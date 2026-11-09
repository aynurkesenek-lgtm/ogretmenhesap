import { baslat, veri, MOD, hataMesaji, kullaniciAdiGoster } from "./data.js";
import { SITE, SQL_BUTONU_GOSTER } from "./ayarlar.js";

/* ---------- Yardımcılar ---------- */
const kok = document.getElementById("uygulama");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const SAATLER = ["1", "2", "3", "4", "5", "6", "7", "8"];
const isoYap = (d) => { d = new Date(d); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const bugunISO = () => isoYap(new Date());
const gunEkle = (iso, n) => { const d = new Date(iso + "T12:00"); d.setDate(d.getDate() + n); return isoYap(d); };
const gunIndex = (iso = bugunISO()) => (new Date(iso + "T12:00").getDay() + 6) % 7;
const tarihYaz = (iso, uzun) => iso ? new Date(iso + "T12:00").toLocaleDateString("tr-TR", uzun ? { weekday: "long", day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "long", weekday: "short" }) : "";
const kisaTarih = (t) => t ? new Date(t).toLocaleDateString("tr-TR") : "";
const siraTarih = (k) => (a, b) => (a[k] || "9999").localeCompare(b[k] || "9999");
const yeniOnce = (a, b) => String(b.olusturma || "").localeCompare(String(a.olusturma || ""));
const trSira = (k) => (a, b) => String(a[k] || "").localeCompare(String(b[k] || ""), "tr", { numeric: true });
const guvenliUrl = (u) => /^https?:\/\//i.test(u || "") ? u : "";

let zaman;
function bildir(m) {
  const b = document.getElementById("bildirim");
  b.textContent = m; b.classList.add("goster");
  clearTimeout(zaman); zaman = setTimeout(() => b.classList.remove("goster"), 2800);
}
async function dene(is, basari) {
  try { const r = await is(); if (basari) bildir(basari); return r ?? true; }
  catch (e) { console.error(e); bildir(hataMesaji(e)); return false; }
}
function tarihEtiketi(iso) {
  if (!iso) return "";
  const b = bugunISO();
  if (iso < b) return `<span class="etiket kirmizi">Gecikti · ${tarihYaz(iso)}</span>`;
  if (iso === b) return `<span class="etiket">Bugün</span>`;
  return `<span class="etiket gri">${tarihYaz(iso)}</span>`;
}

/* ---------- Durum ---------- */
const durum = { kullanici: null, profil: null, sayfa: "bugun" };
const benId = () => durum.kullanici.id;
const ogretmenMi = () => ["yonetici", "ogretmen"].includes(durum.profil?.rol);
const yoneticiMi = () => durum.profil?.rol === "yonetici";
const ROL_AD = { yonetici: "Yönetici", ogretmen: "Öğretmen", ogrenci: "Öğrenci" };

/* ---------- SQL kurulum penceresi ---------- */
async function sqlPenceresi() {
  let dlg = $("#sqlDialog");
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.id = "sqlDialog";
    dlg.innerHTML = `
      <div class="dlg-ust"><h2>Supabase SQL kurulum kodu</h2><button class="ikon-btn" data-kapat aria-label="Kapat">✕</button></div>
      <ol class="adimlar">
        <li><strong>Kopyala</strong> butonuna basın.</li>
        <li>Supabase'de projenizi açın → sol menüden <strong>SQL Editor</strong> → <strong>New query</strong>.</li>
        <li>Kodu yapıştırın ve <strong>Run</strong> deyin. "Success" yazısını görmelisiniz.</li>
      </ol>
      <div class="dlg-arac"><button class="btn" id="sqlKopyala">📋 Kopyala</button><span class="soluk" id="sqlBilgi"></span></div>
      <pre id="sqlKod">Yükleniyor…</pre>`;
    document.body.appendChild(dlg);
    $("[data-kapat]", dlg).addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    $("#sqlKopyala", dlg).addEventListener("click", async () => {
      const metin = $("#sqlKod", dlg).textContent;
      try { await navigator.clipboard.writeText(metin); }
      catch {
        const r = document.createRange(); r.selectNodeContents($("#sqlKod", dlg));
        const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy");
      }
      bildir("SQL kodu kopyalandı ✔");
    });
  }
  dlg.showModal();
  try {
    const kod = await (await fetch("kurulum.sql", { cache: "no-store" })).text();
    $("#sqlKod", dlg).textContent = kod;
    $("#sqlBilgi", dlg).textContent = `${kod.split("\n").length} satır`;
  } catch { $("#sqlKod", dlg).textContent = "kurulum.sql dosyası okunamadı."; }
}

/* ---------- Giriş ---------- */
function girisEkrani(mesaj = "") {
  kok.innerHTML = `
  <main class="giris-sayfa">
    <form class="giris-kutu" id="girisForm">
      <div class="logo">ÖH</div>
      <h1>${esc(SITE.baslik)}</h1>
      <p class="alt">${esc(SITE.okul)}</p>
      <label for="gk">Kullanıcı adı veya e-posta</label>
      <input id="gk" autocomplete="username" required placeholder="örn. ali.yilmaz">
      <label for="gs">Şifre</label>
      <input id="gs" type="password" autocomplete="current-password" required>
      ${mesaj ? `<div class="hata">${esc(mesaj)}</div>` : ""}
      <button class="btn tam" type="submit">Giriş yap</button>
      <p class="soluk" style="margin-top:1rem">Kullanıcı adınızı ve şifrenizi yöneticiden alabilirsiniz.</p>
      ${MOD === "demo" ? `<div class="demo-not"><strong>Demo modu:</strong> Veriler yalnızca bu tarayıcıda saklanır.<br>Yönetici girişi: <code>yonetici</code> / <code>123456</code></div>` : ""}
      ${SQL_BUTONU_GOSTER ? `<button type="button" class="btn ikincil tam" id="girisSql">🛠️ SQL kurulum kodunu göster</button>` : ""}
    </form>
  </main>`;
  $("#girisSql")?.addEventListener("click", sqlPenceresi);
  $("#girisForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", e.target); btn.disabled = true; btn.textContent = "Giriş yapılıyor…";
    try { await veri.login($("#gk").value, $("#gs").value); }
    catch (err) { girisEkrani(hataMesaji(err)); }
  });
}

async function oturumAcildi(k) {
  durum.kullanici = k;
  let p = null;
  try { p = await veri.tek("profiller", { id: k.id }); }
  catch (e) { await veri.logout(); return girisEkrani(hataMesaji(e)); }
  if (!p) { await veri.logout(); return girisEkrani("Bu hesap için profil bulunamadı. SQL kurulum kodu çalıştırıldı mı? Yöneticiye başvurun."); }
  if (p.aktif === false) { await veri.logout(); return girisEkrani("Hesabınız yönetici tarafından kapatılmış."); }
  durum.profil = p;
  durum.sayfa = "bugun";
  kabuk();
}

/* ---------- Kabuk ---------- */
function menu() {
  if (!ogretmenMi()) return [["bugun", "🏠", "Bugün"], ["odevler", "📚", "Ödevlerim"], ["gorevler", "✅", "Yapılacaklarım"], ["duyurular", "📢", "Duyurular"]];
  return [
    ["bugun", "🏠", "Bugün"], ["gunluk", "📅", "Günlük Aktiviteler"], ["yillik", "🗂️", "Yıllık Planlar"], ["moduller", "🧩", "Ders Modülleri"],
    ["program", "🗓️", "Ders Programı"], ["gorevler", "✅", "Görevlerim"], ["notlar", "📝", "Notlarım"], ["duyurular", "📢", "Duyurular"],
    ["odevler", "📚", "Ödevler"], ["kullanicilar", "👥", yoneticiMi() ? "Kullanıcılar" : "Öğrenciler"],
  ];
}

