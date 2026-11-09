-- =====================================================================
--  ÖĞRETMEN HESAP — Supabase veritabanı kurulum kodu
--  Supabase > SQL Editor > New query > bu kodun tamamını yapıştırın > Run
--  Kod birden fazla kez çalıştırılabilir; mevcut verileri silmez.
--
--  Roller:  yonetici (tek kişi) · ogretmen · ogrenci
--  İlk oluşturulan kullanıcı otomatik olarak YÖNETİCİ olur.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1) PROFİLLER (her kullanıcının rolü ve temel bilgileri)
-- ---------------------------------------------------------------------
create table if not exists public.profiller (
  id            uuid primary key references auth.users(id) on delete cascade,
  rol           text not null check (rol in ('yonetici','ogretmen','ogrenci')),
  ad            text not null default '',
  kullanici_adi text unique,
  sinif         text,                  -- öğrenciler için (örn. 5-A)
  brans         text,                  -- öğretmenler için (örn. Matematik)
  aktif         boolean not null default true,
  olusturma     timestamptz not null default now()
);
-- Yalnızca bir yönetici olabilir
create unique index if not exists tek_yonetici on public.profiller (rol) where rol = 'yonetici';

-- Yardımcı fonksiyonlar (güvenlik kurallarında kullanılır)
create or replace function public.benim_rolum() returns text
language sql stable security definer set search_path = '' as $$
  select rol from public.profiller where id = auth.uid() and aktif
$$;

create or replace function public.benim_sinifim() returns text
language sql stable security definer set search_path = '' as $$
  select sinif from public.profiller where id = auth.uid() and aktif
$$;

create or replace function public.ogretmen_mi() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.benim_rolum() in ('yonetici','ogretmen'), false)
$$;

create or replace function public.yonetici_mi() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.benim_rolum() = 'yonetici', false)
$$;

-- ---------------------------------------------------------------------
-- 2) ÖĞRETMEN İÇERİKLERİ
-- ---------------------------------------------------------------------
create table if not exists public.yillik_planlar (
  id            uuid primary key default gen_random_uuid(),
  ogretmen_id   uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  egitim_yili   text not null default '2026-2027',
  ders          text not null,
  sinif_duzeyi  text not null,         -- örn. 5, 6, 7
  hafta         int,
  tarih_araligi text,
  unite         text,
  konu          text,
  kazanim       text,
  yontem        text,
  olcme         text,
  aciklama      text,
  olusturma     timestamptz not null default now()
);

create table if not exists public.ders_modulleri (
  id            uuid primary key default gen_random_uuid(),
  ogretmen_id   uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  baslik        text not null,
  ders          text,
  sinif_duzeyi  text,
  aciklama      text,
  icerik        text,
  kaynak_url    text,
  sira          int not null default 0,
  olusturma     timestamptz not null default now()
);

create table if not exists public.gunluk_aktiviteler (
  id            uuid primary key default gen_random_uuid(),
  ogretmen_id   uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  tarih         date not null default current_date,
  ders_saati    text,
  sinif         text,
  ders          text,
  aktivite      text not null,
  notlar        text,
  yapildi       boolean not null default false,
  olusturma     timestamptz not null default now()
);

create table if not exists public.notlar (
  id            uuid primary key default gen_random_uuid(),
  ogretmen_id   uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  baslik        text not null,
  metin         text,
  etiket        text,
  olusturma     timestamptz not null default now()
);

create table if not exists public.ders_programi (
  ogretmen_id   uuid primary key default auth.uid() references public.profiller(id) on delete cascade,
  hucreler      jsonb not null default '{}'::jsonb,
  saatler       jsonb not null default '{}'::jsonb,
  guncelleme    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3) ORTAK: görevler, duyurular, ödevler, teslimler
-- ---------------------------------------------------------------------
create table if not exists public.gorevler (           -- herkesin kişisel yapılacaklar listesi
  id            uuid primary key default gen_random_uuid(),
  sahip_id      uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  baslik        text not null,
  tarih         date,
  bitti         boolean not null default false,
  olusturma     timestamptz not null default now()
);

create table if not exists public.duyurular (
  id            uuid primary key default gen_random_uuid(),
  ogretmen_id   uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  baslik        text not null,
  metin         text,
  sinif         text not null default 'Tümü',
  olusturma     timestamptz not null default now()
);

create table if not exists public.odevler (
  id            uuid primary key default gen_random_uuid(),
  ogretmen_id   uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  baslik        text not null,
  aciklama      text,
  sinif         text not null default 'Tümü',
  son_tarih     date,
  olusturma     timestamptz not null default now()
);

create table if not exists public.odev_teslim (
  odev_id       uuid not null references public.odevler(id) on delete cascade,
  ogrenci_id    uuid not null default auth.uid() references public.profiller(id) on delete cascade,
  bitti         boolean not null default false,
  zaman         timestamptz not null default now(),
  primary key (odev_id, ogrenci_id)
);

