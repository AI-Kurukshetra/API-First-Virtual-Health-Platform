const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/errors');

const prescriptionSchema = z.object({
  consultation_id: z.string().uuid().optional(),
  notes: z.string().trim().max(3000).optional().or(z.literal('')),
  items: z.array(
    z.object({
      medicine_name: z.string().trim().min(1, 'Medicine name is required').max(120),
      strength: z.string().trim().max(120).optional().or(z.literal('')),
      dosage: z.string().trim().max(120).optional().or(z.literal('')),
      frequency: z.string().trim().max(160).optional().or(z.literal('')),
      duration: z.string().trim().max(120).optional().or(z.literal('')),
      route: z.string().trim().max(120).optional().or(z.literal('')),
      timing: z.string().trim().max(160).optional().or(z.literal('')),
      instructions: z.string().trim().max(500).optional().or(z.literal(''))
    })
  ).min(1, 'Add at least one medicine').max(20).optional()
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

function normalizeText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function parseInput(payload) {
  const parsed = prescriptionSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid prescription payload', 422, 'VALIDATION_ERROR');
  }
  return parsed.data;
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

async function getConsultationById(orgId, id) {
  const { data, error } = await supabase
    .from('consultations')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch consultation', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  return data;
}

async function getAppointmentByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('appointments')
    .select('id, availability_id, doctor_id, patient_id, status, reason')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch appointments', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
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
    .select('id, full_name')
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

async function getPrescriptionItemsByPrescriptionIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('prescription_items')
    .select('*')
    .in('prescription_id', ids)
    .order('sort_order', { ascending: true });

  if (error) {
    throw new AppError('Unable to fetch prescription items', 500, 'PRESCRIPTION_ITEMS_FAILED');
  }

  return (data || []).reduce((acc, item) => {
    if (!acc[item.prescription_id]) acc[item.prescription_id] = [];
    acc[item.prescription_id].push(item);
    return acc;
  }, {});
}

function mapPrescription(record, context) {
  const consultation = context.consultationMap[record.consultation_id];
  const appointment = consultation ? context.appointmentMap[consultation.appointment_id] : null;
  const availability = appointment ? context.availabilityMap[appointment.availability_id] : null;
  const doctor = context.userMap[record.doctor_id];
  const patient = context.patientMap[record.patient_id];
  const items = context.itemMap[record.id] || [];

  return {
    id: record.id,
    consultation_id: record.consultation_id,
    appointment_id: record.appointment_id,
    notes: record.notes,
    created_at: record.created_at,
    updated_at: record.updated_at,
    doctor: doctor ? { id: doctor.id, full_name: doctor.full_name } : null,
    patient: patient ? { id: patient.id, full_name: patient.full_name, mobile: patient.mobile } : null,
    consultation: consultation
      ? {
          id: consultation.id,
          status: consultation.status,
          chief_complaint: consultation.chief_complaint,
          patient_summary: consultation.patient_summary,
          plan: consultation.plan
        }
      : null,
    appointment: appointment
      ? {
          id: appointment.id,
          status: appointment.status,
          reason: appointment.reason,
          availability: availability
            ? {
                id: availability.id,
                start_at: availability.start_at,
                end_at: availability.end_at,
                mode: availability.mode,
                notes: availability.notes
              }
            : null
        }
      : null,
    items: items.map((item) => ({
      id: item.id,
      medicine_name: item.medicine_name,
      strength: item.strength,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      route: item.route,
      timing: item.timing,
      instructions: item.instructions,
      sort_order: item.sort_order
    }))
  };
}

async function hydratePrescriptions(records) {
  const consultationIds = [...new Set(records.map((record) => record.consultation_id))];
  const { data: consultations, error: consultationError } = await supabase
    .from('consultations')
    .select('id, appointment_id, doctor_id, patient_id, status, chief_complaint, patient_summary, plan')
    .in('id', consultationIds);

  if (consultationError) {
    throw new AppError('Unable to fetch consultation context', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  const consultationMap = Object.fromEntries((consultations || []).map((item) => [item.id, item]));
  const appointmentIds = [...new Set((consultations || []).map((item) => item.appointment_id).filter(Boolean))];
  const appointmentMap = await getAppointmentByIds(appointmentIds);
  const availabilityMap = await getAvailabilityByIds(
    [...new Set(Object.values(appointmentMap).map((item) => item?.availability_id).filter(Boolean))]
  );
  const userMap = await getUsersByIds([...new Set(records.map((item) => item.doctor_id))]);
  const patientMap = await getPatientsByIds([...new Set(records.map((item) => item.patient_id))]);
  const itemMap = await getPrescriptionItemsByPrescriptionIds(records.map((record) => record.id));

  return records.map((record) =>
    mapPrescription(record, {
      consultationMap,
      appointmentMap,
      availabilityMap,
      userMap,
      patientMap,
      itemMap
    })
  );
}

async function list(user) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;

  let request = supabase
    .from('prescriptions')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });

  if (user.role === 'patient') {
    request = request.eq('patient_id', patientRecord.id);
  } else if (user.role === 'doctor') {
    request = request.eq('doctor_id', userId);
  } else {
    requireRole(user, ['doctor', 'admin']);
  }

  const { data, error } = await request;
  if (error) {
    throw new AppError('Unable to fetch prescriptions', 500, 'PRESCRIPTION_LIST_FAILED');
  }

  return { data: await hydratePrescriptions(data || []) };
}

