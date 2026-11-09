// Veri katmanı: Firebase (bulut) ya da demo (tarayıcı) modu.
// Uygulamanın geri kalanı yalnızca bu dosyadaki fonksiyonları kullanır.
import { firebaseConfig, OGRETMEN_EPOSTA, OGRENCI_ALAN_ADI } from "./firebase-config.js";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
export const MOD = firebaseConfig.apiKey ? "bulut" : "demo";

export function epostaYap(giris) {
  const g = giris.trim().toLowerCase();
  return g.includes("@") ? g : `${g}@${OGRENCI_ALAN_ADI}`;
}

let api;

/* ---------------- FIREBASE ---------------- */
async function firebaseApi() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(FB + "firebase-app.js"),
    import(FB + "firebase-auth.js"),
    import(FB + "firebase-firestore.js"),
  ]);
  const app = initializeApp(firebaseConfig);
  const auth = A.getAuth(app);
  const db = F.getFirestore(app);
  const ikincil = initializeApp(firebaseConfig, "ikincil"); // öğrenci hesabı açarken öğretmen oturumu kapanmasın
  const ikincilAuth = A.getAuth(ikincil);
  const map = (s) => ({ id: s.id, ...s.data() });

  return {
    onAuth: (cb) => A.onAuthStateChanged(auth, (u) => cb(u ? { uid: u.uid, email: u.email } : null)),
    login: (id, sifre) => A.signInWithEmailAndPassword(auth, epostaYap(id), sifre),
    logout: () => A.signOut(auth),
    sifreDegistir: (yeni) => A.updatePassword(auth.currentUser, yeni),
    async ogrenciHesabiAc(kullaniciAdi, sifre) {
      const c = await A.createUserWithEmailAndPassword(ikincilAuth, epostaYap(kullaniciAdi), sifre);
      await A.signOut(ikincilAuth);
      return c.user.uid;
    },
    list: async (p) => (await F.getDocs(F.collection(db, p))).docs.map(map),
    get: async (p) => { const s = await F.getDoc(F.doc(db, p)); return s.exists() ? map(s) : null; },
    add: async (p, o) => (await F.addDoc(F.collection(db, p), { ...o, olusturma: Date.now() })).id,
    set: (p, o) => F.setDoc(F.doc(db, p), o),
    update: (p, o) => F.updateDoc(F.doc(db, p), o),
    remove: (p) => F.deleteDoc(F.doc(db, p)),
  };
}

/* ---------------- DEMO (localStorage) ---------------- */
function demoApi() {
  const KEY = "ogretmenhesap-demo";
  let bellek = null;
  const oku = () => {
    if (bellek) return bellek;
    try { bellek = JSON.parse(localStorage.getItem(KEY)); } catch { bellek = null; }
    if (!bellek) bellek = { docs: {}, hesaplar: { [OGRETMEN_EPOSTA]: { uid: "ogretmen1", sifre: "123456" } }, oturum: null };
    return bellek;
  };
  const yaz = () => { try { localStorage.setItem(KEY, JSON.stringify(bellek)); } catch {} };
  const yeniId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  let dinleyici = () => {};
  const kullanici = () => {
    const d = oku();
    if (!d.oturum) return null;
    const e = Object.keys(d.hesaplar).find((k) => d.hesaplar[k].uid === d.oturum);
    return e ? { uid: d.oturum, email: e } : null;
  };
  const hata = (code) => Object.assign(new Error(code), { code });

  return {
    onAuth(cb) { dinleyici = cb; setTimeout(() => cb(kullanici()), 0); },
    async login(id, sifre) {
      const d = oku(), h = d.hesaplar[epostaYap(id)];
      if (!h || h.sifre !== sifre) throw hata("auth/invalid-credential");
      d.oturum = h.uid; yaz(); dinleyici(kullanici());
    },
    async logout() { oku().oturum = null; yaz(); dinleyici(null); },
    async sifreDegistir(yeni) { const u = kullanici(); oku().hesaplar[u.email].sifre = yeni; yaz(); },
    async ogrenciHesabiAc(kullaniciAdi, sifre) {
      const d = oku(), e = epostaYap(kullaniciAdi);
      if (d.hesaplar[e]) throw hata("auth/email-already-in-use");
      if (sifre.length < 6) throw hata("auth/weak-password");
      const uid = yeniId(); d.hesaplar[e] = { uid, sifre }; yaz(); return uid;
    },
    async list(p) {
      const d = oku(), on = p + "/", n = p.split("/").length + 1;
      return Object.keys(d.docs).filter((k) => k.startsWith(on) && k.split("/").length === n)
        .map((k) => ({ id: k.split("/").pop(), ...d.docs[k] }));
    },
    async get(p) { const o = oku().docs[p]; return o ? { id: p.split("/").pop(), ...o } : null; },
    async add(p, o) { const id = yeniId(); oku().docs[`${p}/${id}`] = { ...o, olusturma: Date.now() }; yaz(); return id; },
    async set(p, o) { oku().docs[p] = { ...o }; yaz(); },
    async update(p, o) { const d = oku(); d.docs[p] = { ...(d.docs[p] || {}), ...o }; yaz(); },
    async remove(p) {
      const d = oku();
      Object.keys(d.docs).forEach((k) => { if (k === p || k.startsWith(p + "/")) delete d.docs[k]; });
      yaz();
    },
  };
}

export async function baslat() {
  api = MOD === "bulut" ? await firebaseApi() : demoApi();
  return api;
}
export const veri = new Proxy({}, { get: (_, k) => (...a) => api[k](...a) });

export function hataMesaji(e) {
  const c = e?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "Kullanıcı adı / e-posta ya da şifre hatalı.";
  if (c.includes("email-already-in-use")) return "Bu kullanıcı adı zaten kullanılıyor.";
  if (c.includes("weak-password")) return "Şifre en az 6 karakter olmalı.";
  if (c.includes("too-many-requests")) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.";
  if (c.includes("permission-denied")) return "Bu işlem için yetkiniz yok (Firestore kurallarını kontrol edin).";
  if (c.includes("requires-recent-login")) return "Güvenlik için çıkış yapıp yeniden girdikten sonra deneyin.";
  if (c.includes("network")) return "İnternet bağlantısı yok gibi görünüyor.";
  return "Bir hata oluştu: " + (e?.message || c);
}
