create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'role_type') then
    create type role_type as enum ('patient', 'doctor', 'nurse', 'admin', 'super_admin');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_type') then
    create type plan_type as enum ('free', 'starter', 'growth', 'enterprise');
  end if;
end
$$;

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan plan_type not null default 'free',
  settings jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text unique not null,
  email text,
  role role_type not null,
  org_id uuid references organisations(id),
  profile jsonb,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists users_mobile_idx on users (mobile);

alter table organisations enable row level security;
alter table users enable row level security;
