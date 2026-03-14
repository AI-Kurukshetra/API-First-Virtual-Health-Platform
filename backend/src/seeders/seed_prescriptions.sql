delete from prescription_items
where prescription_id in (
  select id from prescriptions
  where org_id = '11111111-1111-1111-1111-111111111111'
);

delete from prescriptions
where org_id = '11111111-1111-1111-1111-111111111111';

insert into prescriptions (
  id,
  org_id,
  consultation_id,
  appointment_id,
  doctor_id,
  patient_id,
  notes,
  created_at,
  updated_at
)
values
  (
    '50111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '40111111-1111-1111-1111-111111111111',
    '30111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    'Use the pain log for the next 7 days and return earlier if symptoms intensify or new red flags appear.',
    now() - interval '8 hours',
    now() - interval '6 hours'
  ),
  (
    '50222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '40222222-2222-2222-2222-222222222222',
    '30222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '77777777-7777-7777-7777-777777777777',
    'Review skin response after 5 days and stop immediately if irritation worsens.',
    now() - interval '7 hours',
    now() - interval '5 hours'
  )
on conflict (id) do update
set
  org_id = excluded.org_id,
  consultation_id = excluded.consultation_id,
  appointment_id = excluded.appointment_id,
  doctor_id = excluded.doctor_id,
  patient_id = excluded.patient_id,
  notes = excluded.notes,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

insert into prescription_items (
  id,
  prescription_id,
  medicine_name,
  strength,
  dosage,
  frequency,
  duration,
  route,
  timing,
  instructions,
  sort_order
)
values
  (
    '51111111-1111-1111-1111-111111111111',
    '50111111-1111-1111-1111-111111111111',
    'Paracetamol',
    '500 mg',
    '1 tablet',
    'Twice daily as needed',
    '5 days',
    'Oral',
    'After food',
    'Do not exceed the advised daily dose.',
    0
  ),
  (
    '51222222-2222-2222-2222-222222222222',
    '50111111-1111-1111-1111-111111111111',
    'Pantoprazole',
    '40 mg',
    '1 tablet',
    'Once daily',
    '3 days',
    'Oral',
    'Before breakfast',
    'Take on an empty stomach if acidity symptoms are present.',
    1
  ),
  (
    '51333333-3333-3333-3333-333333333333',
    '50111111-1111-1111-1111-111111111111',
    'ORS / Hydration support',
    '1 sachet',
    '1 sachet in water',
    'Once daily',
    '3 days',
    'Oral',
    'Any time',
    'Increase overall fluid intake through the day.',
    2
  ),
  (
    '52111111-1111-1111-1111-111111111111',
    '50222222-2222-2222-2222-222222222222',
    'Calamine lotion',
    'Topical',
    'Thin layer',
    'Twice daily',
    '5 days',
    'Topical',
    'After gentle skin cleansing',
    'Apply only to the affected area.',
    0
  ),
  (
    '52222222-2222-2222-2222-222222222222',
    '50222222-2222-2222-2222-222222222222',
    'Cetirizine',
    '10 mg',
    '1 tablet',
    'Once daily',
    '5 days',
    'Oral',
    'At night',
    'May cause mild drowsiness in some patients.',
    1
  ),
  (
    '52333333-3333-3333-3333-333333333333',
    '50222222-2222-2222-2222-222222222222',
    'Hydrocortisone cream',
    '1%',
    'Thin layer',
    'Twice daily',
    '5 days',
    'Topical',
    'Morning and evening',
    'Apply sparingly and avoid broken skin.',
    2
  );
