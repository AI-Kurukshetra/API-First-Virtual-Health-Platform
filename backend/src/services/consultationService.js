const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/errors');

const consultationSchema = z.object({
  appointment_id: z.string().uuid().optional(),
  status: z.enum(['draft', 'finalized']).optional(),
  chief_complaint: z.string().trim().max(240).optional().or(z.literal('')),
  subjective_note: z.string().trim().max(5000).optional().or(z.literal('')),
  objective_note: z.string().trim().max(5000).optional().or(z.literal('')),
  assessment: z.string().trim().max(5000).optional().or(z.literal('')),
  plan: z.string().trim().max(5000).optional().or(z.literal('')),
  patient_summary: z.string().trim().max(5000).optional().or(z.literal('')),
  ai_draft_note: z.string().trim().max(5000).optional().or(z.literal(''))
});

function getOrgId(user) {
  if (!user?.org_id) {
    throw new AppError('Organisation not set for user', 403, 'ORG_REQUIRED');
  }
  return user.org_id;
}

function getUserId(user) {
  const userId = user?.sub || user?.id;
  if (!userId) {
    throw new AppError('User identity missing from token', 401, 'AUTH_INVALID');
  }
  return userId;
}

function requireRole(user, roles) {
  if (!roles.includes(user?.role)) {
    throw new AppError('You are not allowed to access this resource', 403, 'FORBIDDEN');
  }
}

function parseInput(payload) {
  const parsed = consultationSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid consultation payload', 422, 'VALIDATION_ERROR');
  }
  return parsed.data;
}

function normalizeText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

async function getPatientRecord(user) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, user_id')
    .eq('org_id', orgId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch patient profile', 500, 'PATIENT_PROFILE_FAILED');
  }

  if (!data) {
    throw new AppError('Linked patient profile not found for this user', 403, 'PATIENT_PROFILE_REQUIRED');
  }

  return data;
}

async function getAppointmentById(orgId, id) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, availability_id, doctor_id, patient_id, status, reason, created_at, cancelled_at, cancellation_reason')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch appointment', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  return data;
}

async function getAvailabilityByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('appointment_availability')
    .select('id, start_at, end_at, mode, notes')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch appointment slots', 500, 'AVAILABILITY_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

async function getUsersByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch doctors', 500, 'USER_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

async function getPatientsByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, mobile')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch patients', 500, 'PATIENT_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

function mapConsultation(consultation, appointmentMap, availabilityMap, userMap, patientMap, forPatient = false) {
  const appointment = appointmentMap[consultation.appointment_id];
  const slot = appointment ? availabilityMap[appointment.availability_id] : null;
  const doctor = userMap[consultation.doctor_id];
  const patient = patientMap[consultation.patient_id];

  const base = {
    id: consultation.id,
    appointment_id: consultation.appointment_id,
    status: consultation.status,
    created_at: consultation.created_at,
    updated_at: consultation.updated_at,
    chief_complaint: consultation.chief_complaint,
    patient_summary: consultation.patient_summary,
    doctor: doctor ? { id: doctor.id, full_name: doctor.full_name } : null,
    patient: patient ? { id: patient.id, full_name: patient.full_name, mobile: patient.mobile } : null,
    appointment: appointment
      ? {
          id: appointment.id,
          status: appointment.status,
          reason: appointment.reason,
          availability: slot
            ? {
                id: slot.id,
                start_at: slot.start_at,
                end_at: slot.end_at,
                mode: slot.mode,
                notes: slot.notes
              }
            : null
        }
      : null
  };

  if (forPatient) {
    return {
      ...base,
      plan: consultation.plan
    };
  }

  return {
    ...base,
    subjective_note: consultation.subjective_note,
    objective_note: consultation.objective_note,
    assessment: consultation.assessment,
    plan: consultation.plan,
    ai_draft_note: consultation.ai_draft_note
  };
}

async function hydrateConsultations(consultations, { forPatient = false } = {}) {
  const appointmentMap = Object.fromEntries(
    (await Promise.all(
      consultations.map(async (item) => [item.appointment_id, await getAppointmentById(item.org_id, item.appointment_id)])
    )).map(([id, appointment]) => [id, appointment])
  );

  const availabilityIds = Object.values(appointmentMap)
    .map((appointment) => appointment?.availability_id)
    .filter(Boolean);
  const availabilityMap = await getAvailabilityByIds([...new Set(availabilityIds)]);
  const userMap = await getUsersByIds([...new Set(consultations.map((item) => item.doctor_id))]);
  const patientMap = await getPatientsByIds([...new Set(consultations.map((item) => item.patient_id))]);

  return consultations.map((consultation) =>
    mapConsultation(consultation, appointmentMap, availabilityMap, userMap, patientMap, forPatient)
  );
}

