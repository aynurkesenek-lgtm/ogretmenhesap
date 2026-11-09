// Veri katmanı: Supabase (bulut) ya da demo (yalnızca bu tarayıcı).
// Uygulama yalnızca buradaki fonksiyonları kullanır.
import { SUPABASE_URL, SUPABASE_ANON_KEY, KULLANICI_ALAN_ADI, SITE } from "./ayarlar.js";

export const MOD = SUPABASE_URL && SUPABASE_ANON_KEY ? "bulut" : "demo";
export const epostaYap = (g) => { g = g.trim().toLowerCase(); return g.includes("@") ? g : `${g}@${KULLANICI_ALAN_ADI}`; };
export const kullaniciAdiGoster = (e) => (e || "").replace("@" + KULLANICI_ALAN_ADI, "");

let api;

/* ---------------- SUPABASE ---------------- */
async function supabaseApi() {
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const ok = ({ data, error }) => { if (error) throw error; return data; };
  const sorgu = (q, { esit = {}, sira, azalan = false, kolonlar } = {}) => {
    Object.entries(esit).forEach(([k, v]) => { q = v === null ? q.is(k, null) : q.eq(k, v); });
    if (sira) q = q.order(sira, { ascending: !azalan });
    return q;
  };
  let sonKullanici;
  return {
    onAuth(cb) {
      const bildir = (s) => {
        const u = s?.user ? { id: s.user.id, email: s.user.email } : null;
        if ((u?.id || null) === (sonKullanici ?? undefined)) return;
        sonKullanici = u?.id || null; cb(u);
      };
      sb.auth.getSession().then(({ data }) => bildir(data.session));
      sb.auth.onAuthStateChange((_e, s) => setTimeout(() => bildir(s), 0));
    },
    login: async (id, sifre) => ok(await sb.auth.signInWithPassword({ email: epostaYap(id), password: sifre })),
    logout: async () => { await sb.auth.signOut(); },
    sifreDegistir: async (yeni) => ok(await sb.auth.updateUser({ password: yeni })),
    liste: async (t, o = {}) => ok(await sorgu(sb.from(t).select("*"), o)),
    tek: async (t, esit) => ok(await sorgu(sb.from(t).select("*"), { esit }).maybeSingle()),
    ekle: async (t, obj) => ok(await sb.from(t).insert(obj).select()),
    guncelle: async (t, esit, obj) => ok(await sorgu(sb.from(t).update(obj), { esit })),
    sil: async (t, esit) => ok(await sorgu(sb.from(t).delete(), { esit })),
    upsert: async (t, obj, anahtar) => ok(await sb.from(t).upsert(obj, { onConflict: anahtar.join(",") })),
    rpc: async (ad, args) => ok(await sb.rpc(ad, args)),
  };
}

