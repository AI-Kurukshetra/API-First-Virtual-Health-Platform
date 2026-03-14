insert into organisations (id, name, slug, plan, settings)
values
  ('11111111-1111-1111-1111-111111111111', 'VirtualCare Demo Clinic', 'virtualcare-demo', 'starter', '{"timezone": "Asia/Kolkata", "currency": "INR"}')
on conflict (id) do nothing;

delete from video_visit_signals
where visit_id in (
  select id from video_visits
  where org_id = '11111111-1111-1111-1111-111111111111'
);

delete from video_visits
where org_id = '11111111-1111-1111-1111-111111111111';

delete from prescription_items
where prescription_id in (
  select id from prescriptions
  where org_id = '11111111-1111-1111-1111-111111111111'
);

delete from prescriptions
where org_id = '11111111-1111-1111-1111-111111111111';

delete from payments
where org_id = '11111111-1111-1111-1111-111111111111';

delete from consultations
where org_id = '11111111-1111-1111-1111-111111111111';

delete from appointments
where org_id = '11111111-1111-1111-1111-111111111111';

delete from appointment_availability
where org_id = '11111111-1111-1111-1111-111111111111';

delete from patients
where org_id = '11111111-1111-1111-1111-111111111111';

delete from users
where org_id = '11111111-1111-1111-1111-111111111111';

-- Demo users (demo OTP: 123456 for all)
insert into users (id, full_name, mobile, email, role, org_id)
values
  ('22222222-2222-2222-2222-222222222222', 'Dr. Asha Mehta', '+919876543210', 'asha@virtualcare.demo', 'doctor', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', 'Rahul Shah', '+919900112233', 'rahul@virtualcare.demo', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', 'Clinic Admin', '+919811223344', 'admin@virtualcare.demo', 'admin', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dr. Raj Verma', '+919755443322', 'raj@virtualcare.demo', 'doctor', '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Suresh Kumar', '+919933221100', 'suresh@virtualcare.demo', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Kavita Desai', '+919877665544', 'kavita@virtualcare.demo', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'System Super Admin', '+919866554433', 'superadmin@virtualcare.demo', 'super_admin', '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set
  full_name = excluded.full_name,
  mobile = excluded.mobile,
  email = excluded.email,
  role = excluded.role,
  org_id = excluded.org_id;
