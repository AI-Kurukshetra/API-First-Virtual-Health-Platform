do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_status_type') then
    create type payment_status_type as enum ('paid', 'refunded');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'payment_method_type') then
    create type payment_method_type as enum ('upi', 'card', 'cash');
  end if;
end
$$;

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  doctor_id uuid not null references users(id),
  patient_id uuid not null references patients(id),
  amount integer not null check (amount > 0),
  currency text not null default 'INR',
  method payment_method_type not null,
  status payment_status_type not null default 'paid',
  transaction_ref text not null unique,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists payments_org_patient_idx
  on payments (org_id, patient_id, created_at desc);

create index if not exists payments_org_doctor_idx
  on payments (org_id, doctor_id, created_at desc);

alter table payments enable row level security;