/* ---------------- DEMO (localStorage) ---------------- */
function demoApi() {
  const KEY = "ogretmenhesap-demo-v2";
  const SAHIP = { gorevler: "sahip_id", odev_teslim: "ogrenci_id" };
  let d;
  const oku = () => {
    if (d) return d;
    try { d = JSON.parse(localStorage.getItem(KEY)); } catch { d = null; }
    if (!d) {
      d = { t: { profiller: [{ id: "yonetici1", rol: "yonetici", ad: SITE.yoneticiAdi, kullanici_adi: "yonetici", aktif: true, olusturma: new Date().toISOString() }] },
            hesaplar: { [epostaYap("yonetici")]: { id: "yonetici1", sifre: "123456" } }, oturum: null };
    }
    return d;
  };
  const yaz = () => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
  const tablo = (t) => (oku().t[t] ||= []);
  const uyar = (esit) => (r) => Object.entries(esit).every(([k, v]) => (r[k] ?? null) === v);
  const yeniId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
  const hata = (message, code = "") => Object.assign(new Error(message), { code });
  let dinle = () => {};
  const ben = () => {
    const o = oku().oturum; if (!o) return null;
    const e = Object.keys(d.hesaplar).find((k) => d.hesaplar[k].id === o);
    return e ? { id: o, email: e } : null;
  };
  const varsayilan = (t, obj) => {
    const r = { ...obj };
    if (t !== "ders_programi" && t !== "odev_teslim" && !r.id) r.id = yeniId();
    const s = SAHIP[t] || "ogretmen_id";
    if (r[s] == null && t !== "profiller") r[s] = ben()?.id;
    if (!r.olusturma) r.olusturma = new Date().toISOString();
    return r;
  };
  const yonetici = () => tablo("profiller").find((p) => p.id === ben()?.id)?.rol === "yonetici";
  const RPC = {
    kullanici_olustur({ p_kullanici_adi, p_sifre, p_ad, p_rol, p_sinif, p_brans }) {
      if (!yonetici()) throw hata("Bu işlem için yönetici yetkisi gerekir.");
      const ka = p_kullanici_adi.trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,30}$/.test(ka)) throw hata("Kullanıcı adı 3-30 karakter olmalı (küçük harf, rakam, nokta, tire).");
      if (p_sifre.length < 6) throw hata("Şifre en az 6 karakter olmalı.");
      if (d.hesaplar[epostaYap(ka)]) throw hata("Bu kullanıcı adı zaten kullanılıyor.");
      const id = yeniId();
      d.hesaplar[epostaYap(ka)] = { id, sifre: p_sifre };
      tablo("profiller").push({ id, rol: p_rol, ad: p_ad.trim(), kullanici_adi: ka, sinif: (p_sinif || "").trim().toUpperCase() || null, brans: p_brans || null, aktif: true, olusturma: new Date().toISOString() });
      return id;
    },
    sifre_sifirla({ p_id, p_sifre }) {
      if (!yonetici()) throw hata("Bu işlem için yönetici yetkisi gerekir.");
      if (p_sifre.length < 6) throw hata("Şifre en az 6 karakter olmalı.");
      const e = Object.keys(d.hesaplar).find((k) => d.hesaplar[k].id === p_id); if (e) d.hesaplar[e].sifre = p_sifre;
    },
    kullanici_sil({ p_id }) {
      if (!yonetici()) throw hata("Bu işlem için yönetici yetkisi gerekir.");
      const e = Object.keys(d.hesaplar).find((k) => d.hesaplar[k].id === p_id); if (e) delete d.hesaplar[e];
      Object.keys(d.t).forEach((t) => { d.t[t] = d.t[t].filter((r) => r.id !== p_id && r.ogretmen_id !== p_id && r.sahip_id !== p_id && r.ogrenci_id !== p_id); });
    },
    profil_ad_degistir({ p_ad }) { const p = tablo("profiller").find((x) => x.id === ben().id); if (p) p.ad = p_ad.trim(); },
  };
  return {
    onAuth(cb) { dinle = cb; setTimeout(() => cb(ben()), 0); },
    async login(id, sifre) {
      const h = oku().hesaplar[epostaYap(id)];
      if (!h || h.sifre !== sifre) throw hata("Invalid login credentials", "invalid_credentials");
      d.oturum = h.id; yaz(); dinle(ben());
    },
    async logout() { oku().oturum = null; yaz(); dinle(null); },
    async sifreDegistir(yeni) { d.hesaplar[ben().email].sifre = yeni; yaz(); },
    async liste(t, { esit = {}, sira, azalan } = {}) {
      let r = tablo(t).filter(uyar(esit)).map((x) => ({ ...x }));
      if (sira) r.sort((a, b) => String(a[sira] ?? "").localeCompare(String(b[sira] ?? ""), "tr", { numeric: true }) * (azalan ? -1 : 1));
      return r;
    },
    async tek(t, esit) { const r = tablo(t).find(uyar(esit)); return r ? { ...r } : null; },
    async ekle(t, obj) { const satirlar = (Array.isArray(obj) ? obj : [obj]).map((o) => varsayilan(t, o)); tablo(t).push(...satirlar); yaz(); return satirlar; },
    async guncelle(t, esit, obj) { tablo(t).filter(uyar(esit)).forEach((r) => Object.assign(r, obj)); yaz(); },
    async sil(t, esit) {
      d.t[t] = tablo(t).filter((r) => !uyar(esit)(r));
      if (t === "odevler" && esit.id) d.t.odev_teslim = tablo("odev_teslim").filter((r) => r.odev_id !== esit.id);
      yaz();
    },
    async upsert(t, obj, anahtar) {
      const r = varsayilan(t, obj);
      const esit = Object.fromEntries(anahtar.map((k) => [k, r[k]]));
      const var_ = tablo(t).find(uyar(esit));
      var_ ? Object.assign(var_, r) : tablo(t).push(r); yaz();
    },
    async rpc(ad, args) { const s = RPC[ad](args); yaz(); return s; },
  };
}

export async function baslat() { api = MOD === "bulut" ? await supabaseApi() : demoApi(); }
export const veri = new Proxy({}, { get: (_, k) => (...a) => api[k](...a) });

export function hataMesaji(e) {
  const m = e?.message || String(e || "");
  const c = e?.code || "";
  if (/invalid.*credentials|invalid_credentials/i.test(m + c)) return "Kullanıcı adı / e-posta ya da şifre hatalı.";
  if (/row-level security|permission denied|42501/i.test(m + c)) return "Bu işlem için yetkiniz yok.";
  if (/relation .* does not exist|42P01|PGRST205|Could not find the table/i.test(m + c)) return "Veritabanı tabloları bulunamadı. SQL kurulum kodunu Supabase'de çalıştırın.";
  if (/Could not find the function|PGRST202/i.test(m + c)) return "Veritabanı fonksiyonu bulunamadı. SQL kurulum kodunu yeniden çalıştırın.";
  if (/rate limit|too many/i.test(m)) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.";
  if (/Failed to fetch|NetworkError|network/i.test(m)) return "Sunucuya ulaşılamadı. İnternet bağlantınızı ve Supabase adresini kontrol edin.";
  if (/should be different/i.test(m)) return "Yeni şifre eskisinden farklı olmalı.";
  if (/at least 6|Password should/i.test(m)) return "Şifre en az 6 karakter olmalı.";
  return m || "Bir hata oluştu.";
}
