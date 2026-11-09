-- =====================================================================
--  ÖĞRETMEN HESAP — SUPABASE VERİTABANI KURULUMU
--  Supabase → SQL Editor → New query → bu kodun TAMAMINI yapıştır → Run
--  Kod tekrar çalıştırılabilir; mevcut verileri silmez.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tek yönetici: öğretmen hesabı (kullanıcı adı: rasyonelx)
--    Uygulama kullanıcı adını "rasyonelx@ogretmenhesap.app" olarak iletir.
-- ---------------------------------------------------------------------
create or replace function public.teacher_email()
returns text language sql immutable as $$
  select 'rasyonelx@ogretmenhesap.app'::text
$$;

create or replace function public.is_teacher()
returns boolean language sql stable as $$
  select coalesce(lower(auth.jwt() ->> 'email'), '') = public.teacher_email()
$$;

-- ---------------------------------------------------------------------
-- 2) Tablolar
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  username    text not null unique,
  role        text not null check (role in ('teacher', 'student')),
  profile     jsonb not null default '{}'::jsonb,   -- ad soyad, sınıf, okul…
  created_at  timestamptz not null default now(),
  last_login  timestamptz default now()
);

create table if not exists public.user_data (       -- ders programı, yıllık plan, modüller, günlük aktiviteler, notlar
  id          uuid primary key references auth.users(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

create table if not exists public.activity (        -- öğrenci etkinlik geçmişi (yalnızca öğretmen okur)
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  username    text,
  type        text not null,                        -- giris | sayfa | oyun | site | teslim
  label       text,
  detail      text,
  at          timestamptz not null default now()
);
create index if not exists activity_user_at_idx on public.activity (user_id, at desc);

create table if not exists public.resources (       -- öğretmenin eklediği oyun / site bağlantıları
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  url         text not null check (url ~* '^https?://'),
  kind        text not null default 'oyun' check (kind in ('oyun', 'site')),
  description text default '',
  created_at  timestamptz not null default now()
);

create table if not exists public.assignments (     -- ödevler
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text default '',
  due          date,
  link         text default '',
  assignees    uuid[] not null default '{}',
  all_students boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.submissions (     -- ödev teslimleri, puan ve geri bildirim
  id            text primary key,                   -- <assignment_id>_<user_id>
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  username      text,
  text          text default '',
  link          text default '',
  status        text not null default 'teslim' check (status in ('teslim', 'iade', 'puanlandi')),
  score         numeric check (score between 0 and 100),
  feedback      text,
  submitted_at  timestamptz not null default now(),
  graded_at     timestamptz
);
create index if not exists submissions_user_idx on public.submissions (user_id);

create table if not exists public.messages (        -- mesajlar
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references auth.users(id) on delete cascade,
  to_id        uuid not null references auth.users(id) on delete cascade,
  participants uuid[] not null,
  conv_id      text not null,
  text         text not null check (char_length(text) between 1 and 2000),
  at           timestamptz not null default now()
);
create index if not exists messages_conv_idx on public.messages (conv_id, at);

create table if not exists public.settings (        -- ör. öğrenciler arası mesajlaşma açık/kapalı
  id           int primary key default 1 check (id = 1),
  student_chat boolean not null default false
);
insert into public.settings (id, student_chat) values (1, false) on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 3) Yardımcı fonksiyonlar (RLS içinde güvenle kullanılır)
-- ---------------------------------------------------------------------
create or replace function public.role_of(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = uid
$$;

create or replace function public.student_chat_on()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select student_chat from public.settings where id = 1), false)
$$;

-- Mesajlaşma rehberi: giriş yapan herkes yalnızca kullanıcı adı, ad ve rolü görür
create or replace function public.get_directory()
returns table (id uuid, username text, role text, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.username, p.role, coalesce(p.profile ->> 'name', '')
  from public.profiles p
  where auth.uid() is not null
$$;

-- Öğrenci teslim ederken puan / geri bildirim alanlarına dokunamaz
create or replace function public.guard_submission()
returns trigger language plpgsql as $$
begin
  if not public.is_teacher() then
    if tg_op = 'INSERT' then
      new.score := null; new.feedback := null; new.graded_at := null;
    else
      new.id := old.id; new.assignment_id := old.assignment_id; new.user_id := old.user_id;
      new.score := old.score; new.feedback := old.feedback; new.graded_at := old.graded_at;
    end if;
    new.status := 'teslim';
    new.submitted_at := now();
  end if;
  return new;
end $$;
drop trigger if exists trg_guard_submission on public.submissions;
create trigger trg_guard_submission before insert or update on public.submissions
  for each row execute function public.guard_submission();

-- ---------------------------------------------------------------------
-- 4) Yetkiler
-- ---------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke update on public.profiles from authenticated;
grant update (profile, last_login) on public.profiles to authenticated;   -- rol / kullanıcı adı değiştirilemez

revoke all on function public.get_directory() from public, anon;
grant execute on function public.get_directory() to authenticated;

-- ---------------------------------------------------------------------
-- 5) Satır düzeyi güvenlik (RLS) kuralları
-- ---------------------------------------------------------------------
alter table public.profiles    enable row level security;
alter table public.user_data   enable row level security;
alter table public.activity    enable row level security;
alter table public.resources   enable row level security;
alter table public.assignments enable row level security;
alter table public.submissions enable row level security;
alter table public.messages    enable row level security;
alter table public.settings    enable row level security;

