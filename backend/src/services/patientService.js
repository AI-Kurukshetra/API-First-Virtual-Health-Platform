const supabase = require('../config/supabase');
const { z } = require('zod');
const { AppError } = require('../utils/errors');

const mobileRegex = /^\+[1-9]\d{9,14}$/;
const bloodGroupRegex = /^(A|B|AB|O)[+-]$/;
const genderValues = ['male', 'female', 'other', 'prefer_not_to_say'];

function isValidDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime());
}

function isFutureDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() > today.getTime();
}

function normalizeMobile(value) {
  const cleaned = String(value || '').replace(/[^\d+]/g, '');
  if (!cleaned) return '';

  if (cleaned.startsWith('+')) {
    return `+${cleaned.slice(1).replace(/\D/g, '')}`;
  }

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.startsWith('91') && digits.length === 12) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

function optionalTrimmedString(maxLength) {
  return z.preprocess((value) => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const trimmed = String(value).trim();
    return trimmed === '' ? null : trimmed;
  }, z.union([z.string().max(maxLength), z.null()]));
}

const addressSchema = z
  .object({
    line1: optionalTrimmedString(160).optional(),
    city: optionalTrimmedString(80).optional(),
    state: optionalTrimmedString(80).optional(),
    pincode: z.preprocess((value) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    }, z.union([z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'), z.null()])).optional()
  })
  .transform((value) => {
    const normalized = Object.fromEntries(
      Object.entries(value).filter(([, entry]) => entry !== undefined && entry !== null)
    );
    return Object.keys(normalized).length ? normalized : null;
  })
  .nullable();

const patientCreateSchema = z.object({
  full_name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(120),
  mobile: z
    .string()
    .transform(normalizeMobile)
    .refine((value) => mobileRegex.test(value), 'Mobile number must be a valid phone number'),
  date_of_birth: z
    .string()
    .refine(isValidDateOnly, 'Date of birth must be in YYYY-MM-DD format')
    .refine((value) => !isFutureDate(value), 'Date of birth cannot be in the future'),
  gender: z.enum(genderValues),
  user_id: z.string().uuid().nullable().optional(),
  email: optionalTrimmedString(120)
    .optional()
    .refine((value) => value === undefined || value === null || z.string().email().safeParse(value).success, {
      message: 'Email must be valid'
    }),
  abha_id: optionalTrimmedString(40).optional(),
  blood_group: optionalTrimmedString(3)
    .optional()
    .transform((value) => (typeof value === 'string' ? value.toUpperCase() : value))
    .refine((value) => value === undefined || value === null || bloodGroupRegex.test(value), {
      message: 'Blood group must be one of A+, A-, B+, B-, AB+, AB-, O+, O-'
    }),
  ai_consent: z.coerce.boolean().optional().default(false),
  address: addressSchema.optional()
});

const patientUpdateSchema = patientCreateSchema.partial();

function parsePatientPayload(schema, payload) {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message || 'Invalid patient payload', 422, 'VALIDATION_ERROR');
  }
  return result.data;
}

function getOrgId(user) {
  if (!user || !user.org_id) {
    throw new AppError('Organisation not set for user', 403, 'ORG_REQUIRED');
  }
  return user.org_id;
}

async function getUserByMobile(mobile) {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, mobile, email, role, org_id')
    .eq('mobile', mobile)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to validate patient login user', 500, 'USER_LOOKUP_FAILED');
  }

  return data;
}

async function createPatientUser({ orgId, full_name, mobile, email }) {
  const { data, error } = await supabase
    .from('users')
    .insert({
      full_name,
      mobile,
      email: email || null,
      role: 'patient',
      org_id: orgId,
      profile: { source: 'doctor_created_patient' }
    })
    .select('id, full_name, mobile, email, role, org_id')
    .single();

  if (error) {
    throw new AppError('Unable to create patient login account', 500, 'PATIENT_USER_CREATE_FAILED');
  }

  return data;
}

async function ensurePatientUser({ orgId, full_name, mobile, email, requestedUserId = null }) {
  if (requestedUserId) {
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, mobile, email, role, org_id')
      .eq('id', requestedUserId)
      .maybeSingle();

    if (error) {
      throw new AppError('Unable to validate linked patient user', 500, 'USER_LOOKUP_FAILED');
    }

    if (!data) {
      throw new AppError('Linked patient user not found', 404, 'USER_NOT_FOUND');
    }

    if (data.role !== 'patient') {
      throw new AppError('Linked user must have patient role', 422, 'USER_ROLE_INVALID');
    }

    if (data.org_id !== orgId) {
      throw new AppError('Linked user belongs to a different organisation', 422, 'USER_ORG_MISMATCH');
    }

    return data;
  }

  const existingUser = await getUserByMobile(mobile);
  if (!existingUser) {
    return createPatientUser({ orgId, full_name, mobile, email });
  }

  if (existingUser.role !== 'patient') {
    throw new AppError('This mobile number already belongs to a non-patient user', 409, 'MOBILE_ALREADY_IN_USE');
  }

  if (existingUser.org_id !== orgId) {
    throw new AppError('This mobile number belongs to another organisation', 409, 'MOBILE_ALREADY_IN_USE');
  }

  const { data, error } = await supabase
    .from('users')
    .update({
      full_name,
      email: email || null
    })
    .eq('id', existingUser.id)
    .select('id, full_name, mobile, email, role, org_id')
    .single();

  if (error) {
    throw new AppError('Unable to sync patient login account', 500, 'PATIENT_USER_SYNC_FAILED');
  }

  return data;
}

