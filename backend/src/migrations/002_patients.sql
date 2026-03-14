do $$
begin
  if not exists (select 1 from pg_type where typname = 'gender_type') then
    create type gender_type as enum ('male', 'female', 'other', 'prefer_not_to_say');
  end if;
end
$$;

create table if not exists patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  org_id uuid references organisations(id),
  full_name text not null,
  date_of_birth date not null,
  gender gender_type not null,
  mobile text not null,
  email text,
  abha_id text,
  blood_group text,
  ai_consent boolean default false,
  address jsonb,
  created_at timestamptz default now()
);

create index if not exists patients_org_idx on patients (org_id);
create index if not exists patients_mobile_idx on patients (mobile);

alter table patients enable row level security;
