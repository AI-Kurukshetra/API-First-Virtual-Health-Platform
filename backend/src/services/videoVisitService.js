const { z } = require('zod');
const supabase = require('../config/supabase');
const { AppError } = require('../utils/errors');

const signalSchema = z.object({
  recipient_role: z.enum(['doctor', 'patient']),
  kind: z.enum(['ready', 'offer', 'answer', 'ice-candidate', 'leave']),
  payload: z.record(z.any()).default({})
});

const presenceSchema = z.object({
  action: z.enum(['join', 'leave', 'end'])
});

const transcriptSchema = z.object({
  transcript_text: z.string().trim().max(20000).optional().or(z.literal(''))
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

async function getPatientById(orgId, id) {
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, mobile, gender, date_of_birth, blood_group')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch patient profile', 500, 'PATIENT_LOOKUP_FAILED');
  }

  return data;
}

async function getAvailabilityByIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('appointment_availability')
    .select('id, doctor_id, start_at, end_at, mode, notes')
    .in('id', ids);

  if (error) {
    throw new AppError('Unable to fetch availability', 500, 'AVAILABILITY_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.id, entry]));
}

async function getConsultationsByAppointmentIds(ids) {
  if (!ids.length) return {};
  const { data, error } = await supabase
    .from('consultations')
    .select('id, appointment_id, status, chief_complaint, patient_summary, plan, ai_draft_note')
    .in('appointment_id', ids);

  if (error) {
    throw new AppError('Unable to fetch consultations', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  return Object.fromEntries((data || []).map((entry) => [entry.appointment_id, entry]));
}

async function getLatestPriorConsultation(orgId, patientId, currentAppointmentId) {
  const { data, error } = await supabase
    .from('consultations')
    .select('id, appointment_id, status, chief_complaint, patient_summary, plan, assessment, created_at')
    .eq('org_id', orgId)
    .eq('patient_id', patientId)
    .neq('appointment_id', currentAppointmentId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch consultation history', 500, 'CONSULTATION_LOOKUP_FAILED');
  }

  return data;
}

async function getAppointmentById(orgId, id) {
  const { data, error } = await supabase
    .from('appointments')
    .select('id, availability_id, doctor_id, patient_id, status, reason, created_at')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch appointment', 500, 'APPOINTMENT_LOOKUP_FAILED');
  }

  return data;
}

async function getVisitById(orgId, id) {
  const { data, error } = await supabase
    .from('video_visits')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw new AppError('Unable to fetch video visit', 500, 'VIDEO_VISIT_LOOKUP_FAILED');
  }

  return data;
}

function formatVisitDate(value) {
  if (!value) return 'the scheduled visit';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'the scheduled visit';
  return parsed.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildAiDraft({ appointment, availability, patient, previousConsultation }) {
  const chiefComplaint = appointment.reason || previousConsultation?.chief_complaint || 'Follow-up consultation';
  const visitLabel = formatVisitDate(availability?.start_at);
  const patientDescriptor = [
    patient?.full_name || 'The patient',
    patient?.gender ? patient.gender.toLowerCase() : null,
    patient?.blood_group ? `blood group ${patient.blood_group}` : null
  ]
    .filter(Boolean)
    .join(', ');
  const previousSummary = previousConsultation?.patient_summary || previousConsultation?.assessment || '';
  const followUpContext = previousSummary
    ? ` Previous consultation context: ${previousSummary}`
    : '';

  const subjective = `${patientDescriptor || 'The patient'} presented for a ${
    availability?.mode === 'video' ? 'video' : 'scheduled'
  } review on ${visitLabel} regarding ${chiefComplaint.toLowerCase()}.${followUpContext}`.trim();

  const objective = availability?.mode === 'video'
    ? 'Virtual examination performed over secure video consultation. Visual assessment was completed remotely; no in-person vitals were captured during this encounter.'
    : 'Encounter reviewed in the consultation workflow with available visit details and prior records.';

  const assessment = previousConsultation?.assessment
    ? `Current visit appears related to ongoing care for ${chiefComplaint.toLowerCase()}. Prior assessment suggests ${previousConsultation.assessment.toLowerCase()}.`
    : `Current consultation is centered on ${chiefComplaint.toLowerCase()} and requires clinician review of symptoms, progression, and response to prior care.`;

  const plan = previousConsultation?.plan
    ? `Review the current response to the previous care plan, confirm symptom progression, update treatment if required, and document follow-up guidance. Prior plan reference: ${previousConsultation.plan}`
    : 'Review symptom progression, confirm the working diagnosis, document treatment advice, and schedule follow-up if symptoms persist or worsen.';

  const patientSummary = `This visit focused on ${chiefComplaint.toLowerCase()}. Your doctor reviewed the concern, assessed the next steps, and will finalize the consultation guidance in your chart.`;

  return {
    chief_complaint: chiefComplaint,
    subjective_note: subjective,
    objective_note: objective,
    assessment,
    plan,
    patient_summary: patientSummary,
    ai_draft_note: [
      `Chief complaint: ${chiefComplaint}`,
      `Subjective: ${subjective}`,
      `Objective: ${objective}`,
      `Assessment: ${assessment}`,
      `Plan: ${plan}`
    ].join('\n')
  };
}

function canAccessVisit(user, appointment, patientRecord) {
  const userId = getUserId(user);
  if (user.role === 'doctor' && appointment.doctor_id !== userId) {
    throw new AppError('You can only access your own video visits', 403, 'FORBIDDEN');
  }
  if (user.role === 'patient' && appointment.patient_id !== patientRecord.id) {
    throw new AppError('You can only access your own video visits', 403, 'FORBIDDEN');
  }
}

async function hydrateVisits(visits, user) {
  const appointmentIds = [...new Set(visits.map((entry) => entry.appointment_id))];
  const appointmentPairs = await Promise.all(
    appointmentIds.map(async (id) => [id, await getAppointmentById(getOrgId(user), id)])
  );
  const appointmentMap = Object.fromEntries(appointmentPairs);
  const availabilityMap = await getAvailabilityByIds(
    [...new Set(Object.values(appointmentMap).map((entry) => entry?.availability_id).filter(Boolean))]
  );
  const userMap = await getUsersByIds([...new Set(visits.map((entry) => entry.doctor_id))]);
  const patientMap = await getPatientsByIds([...new Set(visits.map((entry) => entry.patient_id))]);
  const consultationMap = await getConsultationsByAppointmentIds(appointmentIds);

  return visits.map((visit) => {
    const appointment = appointmentMap[visit.appointment_id];
    const availability = appointment ? availabilityMap[appointment.availability_id] : null;
    const doctor = userMap[visit.doctor_id];
    const patient = patientMap[visit.patient_id];
    const consultation = consultationMap[visit.appointment_id] || null;

    return {
      id: visit.id,
      status: visit.status,
      doctor_online: visit.doctor_online,
      patient_online: visit.patient_online,
      doctor_joined_at: visit.doctor_joined_at,
      patient_joined_at: visit.patient_joined_at,
      started_at: visit.started_at,
      ended_at: visit.ended_at,
      transcript_text: visit.transcript_text || '',
      ai_note_payload: visit.ai_note_payload || null,
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
      consultation,
      doctor: doctor ? { id: doctor.id, full_name: doctor.full_name } : null,
      patient: patient ? { id: patient.id, full_name: patient.full_name, mobile: patient.mobile } : null
    };
  });
}

async function getOrCreateByAppointment(user, appointmentId) {
  requireRole(user, ['doctor', 'patient']);
  const orgId = getOrgId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;
  const appointment = await getAppointmentById(orgId, appointmentId);

  if (!appointment) {
    throw new AppError('Appointment not found', 404, 'APPOINTMENT_NOT_FOUND');
  }
  if (appointment.status !== 'booked') {
    throw new AppError('Video visit is only available for booked appointments', 422, 'APPOINTMENT_STATE_INVALID');
  }
  canAccessVisit(user, appointment, patientRecord);

  const availabilityMap = await getAvailabilityByIds([appointment.availability_id]);
  const slot = availabilityMap[appointment.availability_id];
  if (!slot || slot.mode !== 'video') {
    throw new AppError('This appointment is not configured as a video consultation', 422, 'VIDEO_MODE_REQUIRED');
  }

  const { data: existing, error: lookupError } = await supabase
    .from('video_visits')
    .select('*')
    .eq('org_id', orgId)
    .eq('appointment_id', appointmentId)
    .maybeSingle();

  if (lookupError) {
    throw new AppError('Unable to fetch video visit', 500, 'VIDEO_VISIT_LOOKUP_FAILED');
  }

  let visit = existing;
  if (!visit) {
    const { data, error } = await supabase
      .from('video_visits')
      .insert({
        org_id: orgId,
        appointment_id: appointment.id,
        doctor_id: appointment.doctor_id,
        patient_id: appointment.patient_id,
        status: 'waiting'
      })
      .select('*')
      .single();

    if (error) {
      throw new AppError('Unable to create video visit room', 500, 'VIDEO_VISIT_CREATE_FAILED');
    }
    visit = data;
  }

  const [hydrated] = await hydrateVisits([visit], user);
  return { data: hydrated };
}

async function updatePresence(user, visitId, payload) {
  requireRole(user, ['doctor', 'patient']);
  const orgId = getOrgId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;
  const parsed = parseInput(presenceSchema, payload);
  const visit = await getVisitById(orgId, visitId);

  if (!visit) {
    throw new AppError('Video visit not found', 404, 'VIDEO_VISIT_NOT_FOUND');
  }

  const appointment = await getAppointmentById(orgId, visit.appointment_id);
  canAccessVisit(user, appointment, patientRecord);

  const roleKey = user.role === 'doctor' ? 'doctor' : 'patient';
  const updates = { updated_at: new Date().toISOString() };
  const nowIso = new Date().toISOString();

  if (parsed.action === 'join') {
    updates[`${roleKey}_online`] = true;
    updates[`${roleKey}_joined_at`] = visit[`${roleKey}_joined_at`] || nowIso;
    const otherOnline = roleKey === 'doctor' ? visit.patient_online : visit.doctor_online;
    updates.status = otherOnline ? 'live' : 'waiting';
    if (!visit.started_at) {
      updates.started_at = nowIso;
    }
  } else if (parsed.action === 'leave') {
    updates[`${roleKey}_online`] = false;
    const otherOnline = roleKey === 'doctor' ? visit.patient_online : visit.doctor_online;
    updates.status = otherOnline ? 'waiting' : 'waiting';
  } else if (parsed.action === 'end') {
    if (user.role !== 'doctor') {
      throw new AppError('Only the doctor can end a consultation room', 403, 'FORBIDDEN');
    }
    updates.status = 'ended';
    updates.ended_at = nowIso;
    updates.doctor_online = false;
    updates.patient_online = false;
  }

  const { data, error } = await supabase
    .from('video_visits')
    .update(updates)
    .eq('org_id', orgId)
    .eq('id', visitId)
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to update visit presence', 500, 'VIDEO_VISIT_UPDATE_FAILED');
  }

  if (parsed.action === 'end' && appointment.status === 'booked') {
    const { error: appointmentUpdateError } = await supabase
      .from('appointments')
      .update({
        status: 'completed'
      })
      .eq('org_id', orgId)
      .eq('id', appointment.id);

    if (appointmentUpdateError) {
      throw new AppError('Unable to complete appointment after ending visit', 500, 'APPOINTMENT_COMPLETE_FAILED');
    }
  }

  const [hydrated] = await hydrateVisits([data], user);
  return { data: hydrated };
}

async function listSignals(user, visitId, since) {
  requireRole(user, ['doctor', 'patient']);
  const orgId = getOrgId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;
  const visit = await getVisitById(orgId, visitId);

  if (!visit) {
    throw new AppError('Video visit not found', 404, 'VIDEO_VISIT_NOT_FOUND');
  }

  const appointment = await getAppointmentById(orgId, visit.appointment_id);
  canAccessVisit(user, appointment, patientRecord);

  let request = supabase
    .from('video_visit_signals')
    .select('*')
    .eq('visit_id', visitId)
    .eq('recipient_role', user.role === 'doctor' ? 'doctor' : 'patient')
    .neq('sender_id', getUserId(user))
    .order('created_at', { ascending: true });

  if (since) {
    request = request.gt('created_at', since);
  }

  const { data, error } = await request;
  if (error) {
    throw new AppError('Unable to fetch signaling messages', 500, 'SIGNAL_LIST_FAILED');
  }

  return { data: data || [] };
}

async function sendSignal(user, visitId, payload) {
  requireRole(user, ['doctor', 'patient']);
  const orgId = getOrgId(user);
  const patientRecord = user.role === 'patient' ? await getPatientRecord(user) : null;
  const parsed = parseInput(signalSchema, payload);
  const visit = await getVisitById(orgId, visitId);

  if (!visit) {
    throw new AppError('Video visit not found', 404, 'VIDEO_VISIT_NOT_FOUND');
  }

  const appointment = await getAppointmentById(orgId, visit.appointment_id);
  canAccessVisit(user, appointment, patientRecord);

  const userRole = user.role === 'doctor' ? 'doctor' : 'patient';
  if (parsed.recipient_role === userRole) {
    throw new AppError('Signal recipient must be the other participant', 422, 'VALIDATION_ERROR');
  }

  const { data, error } = await supabase
    .from('video_visit_signals')
    .insert({
      visit_id: visitId,
      sender_id: getUserId(user),
      sender_role: userRole,
      recipient_role: parsed.recipient_role,
      kind: parsed.kind,
      payload: parsed.payload || {}
    })
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to send signaling message', 500, 'SIGNAL_CREATE_FAILED');
  }

  return { data };
}

