delete from appointments
where org_id = '11111111-1111-1111-1111-111111111111';

delete from appointment_availability
where org_id = '11111111-1111-1111-1111-111111111111';

delete from patients
where org_id = '11111111-1111-1111-1111-111111111111';

insert into patients (
  id,
  user_id,
  org_id,
  full_name,
  date_of_birth,
  gender,
  mobile,
  email,
  abha_id,
  blood_group,
  ai_consent,
  address,
  created_at
)
values
  (
    '55555555-5555-5555-5555-555555555555',
    '33333333-3333-3333-3333-333333333333',
    '11111111-1111-1111-1111-111111111111',
    'Rahul Shah',
    '1992-07-21',
    'male',
    '+919900112233',
    'rahul@virtualcare.demo',
    'ABHA-1001-2026',
    'B+',
    true,
    '{"line1": "18 Lotus Enclave", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380015"}'::jsonb,
    now() - interval '11 days'
  ),
  (
    '66666666-6666-6666-6666-666666666666',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '11111111-1111-1111-1111-111111111111',
    'Suresh Kumar',
    '1988-11-02',
    'male',
    '+919933221100',
    'suresh@virtualcare.demo',
    'ABHA-1002-2026',
    'O+',
    false,
    '{"line1": "90 Palm Avenue", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380009"}'::jsonb,
    now() - interval '10 days'
  ),
  (
    '77777777-7777-7777-7777-777777777777',
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '11111111-1111-1111-1111-111111111111',
    'Kavita Desai',
    '1996-02-18',
    'female',
    '+919877665544',
    'kavita@virtualcare.demo',
    'ABHA-1003-2026',
    'A+',
    true,
    '{"line1": "44 River Park", "city": "Ahmedabad", "state": "Gujarat", "pincode": "380021"}'::jsonb,
    now() - interval '9 days'
  )
on conflict (id) do update
set
  user_id = excluded.user_id,
  org_id = excluded.org_id,
  full_name = excluded.full_name,
  date_of_birth = excluded.date_of_birth,
  gender = excluded.gender,
  mobile = excluded.mobile,
  email = excluded.email,
  abha_id = excluded.abha_id,
  blood_group = excluded.blood_group,
  ai_consent = excluded.ai_consent,
  address = excluded.address,
  created_at = excluded.created_at;