function kabuk() {
  const p = durum.profil;
  const altBilgi = p.rol === "ogrenci" ? `Öğrenci · ${esc(p.sinif || "")}` : ROL_AD[p.rol] + (p.brans ? ` · ${esc(p.brans)}` : "");
  kok.innerHTML = `
  ${MOD === "demo" ? `<div class="demo-serit">Demo modu — veriler yalnızca bu tarayıcıda saklanır. Supabase bilgileri girilince bulut moduna geçer.</div>` : ""}
  <div class="kabuk">
    <nav class="yan" aria-label="Ana menü">
      <div class="kim"><strong>${esc(p.ad)}</strong><span>${altBilgi}</span></div>
      ${menu().map(([id, ik, ad]) => `<button class="menu-btn" data-sayfa="${id}"><span aria-hidden="true">${ik}</span>${ad}</button>`).join("")}
      <div class="alt-kisim">
        ${SQL_BUTONU_GOSTER && yoneticiMi() ? `<button class="menu-btn sql-btn" id="sqlBtn"><span aria-hidden="true">🛠️</span>SQL Kurulum</button>` : ""}
        <button class="menu-btn" data-sayfa="hesap"><span aria-hidden="true">⚙️</span>Hesabım</button>
        <button class="menu-btn" id="cikis"><span aria-hidden="true">🚪</span>Çıkış</button>
      </div>
    </nav>
    <main class="ana" id="ana"></main>
  </div>`;
  $$(".menu-btn[data-sayfa]").forEach((b) => b.addEventListener("click", () => { durum.sayfa = b.dataset.sayfa; sayfaGoster(); }));
  $("#sqlBtn")?.addEventListener("click", sqlPenceresi);
  $("#cikis").addEventListener("click", () => veri.logout());
  sayfaGoster();
}

async function sayfaGoster() {
  $$(".menu-btn[data-sayfa]").forEach((b) => b.classList.toggle("aktif", b.dataset.sayfa === durum.sayfa));
  const ana = $("#ana");
  ana.innerHTML = `<div class="yukleniyor">Yükleniyor…</div>`;
  const s = ogretmenMi() ? OGRETMEN : OGRENCI;
  try { await (s[durum.sayfa] || s.bugun)(ana); }
  catch (e) { console.error(e); ana.innerHTML = `<div class="hata">${esc(hataMesaji(e))}</div>`; }
}
const yenile = () => sayfaGoster();
const baslik = (b, alt = "", sag = "") => `<div class="ust-baslik"><div><h1>${b}</h1>${alt ? `<p>${alt}</p>` : ""}</div>${sag}</div>`;
const silBagla = (ana, tablo, onay, mesaj, anahtar = "id") =>
  $$("[data-sil]", ana).forEach((b) => b.addEventListener("click", async () => {
    if (onay && !confirm(onay)) return;
    if (await dene(() => veri.sil(tablo, { [anahtar]: b.dataset.sil }), mesaj)) yenile();
  }));

/* ---------- Ortak sayfalar ---------- */
async function gorevSayfasi(ana, ustBaslik) {
  const gorevler = (await veri.liste("gorevler", { esit: { sahip_id: benId() } })).sort(siraTarih("tarih"));
  const f = durum.gorevFiltre || "acik";
  const gorunen = gorevler.filter((g) => f === "hepsi" || (f === "acik" ? !g.bitti : g.bitti));
  ana.innerHTML = baslik(ustBaslik, `${gorevler.filter((g) => !g.bitti).length} açık görev`) + `
  <div class="kart">
    <form class="hizli-ekle" id="gorevForm">
      <input type="text" id="gBaslik" placeholder="Yeni görev yazın…" required aria-label="Görev">
      <input type="date" id="gTarih" aria-label="Tarih (isteğe bağlı)">
      <button class="btn">Ekle</button>
    </form>
    <div class="sekmeler">${[["acik", "Açık"], ["bitti", "Tamamlanan"], ["hepsi", "Hepsi"]].map(([k, a]) => `<button data-f="${k}" class="${f === k ? "aktif" : ""}">${a}</button>`).join("")}</div>
    ${gorunen.length ? `<ul class="liste">${gorunen.map((g) => `
      <li class="${g.bitti ? "bitti" : ""}"><input type="checkbox" data-id="${g.id}" ${g.bitti ? "checked" : ""} aria-label="Tamamlandı">
        <div class="icerik"><span class="baslik-metin">${esc(g.baslik)}</span> ${g.bitti ? "" : tarihEtiketi(g.tarih)}</div>
        <button class="ikon-btn" data-sil="${g.id}" aria-label="Sil" title="Sil">✕</button></li>`).join("")}</ul>` : `<p class="bos">Burada görev yok.</p>`}
  </div>`;
  $("#gorevForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await dene(() => veri.ekle("gorevler", { sahip_id: benId(), baslik: $("#gBaslik").value.trim(), tarih: $("#gTarih").value || null, bitti: false }))) yenile();
  });
  $$(".sekmeler button", ana).forEach((b) => b.addEventListener("click", () => { durum.gorevFiltre = b.dataset.f; yenile(); }));
  $$("input[data-id]", ana).forEach((c) => c.addEventListener("change", async () => { await dene(() => veri.guncelle("gorevler", { id: c.dataset.id }, { bitti: c.checked })); yenile(); }));
  silBagla(ana, "gorevler", null, "Görev silindi");
}

async function hesapSayfasi(ana) {
  const k = durum.kullanici;
  ana.innerHTML = baslik("Hesabım") + `
  <div class="izgara" style="max-width:820px">
    <form class="kart" id="adForm">
      <h2>Profil</h2>
      <p class="soluk" style="margin:0">${ROL_AD[durum.profil.rol]} · ${durum.profil.kullanici_adi ? "Kullanıcı adı: " + esc(durum.profil.kullanici_adi) : "E-posta: " + esc(kullaniciAdiGoster(k.email))}</p>
      <label for="pAd">Ad Soyad</label><input id="pAd" value="${esc(durum.profil.ad)}" required>
      <button class="btn tam">Kaydet</button>
    </form>
    <form class="kart" id="sifreForm">
      <h2>Şifre değiştir</h2>
      <label for="s1">Yeni şifre</label><input id="s1" type="password" minlength="6" required autocomplete="new-password">
      <label for="s2">Yeni şifre (tekrar)</label><input id="s2" type="password" minlength="6" required autocomplete="new-password">
      <button class="btn tam">Şifreyi güncelle</button>
    </form>
  </div>`;
  $("#adForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const ad = $("#pAd").value.trim();
    if (await dene(() => veri.rpc("profil_ad_degistir", { p_ad: ad }), "Profil güncellendi")) { durum.profil.ad = ad; kabuk(); }
  });
  $("#sifreForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("#s1").value !== $("#s2").value) return bildir("Şifreler aynı değil.");
    if (await dene(() => veri.sifreDegistir($("#s1").value), "Şifreniz güncellendi")) e.target.reset();
  });
}

