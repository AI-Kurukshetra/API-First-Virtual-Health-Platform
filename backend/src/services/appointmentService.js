const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/errors');

const availabilitySchema = z
  .object({
    start_at: z.string().datetime({ offset: true }),
    end_at: z.string().datetime({ offset: true }),
    mode: z.enum(['video', 'in_person']).default('video'),
    notes: z
      .string()
      .trim()
      .max(240, 'Notes must be 240 characters or fewer')
      .optional()
      .or(z.literal(''))
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.start_at);
    const end = new Date(value.end_at);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid availability time range' });
      return;
    }
    if (end.getTime() <= start.getTime()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'End time must be after start time' });
    }
    if (start.getTime() <= Date.now()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Availability must be scheduled in the future' });
    }
  });

const bookSchema = z.object({
  availability_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(240, 'Reason must be 240 characters or fewer')
    .optional()
    .or(z.literal(''))
});

const cancelSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(240, 'Cancellation reason must be 240 characters or fewer')
    .optional()
    .or(z.literal(''))
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

function parseInput(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new AppError(parsed.error.issues[0]?.message || 'Invalid request payload', 422, 'VALIDATION_ERROR');
  }
  return parsed.data;
}

function normalizeText(value) {
  if (value === undefined || value === null) return null;
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

async function getUsersByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, role')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch users', 500, 'USER_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

async function getPaymentsByAppointmentIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('payments')
    .select('id, appointment_id, amount, currency, method, status, transaction_ref, notes, created_at')
    .in('appointment_id', ids);

  if (error) {
    throw new AppError('Unable to fetch payments', 500, 'PAYMENT_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.appointment_id, entry]));
}

async function getVideoVisitsByAppointmentIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('video_visits')
    .select('id, appointment_id, status, ended_at')
    .in('appointment_id', ids);

  if (error) {
    throw new AppError('Unable to fetch video visit states', 500, 'VIDEO_VISIT_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.appointment_id, entry]));
}

async function getPatientsByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, mobile')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch patient details', 500, 'PATIENT_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

async function getAvailabilityByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('appointment_availability')
    .select('id, doctor_id, org_id, start_at, end_at, mode, notes, created_at')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch availability', 500, 'AVAILABILITY_FETCH_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

function sortByStart(left, right) {
  return new Date(left.start_at).getTime() - new Date(right.start_at).getTime();
}

function mapAppointment(
  appointment,
  availabilityMap,
  userMap,
  patientMap,
  paymentMap = {},
  videoVisitMap = {}
) {
  const slot = availabilityMap[appointment.availability_id];
  const doctor = userMap[appointment.doctor_id];
  const patient = patientMap[appointment.patient_id];
  const payment = paymentMap[appointment.id];
  const videoVisit = videoVisitMap[appointment.id];
  const derivedStatus =
    appointment.status === 'booked' && videoVisit?.status === 'ended'
      ? 'completed'
      : appointment.status;

  return {
    id: appointment.id,
    status: derivedStatus,
    reason: appointment.reason,
    created_at: appointment.created_at,
    cancelled_at: appointment.cancelled_at,
    cancellation_reason: appointment.cancellation_reason,
    availability: slot
      ? {
          id: slot.id,
          start_at: slot.start_at,
          end_at: slot.end_at,
          mode: slot.mode,
          notes: slot.notes
        }
      : null,
    doctor: doctor
      ? {
          id: doctor.id,
          full_name: doctor.full_name
        }
      : null,
    patient: patient
      ? {
          id: patient.id,
          full_name: patient.full_name,
          mobile: patient.mobile
        }
      : null,
    payment: payment
      ? {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          status: payment.status,
          transaction_ref: payment.transaction_ref,
          notes: payment.notes,
          created_at: payment.created_at
        }
      : null
  };
}

async function listAppointments(user) {
  const orgId = getOrgId(user);
  const userId = getUserId(user);

  let patientRecord = null;
  if (user.role === 'patient') {
    patientRecord = await getPatientRecord(user);
  } else {
    requireRole(user, ['doctor', 'admin']);
  }

  let request = supabase
    .from('appointments')
    .select('id, availability_id, doctor_id, patient_id, status, reason, created_at, cancelled_at, cancellation_reason')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (user.role === 'patient') {
    request = request.eq('patient_id', patientRecord.id);
  } else if (user.role === 'doctor') {
    request = request.eq('doctor_id', userId);
  }

  const { data, error } = await request;
  if (error) {
    throw new AppError('Unable to fetch appointments', 500, 'APPOINTMENT_LIST_FAILED');
  }

  const appointments = data || [];
  const availabilityMap = await getAvailabilityByIds(appointments.map((entry) => entry.availability_id));
  const doctorMap = await getUsersByIds([...new Set(appointments.map((entry) => entry.doctor_id))]);
  const patientMap = await getPatientsByIds([...new Set(appointments.map((entry) => entry.patient_id))]);
  const paymentMap = await getPaymentsByAppointmentIds(appointments.map((entry) => entry.id));
  const videoVisitMap = await getVideoVisitsByAppointmentIds(appointments.map((entry) => entry.id));

  const hydrated = appointments
    .map((entry) =>
      mapAppointment(entry, availabilityMap, doctorMap, patientMap, paymentMap, videoVisitMap)
    )
    .sort((left, right) => {
      const leftTime = left.availability ? new Date(left.availability.start_at).getTime() : 0;
      const rightTime = right.availability ? new Date(right.availability.start_at).getTime() : 0;
      return leftTime - rightTime;
    });

  return { data: hydrated };
}

async function listAvailability(user) {
  requireRole(user, ['doctor', 'admin']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('appointment_availability')
    .select('id, doctor_id, org_id, start_at, end_at, mode, notes, created_at')
    .eq('org_id', orgId)
    .eq('doctor_id', userId)
    .gte('end_at', nowIso)
    .order('start_at', { ascending: true });

  if (error) {
    throw new AppError('Unable to fetch doctor availability', 500, 'AVAILABILITY_LIST_FAILED');
  }

  const slots = data || [];
  const slotIds = slots.map((entry) => entry.id);
  const { data: slotAppointments, error: bookingError } = await supabase
    .from('appointments')
    .select('id, availability_id, patient_id, reason, status')
    .eq('org_id', orgId)
    .in('status', ['booked', 'completed'])
    .in('availability_id', slotIds.length ? slotIds : ['00000000-0000-0000-0000-000000000000']);

  if (bookingError) {
    throw new AppError('Unable to fetch slot bookings', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  const videoVisitMap = await getVideoVisitsByAppointmentIds((slotAppointments || []).map((entry) => entry.id));
  const bookingMap = Object.fromEntries(
    (slotAppointments || []).map((entry) => {
      const videoVisit = videoVisitMap[entry.id];
      const derivedStatus =
        entry.status === 'booked' && videoVisit?.status === 'ended' ? 'completed' : entry.status;
      return [entry.availability_id, { ...entry, status: derivedStatus }];
    })
  );
  const patientMap = await getPatientsByIds(
    [...new Set((slotAppointments || []).map((entry) => entry.patient_id).filter(Boolean))]
  );

  return {
    data: slots.map((slot) => ({
      id: slot.id,
      start_at: slot.start_at,
      end_at: slot.end_at,
      mode: slot.mode,
      notes: slot.notes,
      status: bookingMap[slot.id]?.status || 'available',
      appointment: bookingMap[slot.id]
        ? {
            id: bookingMap[slot.id].id,
            reason: bookingMap[slot.id].reason,
            patient: patientMap[bookingMap[slot.id].patient_id] || null
          }
        : null
    }))
  };
}

async function createAvailability(user, payload) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const parsed = parseInput(availabilitySchema, payload);

  const { data: overlapping, error: overlapError } = await supabase
    .from('appointment_availability')
    .select('id')
    .eq('org_id', orgId)
    .eq('doctor_id', userId)
    .lt('start_at', parsed.end_at)
    .gt('end_at', parsed.start_at)
    .limit(1);

  if (overlapError) {
    throw new AppError('Unable to validate availability overlap', 500, 'AVAILABILITY_OVERLAP_CHECK_FAILED');
  }

  if ((overlapping || []).length) {
    throw new AppError('This slot overlaps with an existing availability block', 409, 'AVAILABILITY_OVERLAP');
  }

  const { data, error } = await supabase
    .from('appointment_availability')
    .insert({
      org_id: orgId,
      doctor_id: userId,
      start_at: parsed.start_at,
      end_at: parsed.end_at,
      mode: parsed.mode,
      notes: normalizeText(parsed.notes)
    })
    .select('id, doctor_id, org_id, start_at, end_at, mode, notes, created_at')
    .single();

  if (error) {
    throw new AppError('Unable to create availability', 500, 'AVAILABILITY_CREATE_FAILED');
  }

  return { data };
}

async function deleteAvailability(user, id) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);

  const { data: slot, error: slotError } = await supabase
    .from('appointment_availability')
    .select('id')
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('doctor_id', userId)
    .maybeSingle();

  if (slotError) {
    throw new AppError('Unable to validate availability slot', 500, 'AVAILABILITY_LOOKUP_FAILED');
  }

  if (!slot) {
    throw new AppError('Availability slot not found', 404, 'AVAILABILITY_NOT_FOUND');
  }

  const { data: activeBooking, error: bookingError } = await supabase
    .from('appointments')
    .select('id')
    .eq('org_id', orgId)
    .eq('availability_id', id)
    .eq('status', 'booked')
    .maybeSingle();

  if (bookingError) {
    throw new AppError('Unable to validate slot booking state', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  if (activeBooking) {
    throw new AppError('Booked slots cannot be removed. Cancel the appointment first.', 409, 'SLOT_BOOKED');
  }

  const { error } = await supabase
    .from('appointment_availability')
    .delete()
    .eq('id', id)
    .eq('org_id', orgId)
    .eq('doctor_id', userId);

  if (error) {
    throw new AppError('Unable to delete availability', 500, 'AVAILABILITY_DELETE_FAILED');
  }

  return { data: { id } };
}

async function listCatalog(user) {
  requireRole(user, ['patient']);
  const orgId = getOrgId(user);
  const nowIso = new Date().toISOString();

  await getPatientRecord(user);

  const [{ data: doctors, error: doctorError }, { data: slots, error: slotError }] = await Promise.all([
    supabase
      .from('users')
      .select('id, full_name, role')
      .eq('org_id', orgId)
      .eq('role', 'doctor')
      .order('full_name', { ascending: true }),
    supabase
      .from('appointment_availability')
      .select('id, doctor_id, org_id, start_at, end_at, mode, notes, created_at')
      .eq('org_id', orgId)
      .gte('start_at', nowIso)
      .order('start_at', { ascending: true })
  ]);

  if (doctorError) {
    throw new AppError('Unable to fetch doctors', 500, 'DOCTOR_LIST_FAILED');
  }
  if (slotError) {
    throw new AppError('Unable to fetch available slots', 500, 'AVAILABILITY_LIST_FAILED');
  }

  const slotIds = (slots || []).map((entry) => entry.id);
  const { data: bookedAppointments, error: bookingError } = await supabase
    .from('appointments')
    .select('availability_id')
    .eq('org_id', orgId)
    .eq('status', 'booked')
    .in('availability_id', slotIds.length ? slotIds : ['00000000-0000-0000-0000-000000000000']);

  if (bookingError) {
    throw new AppError('Unable to validate booked slots', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  const bookedSet = new Set((bookedAppointments || []).map((entry) => entry.availability_id));
  const grouped = new Map();

  for (const doctor of doctors || []) {
    grouped.set(doctor.id, {
      id: doctor.id,
      full_name: doctor.full_name,
      slots: []
    });
  }

  for (const slot of slots || []) {
    if (bookedSet.has(slot.id)) continue;
    if (!grouped.has(slot.doctor_id)) continue;
    grouped.get(slot.doctor_id).slots.push({
      id: slot.id,
      start_at: slot.start_at,
      end_at: slot.end_at,
      mode: slot.mode,
      notes: slot.notes
    });
  }

  return {
    data: Array.from(grouped.values())
      .map((doctor) => ({
        ...doctor,
        slots: doctor.slots.sort(sortByStart)
      }))
      .filter((doctor) => doctor.slots.length > 0)
  };
}

async function bookAppointment(user, payload) {
  requireRole(user, ['patient']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const patient = await getPatientRecord(user);
  const parsed = parseInput(bookSchema, payload);

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

  const { data, error } = await supabase
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

  if (error) {
    throw new AppError('Unable to book appointment', 500, 'APPOINTMENT_CREATE_FAILED');
  }

  const doctorMap = await getUsersByIds([data.doctor_id]);
  const patientMap = await getPatientsByIds([data.patient_id]);
  const availabilityMap = await getAvailabilityByIds([data.availability_id]);

  return {
    data: mapAppointment(data, availabilityMap, doctorMap, patientMap)
  };
}

async function cancelAppointment(user, id, payload) {
  requireRole(user, ['doctor', 'patient']);
  const orgId = getOrgId(user);
  const userId = getUserId(user);
  const parsed = parseInput(cancelSchema, payload || {});
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;

  const { data: appointment, error: lookupError } = await supabase
    .from('appointments')
    .select('id, availability_id, doctor_id, patient_id, status, reason, created_at, cancelled_at, cancellation_reason')
    .eq('id', id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (lookupError) {
    throw new AppError('Unable to fetch appointment', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  if (!appointment) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
  }

  if (appointment.status !== 'booked') {
    throw new AppError('Only booked appointments can be cancelled', 422, 'APPOINTMENT_STATE_INVALID');
  }

  if (user.role === 'doctor' && appointment.doctor_id !== userId) {
    throw new AppError('You can only manage your own appointments', 403, 'FORBIDDEN');
  }
  if (user.role === 'patient' && appointment.patient_id !== patientRecord.id) {
    throw new AppError('You can only manage your own appointments', 403, 'FORBIDDEN');
  }

  const { data, error } = await supabase
    .from('appointments')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_reason: normalizeText(parsed.reason)
    })
    .eq('id', id)
    .eq('org_id', orgId)
    .select('id, availability_id, doctor_id, patient_id, status, reason, created_at, cancelled_at, cancellation_reason')
    .single();

  if (error) {
    throw new AppError('Unable to cancel appointment', 500, 'APPOINTMENT_CANCEL_FAILED');
  }

  const doctorMap = await getUsersByIds([data.doctor_id]);
  const patientMap = await getPatientsByIds([data.patient_id]);
  const availabilityMap = await getAvailabilityByIds([data.availability_id]);

  return {
    data: mapAppointment(data, availabilityMap, doctorMap, patientMap)
  };
}

module.exports = {
  listAppointments,
  listAvailability,
  createAvailability,
  deleteAvailability,
  listCatalog,
  bookAppointment,
  cancelAppointment
};
