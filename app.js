import { baslat, veri, MOD, hataMesaji } from "./data.js";
import { OGRETMEN_EPOSTA, OGRENCI_ALAN_ADI, SITE } from "./firebase-config.js";

/* ---------- Yardımcılar ---------- */
const kok = document.getElementById("uygulama");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
const GUNLER = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
const SAATLER = ["1", "2", "3", "4", "5", "6", "7", "8"];
const bugunISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const gunIndex = () => (new Date().getDay() + 6) % 7; // Pazartesi = 0
const tarihYaz = (iso) => iso ? new Date(iso + "T12:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" }) : "";
const siraTarih = (a, b) => (a.tarih || a.sonTarih || "9999").localeCompare(b.tarih || b.sonTarih || "9999");
const yeniOnce = (a, b) => (b.olusturma || 0) - (a.olusturma || 0);

let zamanlayici;
function bildir(m) {
  const b = document.getElementById("bildirim");
  b.textContent = m; b.classList.add("goster");
  clearTimeout(zamanlayici); zamanlayici = setTimeout(() => b.classList.remove("goster"), 2600);
}
async function dene(is, basari) {
  try { await is(); if (basari) bildir(basari); return true; }
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
const durum = { kullanici: null, rol: null, profil: null, sayfa: "bugun" };
const T = () => `ogretmen/${durum.kullanici.uid}`;

/* ---------- Giriş ---------- */
function girisEkrani(mesaj = "") {
  document.title = SITE.baslik;
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
      <p class="soluk" style="margin-top:1rem">Öğrenciler, öğretmenlerinin verdiği kullanıcı adı ve şifreyle girer.</p>
      ${MOD === "demo" ? `<div class="demo-not"><strong>Demo modu:</strong> Veriler yalnızca bu tarayıcıda saklanır.<br>Öğretmen girişi: <code>${esc(OGRETMEN_EPOSTA)}</code> / <code>123456</code></div>` : ""}
    </form>
  </main>`;
  $("#girisForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("button[type=submit]", e.target); btn.disabled = true; btn.textContent = "Giriş yapılıyor…";
    try { await veri.login($("#gk").value, $("#gs").value); }
    catch (err) { girisEkrani(hataMesaji(err)); }
  });
}

async function oturumAcildi(k) {
  durum.kullanici = k;
  if (k.email.toLowerCase() === OGRETMEN_EPOSTA.toLowerCase()) {
    durum.rol = "ogretmen";
    durum.profil = { ad: SITE.ogretmenAdi };
  } else {
    durum.rol = "ogrenci";
    let profil = null;
    try { profil = await veri.get(`kullanicilar/${k.uid}`); } catch (e) { console.error(e); }
    if (!profil || profil.aktif === false) {
      await veri.logout();
      return girisEkrani(profil ? "Hesabınız öğretmeniniz tarafından kapatılmış." : "Bu hesap için öğrenci kaydı bulunamadı. Öğretmeninize başvurun.");
    }
    durum.profil = profil;
  }
  durum.sayfa = "bugun";
  kabuk();
}

/* ---------- Kabuk ---------- */
const MENU = {
  ogretmen: [["bugun", "🏠", "Bugün"], ["gorevler", "✅", "Görevlerim"], ["program", "🗓️", "Ders Programı"], ["notlar", "📝", "Notlarım"], ["duyurular", "📢", "Duyurular"], ["odevler", "📚", "Ödevler"], ["ogrenciler", "👥", "Öğrenciler"]],
  ogrenci: [["bugun", "🏠", "Bugün"], ["odevler", "📚", "Ödevlerim"], ["gorevler", "✅", "Yapılacaklarım"], ["duyurular", "📢", "Duyurular"]],
};

function kabuk() {
  const p = durum.profil;
  kok.innerHTML = `
  ${MOD === "demo" ? `<div class="demo-serit">Demo modu — veriler yalnızca bu tarayıcıda saklanır. Buluta bağlamak için README'ye bakın.</div>` : ""}
  <div class="kabuk">
    <nav class="yan" aria-label="Ana menü">
      <div class="kim"><strong>${esc(p.ad)}</strong><span>${durum.rol === "ogretmen" ? "Öğretmen" : `Öğrenci · ${esc(p.sinif)}`}</span></div>
      ${MENU[durum.rol].map(([id, ik, ad]) => `<button class="menu-btn" data-sayfa="${id}"><span aria-hidden="true">${ik}</span>${ad}</button>`).join("")}
      <div class="alt-kisim">
        <button class="menu-btn" data-sayfa="hesap"><span aria-hidden="true">⚙️</span>Hesabım</button>
        <button class="menu-btn" id="cikis"><span aria-hidden="true">🚪</span>Çıkış</button>
      </div>
    </nav>
    <main class="ana" id="ana"></main>
  </div>`;
  $$(".menu-btn[data-sayfa]").forEach((b) => b.addEventListener("click", () => { durum.sayfa = b.dataset.sayfa; sayfaGoster(); }));
  $("#cikis").addEventListener("click", () => veri.logout());
  sayfaGoster();
}

async function sayfaGoster() {
  $$(".menu-btn[data-sayfa]").forEach((b) => b.classList.toggle("aktif", b.dataset.sayfa === durum.sayfa));
  const ana = $("#ana");
  ana.innerHTML = `<div class="yukleniyor">Yükleniyor…</div>`;
  const sayfalar = durum.rol === "ogretmen" ? OGRETMEN : OGRENCI;
  try { await (sayfalar[durum.sayfa] || sayfalar.bugun)(ana); }
  catch (e) { console.error(e); ana.innerHTML = `<div class="hata">${esc(hataMesaji(e))}</div>`; }
  window.scrollTo(0, 0);
}
const yenile = () => sayfaGoster();

function baslik(b, alt = "", sag = "") {
  return `<div class="ust-baslik"><div><h1>${b}</h1>${alt ? `<p>${alt}</p>` : ""}</div>${sag}</div>`;
}

/* ---------- Ortak parçalar ---------- */
// Yapılacaklar listesi (öğretmen ve öğrenci aynı bileşeni kullanır)
async function gorevSayfasi(ana, yol, ustBaslik) {
  const gorevler = (await veri.list(yol)).sort(siraTarih);
  const filtre = durum.gorevFiltre || "acik";
  const gorunen = gorevler.filter((g) => filtre === "hepsi" || (filtre === "acik" ? !g.bitti : g.bitti));
  ana.innerHTML = baslik(ustBaslik, `${gorevler.filter((g) => !g.bitti).length} açık görev`) + `
  <div class="kart">
    <form class="hizli-ekle" id="gorevForm">
      <input type="text" id="gBaslik" placeholder="Yeni görev yazın…" required aria-label="Görev">
      <input type="date" id="gTarih" aria-label="Tarih (isteğe bağlı)">
      <button class="btn">Ekle</button>
    </form>
    <div class="sekmeler">
      ${[["acik", "Açık"], ["bitti", "Tamamlanan"], ["hepsi", "Hepsi"]].map(([k, a]) => `<button data-f="${k}" class="${filtre === k ? "aktif" : ""}">${a}</button>`).join("")}
    </div>
    ${gorunen.length ? `<ul class="liste">${gorunen.map((g) => `
      <li class="${g.bitti ? "bitti" : ""}">
        <input type="checkbox" data-id="${g.id}" ${g.bitti ? "checked" : ""} aria-label="Tamamlandı">
        <div class="icerik"><span class="baslik-metin">${esc(g.baslik)}</span> ${g.bitti ? "" : tarihEtiketi(g.tarih)}</div>
        <button class="ikon-btn" data-sil="${g.id}" aria-label="Sil" title="Sil">✕</button>
      </li>`).join("")}</ul>` : `<p class="bos">Burada görev yok.</p>`}
  </div>`;
  $("#gorevForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (await dene(() => veri.add(yol, { baslik: $("#gBaslik").value.trim(), tarih: $("#gTarih").value || "", bitti: false }))) yenile();
  });
  $$(".sekmeler button", ana).forEach((b) => b.addEventListener("click", () => { durum.gorevFiltre = b.dataset.f; yenile(); }));
  $$("input[type=checkbox][data-id]", ana).forEach((c) => c.addEventListener("change", async () => { await dene(() => veri.update(`${yol}/${c.dataset.id}`, { bitti: c.checked })); yenile(); }));
  $$("[data-sil]", ana).forEach((b) => b.addEventListener("click", async () => { if (await dene(() => veri.remove(`${yol}/${b.dataset.sil}`), "Görev silindi")) yenile(); }));
}

async function hesapSayfasi(ana) {
  const k = durum.kullanici;
  const kimlik = durum.rol === "ogretmen" ? k.email : k.email.replace("@" + OGRENCI_ALAN_ADI, "");
  ana.innerHTML = baslik("Hesabım") + `
  <div class="kart" style="max-width:480px">
    <p><strong>${esc(durum.profil.ad)}</strong><br><span class="soluk">${durum.rol === "ogretmen" ? "E-posta" : "Kullanıcı adı"}: ${esc(kimlik)}</span></p>
    <form id="sifreForm">
      <h2>Şifre değiştir</h2>
      <label for="s1">Yeni şifre</label><input id="s1" type="password" minlength="6" required autocomplete="new-password">
      <label for="s2">Yeni şifre (tekrar)</label><input id="s2" type="password" minlength="6" required autocomplete="new-password">
      <button class="btn tam">Şifreyi güncelle</button>
    </form>
  </div>`;
  $("#sifreForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if ($("#s1").value !== $("#s2").value) return bildir("Şifreler aynı değil.");
    if (await dene(() => veri.sifreDegistir($("#s1").value), "Şifreniz güncellendi")) e.target.reset();
  });
}

/* ================= ÖĞRETMEN ================= */
async function ogrencileriGetir() {
  return (await veri.list("kullanicilar")).filter((u) => u.rol === "ogrenci")
    .sort((a, b) => (a.sinif || "").localeCompare(b.sinif || "", "tr") || (a.ad || "").localeCompare(b.ad || "", "tr"));
}
const siniflar = (ogr) => [...new Set(ogr.map((o) => o.sinif).filter(Boolean))].sort((a, b) => a.localeCompare(b, "tr"));
const sinifSecici = (id, liste, secili = "Tümü") =>
  `<select id="${id}">${["Tümü", ...liste].map((s) => `<option ${s === secili ? "selected" : ""}>${esc(s)}</option>`).join("")}</select>`;

const OGRETMEN = {
  async bugun(ana) {
    const [gorevler, program, notlar, ogr, odevler] = await Promise.all([
      veri.list(`${T()}/gorevler`), veri.get(`${T()}/ayarlar/program`), veri.list(`${T()}/notlar`), ogrencileriGetir(), veri.list("odevler"),
    ]);
    const b = bugunISO(), gi = gunIndex();
    const acik = gorevler.filter((g) => !g.bitti);
    const bugunku = acik.filter((g) => g.tarih && g.tarih <= b).sort(siraTarih);
    const hucre = program?.hucreler || {};
    const dersler = gi < 5 ? SAATLER.map((s) => [s, hucre[`${gi}-${s}`]]).filter(([, d]) => d) : [];
    const saat = new Date().getHours();
    const selam = saat < 12 ? "Günaydın" : saat < 18 ? "İyi günler" : "İyi akşamlar";
    ana.innerHTML = baslik(`${selam}, ${esc(durum.profil.ad.split(" ")[0])}`, new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })) + `
    <div class="istatistik">
      <div class="kart"><div class="soluk">Açık görev</div><div class="sayi">${acik.length}</div></div>
      <div class="kart"><div class="soluk">Bugünkü ders</div><div class="sayi">${dersler.length}</div></div>
      <div class="kart"><div class="soluk">Öğrenci</div><div class="sayi">${ogr.length}</div></div>
      <div class="kart"><div class="soluk">Aktif ödev</div><div class="sayi">${odevler.filter((o) => !o.sonTarih || o.sonTarih >= b).length}</div></div>
    </div>
    <div class="izgara">
      <section class="kart">
        <div class="kart-baslik"><h2>Bugünkü derslerim</h2><button class="btn ikincil kucuk" data-git="program">Programı düzenle</button></div>
        ${gi > 4 ? `<p class="bos">Bugün hafta sonu. İyi dinlenmeler!</p>` : dersler.length ? `<ul class="liste">${dersler.map(([s, d]) => `<li><span class="etiket">${s}. ders</span><div class="icerik">${esc(d)}</div></li>`).join("")}</ul>` : `<p class="bos">Bugün için programda ders yok. Ders programınızı doldurun.</p>`}
      </section>
      <section class="kart">
        <div class="kart-baslik"><h2>Bugün yapılacaklar</h2><button class="btn ikincil kucuk" data-git="gorevler">Tümü</button></div>
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
      if (await dene(() => veri.add(`${T()}/gorevler`, { baslik: $("#hg").value.trim(), tarih: b, bitti: false }), "Görev eklendi")) yenile();
    });
    $$("input[type=checkbox][data-id]", ana).forEach((c) => c.addEventListener("change", async () => { await dene(() => veri.update(`${T()}/gorevler/${c.dataset.id}`, { bitti: true }), "Tamamlandı 🎉"); yenile(); }));
  },

  gorevler: (ana) => gorevSayfasi(ana, `${T()}/gorevler`, "Görevlerim"),

  async program(ana) {
    const yol = `${T()}/ayarlar/program`;
    const p = (await veri.get(yol)) || {};
    const h = p.hucreler || {}, saatler = p.saatler || {};
    const gi = gunIndex();
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
    const kaydet = () => {
      clearTimeout(bekle);
      bekle = setTimeout(() => {
        const hucreler = {}, sa = {};
        $$("input[data-h]", ana).forEach((i) => { if (i.value.trim()) hucreler[i.dataset.h] = i.value.trim(); });
        $$("input[data-saat]", ana).forEach((i) => { if (i.value.trim()) sa[i.dataset.saat] = i.value.trim(); });
        dene(() => veri.set(yol, { hucreler, saatler: sa }), "Program kaydedildi");
      }, 700);
    };
    $$("input", ana).forEach((i) => i.addEventListener("input", kaydet));
  },

  async notlar(ana) {
    const yol = `${T()}/notlar`;
    const notlar = (await veri.list(yol)).sort(yeniOnce);
    ana.innerHTML = baslik("Notlarım", "Toplantı notları, fikirler, hatırlatmalar — yalnızca siz görürsünüz.") + `
    <form class="kart" id="notForm">
      <label for="nb">Başlık</label><input id="nb" required placeholder="örn. Zümre toplantısı">
      <label for="nm">Not</label><textarea id="nm"></textarea>
      <button class="btn" style="margin-top:.75rem">Notu kaydet</button>
    </form>
    ${notlar.length ? `<div class="izgara">${notlar.map((n) => `
      <article class="not-kart"><button class="ikon-btn" data-sil="${n.id}" aria-label="Notu sil" title="Sil">✕</button>
        <h3>${esc(n.baslik)}</h3><p>${esc(n.metin)}</p>
        <div class="soluk" style="margin-top:.5rem">${new Date(n.olusturma || Date.now()).toLocaleDateString("tr-TR")}</div></article>`).join("")}</div>` : `<p class="bos">Henüz not yok.</p>`}`;
    $("#notForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.add(yol, { baslik: $("#nb").value.trim(), metin: $("#nm").value.trim() }), "Not kaydedildi")) yenile();
    });
    $$("[data-sil]", ana).forEach((b) => b.addEventListener("click", async () => { if (confirm("Not silinsin mi?") && await dene(() => veri.remove(`${yol}/${b.dataset.sil}`), "Not silindi")) yenile(); }));
  },

  async duyurular(ana) {
    const [duyurular, ogr] = await Promise.all([veri.list("duyurular"), ogrencileriGetir()]);
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
        <p>${esc(d.metin)}</p><span class="soluk">${new Date(d.olusturma).toLocaleDateString("tr-TR")}</span></div>
        <button class="ikon-btn" data-sil="${d.id}" aria-label="Duyuruyu sil" title="Sil">✕</button></li>`).join("")}</ul>` : `<p class="bos">Henüz duyuru yok.</p>`}</div>`;
    $("#dForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.add("duyurular", { baslik: $("#db").value.trim(), metin: $("#dm").value.trim(), sinif: $("#ds").value }), "Duyuru yayınlandı")) yenile();
    });
    $$("[data-sil]", ana).forEach((b) => b.addEventListener("click", async () => { if (confirm("Duyuru silinsin mi?") && await dene(() => veri.remove(`duyurular/${b.dataset.sil}`), "Duyuru silindi")) yenile(); }));
  },

  async odevler(ana) {
    const [odevler, ogr] = await Promise.all([veri.list("odevler"), ogrencileriGetir()]);
    odevler.sort((a, b) => (b.sonTarih || "").localeCompare(a.sonTarih || ""));
    const teslimler = await Promise.all(odevler.map((o) => veri.list(`odevler/${o.id}/teslim`)));
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
    ${odevler.length ? odevler.map((o, i) => {
      const hedef = ogr.filter((s) => s.aktif !== false && (o.sinif === "Tümü" || s.sinif === o.sinif));
      const bitenler = new Set(teslimler[i].filter((t) => t.bitti).map((t) => t.id));
      const sayi = hedef.filter((s) => bitenler.has(s.id)).length;
      return `<div class="kart">
        <div class="kart-baslik"><h3>${esc(o.baslik)} <span class="etiket">${esc(o.sinif)}</span></h3>
          <button class="ikon-btn" data-sil="${o.id}" aria-label="Ödevi sil" title="Sil">✕</button></div>
        ${o.aciklama ? `<p style="white-space:pre-wrap;margin:.2rem 0 .5rem">${esc(o.aciklama)}</p>` : ""}
        <div>${o.sonTarih ? tarihEtiketi(o.sonTarih) : ""} <span class="etiket ${sayi === hedef.length && hedef.length ? "yesil" : "gri"}">${sayi}/${hedef.length} tamamladı</span></div>
        ${hedef.length ? `<details><summary>Öğrenci durumu</summary><ul class="liste">${hedef.map((s) => `<li><span>${bitenler.has(s.id) ? "✅" : "⏳"}</span><div class="icerik">${esc(s.ad)} <span class="soluk">${esc(s.sinif)}</span></div></li>`).join("")}</ul></details>` : ""}
      </div>`;
    }).join("") : `<p class="bos">Henüz ödev yok.</p>`}`;
    $("#oForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      if (await dene(() => veri.add("odevler", { baslik: $("#ob").value.trim(), aciklama: $("#oa").value.trim(), sinif: $("#os").value, sonTarih: $("#ot").value || "" }), "Ödev verildi")) yenile();
    });
    $$("[data-sil]", ana).forEach((b) => b.addEventListener("click", async () => { if (confirm("Ödev ve teslim bilgileri silinsin mi?") && await dene(() => veri.remove(`odevler/${b.dataset.sil}`), "Ödev silindi")) yenile(); }));
  },

  async ogrenciler(ana) {
    const ogr = await ogrencileriGetir();
    const gruplar = siniflar(ogr);
    ana.innerHTML = baslik("Öğrenciler", `${ogr.length} öğrenci · ${gruplar.length} sınıf`) + `
    <form class="kart" id="ogrForm">
      <h2>Öğrenci hesabı aç</h2>
      <p class="soluk" style="margin-top:0">Öğrencinin e-postası gerekmez. Kullanıcı adı ve şifreyi öğrenciye siz iletin. Kişisel veri olarak yalnızca ad ve sınıf tutulur.</p>
      <div class="form-satir">
        <div><label for="ya">Ad Soyad</label><input id="ya" required></div>
        <div><label for="ys">Sınıf</label><input id="ys" required placeholder="örn. 5-A" list="sinifListe"><datalist id="sinifListe">${gruplar.map((s) => `<option value="${esc(s)}">`).join("")}</datalist></div>
        <div><label for="yk">Kullanıcı adı</label><input id="yk" required pattern="[a-z0-9._\\-]{3,30}" title="3-30 karakter: küçük harf, rakam, nokta, tire" placeholder="örn. ali.yilmaz"></div>
        <div><label for="yp">Şifre (en az 6)</label><input id="yp" required minlength="6"></div>
      </div>
      <button class="btn" style="margin-top:.75rem">Hesap oluştur</button>
    </form>
    ${gruplar.length ? gruplar.map((s) => `<div class="kart"><div class="kart-baslik"><h2>${esc(s)}</h2><span class="etiket gri">${ogr.filter((o) => o.sinif === s).length} öğrenci</span></div>
      <ul class="liste">${ogr.filter((o) => o.sinif === s).map((o) => `<li>
        <div class="icerik"><strong>${esc(o.ad)}</strong> <span class="soluk">@${esc(o.kullaniciAdi)}</span> ${o.aktif === false ? `<span class="etiket kirmizi">Kapalı</span>` : ""}</div>
        <button class="btn ${o.aktif === false ? "ikincil" : "tehlike"} kucuk" data-durum="${o.id}" data-aktif="${o.aktif !== false}">${o.aktif === false ? "Aç" : "Kapat"}</button>
      </li>`).join("")}</ul></div>`).join("") : `<p class="bos">Henüz öğrenci eklenmedi.</p>`}`;
    $("#ogrForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("button", e.target); btn.disabled = true;
      const ka = $("#yk").value.trim().toLowerCase();
      const ok = await dene(async () => {
        const uid = await veri.ogrenciHesabiAc(ka, $("#yp").value);
        await veri.set(`kullanicilar/${uid}`, { rol: "ogrenci", ad: $("#ya").value.trim(), sinif: $("#ys").value.trim().toUpperCase(), kullaniciAdi: ka, aktif: true, olusturma: Date.now() });
      }, `Hesap açıldı: ${ka}`);
      btn.disabled = false;
      if (ok) yenile();
    });
    $$("[data-durum]", ana).forEach((b) => b.addEventListener("click", async () => {
      const aktif = b.dataset.aktif === "true";
      if (await dene(() => veri.update(`kullanicilar/${b.dataset.durum}`, { aktif: !aktif }), aktif ? "Hesap kapatıldı" : "Hesap açıldı")) yenile();
    }));
  },

  hesap: hesapSayfasi,
};