async function saveTranscript(user, visitId, payload) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const parsed = parseInput(transcriptSchema, payload);
  const visit = await getVisitById(orgId, visitId);

  if (!visit) {
    throw new AppError('Video visit not found', 404, 'VIDEO_VISIT_NOT_FOUND');
  }
  if (visit.doctor_id !== getUserId(user)) {
    throw new AppError('You can only update transcript for your own visit', 403, 'FORBIDDEN');
  }

  const { data, error } = await supabase
    .from('video_visits')
    .update({
      transcript_text: parsed.transcript_text || '',
      updated_at: new Date().toISOString()
    })
    .eq('org_id', orgId)
    .eq('id', visitId)
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to save transcript', 500, 'VIDEO_VISIT_UPDATE_FAILED');
  }

  const [hydrated] = await hydrateVisits([data], user);
  return { data: hydrated };
}

async function generateAiDraft(user, visitId) {
  requireRole(user, ['doctor']);
  const orgId = getOrgId(user);
  const visit = await getVisitById(orgId, visitId);

  if (!visit) {
    throw new AppError('Video visit not found', 404, 'VIDEO_VISIT_NOT_FOUND');
  }
  if (visit.doctor_id !== getUserId(user)) {
    throw new AppError('You can only generate AI draft for your own visit', 403, 'FORBIDDEN');
  }

  const appointment = await getAppointmentById(orgId, visit.appointment_id);
  const availabilityMap = await getAvailabilityByIds([appointment.availability_id]);
  const patient = await getPatientById(orgId, visit.patient_id);
  const previousConsultation = await getLatestPriorConsultation(
    orgId,
    visit.patient_id,
    appointment.id
  );
  const draft = buildAiDraft({
    appointment,
    availability: availabilityMap[appointment.availability_id] || null,
    patient,
    previousConsultation
  });

  const { data, error } = await supabase
    .from('video_visits')
    .update({
      ai_note_payload: draft,
      updated_at: new Date().toISOString()
    })
    .eq('org_id', orgId)
    .eq('id', visitId)
    .select('*')
    .single();

  if (error) {
    throw new AppError('Unable to generate AI draft note', 500, 'AI_DRAFT_FAILED');
  }

  const [hydrated] = await hydrateVisits([data], user);
  return { data: hydrated };
}

module.exports = {
  getOrCreateByAppointment,
  updatePresence,
  listSignals,
  sendSignal,
  saveTranscript,
  generateAiDraft
};
