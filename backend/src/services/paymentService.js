const { randomUUID } = require('crypto');
const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/errors');

const checkoutSchema = z.object({
  availability_id: z.string().uuid(),
  reason: z.string().trim().max(240).optional().or(z.literal('')),
  method: z.enum(['upi', 'card', 'cash']),
  amount: z.number().int().positive().optional(),
  notes: z.string().trim().max(240).optional().or(z.literal(''))
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
  const parsed = checkoutSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid payment payload', 422, 'VALIDATION_ERROR');
  }
  return parsed.data;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function getSlotFee(slot) {
  return slot.mode === 'in_person' ? 79900 : 49900;
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

async function getUsersByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch users', 500, 'USER_LOOKUP_FAILED');
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

async function getAvailabilityByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('appointment_availability')
    .select('id, doctor_id, start_at, end_at, mode, notes')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch availability', 500, 'AVAILABILITY_FETCH_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

async function getAppointmentsByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('appointments')
    .select('id, availability_id')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch appointments', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

async function hydratePayments(records) {
  const appointmentMap = await getAppointmentsByIds(records.map((record) => record.appointment_id));
  const availabilityMap = await getAvailabilityByIds(
    [...new Set(Object.values(appointmentMap).map((record) => record?.availability_id).filter(Boolean))]
  );
  const doctorMap = await getUsersByIds([...new Set(records.map((record) => record.doctor_id))]);
  const patientMap = await getPatientsByIds([...new Set(records.map((record) => record.patient_id))]);

  return records.map((record) => ({
    id: record.id,
    appointment_id: record.appointment_id,
    amount: record.amount,
    currency: record.currency,
    method: record.method,
    status: record.status,
    transaction_ref: record.transaction_ref,
    notes: record.notes,
    created_at: record.created_at,
    updated_at: record.updated_at,
    doctor: doctorMap[record.doctor_id]
      ? { id: doctorMap[record.doctor_id].id, full_name: doctorMap[record.doctor_id].full_name }
      : null,
    patient: patientMap[record.patient_id]
      ? {
          id: patientMap[record.patient_id].id,
          full_name: patientMap[record.patient_id].full_name,
          mobile: patientMap[record.patient_id].mobile
        }
      : null,
    availability: availabilityMap[appointmentMap[record.appointment_id]?.availability_id]
      ? {
          id: availabilityMap[appointmentMap[record.appointment_id].availability_id].id,
          start_at: availabilityMap[appointmentMap[record.appointment_id].availability_id].start_at,
          end_at: availabilityMap[appointmentMap[record.appointment_id].availability_id].end_at,
          mode: availabilityMap[appointmentMap[record.appointment_id].availability_id].mode,
          notes: availabilityMap[appointmentMap[record.appointment_id].availability_id].notes
        }
      : null
  }));
}

async function list(user) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;

  let request = supabase
    .from('payments')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (user.role === 'patient') {
    request = request.eq('patient_id', patientRecord.id);
  } else if (user.role === 'doctor') {
    request = request.eq('doctor_id', userId);
  } else {
    requireRole(user, ['doctor', 'admin']);
  }

  const { data, error } = await request;
  if (error) {
    throw new AppError('Unable to fetch payments', 500, 'PAYMENT_LIST_FAILED');
  }

  return { data: await hydratePayments(data || []) };
}

async function checkoutAndBook(user, payload) {
  requireRole(user, ['patient']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patient = await getPatientRecord(user);
  const parsed = parseInput(payload);

  const { data: slot, error: slotError } = await supabase
    .from('appointment_availability')
    .select('id, doctor_id, org_id, start_at, end_at, mode, notes')
    .eq('id', parsed.availability_id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (slotError) {
    throw new AppError('Unable to fetch selected slot', 500, 'AVAILABILITY_LOOKUP_FAILED');
  }
  if (!slot) {
    throw new AppError('Selected slot not found', 404, 'AVAILABILITY_NOT_FOUND');
  }
  if (new Date(slot.start_at).getTime() <= Date.now()) {
    throw new AppError('Selected slot is no longer bookable', 409, 'SLOT_EXPIRED');
  }

  const { data: existing, error: existingError } = await supabase
    .from('appointments')
    .select('id')
    .eq('org_id', orgId)
    .eq('availability_id', parsed.availability_id)
    .eq('status', 'booked')
    .maybeSingle();

  if (existingError) {
    throw new AppError('Unable to validate slot availability', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }
  if (existing) {
    throw new AppError('This slot has already been booked by another patient', 409, 'SLOT_ALREADY_BOOKED');
  }

  const amount = parsed.amount || getSlotFee(slot);

  const { data: appointment, error: appointmentError } = await supabase
    .from('appointments')
    .insert({
      org_id: orgId,
      availability_id: slot.id,
      doctor_id: slot.doctor_id,
      patient_id: patient.id,
      status: 'booked',
      reason: normalizeText(parsed.reason),
      created_by: userId
    })
    .select('id, availability_id, doctor_id, patient_id, status, reason, created_at, cancelled_at, cancellation_reason')
    .single();

  if (appointmentError) {
    throw new AppError('Unable to book appointment', 500, 'APPOINTMENT_CREATE_FAILED');
  }

  const transactionRef = `TXN-${Date.now()}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      org_id: orgId,
      appointment_id: appointment.id,
      doctor_id: appointment.doctor_id,
      patient_id: appointment.patient_id,
      amount,
      currency: 'INR',
      method: parsed.method,
      status: 'paid',
      transaction_ref: transactionRef,
      notes: normalizeText(parsed.notes)
    })
    .select('*')
    .single();

  if (paymentError) {
    await supabase.from('appointments').delete().eq('id', appointment.id).eq('org_id', orgId);
    throw new AppError('Unable to capture payment', 500, 'PAYMENT_CREATE_FAILED');
  }

  const doctorMap = await getUsersByIds([appointment.doctor_id]);
  const patientMap = await getPatientsByIds([appointment.patient_id]);
  const availabilityMap = await getAvailabilityByIds([appointment.availability_id]);

  return {
    data: {
      appointment: {
        id: appointment.id,
        status: appointment.status,
        reason: appointment.reason,
        created_at: appointment.created_at,
        cancelled_at: appointment.cancelled_at,
        cancellation_reason: appointment.cancellation_reason,
        availability: availabilityMap[appointment.availability_id]
          ? {
              id: availabilityMap[appointment.availability_id].id,
              start_at: availabilityMap[appointment.availability_id].start_at,
              end_at: availabilityMap[appointment.availability_id].end_at,
              mode: availabilityMap[appointment.availability_id].mode,
              notes: availabilityMap[appointment.availability_id].notes
            }
          : null,
        doctor: doctorMap[appointment.doctor_id]
          ? { id: doctorMap[appointment.doctor_id].id, full_name: doctorMap[appointment.doctor_id].full_name }
          : null,
        patient: patientMap[appointment.patient_id]
          ? {
              id: patientMap[appointment.patient_id].id,
              full_name: patientMap[appointment.patient_id].full_name,
              mobile: patientMap[appointment.patient_id].mobile
            }
          : null,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          status: payment.status,
          transaction_ref: payment.transaction_ref,
          notes: payment.notes,
          created_at: payment.created_at
        }
      }
    }
  };
}

module.exports = {
  list,
  checkoutAndBook,
  getSlotFee
};