create index if not exists yp_ogretmen on public.yillik_planlar (ogretmen_id, ders, sinif_duzeyi, hafta);
create index if not exists ga_ogretmen on public.gunluk_aktiviteler (ogretmen_id, tarih);
create index if not exists gr_sahip on public.gorevler (sahip_id);

-- ---------------------------------------------------------------------
-- 4) GÜVENLİK KURALLARI (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.profiller          enable row level security;
alter table public.yillik_planlar     enable row level security;
alter table public.ders_modulleri     enable row level security;
alter table public.gunluk_aktiviteler enable row level security;
alter table public.notlar             enable row level security;
alter table public.ders_programi      enable row level security;
alter table public.gorevler           enable row level security;
alter table public.duyurular          enable row level security;
alter table public.odevler            enable row level security;
alter table public.odev_teslim        enable row level security;

-- Profiller: herkes kendi kaydını, öğretmen/yönetici herkesi görür; yalnızca yönetici değiştirir
drop policy if exists profil_oku on public.profiller;
create policy profil_oku on public.profiller for select to authenticated
  using (id = auth.uid() or public.ogretmen_mi());
drop policy if exists profil_yonet on public.profiller;
create policy profil_yonet on public.profiller for update to authenticated
  using (public.yonetici_mi()) with check (public.yonetici_mi());

-- Öğretmenin kişisel içerikleri: yalnızca sahibi (yönetici okuyabilir)
do $$
declare t text;
begin
  foreach t in array array['yillik_planlar','ders_modulleri','gunluk_aktiviteler','notlar','ders_programi'] loop
    execute format('drop policy if exists sahip_oku on public.%I', t);
    execute format('create policy sahip_oku on public.%I for select to authenticated using ((ogretmen_id = auth.uid() and public.ogretmen_mi()) or public.yonetici_mi())', t);
    execute format('drop policy if exists sahip_yaz on public.%I', t);
    execute format('create policy sahip_yaz on public.%I for insert to authenticated with check (ogretmen_id = auth.uid() and public.ogretmen_mi())', t);
    execute format('drop policy if exists sahip_guncelle on public.%I', t);
    execute format('create policy sahip_guncelle on public.%I for update to authenticated using (ogretmen_id = auth.uid() and public.ogretmen_mi()) with check (ogretmen_id = auth.uid())', t);
    execute format('drop policy if exists sahip_sil on public.%I', t);
    execute format('create policy sahip_sil on public.%I for delete to authenticated using (ogretmen_id = auth.uid() and public.ogretmen_mi())', t);
  end loop;
end $$;

-- Görevler: herkes yalnızca kendi listesini görür ve düzenler
drop policy if exists gorev_sahip on public.gorevler;
create policy gorev_sahip on public.gorevler for all to authenticated
  using (sahip_id = auth.uid() and public.benim_rolum() is not null)
  with check (sahip_id = auth.uid() and public.benim_rolum() is not null);

-- Duyurular ve ödevler: öğretmenler yazar; öğrenci yalnızca kendi sınıfınınkileri görür
do $$
declare t text;
begin
  foreach t in array array['duyurular','odevler'] loop
    execute format('drop policy if exists sinif_oku on public.%I', t);
    execute format($p$create policy sinif_oku on public.%I for select to authenticated using (public.ogretmen_mi() or (public.benim_rolum() = 'ogrenci' and sinif in ('Tümü', public.benim_sinifim())))$p$, t);
    execute format('drop policy if exists ogretmen_yaz on public.%I', t);
    execute format('create policy ogretmen_yaz on public.%I for insert to authenticated with check (ogretmen_id = auth.uid() and public.ogretmen_mi())', t);
    execute format('drop policy if exists ogretmen_guncelle on public.%I', t);
    execute format('create policy ogretmen_guncelle on public.%I for update to authenticated using ((ogretmen_id = auth.uid() and public.ogretmen_mi()) or public.yonetici_mi())', t);
    execute format('drop policy if exists ogretmen_sil on public.%I', t);
    execute format('create policy ogretmen_sil on public.%I for delete to authenticated using ((ogretmen_id = auth.uid() and public.ogretmen_mi()) or public.yonetici_mi())', t);
  end loop;
end $$;

-- Ödev teslimi: öğrenci kendi kaydını yazar; öğretmenler hepsini görür
drop policy if exists teslim_oku on public.odev_teslim;
create policy teslim_oku on public.odev_teslim for select to authenticated
  using (ogrenci_id = auth.uid() or public.ogretmen_mi());
drop policy if exists teslim_yaz on public.odev_teslim;
create policy teslim_yaz on public.odev_teslim for insert to authenticated
  with check (ogrenci_id = auth.uid() and public.benim_rolum() = 'ogrenci'
              and exists (select 1 from public.odevler o where o.id = odev_id));
drop policy if exists teslim_guncelle on public.odev_teslim;
create policy teslim_guncelle on public.odev_teslim for update to authenticated
  using (ogrenci_id = auth.uid() and public.benim_rolum() = 'ogrenci')
  with check (ogrenci_id = auth.uid());

-- ---------------------------------------------------------------------
-- 5) YÖNETİCİ İŞLEMLERİ (kullanıcı açma, şifre sıfırlama, silme)
--    Öğretmen ve öğrenciler e-posta yerine kullanıcı adıyla girer.
-- ---------------------------------------------------------------------
create or replace function public.kullanici_olustur(
  p_kullanici_adi text, p_sifre text, p_ad text,
  p_rol text default 'ogrenci', p_sinif text default null, p_brans text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id     uuid := gen_random_uuid();
  v_eposta text;
begin
  if not public.yonetici_mi() then raise exception 'Bu işlem için yönetici yetkisi gerekir.'; end if;
  if p_rol not in ('ogretmen','ogrenci') then raise exception 'Geçersiz rol.'; end if;
  p_kullanici_adi := lower(trim(p_kullanici_adi));
  if p_kullanici_adi !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'Kullanıcı adı 3-30 karakter olmalı (küçük harf, rakam, nokta, tire).';
  end if;
  if length(p_sifre) < 6 then raise exception 'Şifre en az 6 karakter olmalı.'; end if;
  v_eposta := p_kullanici_adi || '@kullanici.ogretmenhesap.app';
  if exists (select 1 from auth.users where email = v_eposta) then
    raise exception 'Bu kullanıcı adı zaten kullanılıyor.';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_eposta,
          extensions.crypt(p_sifre, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('ad', p_ad),
          now(), now(), '', '', '', '');

  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text,
          jsonb_build_object('sub', v_id::text, 'email', v_eposta, 'email_verified', true),
          'email', now(), now(), now());

  insert into public.profiller (id, rol, ad, kullanici_adi, sinif, brans)
  values (v_id, p_rol, trim(p_ad), p_kullanici_adi,
          nullif(upper(trim(coalesce(p_sinif, ''))), ''), nullif(trim(coalesce(p_brans, '')), ''));
  return v_id;
