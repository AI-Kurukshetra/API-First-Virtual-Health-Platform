insert into video_visits (
  id,
  org_id,
  appointment_id,
  doctor_id,
  patient_id,
  status,
  doctor_online,
  patient_online,
  doctor_joined_at,
  patient_joined_at,
  started_at,
  transcript_text,
  ai_note_payload,
  created_at,
  updated_at
)
values
  (
    '70111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '30111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    'waiting',
    false,
    false,
    now() - interval '10 hours',
    now() - interval '10 hours',
    now() - interval '10 hours',
    'Patient reports recurring frontal headache for around three weeks. Headache worsens after long screen exposure and improves slightly with rest. No red flag symptoms were reported in this follow-up call.',
    '{
      "chief_complaint": "Recurring frontal headache",
      "subjective_note": "Patient reports intermittent frontal headache for around three weeks, worse after prolonged screen exposure.",
      "objective_note": "Video follow-up did not reveal acute distress. Red flag symptoms were denied during the call.",
      "assessment": "Likely tension-type headache pattern with lifestyle triggers.",
      "plan": "Continue hydration, screen breaks, sleep hygiene, and review if symptoms persist or worsen.",
      "patient_summary": "Your call suggests a screen or stress-related headache pattern. Continue hydration and screen breaks, and seek review if symptoms increase.",
      "ai_draft_note": "AI draft: headache pattern reviewed on video visit, conservative management and monitoring advised."
    }'::jsonb,
    now() - interval '10 hours',
    now() - interval '8 hours'
  )
on conflict (id) do update
set
  org_id = excluded.org_id,
  appointment_id = excluded.appointment_id,
  doctor_id = excluded.doctor_id,
  patient_id = excluded.patient_id,
  status = excluded.status,
  doctor_online = excluded.doctor_online,
  patient_online = excluded.patient_online,
  doctor_joined_at = excluded.doctor_joined_at,
  patient_joined_at = excluded.patient_joined_at,
  started_at = excluded.started_at,
  transcript_text = excluded.transcript_text,
  ai_note_payload = excluded.ai_note_payload,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
