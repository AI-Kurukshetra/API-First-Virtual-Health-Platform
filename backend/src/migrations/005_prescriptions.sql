create table if not exists prescriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  consultation_id uuid not null unique references consultations(id) on delete cascade,
  appointment_id uuid not null references appointments(id) on delete cascade,
  doctor_id uuid not null references users(id),
  patient_id uuid not null references patients(id),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists prescription_items (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions(id) on delete cascade,
  medicine_name text not null,
  strength text,
  dosage text,
  frequency text,
  duration text,
  route text,
  timing text,
  instructions text,
  sort_order integer not null default 0,
  created_at timestamptz default now()
);

create index if not exists prescriptions_org_doctor_idx
  on prescriptions (org_id, doctor_id, updated_at desc);

create index if not exists prescriptions_org_patient_idx
  on prescriptions (org_id, patient_id, updated_at desc);

create index if not exists prescription_items_prescription_idx
  on prescription_items (prescription_id, sort_order asc, created_at asc);

alter table prescriptions enable row level security;
alter table prescription_items enable row level security;