/* ================= ÖĞRETMEN / YÖNETİCİ ================= */
const ogrencileriGetir = async () => (await veri.liste("profiller", { esit: { rol: "ogrenci" } })).sort((a, b) => trSira("sinif")(a, b) || trSira("ad")(a, b));
const siniflar = (ogr) => [...new Set(ogr.map((o) => o.sinif).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr", { numeric: true }));
const sinifSecici = (id, liste) => `<select id="${id}">${["Tümü", ...liste].map((s) => `<option>${esc(s)}</option>`).join("")}</select>`;
const programGetir = async () => (await veri.tek("ders_programi", { ogretmen_id: benId() })) || { hucreler: {}, saatler: {} };

const OGRETMEN = {
  async bugun(ana) {
    const b = bugunISO(), gi = gunIndex();
    const [gorevler, program, notlar, aktiviteler, odevler] = await Promise.all([
      veri.liste("gorevler", { esit: { sahip_id: benId() } }), programGetir(), veri.liste("notlar", { esit: { ogretmen_id: benId() } }),
      veri.liste("gunluk_aktiviteler", { esit: { ogretmen_id: benId(), tarih: b }, sira: "ders_saati" }), veri.liste("odevler", { esit: { ogretmen_id: benId() } }),
    ]);
    const acik = gorevler.filter((g) => !g.bitti);
    const bugunku = acik.filter((g) => g.tarih && g.tarih <= b).sort(siraTarih("tarih"));
    const dersler = gi < 5 ? SAATLER.map((s) => [s, program.hucreler?.[`${gi}-${s}`], program.saatler?.[s]]).filter(([, d]) => d) : [];
    const sa = new Date().getHours();
    ana.innerHTML = baslik(`${sa < 12 ? "Günaydın" : sa < 18 ? "İyi günler" : "İyi akşamlar"}, ${esc(durum.profil.ad.split(" ")[0])}`, tarihYaz(b, true)) + `
    <div class="istatistik">
      <div class="kart"><div class="soluk">Bugünkü ders</div><div class="sayi">${dersler.length}</div></div>
      <div class="kart"><div class="soluk">Bugünkü aktivite</div><div class="sayi">${aktiviteler.filter((a) => a.yapildi).length}/${aktiviteler.length}</div></div>
      <div class="kart"><div class="soluk">Açık görev</div><div class="sayi">${acik.length}</div></div>
      <div class="kart"><div class="soluk">Aktif ödev</div><div class="sayi">${odevler.filter((o) => !o.son_tarih || o.son_tarih >= b).length}</div></div>
    </div>
    <div class="izgara">
      <section class="kart">
        <div class="kart-baslik"><h2>Bugünkü derslerim</h2><button class="btn ikincil kucuk" data-git="program">Program</button></div>
        ${gi > 4 ? `<p class="bos">Bugün hafta sonu. İyi dinlenmeler!</p>` : dersler.length ? `<ul class="liste">${dersler.map(([s, d, saat]) => `<li><span class="etiket">${s}. ders</span><div class="icerik">${esc(d)} ${saat ? `<span class="soluk">${esc(saat)}</span>` : ""}</div></li>`).join("")}</ul>` : `<p class="bos">Bugün için programda ders yok.</p>`}
      </section>
      <section class="kart">
        <div class="kart-baslik"><h2>Bugünkü aktiviteler</h2><button class="btn ikincil kucuk" data-git="gunluk">Planla</button></div>
        ${aktiviteler.length ? `<ul class="liste">${aktiviteler.map((a) => `<li class="${a.yapildi ? "bitti" : ""}"><input type="checkbox" data-akt="${a.id}" ${a.yapildi ? "checked" : ""} aria-label="Yapıldı"><div class="icerik"><span class="baslik-metin">${esc(a.aktivite)}</span><br><span class="soluk">${[a.ders_saati && a.ders_saati + ". ders", a.sinif, a.ders].filter(Boolean).map(esc).join(" · ")}</span></div></li>`).join("")}</ul>` : `<p class="bos">Bugün için aktivite planlanmamış.</p>`}
      </section>
      <section class="kart">
        <div class="kart-baslik"><h2>Yapılacaklar</h2><button class="btn ikincil kucuk" data-git="gorevler">Tümü</button></div>
        <form class="hizli-ekle" id="hizliGorev"><input type="text" id="hg" placeholder="Hızlı görev ekle…" required aria-label="Hızlı görev"><button class="btn">Ekle</button></form>
        ${bugunku.length ? `<ul class="liste">${bugunku.map((g) => `<li><input type="checkbox" data-id="${g.id}" aria-label="Tamamlandı"><div class="icerik">${esc(g.baslik)} ${tarihEtiketi(g.tarih)}</div></li>`).join("")}</ul>` : `<p class="bos">Bugüne ait ya da geciken görev yok.</p>`}
      </section>
      <section class="kart">
        <div class="kart-baslik"><h2>Son notlarım</h2><button class="btn ikincil kucuk" data-git="notlar">Tümü</button></div>
        ${notlar.length ? `<ul class="liste">${notlar.sort(yeniOnce).slice(0, 4).map((n) => `<li><div class="icerik"><strong>${esc(n.baslik)}</strong><p class="soluk">${esc((n.metin || "").slice(0, 120))}</p></div></li>`).join("")}</ul>` : `<p class="bos">Henüz not yok.</p>`}
      </section>
    </div>`;
    $$("[data-git]", ana).forEach((x) => x.addEventListener("click", () => { durum.sayfa = x.dataset.git; sayfaGoster(); }));
    $("#hizliGorev").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.ekle("gorevler", { sahip_id: benId(), baslik: $("#hg").value.trim(), tarih: b, bitti: false }), "Görev eklendi")) yenile();
    });
    $$("input[data-id]", ana).forEach((c) => c.addEventListener("change", async () => { await dene(() => veri.guncelle("gorevler", { id: c.dataset.id }, { bitti: true }), "Tamamlandı 🎉"); yenile(); }));
    $$("input[data-akt]", ana).forEach((c) => c.addEventListener("change", async () => { await dene(() => veri.guncelle("gunluk_aktiviteler", { id: c.dataset.akt }, { yapildi: c.checked })); yenile(); }));
  },

  /* --- Günlük aktiviteler --- */
  async gunluk(ana) {
    const t = durum.gunTarih || bugunISO(), gi = gunIndex(t);
    const [akt, program] = await Promise.all([veri.liste("gunluk_aktiviteler", { esit: { ogretmen_id: benId(), tarih: t } }), programGetir()]);
    akt.sort(trSira("ders_saati"));
    const dersler = gi < 5 ? SAATLER.map((s) => [s, program.hucreler?.[`${gi}-${s}`]]).filter(([, d]) => d) : [];
    ana.innerHTML = baslik("Günlük Aktiviteler", "Her gün için ders içi etkinliklerinizi planlayın ve yaptıklarınızı işaretleyin.") + `
    <div class="kart">
      <div class="tarih-gezgin">
        <button class="btn ikincil kucuk" data-gun="-1" aria-label="Önceki gün">‹</button>
        <input type="date" id="gunSec" value="${t}" aria-label="Tarih">
        <button class="btn ikincil kucuk" data-gun="1" aria-label="Sonraki gün">›</button>
        <button class="btn ikincil kucuk" data-gun="0">Bugün</button>
        <strong>${tarihYaz(t, true)}</strong>
      </div>
      ${dersler.length ? `<p class="soluk" style="margin:.75rem 0 .3rem">Bu günün programı (tıklayınca forma aktarılır):</p><div class="cipler">${dersler.map(([s, d]) => `<button type="button" class="cip" data-saat="${s}" data-ders="${esc(d)}">${s}. ders · ${esc(d)}</button>`).join("")}</div>` : ""}
    </div>
    <form class="kart" id="aktForm">
      <h2>Aktivite ekle</h2>
      <div class="form-satir">
        <div><label for="aSaat">Ders saati</label><select id="aSaat"><option value="">—</option>${SAATLER.map((s) => `<option value="${s}">${s}. ders</option>`).join("")}</select></div>
        <div><label for="aSinif">Sınıf</label><input id="aSinif" placeholder="örn. 5-A"></div>
        <div><label for="aDers">Ders</label><input id="aDers" placeholder="örn. Matematik"></div>
      </div>
      <label for="aAkt">Aktivite</label><input id="aAkt" required placeholder="örn. Kesir kartlarıyla grup çalışması">
      <label for="aNot">Not (isteğe bağlı)</label><textarea id="aNot" style="min-height:60px" placeholder="Materyal, gözlem, sonraki derse not…"></textarea>
      <button class="btn" style="margin-top:.75rem">Ekle</button>
    </form>
    <div class="kart">
      <div class="kart-baslik"><h2>Aktiviteler</h2><span class="etiket gri">${akt.filter((a) => a.yapildi).length}/${akt.length} yapıldı</span></div>
      ${akt.length ? `<ul class="liste">${akt.map((a) => `<li class="${a.yapildi ? "bitti" : ""}">
        <input type="checkbox" data-akt="${a.id}" ${a.yapildi ? "checked" : ""} aria-label="Yapıldı">
        <div class="icerik"><span class="baslik-metin">${esc(a.aktivite)}</span>
          <br><span class="soluk">${[a.ders_saati && a.ders_saati + ". ders", a.sinif, a.ders].filter(Boolean).map(esc).join(" · ")}</span>
          ${a.notlar ? `<p class="soluk">${esc(a.notlar)}</p>` : ""}</div>
        <button class="ikon-btn" data-sil="${a.id}" aria-label="Sil" title="Sil">✕</button></li>`).join("")}</ul>` : `<p class="bos">Bu gün için aktivite yok.</p>`}
    </div>`;
    $$("[data-gun]", ana).forEach((b) => b.addEventListener("click", () => { const n = +b.dataset.gun; durum.gunTarih = n ? gunEkle(t, n) : bugunISO(); yenile(); }));
    $("#gunSec").addEventListener("change", (e) => { if (e.target.value) { durum.gunTarih = e.target.value; yenile(); } });
    $$(".cip", ana).forEach((c) => c.addEventListener("click", () => {
      $("#aSaat").value = c.dataset.saat;
      const [sinif, ...ders] = c.dataset.ders.split(" ");
      if (/^\d/.test(sinif)) { $("#aSinif").value = sinif; $("#aDers").value = ders.join(" "); } else $("#aDers").value = c.dataset.ders;
      $("#aAkt").focus();
    }));
    $("#aktForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.ekle("gunluk_aktiviteler", { ogretmen_id: benId(), tarih: t, ders_saati: $("#aSaat").value || null, sinif: $("#aSinif").value.trim().toUpperCase() || null, ders: $("#aDers").value.trim() || null, aktivite: $("#aAkt").value.trim(), notlar: $("#aNot").value.trim() || null, yapildi: false }), "Aktivite eklendi")) yenile();
    });
    $$("input[data-akt]", ana).forEach((c) => c.addEventListener("change", async () => { await dene(() => veri.guncelle("gunluk_aktiviteler", { id: c.dataset.akt }, { yapildi: c.checked })); yenile(); }));
    silBagla(ana, "gunluk_aktiviteler", "Aktivite silinsin mi?", "Aktivite silindi");
  },

  /* --- Yıllık planlar --- */
  async yillik(ana) {
    const tum = await veri.liste("yillik_planlar", { esit: { ogretmen_id: benId() } });
    const gruplar = [...new Map(tum.map((r) => [`${r.ders}|${r.sinif_duzeyi}`, { ders: r.ders, sinif: r.sinif_duzeyi, sayi: 0 }])).values()];
    gruplar.forEach((g) => (g.sayi = tum.filter((r) => r.ders === g.ders && r.sinif_duzeyi === g.sinif).length));
    gruplar.sort((a, b) => trSira("ders")(a, b) || trSira("sinif")(a, b));
    let sec = durum.yp && gruplar.find((g) => g.ders === durum.yp.ders && g.sinif === durum.yp.sinif) ? durum.yp : (durum.yp?.yeni ? durum.yp : gruplar[0]);
    const satirlar = sec ? tum.filter((r) => r.ders === sec.ders && r.sinif_duzeyi === sec.sinif).sort((a, b) => (a.hafta ?? 999) - (b.hafta ?? 999)) : [];
    const KOL = [["hafta", "Hafta"], ["tarih_araligi", "Tarih"], ["unite", "Ünite / Tema"], ["konu", "Konu"], ["kazanim", "Öğrenme çıktısı / Kazanım"], ["yontem", "Yöntem-Teknik"], ["olcme", "Ölçme-Değerlendirme"], ["aciklama", "Açıklama"]];
    ana.innerHTML = baslik("Yıllık Planlar", `${esc(SITE.egitimYili)} eğitim-öğretim yılı · ders ve sınıf düzeyine göre haftalık plan`) + `
    <div class="kart">
      <div class="sekmeler">
        ${gruplar.map((g) => `<button data-ders="${esc(g.ders)}" data-sinif="${esc(g.sinif)}" class="${sec && g.ders === sec.ders && g.sinif === sec.sinif ? "aktif" : ""}">${esc(g.ders)} · ${esc(g.sinif)}. sınıf <span class="soluk">(${g.sayi})</span></button>`).join("")}
      </div>
      <form class="hizli-ekle" id="yeniPlan">
        <input type="text" id="ypDers" placeholder="Ders (örn. Matematik)" required aria-label="Ders">
        <input type="text" id="ypSinif" placeholder="Sınıf düzeyi (örn. 5)" required aria-label="Sınıf düzeyi" style="flex:0 1 170px">
        <button class="btn ikincil">+ Yeni plan</button>
      </form>
    </div>
    ${sec ? `
    <div class="kart">
      <div class="kart-baslik"><h2>${esc(sec.ders)} · ${esc(sec.sinif)}. sınıf</h2><span class="etiket gri">${satirlar.length} hafta</span></div>
      ${satirlar.length ? `<div class="tablo-kap"><table class="plan"><thead><tr>${KOL.map(([, a]) => `<th>${a}</th>`).join("")}<th></th></tr></thead>
        <tbody>${satirlar.map((r) => `<tr>${KOL.map(([k]) => `<td>${esc(r[k])}</td>`).join("")}<td><button class="ikon-btn" data-sil="${r.id}" aria-label="Satırı sil" title="Sil">✕</button></td></tr>`).join("")}</tbody></table></div>`
        : `<p class="bos">Bu plan henüz boş. Aşağıdan satır ekleyin ya da Excel'den yapıştırın.</p>`}
    </div>
    <form class="kart" id="satirForm">
      <h2>Hafta ekle</h2>
      <div class="form-satir">
        <div><label for="yHafta">Hafta</label><input id="yHafta" type="number" min="1" max="40" value="${(satirlar.at(-1)?.hafta || 0) + 1}"></div>
        <div><label for="yTarih">Tarih aralığı</label><input id="yTarih" placeholder="örn. 8-12 Eylül"></div>
        <div><label for="yUnite">Ünite / Tema</label><input id="yUnite"></div>
        <div><label for="yKonu">Konu</label><input id="yKonu"></div>
      </div>
      <label for="yKaz">Öğrenme çıktısı / Kazanım</label><textarea id="yKaz" style="min-height:60px"></textarea>
      <div class="form-satir">
        <div><label for="yYon">Yöntem-Teknik</label><input id="yYon"></div>
        <div><label for="yOlc">Ölçme-Değerlendirme</label><input id="yOlc"></div>
        <div><label for="yAc">Açıklama</label><input id="yAc" placeholder="Belirli gün ve haftalar vb."></div>
      </div>
      <button class="btn" style="margin-top:.75rem">Satırı ekle</button>
    </form>
    <form class="kart" id="excelForm">
      <h2>Excel'den toplu yapıştır</h2>
      <p class="soluk" style="margin-top:0">Excel / Word tablosundan satırları kopyalayıp yapıştırın. Sütun sırası: <strong>Hafta · Tarih · Ünite · Konu · Kazanım · Yöntem · Ölçme · Açıklama</strong> (eksik sütunlar boş kalır).</p>
      <textarea id="excelMetin" placeholder="1&#9;8-12 Eylül&#9;Sayılar ve Nicelikler&#9;..."></textarea>
      <button class="btn" style="margin-top:.75rem">İçe aktar</button>
    </form>` : `<p class="bos">Henüz yıllık plan yok. Yukarıdan ders ve sınıf düzeyi yazarak yeni plan başlatın.</p>`}`;
    $$(".sekmeler button", ana).forEach((b) => b.addEventListener("click", () => { durum.yp = { ders: b.dataset.ders, sinif: b.dataset.sinif }; yenile(); }));
    $("#yeniPlan").addEventListener("submit", (e) => { e.preventDefault(); durum.yp = { ders: $("#ypDers").value.trim(), sinif: $("#ypSinif").value.trim(), yeni: true }; yenile(); });
    if (!sec) return;
    const temel = { ogretmen_id: benId(), egitim_yili: SITE.egitimYili, ders: sec.ders, sinif_duzeyi: sec.sinif };
    $("#satirForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const v = (id) => $(id).value.trim() || null;
      const ok = await dene(() => veri.ekle("yillik_planlar", { ...temel, hafta: +$("#yHafta").value || null, tarih_araligi: v("#yTarih"), unite: v("#yUnite"), konu: v("#yKonu"), kazanim: v("#yKaz"), yontem: v("#yYon"), olcme: v("#yOlc"), aciklama: v("#yAc") }), "Satır eklendi");
      if (ok) { durum.yp = { ders: sec.ders, sinif: sec.sinif }; yenile(); }
    });
    $("#excelForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const kayitlar = $("#excelMetin").value.split(/\r?\n/).filter((l) => l.trim()).map((l) => {
        const c = l.split("\t").map((x) => x.trim() || null);
        const h = parseInt(c[0], 10);
        return { ...temel, hafta: Number.isFinite(h) ? h : null, tarih_araligi: c[1] ?? null, unite: c[2] ?? null, konu: c[3] ?? null, kazanim: c[4] ?? null, yontem: c[5] ?? null, olcme: c[6] ?? null, aciklama: c.slice(7).filter(Boolean).join(" ") || null };
      });
      if (!kayitlar.length) return bildir("Yapıştırılmış satır bulunamadı.");
      if (await dene(() => veri.ekle("yillik_planlar", kayitlar), `${kayitlar.length} satır içe aktarıldı`)) { durum.yp = { ders: sec.ders, sinif: sec.sinif }; yenile(); }
    });
    silBagla(ana, "yillik_planlar", "Bu hafta satırı silinsin mi?", "Satır silindi");
  },

  /* --- Ders modülleri --- */
  async moduller(ana) {
    const mods = (await veri.liste("ders_modulleri", { esit: { ogretmen_id: benId() } })).sort((a, b) => trSira("ders")(a, b) || trSira("sinif_duzeyi")(a, b) || (a.sira - b.sira) || trSira("baslik")(a, b));
    const duz = durum.modulDuzenle ? mods.find((m) => m.id === durum.modulDuzenle) : null;
    const f = durum.modulFiltre || "Tümü";
    const dersler = [...new Set(mods.map((m) => m.ders).filter(Boolean))];
    const gorunen = mods.filter((m) => f === "Tümü" || m.ders === f);
    ana.innerHTML = baslik("Ders Modülleri", "Ünite ve konulara göre ders içeriklerinizi, materyallerinizi ve bağlantılarınızı düzenleyin.") + `
    <form class="kart" id="modForm">
      <h2>${duz ? "Modülü düzenle" : "Yeni modül"}</h2>
      <div class="form-satir">
        <div><label for="mBaslik">Modül başlığı</label><input id="mBaslik" required value="${esc(duz?.baslik)}" placeholder="örn. Kesirlerle İşlemler"></div>
        <div><label for="mDers">Ders</label><input id="mDers" value="${esc(duz?.ders)}" placeholder="Matematik" list="dersListe"><datalist id="dersListe">${dersler.map((d) => `<option value="${esc(d)}">`).join("")}</datalist></div>
        <div><label for="mSinif">Sınıf düzeyi</label><input id="mSinif" value="${esc(duz?.sinif_duzeyi)}" placeholder="5"></div>
        <div><label for="mSira">Sıra</label><input id="mSira" type="number" value="${esc(duz?.sira ?? mods.length + 1)}"></div>
      </div>
      <label for="mAc">Kısa açıklama</label><input id="mAc" value="${esc(duz?.aciklama)}" placeholder="Modülün amacı ve kapsamı">
      <label for="mIcerik">İçerik (ders akışı, etkinlikler, materyaller)</label><textarea id="mIcerik">${esc(duz?.icerik)}</textarea>
      <label for="mUrl">Kaynak bağlantısı</label><input id="mUrl" type="url" value="${esc(duz?.kaynak_url)}" placeholder="https://…">
      <div style="display:flex;gap:.5rem;margin-top:.75rem"><button class="btn">${duz ? "Değişiklikleri kaydet" : "Modülü ekle"}</button>${duz ? `<button type="button" class="btn ikincil" id="mVazgec">Vazgeç</button>` : ""}</div>
    </form>
    ${dersler.length > 1 ? `<div class="sekmeler">${["Tümü", ...dersler].map((d) => `<button data-mf="${esc(d)}" class="${f === d ? "aktif" : ""}">${esc(d)}</button>`).join("")}</div>` : ""}
    ${gorunen.length ? `<div class="izgara">${gorunen.map((m) => `
      <article class="kart modul">
        <div class="kart-baslik"><h3>${esc(m.baslik)}</h3><div style="white-space:nowrap"><button class="ikon-btn" data-duz="${m.id}" aria-label="Düzenle" title="Düzenle">✎</button><button class="ikon-btn" data-sil="${m.id}" aria-label="Sil" title="Sil">✕</button></div></div>
        <div>${m.ders ? `<span class="etiket">${esc(m.ders)}</span>` : ""} ${m.sinif_duzeyi ? `<span class="etiket gri">${esc(m.sinif_duzeyi)}. sınıf</span>` : ""}</div>
        ${m.aciklama ? `<p style="margin:.5rem 0 0">${esc(m.aciklama)}</p>` : ""}
        ${m.icerik ? `<details><summary>İçeriği göster</summary><p style="white-space:pre-wrap">${esc(m.icerik)}</p></details>` : ""}
        ${guvenliUrl(m.kaynak_url) ? `<p style="margin:.5rem 0 0"><a href="${esc(m.kaynak_url)}" target="_blank" rel="noopener">🔗 Kaynağı aç</a></p>` : ""}
      </article>`).join("")}</div>` : `<p class="bos">Henüz modül yok.</p>`}`;
    $("#modForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const kayit = { baslik: $("#mBaslik").value.trim(), ders: $("#mDers").value.trim() || null, sinif_duzeyi: $("#mSinif").value.trim() || null, sira: +$("#mSira").value || 0, aciklama: $("#mAc").value.trim() || null, icerik: $("#mIcerik").value.trim() || null, kaynak_url: $("#mUrl").value.trim() || null };
      const ok = duz ? await dene(() => veri.guncelle("ders_modulleri", { id: duz.id }, kayit), "Modül güncellendi")
                     : await dene(() => veri.ekle("ders_modulleri", { ...kayit, ogretmen_id: benId() }), "Modül eklendi");
      if (ok) { durum.modulDuzenle = null; yenile(); }
    });
    $("#mVazgec")?.addEventListener("click", () => { durum.modulDuzenle = null; yenile(); });
    $$("[data-duz]", ana).forEach((b) => b.addEventListener("click", () => { durum.modulDuzenle = b.dataset.duz; yenile().then(() => window.scrollTo(0, 0)); }));
    $$("[data-mf]", ana).forEach((b) => b.addEventListener("click", () => { durum.modulFiltre = b.dataset.mf; yenile(); }));
    silBagla(ana, "ders_modulleri", "Modül silinsin mi?", "Modül silindi");
  },

  /* --- Ders programı --- */
  async program(ana) {
    const p = await programGetir();
    const h = p.hucreler || {}, saatler = p.saatler || {}, gi = gunIndex();
    ana.innerHTML = baslik("Ders Programı", "Hücrelere sınıf ve dersi yazın (örn. 5-A Matematik). Değişiklikler otomatik kaydedilir.") + `
    <div class="kart tablo-kap">
      <table class="program">
        <thead><tr><th>Ders</th>${GUNLER.map((g, i) => `<th class="${i === gi ? "bugun" : ""}">${g}</th>`).join("")}</tr></thead>
        <tbody>${SAATLER.map((s) => `<tr>
          <th class="saat">${s}. ders<br><input data-saat="${s}" value="${esc(saatler[s] || "")}" placeholder="08.30" aria-label="${s}. ders saati" style="font-size:.75rem;padding:.2rem"></th>
          ${GUNLER.map((_, i) => `<td class="${i === gi ? "bugun" : ""}"><input data-h="${i}-${s}" value="${esc(h[`${i}-${s}`] || "")}" aria-label="${GUNLER[i]} ${s}. ders"></td>`).join("")}
        </tr>`).join("")}</tbody>
      </table>
    </div>`;
    let bekle;
    $$("input", ana).forEach((i) => i.addEventListener("input", () => {
      clearTimeout(bekle);
      bekle = setTimeout(() => {
        const hucreler = {}, sa = {};
        $$("input[data-h]", ana).forEach((x) => { if (x.value.trim()) hucreler[x.dataset.h] = x.value.trim(); });
        $$("input[data-saat]", ana).forEach((x) => { if (x.value.trim()) sa[x.dataset.saat] = x.value.trim(); });
        dene(() => veri.upsert("ders_programi", { ogretmen_id: benId(), hucreler, saatler: sa, guncelleme: new Date().toISOString() }, ["ogretmen_id"]), "Program kaydedildi");
      }, 800);
    }));
  },

  gorevler: (ana) => gorevSayfasi(ana, "Görevlerim"),

  /* --- Notlar --- */
  async notlar(ana) {
    const notlar = (await veri.liste("notlar", { esit: { ogretmen_id: benId() } })).sort(yeniOnce);
    const etiketler = [...new Set(notlar.map((n) => n.etiket).filter(Boolean))];
    const f = durum.notFiltre || "Tümü";
    const gorunen = notlar.filter((n) => f === "Tümü" || n.etiket === f);
    ana.innerHTML = baslik("Notlarım", "Toplantı notları, gözlemler, fikirler — yalnızca siz görürsünüz.") + `
    <form class="kart" id="notForm">
      <div class="form-satir">
        <div><label for="nb">Başlık</label><input id="nb" required placeholder="örn. Zümre toplantısı"></div>
        <div><label for="ne">Etiket</label><input id="ne" placeholder="örn. Zümre, eTwinning" list="etiketListe"><datalist id="etiketListe">${etiketler.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div>
      </div>
      <label for="nm">Not</label><textarea id="nm"></textarea>
      <button class="btn" style="margin-top:.75rem">Notu kaydet</button>
    </form>
    ${etiketler.length ? `<div class="sekmeler">${["Tümü", ...etiketler].map((x) => `<button data-nf="${esc(x)}" class="${f === x ? "aktif" : ""}">${esc(x)}</button>`).join("")}</div>` : ""}
    ${gorunen.length ? `<div class="izgara">${gorunen.map((n) => `
      <article class="not-kart"><button class="ikon-btn" data-sil="${n.id}" aria-label="Notu sil" title="Sil">✕</button>
        <h3>${esc(n.baslik)}</h3><p>${esc(n.metin)}</p>
        <div class="soluk" style="margin-top:.5rem">${kisaTarih(n.olusturma)} ${n.etiket ? `· <span class="etiket gri">${esc(n.etiket)}</span>` : ""}</div></article>`).join("")}</div>` : `<p class="bos">Henüz not yok.</p>`}`;
    $("#notForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.ekle("notlar", { ogretmen_id: benId(), baslik: $("#nb").value.trim(), metin: $("#nm").value.trim() || null, etiket: $("#ne").value.trim() || null }), "Not kaydedildi")) yenile();
    });
    $$("[data-nf]", ana).forEach((b) => b.addEventListener("click", () => { durum.notFiltre = b.dataset.nf; yenile(); }));
    silBagla(ana, "notlar", "Not silinsin mi?", "Not silindi");
  },

  /* --- Duyurular --- */
  async duyurular(ana) {
    const [duyurular, ogr] = await Promise.all([veri.liste("duyurular", { esit: { ogretmen_id: benId() } }), ogrencileriGetir()]);
    duyurular.sort(yeniOnce);
    ana.innerHTML = baslik("Duyurular", "Seçtiğiniz sınıftaki öğrenciler kendi panellerinde görür.") + `
    <form class="kart" id="dForm">
      <div class="form-satir">
        <div><label for="db">Başlık</label><input id="db" required></div>
        <div><label for="ds">Sınıf</label>${sinifSecici("ds", siniflar(ogr))}</div>
      </div>
      <label for="dm">Duyuru metni</label><textarea id="dm" required></textarea>
      <button class="btn" style="margin-top:.75rem">Yayınla</button>
    </form>
    <div class="kart">${duyurular.length ? `<ul class="liste">${duyurular.map((d) => `
      <li><div class="icerik"><strong>${esc(d.baslik)}</strong> <span class="etiket">${esc(d.sinif)}</span>
        <p>${esc(d.metin)}</p><span class="soluk">${kisaTarih(d.olusturma)}</span></div>
        <button class="ikon-btn" data-sil="${d.id}" aria-label="Duyuruyu sil" title="Sil">✕</button></li>`).join("")}</ul>` : `<p class="bos">Henüz duyuru yok.</p>`}</div>`;
    $("#dForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.ekle("duyurular", { ogretmen_id: benId(), baslik: $("#db").value.trim(), metin: $("#dm").value.trim(), sinif: $("#ds").value }), "Duyuru yayınlandı")) yenile();
    });
    silBagla(ana, "duyurular", "Duyuru silinsin mi?", "Duyuru silindi");
  },

  /* --- Ödevler --- */
  async odevler(ana) {
    const [odevler, ogr, teslim] = await Promise.all([veri.liste("odevler", { esit: { ogretmen_id: benId() } }), ogrencileriGetir(), veri.liste("odev_teslim")]);
    odevler.sort((a, b) => (b.son_tarih || "").localeCompare(a.son_tarih || ""));
    ana.innerHTML = baslik("Ödevler", "Öğrenciler ödevi tamamladığında işaretler; durumu buradan izlersiniz.") + `
    <form class="kart" id="oForm">
      <div class="form-satir">
        <div><label for="ob">Ödev başlığı</label><input id="ob" required placeholder="örn. Kesirler çalışma kâğıdı"></div>
        <div><label for="os">Sınıf</label>${sinifSecici("os", siniflar(ogr))}</div>
        <div><label for="ot">Son tarih</label><input id="ot" type="date"></div>
      </div>
      <label for="oa">Açıklama / bağlantı</label><textarea id="oa" placeholder="Ödevin ayrıntıları, sayfa numaraları ya da bağlantı"></textarea>
      <button class="btn" style="margin-top:.75rem">Ödev ver</button>
    </form>
    ${odevler.length ? odevler.map((o) => {
      const hedef = ogr.filter((s) => s.aktif !== false && (o.sinif === "Tümü" || s.sinif === o.sinif));
      const biten = new Set(teslim.filter((t) => t.odev_id === o.id && t.bitti).map((t) => t.ogrenci_id));
      const sayi = hedef.filter((s) => biten.has(s.id)).length;
      return `<div class="kart">
        <div class="kart-baslik"><h3>${esc(o.baslik)} <span class="etiket">${esc(o.sinif)}</span></h3><button class="ikon-btn" data-sil="${o.id}" aria-label="Ödevi sil" title="Sil">✕</button></div>
        ${o.aciklama ? `<p style="white-space:pre-wrap;margin:.2rem 0 .5rem">${esc(o.aciklama)}</p>` : ""}
        <div>${tarihEtiketi(o.son_tarih)} <span class="etiket ${sayi === hedef.length && hedef.length ? "yesil" : "gri"}" data-teslim>${sayi}/${hedef.length} tamamladı</span></div>
        ${hedef.length ? `<details><summary>Öğrenci durumu</summary><ul class="liste">${hedef.map((s) => `<li><span>${biten.has(s.id) ? "✅" : "⏳"}</span><div class="icerik">${esc(s.ad)} <span class="soluk">${esc(s.sinif)}</span></div></li>`).join("")}</ul></details>` : ""}
      </div>`;
    }).join("") : `<p class="bos">Henüz ödev yok.</p>`}`;
    $("#oForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.ekle("odevler", { ogretmen_id: benId(), baslik: $("#ob").value.trim(), aciklama: $("#oa").value.trim() || null, sinif: $("#os").value, son_tarih: $("#ot").value || null }), "Ödev verildi")) yenile();
    });
    silBagla(ana, "odevler", "Ödev ve teslim bilgileri silinsin mi?", "Ödev silindi");
  },

  /* --- Kullanıcılar (yönetici) / Öğrenciler (öğretmen) --- */
  async kullanicilar(ana) {
    const tum = (await veri.liste("profiller")).filter((p) => p.id !== benId());
    const ogr = tum.filter((p) => p.rol === "ogrenci").sort((a, b) => trSira("ad")(a, b));
    const ogrt = tum.filter((p) => p.rol === "ogretmen").sort(trSira("ad"));
    const gruplar = siniflar(ogr);
    const yon = yoneticiMi();
    const satir = (o) => `<li>
      <div class="icerik"><strong>${esc(o.ad)}</strong> <span class="soluk">@${esc(o.kullanici_adi)}</span>${o.brans ? ` <span class="etiket gri">${esc(o.brans)}</span>` : ""} ${o.aktif === false ? `<span class="etiket kirmizi">Kapalı</span>` : ""}</div>
      ${yon ? `<div class="satir-arac">
        <button class="btn ikincil kucuk" data-sifre="${o.id}" data-ad="${esc(o.ad)}">Şifre</button>
        <button class="btn ${o.aktif === false ? "ikincil" : "tehlike"} kucuk" data-durum="${o.id}" data-aktif="${o.aktif !== false}">${o.aktif === false ? "Aç" : "Kapat"}</button>
        <button class="ikon-btn" data-kaldir="${o.id}" data-ad="${esc(o.ad)}" aria-label="Kullanıcıyı sil" title="Sil">🗑</button></div>` : ""}
    </li>`;
    ana.innerHTML = baslik(yon ? "Kullanıcılar" : "Öğrenciler", `${ogrt.length} öğretmen · ${ogr.length} öğrenci · ${gruplar.length} sınıf`) + `
    ${yon ? `<form class="kart" id="kForm">
      <h2>Yeni kullanıcı</h2>
      <p class="soluk" style="margin-top:0">E-posta gerekmez; kullanıcı adı ve şifreyi kişiye siz iletirsiniz. Öğrenciler için yalnızca ad ve sınıf tutulur.</p>
      <div class="form-satir">
        <div><label for="kRol">Rol</label><select id="kRol"><option value="ogrenci">Öğrenci</option><option value="ogretmen">Öğretmen</option></select></div>
        <div><label for="kAd">Ad Soyad</label><input id="kAd" required></div>
        <div><label for="kKa">Kullanıcı adı</label><input id="kKa" required pattern="[a-z0-9._\\-]{3,30}" title="3-30 karakter: küçük harf, rakam, nokta, tire" placeholder="örn. ali.yilmaz"></div>
        <div><label for="kSifre">Şifre (en az 6)</label><input id="kSifre" required minlength="6"></div>
        <div id="kSinifKap"><label for="kSinif">Sınıf</label><input id="kSinif" placeholder="örn. 5-A" list="sinifListe"><datalist id="sinifListe">${gruplar.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>
        <div id="kBransKap" hidden><label for="kBrans">Branş</label><input id="kBrans" placeholder="örn. Fen Bilimleri"></div>
      </div>
      <button class="btn" style="margin-top:.75rem">Hesap oluştur</button>
    </form>
    <div class="kart"><div class="kart-baslik"><h2>Öğretmenler</h2><span class="etiket gri">${ogrt.length}</span></div>
      ${ogrt.length ? `<ul class="liste">${ogrt.map(satir).join("")}</ul>` : `<p class="bos">Henüz öğretmen eklenmedi.</p>`}</div>` : ""}
    ${gruplar.length ? gruplar.map((s) => `<div class="kart"><div class="kart-baslik"><h2>${esc(s)}</h2><span class="etiket gri">${ogr.filter((o) => o.sinif === s).length} öğrenci</span></div>
      <ul class="liste">${ogr.filter((o) => o.sinif === s).map(satir).join("")}</ul></div>`).join("") : `<p class="bos">Henüz öğrenci eklenmedi.</p>`}`;
    if (!yon) return;
    $("#kRol").addEventListener("change", (e) => { const o = e.target.value === "ogrenci"; $("#kSinifKap").hidden = !o; $("#kBransKap").hidden = o; $("#kSinif").required = o; });
    $("#kSinif").required = true;
    $("#kForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button", e.target); btn.disabled = true;
      const rol = $("#kRol").value, ka = $("#kKa").value.trim().toLowerCase();
      const ok = await dene(() => veri.rpc("kullanici_olustur", { p_kullanici_adi: ka, p_sifre: $("#kSifre").value, p_ad: $("#kAd").value.trim(), p_rol: rol, p_sinif: rol === "ogrenci" ? $("#kSinif").value : null, p_brans: rol === "ogretmen" ? $("#kBrans").value : null }), `Hesap açıldı: ${ka}`);
      btn.disabled = false;
      if (ok) yenile();
    });
    $$("[data-durum]", ana).forEach((b) => b.addEventListener("click", async () => {
      const aktif = b.dataset.aktif === "true";
      if (await dene(() => veri.guncelle("profiller", { id: b.dataset.durum }, { aktif: !aktif }), aktif ? "Hesap kapatıldı" : "Hesap açıldı")) yenile();
    }));
    $$("[data-sifre]", ana).forEach((b) => b.addEventListener("click", async () => {
      const s = prompt(`${b.dataset.ad} için yeni şifre (en az 6 karakter):`);
      if (s) await dene(() => veri.rpc("sifre_sifirla", { p_id: b.dataset.sifre, p_sifre: s }), "Şifre güncellendi");
    }));
    $$("[data-kaldir]", ana).forEach((b) => b.addEventListener("click", async () => {
      if (confirm(`${b.dataset.ad} ve tüm verileri kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`) && await dene(() => veri.rpc("kullanici_sil", { p_id: b.dataset.kaldir }), "Kullanıcı silindi")) yenile();
    }));
  },

  hesap: hesapSayfasi,
};

