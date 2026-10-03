-- iCare schema. Paste into Supabase > SQL Editor and run.
-- Hackathon mode: single demo user, no auth. The anon key can read/write.

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,                 -- digits with country code, e.g. 15551234567
  relationship text,
  emoji text default '🙂',
  timezone text,              -- IANA zone, e.g. Europe/London
  whatsapp_id text,           -- e.g. 447911123456@c.us
  last_contact_at timestamptz,
  contact_every_days int default 14,
  created_at timestamptz default now()
);

create table if not exists moments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references people(id) on delete cascade,
  title text not null,
  detail text,
  category text,
  event_date date,
  followup_date date not null,
  suggested_message text not null,
  status text default 'pending',
  source text default 'screenshot',
  created_at timestamptz default now(),
  completed_at timestamptz
);

create table if not exists outbox (
  id uuid primary key default gen_random_uuid(),
  person_id uuid references people(id) on delete cascade,
  moment_id uuid references moments(id) on delete set null,
  text text not null,
  status text default 'scheduled',  -- scheduled | sent | failed | cancelled
  send_at timestamptz not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);

alter table people enable row level security;
alter table moments enable row level security;
alter table outbox enable row level security;

drop policy if exists "demo all people" on people;
drop policy if exists "demo all moments" on moments;
drop policy if exists "demo all outbox" on outbox;
create policy "demo all people" on people for all using (true) with check (true);
create policy "demo all moments" on moments for all using (true) with check (true);
create policy "demo all outbox" on outbox for all using (true) with check (true);