-- profiles: kendisi + öğretmen görür
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_teacher());
drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = case when public.is_teacher() then 'teacher' else 'student' end);
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_delete on public.profiles;
create policy profiles_delete on public.profiles for delete to authenticated
  using (public.is_teacher());

-- user_data: yalnızca sahibi (öğretmen silebilir)
drop policy if exists user_data_own on public.user_data;
create policy user_data_own on public.user_data for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists user_data_teacher_delete on public.user_data;
create policy user_data_teacher_delete on public.user_data for delete to authenticated
  using (public.is_teacher());

-- activity: öğrenci kendi adına ekler; YALNIZCA öğretmen okur / siler
drop policy if exists activity_insert on public.activity;
create policy activity_insert on public.activity for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists activity_teacher on public.activity;
create policy activity_teacher on public.activity for select to authenticated
  using (public.is_teacher());
drop policy if exists activity_teacher_delete on public.activity;
create policy activity_teacher_delete on public.activity for delete to authenticated
  using (public.is_teacher());

-- resources: herkes okur, öğretmen yönetir
drop policy if exists resources_select on public.resources;
create policy resources_select on public.resources for select to authenticated using (true);
drop policy if exists resources_teacher on public.resources;
create policy resources_teacher on public.resources for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- settings: herkes okur, öğretmen değiştirir
drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings for select to authenticated using (true);
drop policy if exists settings_teacher on public.settings;
create policy settings_teacher on public.settings for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- assignments: öğretmen yönetir; öğrenci yalnızca kendisine atananları görür
drop policy if exists assignments_select on public.assignments;
create policy assignments_select on public.assignments for select to authenticated
  using (public.is_teacher() or auth.uid() = any (assignees));
drop policy if exists assignments_teacher on public.assignments;
create policy assignments_teacher on public.assignments for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- submissions: öğrenci kendi teslimini görür/gönderir; öğretmen hepsini görür, puanlar, iade eder
drop policy if exists submissions_select on public.submissions;
create policy submissions_select on public.submissions for select to authenticated
  using (public.is_teacher() or user_id = auth.uid());
drop policy if exists submissions_insert on public.submissions;
create policy submissions_insert on public.submissions for insert to authenticated
  with check (
    user_id = auth.uid()
    and id = assignment_id::text || '_' || auth.uid()::text
    and exists (select 1 from public.assignments a where a.id = assignment_id and auth.uid() = any (a.assignees))
  );
drop policy if exists submissions_student_update on public.submissions;
create policy submissions_student_update on public.submissions for update to authenticated
  using (user_id = auth.uid() and status in ('teslim', 'iade'))
  with check (user_id = auth.uid());
drop policy if exists submissions_teacher on public.submissions;
create policy submissions_teacher on public.submissions for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- messages: taraflar okur; öğretmen TÜM yazışmaları görür ve silebilir.
-- Öğrenciden öğrenciye mesaj yalnızca öğretmen izin verdiyse gönderilebilir.
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages for select to authenticated
  using (public.is_teacher() or auth.uid() = any (participants));
drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages for insert to authenticated
  with check (
    from_id = auth.uid()
    and cardinality(participants) = 2
    and auth.uid() = any (participants)
    and to_id = any (participants)
    and to_id <> auth.uid()
    and (public.is_teacher() or public.role_of(to_id) = 'teacher' or public.student_chat_on())
  );
drop policy if exists messages_teacher_delete on public.messages;
create policy messages_teacher_delete on public.messages for delete to authenticated
  using (public.is_teacher());

-- =====================================================================
-- KURULUM BİTTİ. Sonraki adımlar (Supabase panelinde):
--  a) Authentication → Sign In / Providers → Email: "Confirm email" KAPALI olsun.
--  b) Authentication → Users → Add user → Create new user:
--       Email: rasyonelx@ogretmenhesap.app   Password: (öğretmen şifresi)
--       "Auto Confirm User" işaretli olsun.  (Öğrenciler kayıt olmadan ÖNCE yapın.)
--  c) Project Settings → API: Project URL ve anon/publishable anahtarı js/config.js'e yazın.
-- =====================================================================