/* ================= ÖĞRENCİ ================= */
const benimIcin = (x) => x.sinif === "Tümü" || x.sinif === durum.profil.sinif;
async function odevDurumlari() {
  const [odevler, teslim] = await Promise.all([veri.liste("odevler"), veri.liste("odev_teslim", { esit: { ogrenci_id: benId() } })]);
  const biten = new Set(teslim.filter((t) => t.bitti).map((t) => t.odev_id));
  return odevler.filter(benimIcin).map((o) => ({ ...o, bitti: biten.has(o.id) })).sort(siraTarih("son_tarih"));
}
const odevListesi = (od) => od.length ? `<ul class="liste">${od.map((o) => `
  <li class="${o.bitti ? "bitti" : ""}"><input type="checkbox" data-odev="${o.id}" ${o.bitti ? "checked" : ""} aria-label="Tamamladım">
    <div class="icerik"><strong class="baslik-metin">${esc(o.baslik)}</strong> ${o.bitti ? `<span class="etiket yesil">Tamamlandı</span>` : tarihEtiketi(o.son_tarih)}
    ${o.aciklama ? `<p>${esc(o.aciklama)}</p>` : ""}</div></li>`).join("")}</ul>` : `<p class="bos">Ödev yok. 🎉</p>`;
function odevIsaretle(ana) {
  $$("[data-odev]", ana).forEach((c) => c.addEventListener("change", async () => {
    await dene(() => veri.upsert("odev_teslim", { odev_id: c.dataset.odev, ogrenci_id: benId(), bitti: c.checked, zaman: new Date().toISOString() }, ["odev_id", "ogrenci_id"]), c.checked ? "Harika, ödev tamamlandı! 🎉" : "İşaret kaldırıldı");
    yenile();
  }));
}
const duyuruListesi = (d) => d.length ? `<ul class="liste">${d.map((x) => `<li><div class="icerik"><strong>${esc(x.baslik)}</strong> <span class="soluk">${kisaTarih(x.olusturma)}</span><p>${esc(x.metin)}</p></div></li>`).join("")}</ul>` : `<p class="bos">Duyuru yok.</p>`;

