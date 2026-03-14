do $$
begin
  if not exists (select 1 from pg_type where typname = 'video_visit_status_type') then
    create type video_visit_status_type as enum ('waiting', 'live', 'ended');
  end if;
end
$$;

create table if not exists video_visits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisations(id),
  appointment_id uuid not null unique references appointments(id) on delete cascade,
  doctor_id uuid not null references users(id),
  patient_id uuid not null references patients(id),
  status video_visit_status_type not null default 'waiting',
  doctor_online boolean not null default false,
  patient_online boolean not null default false,
  doctor_joined_at timestamptz,
  patient_joined_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  transcript_text text,
  ai_note_payload jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists video_visit_signals (
  id uuid primary key default gen_random_uuid(),
  visit_id uuid not null references video_visits(id) on delete cascade,
  sender_id uuid not null references users(id),
  sender_role text not null,
  recipient_role text not null,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists video_visits_org_doctor_idx
  on video_visits (org_id, doctor_id, updated_at desc);

create index if not exists video_visits_org_patient_idx
  on video_visits (org_id, patient_id, updated_at desc);

create index if not exists video_visit_signals_visit_created_idx
  on video_visit_signals (visit_id, created_at asc);

alter table video_visits enable row level security;
alter table video_visit_signals enable row level security;
