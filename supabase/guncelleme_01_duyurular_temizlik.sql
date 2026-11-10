-- =====================================================================
--  ÖĞRETMEN HESAP — GÜNCELLEME 01 (Kasım 2026)
--  Supabase → ogretmenpanel projesi → SQL Editor → bu dosyanın TAMAMINI yapıştır → Run
--  Tekrar çalıştırılabilir.
--
--  1) Duyurular tablosunu ekler (schema.sql'e de eklendi; yeni kurulumlar için ayrıca gerekmez).
--  2) Aynı projeye daha önce kurulmuş ikinci sürümün ("yönetici modeli", kurulum.sql) tablolarını,
--     fonksiyonlarını ve auth.users tetikleyicisini kaldırır. Bu nesneler sitede kullanılmıyor.
--     GÜVENLİK: Bu tablolarda veri varsa (profiller'deki tek yönetici kaydı hariç) kod HİÇBİR ŞEY
--     silmeden durur ve hangi tabloda kaç satır olduğunu bildirir.
--
--  NOT: Bu dosya yalnızca Öğretmen Hesap'ın Supabase projesi içindir; Rasyonelx projesinde ÇALIŞTIRMAYIN.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Duyurular
-- ---------------------------------------------------------------------
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 200),
  body        text default '' check (char_length(body) <= 5000),
  recipients  uuid[],                               -- null: tüm öğrenciler; dolu: yalnızca bu öğrenciler
  created_at  timestamptz not null default now()
);
revoke all on public.announcements from anon;
alter table public.announcements enable row level security;

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements for select to authenticated
  using (public.is_teacher() or recipients is null or auth.uid() = any (recipients));
drop policy if exists announcements_teacher on public.announcements;
create policy announcements_teacher on public.announcements for all to authenticated
  using (public.is_teacher()) with check (public.is_teacher());

-- ---------------------------------------------------------------------
-- 2) İkinci sürümün kalıntılarını temizle (veri varsa durur)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  n bigint;
  dolu text := '';
  tablolar text[] := array['odev_teslim','odevler','duyurular','gorevler','notlar','ders_programi',
                           'ders_modulleri','gunluk_aktiviteler','yillik_planlar','profiller'];
  fonksiyonlar text[] := array['benim_rolum','benim_sinifim','ilk_yonetici','kullanici_olustur','kullanici_sil',
                               'ogretmen_mi','profil_ad_degistir','sifre_sifirla','yonetici_mi'];
  f record;
begin
  -- Veri kontrolü
  foreach t in array tablolar loop
    if to_regclass('public.' || t) is not null then
      execute format('select count(*) from public.%I', t) into n;
      if (t = 'profiller' and n > 1) or (t <> 'profiller' and n > 0) then
        dolu := dolu || format(E'\n  %s: %s satır', t, n);
      end if;
    end if;
  end loop;
  if dolu <> '' then
    raise exception E'Temizlik DURDURULDU, hiçbir şey silinmedi. İkinci sürümün şu tablolarında veri var:%\nBu veriler gerekliyse önce dışa aktarın; gerekli değilse bana haber verin.', dolu;
  end if;

  -- auth.users üzerindeki tetikleyici
  drop trigger if exists ilk_yonetici_tetik on auth.users;

  -- Tablolar (bağımlı politikalarıyla birlikte)
  foreach t in array tablolar loop
    execute format('drop table if exists public.%I cascade', t);
  end loop;

  -- Fonksiyonlar (tüm imzaları)
  for f in
    select p.oid::regprocedure as imza
    from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = any (fonksiyonlar)
  loop
    execute format('drop function if exists %s cascade', f.imza);
  end loop;

  raise notice 'Temizlik tamam: ikinci sürümün tabloları, fonksiyonları ve tetikleyicisi kaldırıldı.';
end $$;

-- Kontrol (isteğe bağlı): aşağıdaki sorgu yalnızca Öğretmen Hesap tablolarını listelemeli —
-- announcements, activity, assignments, grades, messages, profiles, resources, settings, submissions, user_data
-- select table_name from information_schema.tables where table_schema = 'public' order by 1;
