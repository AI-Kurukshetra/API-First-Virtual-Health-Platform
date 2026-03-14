delete from appointments
where org_id = '11111111-1111-1111-1111-111111111111';

delete from appointment_availability
where org_id = '11111111-1111-1111-1111-111111111111';

insert into appointment_availability (
  id,
  org_id,
  doctor_id,
  start_at,
  end_at,
  mode,
  notes,
  created_at
)
values
  (
    '20111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    now() - interval '10 hours',
    now() - interval '9 hours 30 minutes',
    'video',
    'Completed demo consultation slot.',
    now() - interval '12 hours'
  ),
  (
    '20222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() - interval '9 hours',
    now() - interval '8 hours 30 minutes',
    'video',
    'Completed dermatology follow-up slot.',
    now() - interval '11 hours'
  ),
  (
    '20333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() + interval '4 hours',
    now() + interval '4 hours 30 minutes',
    'video',
    'Booked follow-up for demo patient.',
    now() - interval '2 hours'
  ),
  (
    '20444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    now() + interval '1 day 2 hours',
    now() + interval '1 day 2 hours 30 minutes',
    'video',
    'General physician video slot.',
    now() - interval '2 hours'
  ),
  (
    '20555555-5555-5555-5555-555555555555',
    '11111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    now() + interval '2 days 4 hours',
    now() + interval '2 days 4 hours 30 minutes',
    'in_person',
    'In-clinic consultation slot.',
    now() - interval '2 hours'
  ),
  (
    '20666666-6666-6666-6666-666666666666',
    '11111111-1111-1111-1111-111111111111',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    now() + interval '1 day 5 hours',
    now() + interval '1 day 5 hours 30 minutes',
    'video',
    'Skin review open slot.',
    now() - interval '2 hours'
  );

insert into appointments (
  id,
  org_id,
  availability_id,
  doctor_id,
  patient_id,
  status,
  reason,
  created_by,
  cancellation_reason,
  cancelled_at,
  created_at
)
values
  (
    '30111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '20111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    'completed',
    'Frequent headaches after screen exposure',
    '33333333-3333-3333-3333-333333333333',
    null,
    null,
    now() - interval '10 hours'
  ),
  (
    '30222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '20222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '77777777-7777-7777-7777-777777777777',
    'completed',
    'Itchy skin rash review',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    null,
    null,
    now() - interval '9 hours'
  ),
  (
    '30333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    '20333333-3333-3333-3333-333333333333',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '66666666-6666-6666-6666-666666666666',
    'booked',
    'Follow-up for seasonal allergy symptoms',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    null,
    null,
    now() - interval '1 hour'
  )
on conflict (id) do update
set
  org_id = excluded.org_id,
  availability_id = excluded.availability_id,
  doctor_id = excluded.doctor_id,
  patient_id = excluded.patient_id,
  status = excluded.status,
  reason = excluded.reason,
  created_by = excluded.created_by,
  cancellation_reason = excluded.cancellation_reason,
  cancelled_at = excluded.cancelled_at,
  created_at = excluded.created_at;