const OGRENCI = {
  async bugun(ana) {
    const [odevler, duyurular, gorevler] = await Promise.all([odevDurumlari(), veri.liste("duyurular"), veri.liste("gorevler", { esit: { sahip_id: benId() } })]);
    const bekleyen = odevler.filter((o) => !o.bitti);
    ana.innerHTML = baslik(`Merhaba ${esc(durum.profil.ad.split(" ")[0])} 👋`, tarihYaz(bugunISO(), true)) + `
    <div class="istatistik">
      <div class="kart"><div class="soluk">Bekleyen ödev</div><div class="sayi">${bekleyen.length}</div></div>
      <div class="kart"><div class="soluk">Tamamlanan ödev</div><div class="sayi">${odevler.length - bekleyen.length}</div></div>
      <div class="kart"><div class="soluk">Yapılacaklarım</div><div class="sayi">${gorevler.filter((g) => !g.bitti).length}</div></div>
    </div>
    <div class="izgara">
      <section class="kart"><div class="kart-baslik"><h2>Bekleyen ödevlerim</h2></div>${odevListesi(bekleyen.slice(0, 5))}</section>
      <section class="kart"><div class="kart-baslik"><h2>Son duyurular</h2></div>${duyuruListesi(duyurular.filter(benimIcin).sort(yeniOnce).slice(0, 3))}</section>
    </div>`;
    odevIsaretle(ana);
  },
  async odevler(ana) {
    ana.innerHTML = baslik("Ödevlerim", "Bitirdiğin ödevi işaretle; öğretmenin görür.") + `<div class="kart">${odevListesi(await odevDurumlari())}</div>`;
    odevIsaretle(ana);
  },
  gorevler: (ana) => gorevSayfasi(ana, "Yapılacaklarım"),
  async duyurular(ana) {
    ana.innerHTML = baslik("Duyurular") + `<div class="kart">${duyuruListesi((await veri.liste("duyurular")).filter(benimIcin).sort(yeniOnce))}</div>`;
  },
  hesap: hesapSayfasi,
};

/* ---------- Başlat ---------- */
(async () => {
  try {
    await baslat();
    veri.onAuth((k) => (k ? oturumAcildi(k) : girisEkrani()));
  } catch (e) {
    console.error(e);
    kok.innerHTML = `<div class="giris-sayfa"><div class="giris-kutu"><h1>Bağlantı hatası</h1><p>${esc(hataMesaji(e))}</p></div></div>`;
  }
})();
