insert into organisations (id, name, slug, plan, settings)
values
  ('11111111-1111-1111-1111-111111111111', 'VirtualCare Demo Clinic', 'virtualcare-demo', 'starter', '{"timezone": "Asia/Kolkata", "currency": "INR"}')
on conflict (id) do nothing;

-- Dummy testing users (demo OTP: 123456 for all)
insert into users (id, full_name, mobile, email, role, org_id)
values
  ('22222222-2222-2222-2222-222222222222', 'Dr. Asha Mehta', '+919876543210', 'asha@virtualcare.demo', 'doctor', '11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333', 'Rahul Shah', '+919900112233', 'rahul@virtualcare.demo', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('44444444-4444-4444-4444-444444444444', 'Clinic Admin', '+919811223344', 'admin@virtualcare.demo', 'admin', '11111111-1111-1111-1111-111111111111'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dr. Raj Verma', '+919755443322', 'raj@virtualcare.demo', 'doctor', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Priya Nair', '+919844332211', 'priya@virtualcare.demo', 'nurse', '11111111-1111-1111-1111-111111111111'),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Suresh Kumar', '+919933221100', 'suresh@virtualcare.demo', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Kavita Desai', '+919877665544', 'kavita@virtualcare.demo', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f1111111-1111-1111-1111-111111111111', 'Aarti Singh', '+919812345678', 'aarti@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f2222222-2222-2222-2222-222222222222', 'Vikram Iyer', '+919899001122', 'vikram@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f3333333-3333-3333-3333-333333333333', 'Neha Kulkarni', '+919988776655', 'neha@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f4444444-4444-4444-4444-444444444444', 'Priyanka Menon', '+919701112233', 'priyanka.menon@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f5555555-5555-5555-5555-555555555555', 'Manoj Patel', '+919722334455', 'manoj.patel@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f6666666-6666-6666-6666-666666666666', 'Farah Khan', '+919633221144', 'farah.khan@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f7777777-7777-7777-7777-777777777777', 'Arjun Rao', '+919544113355', 'arjun.rao@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f8888888-8888-8888-8888-888888888888', 'Meera Joshi', '+919455667788', 'meera.joshi@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('f9999999-9999-9999-9999-999999999999', 'Devansh Trivedi', '+919366778899', 'devansh.trivedi@example.com', 'patient', '11111111-1111-1111-1111-111111111111'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'System Super Admin', '+919866554433', 'superadmin@virtualcare.demo', 'super_admin', '11111111-1111-1111-1111-111111111111')
on conflict (id) do update
set
  full_name = excluded.full_name,
  mobile = excluded.mobile,
  email = excluded.email,
  role = excluded.role,
  org_id = excluded.org_id;