/* ================= ÖĞRENCİ ================= */
const benimIcin = (x) => x.sinif === "Tümü" || x.sinif === durum.profil.sinif;
async function odevDurumlari() {
  const odevler = (await veri.list("odevler")).filter(benimIcin);
  const durumlar = await Promise.all(odevler.map((o) => veri.get(`odevler/${o.id}/teslim/${durum.kullanici.uid}`).catch(() => null)));
  return odevler.map((o, i) => ({ ...o, bitti: !!durumlar[i]?.bitti })).sort(siraTarih);
}
function odevListesi(odevler) {
  return odevler.length ? `<ul class="liste">${odevler.map((o) => `
    <li class="${o.bitti ? "bitti" : ""}"><input type="checkbox" data-odev="${o.id}" ${o.bitti ? "checked" : ""} aria-label="Tamamladım">
      <div class="icerik"><strong class="baslik-metin">${esc(o.baslik)}</strong> ${o.bitti ? `<span class="etiket yesil">Tamamlandı</span>` : tarihEtiketi(o.sonTarih)}
      ${o.aciklama ? `<p>${esc(o.aciklama)}</p>` : ""}</div></li>`).join("")}</ul>` : `<p class="bos">Ödev yok. 🎉</p>`;
}
function odevIsaretle(ana) {
  $$("[data-odev]", ana).forEach((c) => c.addEventListener("change", async () => {
    await dene(() => veri.set(`odevler/${c.dataset.odev}/teslim/${durum.kullanici.uid}`, { bitti: c.checked, zaman: Date.now() }), c.checked ? "Harika, ödev tamamlandı! 🎉" : "İşaret kaldırıldı");
    yenile();
  }));
}
const duyuruListesi = (d) => d.length ? `<ul class="liste">${d.map((x) => `<li><div class="icerik"><strong>${esc(x.baslik)}</strong> <span class="soluk">${new Date(x.olusturma).toLocaleDateString("tr-TR")}</span><p>${esc(x.metin)}</p></div></li>`).join("")}</ul>` : `<p class="bos">Duyuru yok.</p>`;

const OGRENCI = {
  async bugun(ana) {
    const [odevler, duyurular, gorevler] = await Promise.all([odevDurumlari(), veri.list("duyurular"), veri.list(`kullanicilar/${durum.kullanici.uid}/gorevler`)]);
    const bekleyen = odevler.filter((o) => !o.bitti);
    ana.innerHTML = baslik(`Merhaba ${esc(durum.profil.ad.split(" ")[0])} 👋`, new Date().toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long" })) + `
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
    const odevler = await odevDurumlari();
    ana.innerHTML = baslik("Ödevlerim", "Bitirdiğin ödevi işaretle; öğretmenin görür.") + `<div class="kart">${odevListesi(odevler)}</div>`;
    odevIsaretle(ana);
  },
  gorevler: (ana) => gorevSayfasi(ana, `kullanicilar/${durum.kullanici.uid}/gorevler`, "Yapılacaklarım"),
  async duyurular(ana) {
    const d = (await veri.list("duyurular")).filter(benimIcin).sort(yeniOnce);
    ana.innerHTML = baslik("Duyurular") + `<div class="kart">${duyuruListesi(d)}</div>`;
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