async function getById(user, id) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;

  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch prescription', 500, 'PRESCRIPTION_LOOKUP_FAILED');
  }
  if (!data) {
    throw new AppError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND');
  }

  if (user.role === 'doctor' && data.doctor_id !== userId) {
    throw new AppError('You can only access your own prescriptions', 403, 'FORBIDDEN');
  }
  if (user.role === 'patient' && data.patient_id !== patientRecord.id) {
    throw new AppError('You can only access your own prescriptions', 403, 'FORBIDDEN');
  }

  const [hydrated] = await hydratePrescriptions([data]);
  return { data: hydrated };
}

async function getByConsultation(user, consultationId) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;
  const consultation = await getConsultationById(orgId, consultationId);

  if (!consultation) {
    throw new AppError('Consultation not found', 404, 'CONSULTATION_NOT_FOUND');
  }
  if (user.role === 'doctor' && consultation.doctor_id !== userId) {
    throw new AppError('You can only access your own prescriptions', 403, 'FORBIDDEN');
  }
  if (user.role === 'patient' && consultation.patient_id !== patientRecord.id) {
    throw new AppError('You can only access your own prescriptions', 403, 'FORBIDDEN');
  }

  const { data, error } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('org_id', orgId)
    .eq('consultation_id', consultationId)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch prescription', 500, 'PRESCRIPTION_LOOKUP_FAILED');
  }
  if (!data) {
    return { data: null };
  }

  const [hydrated] = await hydratePrescriptions([data]);
  return { data: hydrated };
}

