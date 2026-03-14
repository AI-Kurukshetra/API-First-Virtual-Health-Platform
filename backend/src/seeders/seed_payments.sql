insert into payments (
  id,
  org_id,
  appointment_id,
  doctor_id,
  patient_id,
  amount,
  currency,
  method,
  status,
  transaction_ref,
  notes,
  created_at,
  updated_at
)
values
  (
    '60111111-1111-1111-1111-111111111111',
    '11111111-1111-1111-1111-111111111111',
    '30111111-1111-1111-1111-111111111111',
    '22222222-2222-2222-2222-222222222222',
    '55555555-5555-5555-5555-555555555555',
    49900,
    'INR',
    'upi',
    'paid',
    'TXN-DEMO-30111111',
    'Mock checkout completed for seeded appointment.',
    now() - interval '10 hours',
    now() - interval '10 hours'
  ),
  (
    '60222222-2222-2222-2222-222222222222',
    '11111111-1111-1111-1111-111111111111',
    '30222222-2222-2222-2222-222222222222',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '77777777-7777-7777-7777-777777777777',
    79900,
    'INR',
    'card',
    'paid',
    'TXN-DEMO-30222222',
    'Mock checkout completed for seeded appointment.',
    now() - interval '9 hours',
    now() - interval '9 hours'
  )
on conflict (id) do update
set
  org_id = excluded.org_id,
  appointment_id = excluded.appointment_id,
  doctor_id = excluded.doctor_id,
  patient_id = excluded.patient_id,
  amount = excluded.amount,
  currency = excluded.currency,
  method = excluded.method,
  status = excluded.status,
  transaction_ref = excluded.transaction_ref,
  notes = excluded.notes,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;
