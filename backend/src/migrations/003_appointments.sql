do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_mode_type') then
    create type appointment_mode_type as enum ('video', 'in_person');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_status_type') then
    create type appointment_status_type as enum ('booked', 'cancelled', 'completed');
  end if;
end
$$;

create table if not exists appointment_availability (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  doctor_id uuid not null references users(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  mode appointment_mode_type not null default 'video',
  notes text,
  created_at timestamptz default now(),
  constraint appointment_availability_time_check check (end_at > start_at),
  constraint appointment_availability_unique_slot unique (doctor_id, start_at, end_at)
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  availability_id uuid not null references appointment_availability(id) on delete cascade,
  doctor_id uuid not null references users(id),
  patient_id uuid not null references patients(id),
  status appointment_status_type not null default 'booked',
  reason text,
  created_by uuid references users(id),
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz default now()
);

create unique index if not exists appointments_active_slot_idx
  on appointments (availability_id)
  where status = 'booked';

create index if not exists appointment_availability_org_doctor_idx
  on appointment_availability (org_id, doctor_id, start_at);

create index if not exists appointments_org_doctor_idx
  on appointments (org_id, doctor_id, created_at desc);

create index if not exists appointments_org_patient_idx
  on appointments (org_id, patient_id, created_at desc);

alter table appointment_availability enable row level security;
alter table appointments enable row level security;
