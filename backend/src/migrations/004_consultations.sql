do $$
begin
  if not exists (select 1 from pg_type where typname = 'consultation_status_type') then
    create type consultation_status_type as enum ('draft', 'finalized');
  end if;
end
$$;

create table if not exists consultations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  doctor_id uuid not null references users(id),
  patient_id uuid not null references patients(id),
  status consultation_status_type not null default 'draft',
  chief_complaint text,
  subjective_note text,
  objective_note text,
  assessment text,
  plan text,
  patient_summary text,
  ai_draft_note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists consultations_org_doctor_idx
  on consultations (org_id, doctor_id, updated_at desc);

create index if not exists consultations_org_patient_idx
  on consultations (org_id, patient_id, updated_at desc);

alter table consultations enable row level security;