async function list(user) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);

  let patientRecord = null;
  if (user.role === 'patient') {
    patientRecord = await getPatientRecord(user);
  } else {
    requireRole(user, ['doctor', 'admin']);
  }

  let request = supabase
    .from('consultations')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (user.role === 'patient') {
    request = request.eq('patient_id', patientRecord.id);
  } else if (user.role === 'doctor') {
    request = request.eq('doctor_id', userId);
  }

  const { data, error } = await request;
  if (error) {
    throw new AppError('Unable to fetch consultations', 500, 'CONSULTATION_LIST_FAILED');
  }

  return {
    data: await hydrateConsultations(data || [], { forPatient: user.role === 'patient' })
  };
}

async function getById(user, id) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;

  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch consultation', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  if (!data) {
    throw new AppError('Consultation not found', 404, 'CONSULTATION_NOT_FOUND');
  }

  if (user.role === 'doctor' && data.doctor_id !== userId) {
    throw new AppError('You can only access your own consultation records', 403, 'FORBIDDEN');
  }

  if (user.role === 'patient' && data.patient_id !== patientRecord.id) {
    throw new AppError('You can only access your own consultation records', 403, 'FORBIDDEN');
  }

  const [hydrated] = await hydrateConsultations([data], { forPatient: user.role === 'patient' });
  return { data: hydrated };
}

async function getByAppointment(user, appointmentId) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;
  const appointment = await getAppointmentById(orgId, appointmentId);

  if (!appointment) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
  }

  if (user.role === 'doctor' && appointment.doctor_id !== userId) {
    throw new AppError('You can only access your own appointment consultations', 403, 'FORBIDDEN');
  }
  if (user.role === 'patient' && appointment.patient_id !== patientRecord.id) {
    throw new AppError('You can only access your own appointment consultations', 403, 'FORBIDDEN');
  }

  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .eq('org_id', orgId)
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch consultation', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  if (!data) {
    return { data: null };
  }

  const [hydrated] = await hydrateConsultations([data], { forPatient: user.role === 'patient' });
  return { data: hydrated };
}

async function create(user, payload) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const parsed = parseInput(payload);

  if (!parsed.appointment_id) {
    throw new AppError('appointment_id is required', 422, 'VALIDATION_ERROR');
  }

  const appointment = await getAppointmentById(orgId, parsed.appointment_id);
  if (!appointment) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
  }

  if (appointment.doctor_id !== userId) {
    throw new AppError('You can only create consultations for your own appointments', 403, 'FORBIDDEN');
  }

  const { data: existing, error: existingError } = await supabase
    .from('consultations')
    .select('id')
    .eq('org_id', orgId)
    .eq('appointment_id', parsed.appointment_id)
    .maybeSingle();

  if (existingError) {
    throw new AppError('Unable to validate consultation uniqueness', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  if (existing) {
    throw new AppError('A consultation already exists for this appointment', 409, 'CONSULTATION_EXISTS');
  }

  const record = {
    org_id: orgId,
    appointment_id: parsed.appointment_id,
    doctor_id: appointment.doctor_id,
    patient_id: appointment.patient_id,
    status: parsed.status || 'draft',
    chief_complaint: normalizeText(parsed.chief_complaint) || null,
    subjective_note: normalizeText(parsed.subjective_note) || null,
    objective_note: normalizeText(parsed.objective_note) || null,
    assessment: normalizeText(parsed.assessment) || null,
    plan: normalizeText(parsed.plan) || null,
    patient_summary: normalizeText(parsed.patient_summary) || null,
    ai_draft_note: normalizeText(parsed.ai_draft_note) || null
  };

  const { data, error } = await supabase
    .from('consultations')
    .insert(record)
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to create consultation', 500, 'CONSULTATION_CREATE_FAILED');
  }

  const [hydrated] = await hydrateConsultations([data]);
  return { data: hydrated };
}

async function update(user, id, payload) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const parsed = parseInput(payload);

  const { data: existing, error: lookupError } = await supabase
    .from('consultations')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (lookupError) {
    throw new AppError('Unable to fetch consultation', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  if (!existing) {
    throw new AppError('Consultation not found', 404, 'CONSULTATION_NOT_FOUND');
  }

  if (existing.doctor_id !== userId) {
    throw new AppError('You can only update your own consultation records', 403, 'FORBIDDEN');
  }

  const updates = {
    status: parsed.status,
    chief_complaint: normalizeText(parsed.chief_complaint),
    subjective_note: normalizeText(parsed.subjective_note),
    objective_note: normalizeText(parsed.objective_note),
    assessment: normalizeText(parsed.assessment),
    plan: normalizeText(parsed.plan),
    patient_summary: normalizeText(parsed.patient_summary),
    ai_draft_note: normalizeText(parsed.ai_draft_note),
    updated_at: new Date().toISOString()
  };

  const filtered = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined)
  );

  if (!Object.keys(filtered).length) {
    throw new AppError('No consultation fields provided', 422, 'NO_FIELDS');
  }

  const { data, error } = await supabase
    .from('consultations')
    .update(filtered)
    .eq('org_id', orgId)
    .eq('id', id)
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to update consultation', 500, 'CONSULTATION_UPDATE_FAILED');
  }

  const [hydrated] = await hydrateConsultations([data]);
  return { data: hydrated };
}

module.exports = {
  list,
  getById,
  getByAppointment,
  create,
  update
};