async function create(user, payload) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const parsed = parseInput(payload);

  if (!parsed.consultation_id) {
    throw new AppError('consultation_id is required', 422, 'VALIDATION_ERROR');
  }
  if (!parsed.items?.length) {
    throw new AppError('Add at least one medicine', 422, 'VALIDATION_ERROR');
  }

  const consultation = await getConsultationById(orgId, parsed.consultation_id);
  if (!consultation) {
    throw new AppError('Consultation not found', 404, 'CONSULTATION_NOT_FOUND');
  }
  if (consultation.doctor_id !== userId) {
    throw new AppError('You can only create prescriptions for your own consultations', 403, 'FORBIDDEN');
  }

  const { data: existing, error: existingError } = await supabase
    .from('prescriptions')
    .select('id')
    .eq('org_id', orgId)
    .eq('consultation_id', parsed.consultation_id)
    .maybeSingle();

  if (existingError) {
    throw new AppError('Unable to validate prescription uniqueness', 500, 'PRESCRIPTION_LOOKUP_FAILED');
  }
  if (existing) {
    throw new AppError('A prescription already exists for this consultation', 409, 'PRESCRIPTION_EXISTS');
  }

  const record = {
    org_id: orgId,
    consultation_id: consultation.id,
    appointment_id: consultation.appointment_id,
    doctor_id: consultation.doctor_id,
    patient_id: consultation.patient_id,
    notes: normalizeText(parsed.notes) || null
  };

  const { data: created, error: createError } = await supabase
    .from('prescriptions')
    .insert(record)
    .select('*')
    .single();

  if (createError) {
    throw new AppError('Unable to create prescription', 500, 'PRESCRIPTION_CREATE_FAILED');
  }

  const items = parsed.items.map((item, index) => ({
    prescription_id: created.id,
    medicine_name: item.medicine_name.trim(),
    strength: normalizeText(item.strength) || null,
    dosage: normalizeText(item.dosage) || null,
    frequency: normalizeText(item.frequency) || null,
    duration: normalizeText(item.duration) || null,
    route: normalizeText(item.route) || null,
    timing: normalizeText(item.timing) || null,
    instructions: normalizeText(item.instructions) || null,
    sort_order: index
  }));

  const { error: itemError } = await supabase.from('prescription_items').insert(items);
  if (itemError) {
    throw new AppError('Unable to create prescription items', 500, 'PRESCRIPTION_ITEMS_FAILED');
  }

  const [hydrated] = await hydratePrescriptions([created]);
  return { data: hydrated };
}

async function update(user, id, payload) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const parsed = parseInput(payload);

  const { data: existing, error: lookupError } = await supabase
    .from('prescriptions')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (lookupError) {
    throw new AppError('Unable to fetch prescription', 500, 'PRESCRIPTION_LOOKUP_FAILED');
  }
  if (!existing) {
    throw new AppError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND');
  }
  if (existing.doctor_id !== userId) {
    throw new AppError('You can only update your own prescriptions', 403, 'FORBIDDEN');
  }

  const updates = {
    notes: normalizeText(parsed.notes),
    updated_at: new Date().toISOString()
  };
  const filtered = Object.fromEntries(Object.entries(updates).filter(([, value]) => value !== undefined));

  const { data: updated, error: updateError } = await supabase
    .from('prescriptions')
    .update(filtered)
    .eq('org_id', orgId)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    throw new AppError('Unable to update prescription', 500, 'PRESCRIPTION_UPDATE_FAILED');
  }

  if (parsed.items) {
    const { error: deleteError } = await supabase
      .from('prescription_items')
      .delete()
      .eq('prescription_id', id);

    if (deleteError) {
      throw new AppError('Unable to refresh prescription items', 500, 'PRESCRIPTION_ITEMS_FAILED');
    }

    const items = parsed.items.map((item, index) => ({
      prescription_id: id,
      medicine_name: item.medicine_name.trim(),
      strength: normalizeText(item.strength) || null,
      dosage: normalizeText(item.dosage) || null,
      frequency: normalizeText(item.frequency) || null,
      duration: normalizeText(item.duration) || null,
      route: normalizeText(item.route) || null,
      timing: normalizeText(item.timing) || null,
      instructions: normalizeText(item.instructions) || null,
      sort_order: index
    }));

    const { error: insertError } = await supabase.from('prescription_items').insert(items);
    if (insertError) {
      throw new AppError('Unable to save prescription items', 500, 'PRESCRIPTION_ITEMS_FAILED');
    }
  }

  const [hydrated] = await hydratePrescriptions([updated]);
  return { data: hydrated };
}

module.exports = {
  list,
  getById,
  getByConsultation,
  create,
  update
};