end $$;

create or replace function public.sifre_sifirla(p_id uuid, p_sifre text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_mi() then raise exception 'Bu işlem için yönetici yetkisi gerekir.'; end if;
  if length(p_sifre) < 6 then raise exception 'Şifre en az 6 karakter olmalı.'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_sifre, extensions.gen_salt('bf')), updated_at = now()
  where id = p_id;
end $$;

create or replace function public.kullanici_sil(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.yonetici_mi() then raise exception 'Bu işlem için yönetici yetkisi gerekir.'; end if;
  if p_id = auth.uid() then raise exception 'Yönetici kendi hesabını silemez.'; end if;
  delete from auth.users where id = p_id;   -- profil ve tüm verileri de silinir
end $$;

create or replace function public.profil_ad_degistir(p_ad text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.profiller set ad = trim(p_ad) where id = auth.uid();
end $$;

revoke execute on function public.kullanici_olustur(text,text,text,text,text,text) from public, anon;
revoke execute on function public.sifre_sifirla(uuid,text) from public, anon;
revoke execute on function public.kullanici_sil(uuid) from public, anon;
revoke execute on function public.profil_ad_degistir(text) from public, anon;
grant execute on function public.kullanici_olustur(text,text,text,text,text,text) to authenticated;
grant execute on function public.sifre_sifirla(uuid,text) to authenticated;
grant execute on function public.kullanici_sil(uuid) to authenticated;
grant execute on function public.profil_ad_degistir(text) to authenticated;

-- ---------------------------------------------------------------------
-- 6) İLK KULLANICI = YÖNETİCİ
--    Authentication > Users > Add user ile oluşturduğunuz ilk hesap yönetici olur.
-- ---------------------------------------------------------------------
create or replace function public.ilk_yonetici() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.profiller where rol = 'yonetici') then
    insert into public.profiller (id, rol, ad)
    values (new.id, 'yonetici', coalesce(new.raw_user_meta_data->>'ad', split_part(new.email, '@', 1)))
    on conflict (id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists ilk_yonetici_tetik on auth.users;
create trigger ilk_yonetici_tetik after insert on auth.users
  for each row execute function public.ilk_yonetici();

-- Hesabınızı bu kodu çalıştırmadan ÖNCE açtıysanız, sizi yönetici yapar:
insert into public.profiller (id, rol, ad)
select u.id, 'yonetici', split_part(u.email, '@', 1)
from auth.users u
where not exists (select 1 from public.profiller where rol = 'yonetici')
order by u.created_at
limit 1
on conflict (id) do update set rol = 'yonetici';

-- Kurulum tamam. Kontrol için:  select * from public.profiller;
