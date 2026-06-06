-- ============================================================
-- AICOCoach – Supabase-Schema: Teams, Mitglieder, Team-Daten
-- Einmal im Supabase-Projekt ausführen:
--   Dashboard -> SQL Editor -> New query -> einfügen -> Run
-- ============================================================

create extension if not exists pgcrypto;

-- Teams
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  fussball_club_id text,
  created_by uuid not null references auth.users(id) default auth.uid(),
  created_at timestamptz default now()
);

-- Mitgliedschaften (mehrere Trainer pro Team möglich)
create table if not exists public.team_members (
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'trainer',
  created_at timestamptz default now(),
  primary key (team_id, user_id)
);

-- Team-Daten (Kader, Trainings, Spiele, KI-Verlauf) als JSON
create table if not exists public.team_data (
  team_id uuid primary key references public.teams(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);

-- Row Level Security
alter table public.teams        enable row level security;
alter table public.team_members enable row level security;
alter table public.team_data    enable row level security;

-- Hilfsfunktion: ist der aktuelle User Mitglied im Team?
create or replace function public.is_team_member(t uuid)
returns boolean language sql security definer stable
set search_path = public as $$
  select exists(
    select 1 from public.team_members m
    where m.team_id = t and m.user_id = auth.uid()
  );
$$;

-- Policies: teams
drop policy if exists teams_select on public.teams;
drop policy if exists teams_insert on public.teams;
drop policy if exists teams_update on public.teams;
create policy teams_select on public.teams for select using (public.is_team_member(id));
create policy teams_insert on public.teams for insert with check (auth.uid() = created_by);
create policy teams_update on public.teams for update using (public.is_team_member(id));

-- Policies: team_members
drop policy if exists tm_select on public.team_members;
drop policy if exists tm_insert on public.team_members;
drop policy if exists tm_delete on public.team_members;
create policy tm_select on public.team_members for select using (user_id = auth.uid() or public.is_team_member(team_id));
create policy tm_insert on public.team_members for insert with check (user_id = auth.uid());
create policy tm_delete on public.team_members for delete using (user_id = auth.uid());

-- Policies: team_data (nur Mitglieder)
drop policy if exists td_select on public.team_data;
drop policy if exists td_insert on public.team_data;
drop policy if exists td_update on public.team_data;
create policy td_select on public.team_data for select using (public.is_team_member(team_id));
create policy td_insert on public.team_data for insert with check (public.is_team_member(team_id));
create policy td_update on public.team_data for update using (public.is_team_member(team_id));

-- Atomar Team anlegen + sich selbst als Mitglied + leeren Datensatz (umgeht RLS-Henne-Ei)
create or replace function public.create_team(p_name text, p_club_id text default null)
returns uuid language plpgsql security definer
set search_path = public as $$
declare new_id uuid;
begin
  insert into public.teams(name, fussball_club_id, created_by)
    values (p_name, p_club_id, auth.uid()) returning id into new_id;
  insert into public.team_members(team_id, user_id, role)
    values (new_id, auth.uid(), 'owner');
  insert into public.team_data(team_id, data)
    values (new_id, '{}'::jsonb);
  return new_id;
end; $$;

grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
