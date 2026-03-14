delete from consultations
where org_id = '11111111-1111-1111-1111-111111111111';

insert into consultations (
  id,
  org_id,
  appointment_id,
  doctor_id,
  patient_id,
  status,
  chief_complaint,
  subjective_note,
  objective_note,
  assessment,
  plan,
  patient_summary,
  ai_draft_note,
  created_at,
  updated_at
)
values
  (
    '40111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '30111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    'finalized',
    'Recurring frontal headache',
    'Patient reports intermittent headaches for 3 weeks, worse in the evening and after prolonged screen exposure.',
    'Vitals stable. No focal neurological deficit reported in review. Hydration appears suboptimal.',
    'Likely tension-type headache with lifestyle trigger pattern.',
    'Advise hydration, sleep regulation, screen breaks, and review in 1 week if symptoms persist.',
    'Your consultation suggests a stress or screen-related headache pattern. Please hydrate well, reduce continuous screen time, and follow up if symptoms continue.',
    'AI draft: Tension-pattern headache, conservative care advised, monitor red flags.',
    now() - interval '10 hours',
    now() - interval '8 hours'
  ),
  (
    '40222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '30222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '77777777-7777-7777-7777-777777777777',
    'draft',
    'Persistent skin rash',
    'Patient notes mild itching and patchy redness for 6 days, no fever reported.',
    'Visual review suggests localized inflammatory rash without acute distress.',
    'Possible contact dermatitis; needs follow-up after topical response.',
    'Start symptomatic skin care and reassess after short follow-up.',
    'Your doctor suspects an irritation-related rash and has advised symptom-focused care with follow-up review.',
    'AI draft: Localized rash, monitor topical response, consider trigger review.',
    now() - interval '9 hours',
    now() - interval '7 hours'
  )
on conflict (id) do update
set
  org_id = excluded.org_id,
  appointment_id = excluded.appointment_id,
  doctor_id = excluded.doctor_id,
  patient_id = excluded.patient_id,
  status = excluded.status,
  chief_complaint = excluded.chief_complaint,
  subjective_note = excluded.subjective_note,
  objective_note = excluded.objective_note,
  assessment = excluded.assessment,
  plan = excluded.plan,
  patient_summary = excluded.patient_summary,
  ai_draft_note = excluded.ai_draft_note,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