async function syncPatientUser(userId, updates) {
  const allowed = {
    full_name: updates.full_name,
    mobile: updates.mobile,
    email: updates.email
  };

  const payload = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined)
  );

  if (!Object.keys(payload).length) {
    return null;
  }

  if (payload.email === null) {
    payload.email = null;
  }

  const { data, error } = await supabase
    .from('users')
    .update(payload)
    .eq('id', userId)
    .eq('role', 'patient')
    .select('id')
    .single();

  if (error) {
    throw new AppError('Unable to sync patient login account', 500, 'PATIENT_USER_SYNC_FAILED');
  }

  return data;
}

function normalizeSearch(search) {
  if (!search) return null;
  return `%${search.trim()}%`;
}

async function list(user, query) {
  const orgId = getOrgId(user);
  const limit = Math.min(Number(query.limit || 20), 50);
  const cursor = Number(query.cursor || 0);
  const search = normalizeSearch(query.search);

  let request = supabase
    .from('patients')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(cursor, cursor + limit - 1);

  if (search) {
    request = request.or(`full_name.ilike.${search},mobile.ilike.${search}`);
  }

  const { data, error, count } = await request;
  if (error) {
    throw new AppError('Unable to fetch patients', 500, 'PATIENT_LIST_FAILED');
  }

  return {
    data,
    meta: {
      limit,
      cursor,
      total: count || 0
    }
  };
}

async function create(user, payload) {
  const orgId = getOrgId(user);
  const parsed = parsePatientPayload(patientCreateSchema, payload);
  const patientUser = await ensurePatientUser({
    orgId,
    full_name: parsed.full_name,
    mobile: parsed.mobile,
    email: parsed.email,
    requestedUserId: parsed.user_id || null
  });

  const record = {
    org_id: orgId,
    user_id: patientUser.id,
    full_name: parsed.full_name,
    date_of_birth: parsed.date_of_birth,
    gender: parsed.gender,
    mobile: parsed.mobile,
    email: parsed.email || null,
    abha_id: parsed.abha_id || null,
    blood_group: parsed.blood_group || null,
    ai_consent: Boolean(parsed.ai_consent),
    address: parsed.address || null
  };

  const { data, error } = await supabase
    .from('patients')
    .insert(record)
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to create patient', 500, 'PATIENT_CREATE_FAILED');
  }

  return { data };
}

async function getById(user, id) {
  const orgId = getOrgId(user);
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (error) {
    throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
  }

  return { data };
}

async function update(user, id, payload) {
  const orgId = getOrgId(user);
  const parsed = parsePatientPayload(patientUpdateSchema, payload);
  const { data: existingPatient, error: existingPatientError } = await supabase
    .from('patients')
    .select('id, user_id, full_name, mobile, email')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (existingPatientError || !existingPatient) {
    throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
  }

  const nextFullName = parsed.full_name ?? existingPatient.full_name;
  const nextMobile = parsed.mobile ?? existingPatient.mobile;
  const nextEmail = parsed.email !== undefined ? parsed.email : existingPatient.email;

  if (existingPatient.user_id) {
    const mobileOwner = parsed.mobile ? await getUserByMobile(parsed.mobile) : null;
    if (mobileOwner && mobileOwner.id !== existingPatient.user_id) {
      throw new AppError('This mobile number is already linked to another login user', 409, 'MOBILE_ALREADY_IN_USE');
    }

    await syncPatientUser(existingPatient.user_id, {
      full_name: nextFullName,
      mobile: nextMobile,
      email: nextEmail
    });
  } else {
    const patientUser = await ensurePatientUser({
      orgId,
      full_name: nextFullName,
      mobile: nextMobile,
      email: nextEmail,
      requestedUserId: null
    });
    parsed.user_id = patientUser.id;
  }

  const allowed = {
    user_id: parsed.user_id,
    full_name: parsed.full_name,
    date_of_birth: parsed.date_of_birth,
    gender: parsed.gender,
    mobile: parsed.mobile,
    email: parsed.email,
    abha_id: parsed.abha_id,
    blood_group: parsed.blood_group,
    ai_consent: parsed.ai_consent,
    address: parsed.address
  };

  const updates = Object.fromEntries(
    Object.entries(allowed).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(updates).length === 0) {
    throw new AppError('No fields provided', 422, 'NO_FIELDS');
  }

  const { data, error } = await supabase
    .from('patients')
    .update(updates)
    .eq('id', id)
    .eq('org_id', orgId)
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to update patient', 500, 'PATIENT_UPDATE_FAILED');
  }

  return { data };
}

async function remove(user, id) {
  const orgId = getOrgId(user);
  const { error, count } = await supabase
    .from('patients')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) {
    throw new AppError('Unable to delete patient', 500, 'PATIENT_DELETE_FAILED');
  }

  if (!count) {
    throw new AppError('Patient not found', 404, 'PATIENT_NOT_FOUND');
  }

  return { data: { id } };
}

module.exports = {
  list,
  create,
  getById,
  update,
  remove
};
