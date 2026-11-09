/* Öğretmen Hesap — ekranlar ve yönlendirme.
 * Veri işlemleri js/backend.js içindeki altyapı (B) üzerinden yapılır.
 */
(function () {
  "use strict";

  const { UserError, fail, uid, normData, TEACHER_USERNAME } = window.OGH;
  const THEME_KEY = "ogretmenhesap.theme";
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const MONTHS = ["Eylül", "Ekim", "Kasım", "Aralık", "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran"];
  const PERIODS = 8;
  const USER_RE = /^[a-z0-9._-]{3,20}$/;
  const MIN_PW = 6;

  const ROLES = {
    teacher: {
      label: "Öğretmen", icon: "👨‍🏫",
      fields: [
        { key: "name", label: "Ad Soyad" },
        { key: "school", label: "Okul" },
        { key: "branch", label: "Branş", placeholder: "ör. Fen Bilimleri" },
        { key: "classes", label: "Girdiğim sınıflar", placeholder: "ör. 5-A, 6-B, 7-C" },
      ],
      todoTitle: "Yapılacaklar", todoPlaceholder: "ör. 6-B sınav kâğıtlarını oku",
      tabs: [["panel", "🏠 Panel"], ["planlar", "📚 Planlarım"], ["ogrenciler", "👥 Öğrenciler"], ["odevler", "📝 Ödevler"], ["mesajlar", "💬 Mesajlar"], ["uygulamalar", "📱 Uygulamalarım"]],
    },
    student: {
      label: "Öğrenci", icon: "🧑‍🎓",
      fields: [
        { key: "name", label: "Ad Soyad" },
        { key: "grade", label: "Sınıf / Şube", placeholder: "ör. 7-C" },
        { key: "number", label: "Okul numarası" },
        { key: "school", label: "Okul" },
      ],
      todoTitle: "Yapılacaklarım", todoPlaceholder: "ör. Matematik s. 45-46",
      tabs: [["panel", "🏠 Panel"], ["odevler", "📝 Ödevlerim"], ["mesajlar", "💬 Mesajlar"], ["uygulamalar", "📱 Uygulamalarım"]],
    },
  };
  const PAGE_NAMES = { panel: "Panel", planlar: "Planlarım", ogrenciler: "Öğrenciler", ogrenci: "Öğrenci profili", odevler: "Ödevler", odev: "Ödev", mesajlar: "Mesajlar", uygulamalar: "Uygulamalarım", oyunlar: "Uygulamalarım", oyun: "Oyun", profil: "Bilgilerim" };
  const ACT = {
    giris: { icon: "🔑", label: "Giriş" }, sayfa: { icon: "📄", label: "Sayfa" }, oyun: { icon: "🎮", label: "Oyun" },
    site: { icon: "🌐", label: "Site" }, teslim: { icon: "📤", label: "Ödev teslimi" },
  };
  const STATUS = {
    yok: { label: "Teslim edilmedi", cls: "st-none" }, teslim: { label: "Teslim edildi", cls: "st-sent" },
    iade: { label: "Düzeltme istendi", cls: "st-back" }, puanlandi: { label: "Puanlandı", cls: "st-done" },
  };

  /* ================= Yardımcılar ================= */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const app = $("#app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const initials = (n) => String(n || "?").trim().split(/[\s._-]+/).map((p) => p[0]).slice(0, 2).join("").toLocaleUpperCase("tr-TR");
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fmtDate = (iso) => (iso ? new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" }) : "");
  const fmtStamp = (iso) => (iso ? new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const daysUntil = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);
  const normUser = (s) => String(s || "").trim().toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" }[c]));
  const safeUrl = (u) => (/^https?:\/\//i.test(String(u || "").trim()) ? String(u).trim() : "");
  const nameOf = (u) => (u ? (u.profile && u.profile.name) || u.name || u.username : "Bilinmeyen kullanıcı");
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null);
  const nl2br = (s) => esc(s).replace(/\n/g, "<br>");

  /* ================= Durum ================= */
  let B = null;          // veri altyapısı
  let me = null;         // { uid, username, role, profile }
  let renderToken = 0;
  let flushSave = null;  // bekleyen kişisel veri kaydını hemen yazar
  let pageTimer = null;  // sayfaya özel yenileme zamanlayıcısı
  let lastLoggedPage = "";

  const isTeacher = () => me && me.role === "teacher";
  const displayName = () => (me.profile && me.profile.name) || me.username;
  const live = (token) => token === renderToken;

  async function setMe(user) {
    me = user;
    if (me) me.profile = await B.getProfile(me.uid);
  }
  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }
  async function runFlush() {
    if (!flushSave) return;
    const f = flushSave; flushSave = null;
    try { await f(); } catch (e) { console.error(e); }
  }

  function bindForm(form, errEl, handler) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const btn = ev.submitter || form.querySelector("button[type=submit]");
      if (errEl) errEl.textContent = "";
      if (btn) btn.disabled = true;
      try { await handler(new FormData(form), btn); }
      catch (e) {
        const msg = e instanceof UserError ? e.message : "Beklenmeyen hata: " + e.message;
        if (errEl) errEl.textContent = msg; else alert(msg);
        if (!(e instanceof UserError)) console.error(e);
      } finally { if (btn) btn.disabled = false; }
    });
  }

  /* Okunmamış mesaj takibi (cihaz bazında) */
  const seenKey = () => "ogretmenhesap.seen." + me.uid;
  function getSeen() { try { return JSON.parse(localStorage.getItem(seenKey())) || {}; } catch (e) { return {}; } }
  function markSeen(convId) { const s = getSeen(); s[convId] = new Date().toISOString(); try { localStorage.setItem(seenKey(), JSON.stringify(s)); } catch (e) { /* yok say */ } }
  function unreadCount(msgs, convId) {
    const seen = getSeen();
    return msgs.filter((m) => m.to === me.uid && (!convId || m.convId === convId) && m.at > (seen[m.convId] || "")).length;
  }

  /* Kişisel verileri (ders programı, planlar…) gecikmeli kaydeden yardımcı */
  function makeSaver(d) {
    let timer = null;
    const status = (t) => { const el = $("#save-status"); if (el) el.textContent = t; };
    const myId = me.uid;
    async function doSave() {
      timer = null;
      try { await B.saveData(myId, d); status("✓ kaydedildi"); }
      catch (e) { status("⚠️ kaydedilemedi: " + e.message); throw e; }
    }
    return function queueSave(delay) {
      status("kaydediliyor…");
      clearTimeout(timer);
      timer = setTimeout(() => { flushSave = null; doSave().catch(() => {}); }, delay == null ? 600 : delay);
      flushSave = () => { clearTimeout(timer); return doSave(); };
    };
  }

  function credentialFields() {
    return `
      <label for="c-user">Kullanıcı adı</label>
      <input id="c-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
      <p class="hint">3–20 karakter: harf, rakam, nokta, alt çizgi. Türkçe harfler otomatik dönüştürülür (ş→s, ı→i).</p>
      <label for="c-pw">Şifre</label>
      <input id="c-pw" name="password" type="password" autocomplete="new-password" required minlength="${MIN_PW}">
      <label for="c-pw2">Şifre (tekrar)</label>
      <input id="c-pw2" name="password2" type="password" autocomplete="new-password" required minlength="${MIN_PW}">
      <p class="hint">En az ${MIN_PW} karakter. Şifreni kimseyle paylaşma.</p>`;
  }

  /* ================= Tema ve üst çubuk ================= */
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) { /* yok say */ }
  $("#btn-theme").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* yok say */ }
  });
  $("#btn-logout").addEventListener("click", async () => {
    await runFlush();
    await B.logout();
    me = null; lastLoggedPage = "";
    go("#/");
  });

  function setChrome(page) {
    $("#topnav").hidden = !me;
    $("#tabs").hidden = !me;
    document.body.dataset.role = me ? me.role : "";
    if (!me) return;
    $("#whoami").textContent = `${ROLES[me.role].icon} ${displayName()}`;
    const active = { ogrenci: "ogrenciler", odev: "odevler", oyun: "uygulamalar", oyunlar: "uygulamalar" }[page] || page || "panel";
    $("#tabs").innerHTML = ROLES[me.role].tabs
      .map(([k, l]) => `<a href="#/${k}" class="${k === active ? "active" : ""}">${l}</a>`).join("");
  }

  /* ================= Giriş / Kayıt ================= */
  function viewLogin() {
    app.innerHTML = `
      <div class="hero">
        <h1>Hoş geldiniz</h1>
        <p class="muted">Öğretmen ve öğrenci paneline giriş</p>
      </div>
      <section class="card narrow">
        <h2>🔐 Giriş yap</h2>
        <form id="f-login" novalidate>
          <label for="l-user">Kullanıcı adı</label>
          <input id="l-user" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
          <label for="l-pw">Şifre</label>
          <input id="l-pw" name="password" type="password" autocomplete="current-password" required>
          <p class="error" id="err"></p>
          <button class="btn block" type="submit">Giriş yap</button>
        </form>
        <hr>
        <p class="center">Hesabın yok mu? <a class="btn ghost small" href="#/kayit">Öğrenci kaydı oluştur</a></p>
      </section>
      ${B.mode === "local" ? `<p class="hint center">Demo modu: hesaplar ve veriler yalnızca bu cihazda saklanır.</p>` : ""}`;
    $("#l-user").focus();
    bindForm($("#f-login"), $("#err"), async (fd) => {
      const username = normUser(fd.get("username"));
      const pw = String(fd.get("password") || "");
      if (!username || !pw) fail("Kullanıcı adı ve şifreni gir.");
      await setMe(await B.login(username, pw));
      B.logActivity("giris", "Sisteme giriş yaptı");
      go("#/panel");
    });
  }

  function viewRegister() {
    app.innerHTML = `
      <section class="card narrow">
        <h2>🧑‍🎓 Öğrenci kaydı</h2>
        <p class="muted">Kayıt için yalnızca bir kullanıcı adı ve şifre belirlemen yeterli.</p>
        <form id="f-reg" novalidate>
          ${credentialFields()}
          <p class="error" id="err"></p>
          <button class="btn block" type="submit">Kayıt ol ve giriş yap</button>
        </form>
        <p class="center">Zaten hesabın var mı? <a href="#/">Giriş yap</a></p>
      </section>`;
    $("#c-user").focus();
    bindForm($("#f-reg"), $("#err"), async (fd) => {
      const username = normUser(fd.get("username"));
      const pw = String(fd.get("password") || "");
      if (!USER_RE.test(username)) fail("Kullanıcı adı 3–20 karakter olmalı; yalnızca harf, rakam, nokta (.), alt çizgi (_) veya tire (-) içerebilir.");
      if (username === TEACHER_USERNAME) fail("Bu kullanıcı adı alınmış, başka bir tane deneyin.");
      if (pw.length < MIN_PW) fail(`Şifre en az ${MIN_PW} karakter olmalı.`);
      if (pw !== String(fd.get("password2") || "")) fail("Şifreler birbiriyle aynı değil.");
      await setMe(await B.registerStudent(username, pw));
      B.logActivity("giris", "Kayıt oldu ve ilk kez giriş yaptı");
      go("#/panel");
    });
  }

  /* ================= Bilgilerim ================= */
  function viewProfile() {
    const r = ROLES[me.role];
    const p = me.profile || {};
    app.innerHTML = `
      <section class="card narrow">
        <h2>✏️ Bilgilerim</h2>
        <p class="muted">Kullanıcı adı: <strong>${esc(me.username)}</strong> · ${r.label}</p>
        <form id="f-prof">
          ${r.fields.map((f) => `
            <label for="p-${f.key}">${f.label}</label>
            <input id="p-${f.key}" name="${f.key}" value="${esc(p[f.key])}" placeholder="${esc(f.placeholder || "")}">`).join("")}
          ${isTeacher() ? "" : `<p class="hint">Bu bilgiler isteğe bağlıdır; öğretmeninin seni tanıması için kullanılır.</p>`}
          <p class="error" id="err"></p>
          <div class="actions">
            <button class="btn" type="submit">Kaydet</button>
            <a class="btn ghost" href="#/panel">Panele dön</a>
          </div>
        </form>
      </section>
      <section class="card narrow" style="margin-top:16px">
        <h2>🔑 Şifre değiştir</h2>
        <form id="f-pw">
          <label for="pw-cur">Mevcut şifre</label>
          <input id="pw-cur" name="current" type="password" autocomplete="current-password" required>
          <label for="pw-new">Yeni şifre</label>
          <input id="pw-new" name="password" type="password" autocomplete="new-password" required minlength="${MIN_PW}">
          <label for="pw-new2">Yeni şifre (tekrar)</label>
          <input id="pw-new2" name="password2" type="password" autocomplete="new-password" required minlength="${MIN_PW}">
          <p class="error" id="err-pw"></p>
          <button class="btn" type="submit">Şifreyi değiştir</button>
        </form>
      </section>`;
    bindForm($("#f-prof"), $("#err"), async (fd) => {
      const np = {};
      for (const f of r.fields) np[f.key] = String(fd.get(f.key) || "").trim();
      await B.saveProfile(me.uid, np);
      me.profile = np;
      go("#/panel");
    });
    bindForm($("#f-pw"), $("#err-pw"), async (fd) => {
      const pw = String(fd.get("password") || "");
      if (pw.length < MIN_PW) fail(`Şifre en az ${MIN_PW} karakter olmalı.`);
      if (pw !== String(fd.get("password2") || "")) fail("Yeni şifreler birbiriyle aynı değil.");
      await B.changePassword(String(fd.get("current") || ""), pw);
      $("#f-pw").reset();
      alert("Şifreniz değiştirildi.");
    });
  }

  /* ================= Panel ================= */
  async function viewDashboard(token) {
    const r = ROLES[me.role];
    const T = isTeacher();
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    const [d, assignments, subs, msgs, students] = await Promise.all([
      B.getData(me.uid), B.listAssignments(), B.listSubmissions(), B.listMessages(), T ? B.listStudents() : Promise.resolve([]),
    ]);
    if (!live(token)) return;
    const queueSave = makeSaver(d);
    const p = me.profile || {};
    const now = new Date();
    const dayIdx = now.getDay() - 1;
    const isSchoolDay = dayIdx >= 0 && dayIdx < 5;
    const hello = now.getHours() < 12 ? "Günaydın" : now.getHours() < 18 ? "İyi günler" : "İyi akşamlar";
    const filled = r.fields.filter((f) => p[f.key]);
    const unread = unreadCount(msgs);

    let stats;
    if (T) {
      const pending = subs.filter((s) => s.status === "teslim").length;
      const today = students.filter((s) => (s.lastLogin || "").slice(0, 10) === todayISO()).length;
      stats = [
        ["👥", students.length, "Kayıtlı öğrenci", "#/ogrenciler"],
        ["📥", pending, "Değerlendirme bekleyen", "#/odevler"],
        ["🔑", today, "Bugün giriş yapan", "#/ogrenciler"],
        ["💬", unread, "Okunmamış mesaj", "#/mesajlar"],
      ];
    } else {
      const mySub = (a) => subs.find((s) => s.assignmentId === a.id);
      const waiting = assignments.filter((a) => !mySub(a)).length;
      const back = subs.filter((s) => s.status === "iade").length;
      const scores = subs.filter((s) => s.status === "puanlandi" && typeof s.score === "number").map((s) => s.score);
      stats = [
        ["📝", waiting, "Teslim bekleyen ödev", "#/odevler"],
        ["↩️", back, "Düzeltme istenen", "#/odevler"],
        ["⭐", avg(scores) ?? "—", "Ortalama puan", "#/odevler"],
        ["💬", unread, "Okunmamış mesaj", "#/mesajlar"],
      ];
    }

    app.innerHTML = `
      <div class="welcome">
        <div>
          <h1>${hello}, ${esc(displayName().split(" ")[0])} 👋</h1>
          <span class="muted">${now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          <span class="saved" id="save-status"></span>
        </div>
      </div>
      ${B.mode === "local" && T ? `<div class="card notice">ℹ️ <strong>Demo modu:</strong> veriler yalnızca bu cihazda. Öğrencilerin kendi cihazlarından girebilmesi ve tüm verilerin tek veritabanında tutulması için soldaki 🗄️ SQL butonundaki adımlarla Supabase bağlantısını kurun.</div>` : ""}
      ${T ? "" : `<div class="card notice">ℹ️ Bu sistemde yaptığın etkinlikler (girişler, açtığın oyun ve siteler, ödev teslimleri) ve mesajların öğretmenin tarafından görülebilir.</div>`}

      <div class="stats">
        ${stats.map(([ic, n, l, href]) => `<a class="stat card" href="${href}"><span class="stat-ic">${ic}</span><span class="stat-n">${esc(n)}</span><span class="stat-l">${l}</span></a>`).join("")}
      </div>

      <div class="grid">
        <section class="card col-4">
          <h2>${r.icon} Bilgilerim <span class="badge">${r.label}</span></h2>
          <dl class="info-list">
            <dt>Kullanıcı adı</dt><dd>${esc(me.username)}</dd>
            ${filled.map((f) => `<dt>${f.label}</dt><dd>${esc(p[f.key])}</dd>`).join("")}
          </dl>
          ${filled.length ? "" : `<p class="hint">Henüz bilgi eklenmedi.</p>`}
          <p style="margin:14px 0 0"><a class="btn ${filled.length ? "ghost " : ""}small" href="#/profil">✏️ ${filled.length ? "Düzenle" : "Bilgilerimi tamamla"}</a></p>
        </section>

        <section class="card col-4">
          <h2>📅 Bugünkü dersler</h2>
          <div id="today"></div>
        </section>

        <section class="card col-4">
          <h2>⏰ Yaklaşan tarihler</h2>
          <form id="f-event" class="row wrap">
            <input id="ev-title" placeholder="${T ? "ör. 7-C yazılı" : "ör. Matematik sınavı"}" required style="flex:2 1 140px">
            <input id="ev-date" type="date" required value="${todayISO()}" style="flex:1 1 130px">
            <button class="btn small" type="submit">Ekle</button>
          </form>
          <ul class="todo-list" id="events"></ul>
        </section>

        <section class="card col-6">
          <h2>✅ ${r.todoTitle}</h2>
          <form id="f-todo" class="row wrap">
            <input id="todo-text" placeholder="${esc(r.todoPlaceholder)}" required style="flex:2 1 160px">
            <input id="todo-due" type="date" title="Son tarih (isteğe bağlı)" style="flex:1 1 130px">
            <button class="btn small" type="submit">Ekle</button>
          </form>
          <ul class="todo-list" id="todos"></ul>
        </section>

        <section class="card col-6">
          <h2>📝 Notlarım</h2>
          <textarea id="notes" placeholder="Hızlı notlar… (otomatik kaydedilir)">${esc(d.notes)}</textarea>
        </section>

        <section class="card col-12">
          <h2>🗓️ Haftalık ders programı</h2>
          <p class="hint">Hücrelere tıklayarak ${T ? "ders ve sınıfı (ör. Fen 6-B)" : "ders adını"} yazın; saatleri de düzenleyebilirsiniz. Otomatik kaydedilir.</p>
          <div class="table-wrap">
            <table class="schedule">
              <thead><tr><th>Saat</th>${DAYS.map((dn, i) => `<th class="${i === dayIdx ? "today" : ""}">${dn}</th>`).join("")}</tr></thead>
              <tbody>
                ${Array.from({ length: PERIODS }, (_, pi) => `
                  <tr>
                    <th><input class="time" data-time="${pi}" value="${esc(d.times[pi] || "")}" aria-label="${pi + 1}. ders saati"></th>
                    ${DAYS.map((dn, i) => `<td><input data-cell="${i}-${pi}" value="${esc((d.schedule[i] || [])[pi] || "")}" aria-label="${dn} ${pi + 1}. ders"></td>`).join("")}
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>
      </div>`;

    function renderToday() {
      const box = $("#today");
      if (!isSchoolDay) { box.innerHTML = `<p class="muted">Bugün hafta sonu, iyi dinlenmeler! 🌿</p>`; return; }
      const lessons = (d.schedule[dayIdx] || []).map((name, i) => ({ name, i })).filter((x) => x.name);
      if (!lessons.length) { box.innerHTML = `<p class="muted">Bugün için ders girilmemiş. Aşağıdaki programı doldurun.</p>`; return; }
      const mins = now.getHours() * 60 + now.getMinutes();
      const toMin = (t) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
      box.innerHTML = `<ul class="today-list">${lessons.map(({ name, i }) => {
        const st = toMin(d.times[i]);
        const cur = st != null && mins >= st && mins < st + 40;
        return `<li class="${cur ? "now" : ""}"><span class="period">${i + 1}. ${esc(d.times[i] || "")}</span><span>${esc(name)}${cur ? " ← şimdi" : ""}</span></li>`;
      }).join("")}</ul>`;
    }
    renderToday();

    app.querySelector("table.schedule").addEventListener("input", (ev) => {
      const t = ev.target;
      if (t.dataset.cell) {
        const [i, pi] = t.dataset.cell.split("-").map(Number);
        d.schedule[i] = d.schedule[i] || [];
        d.schedule[i][pi] = t.value.trim();
      } else if (t.dataset.time) d.times[+t.dataset.time] = t.value.trim();
      else return;
      renderToday(); queueSave();
    });

    function renderTodos() {
      const list = d.todos.slice().sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
      $("#todos").innerHTML = list.length ? list.map((t) => {
        const late = t.due && !t.done && daysUntil(t.due) < 0;
        return `<li class="${t.done ? "done" : ""}">
          <input type="checkbox" data-toggle="${esc(t.id)}" ${t.done ? "checked" : ""} aria-label="Tamamlandı">
          <span>${esc(t.text)}</span>
          ${t.due ? `<span class="due ${late ? "late" : ""}">${fmtDate(t.due)}</span>` : ""}
          <button class="btn icon" data-del="${esc(t.id)}" title="Sil" aria-label="Sil">✕</button></li>`;
      }).join("") : `<li class="muted">Liste boş. 🎉</li>`;
    }
    renderTodos();
    $("#f-todo").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = $("#todo-text").value.trim(); if (!text) return;
      d.todos.push({ id: uid(), text, due: $("#todo-due").value || "", done: false });
      ev.target.reset(); renderTodos(); queueSave(0); $("#todo-text").focus();
    });
    $("#todos").addEventListener("click", (ev) => {
      const tg = ev.target.dataset.toggle, del = ev.target.dataset.del;
      if (tg) { const t = d.todos.find((x) => x.id === tg); if (t) t.done = !t.done; }
      else if (del) d.todos = d.todos.filter((x) => x.id !== del);
      else return;
      renderTodos(); queueSave(0);
    });

    function renderEvents() {
      const list = d.events.filter((e) => daysUntil(e.date) >= -1).sort((a, b) => a.date.localeCompare(b.date));
      $("#events").innerHTML = list.length ? list.map((e) => {
        const n = daysUntil(e.date);
        const when = n === 0 ? "Bugün" : n === 1 ? "Yarın" : n < 0 ? "Dün" : n + " gün";
        return `<li><span><strong>${esc(e.title)}</strong><br><span class="muted">${fmtDate(e.date)}</span></span>
          <span class="due ${n <= 1 ? "late" : ""}">${when}</span>
          <button class="btn icon" data-del="${esc(e.id)}" title="Sil" aria-label="Sil">✕</button></li>`;
      }).join("") : `<li class="muted">Yaklaşan sınav, toplantı veya etkinlik yok.</li>`;
    }
    renderEvents();
    $("#f-event").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const title = $("#ev-title").value.trim(), date = $("#ev-date").value;
      if (!title || !date) return;
      d.events.push({ id: uid(), title, date });
      $("#ev-title").value = ""; renderEvents(); queueSave(0);
    });
    $("#events").addEventListener("click", (ev) => {
      const del = ev.target.dataset.del; if (!del) return;
      d.events = d.events.filter((x) => x.id !== del); renderEvents(); queueSave(0);
    });
    $("#notes").addEventListener("input", (ev) => { d.notes = ev.target.value; queueSave(); });
  }

  /* ================= Planlarım (öğretmen) ================= */
  async function viewPlans(token, sub) {
    sub = ["yillik", "moduller", "gunluk"].includes(sub) ? sub : "yillik";
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    const d = await B.getData(me.uid);
    if (!live(token)) return;
    const queueSave = makeSaver(d);
    const subTabs = [["yillik", "📆 Yıllık plan"], ["moduller", "🧩 Ders modülleri"], ["gunluk", "🗒️ Günlük aktiviteler"]];
    app.innerHTML = `
      <div class="welcome"><div><h1>📚 Planlarım</h1><span class="saved" id="save-status"></span></div></div>
      <nav class="subtabs">${subTabs.map(([k, l]) => `<a href="#/planlar/${k}" class="${k === sub ? "active" : ""}">${l}</a>`).join("")}</nav>
      <div id="plan-body"></div>`;
    const body = $("#plan-body");

    if (sub === "yillik") {
      body.innerHTML = `
        <section class="card">
          <h2>➕ Plana satır ekle</h2>
          <form id="f-yp" class="form-grid">
            <div><label for="yp-month">Ay</label><select id="yp-month" name="month">${MONTHS.map((m) => `<option>${m}</option>`).join("")}</select></div>
            <div><label for="yp-week">Hafta / tarih</label><input id="yp-week" name="week" placeholder="ör. 2. hafta (15-19 Eylül)"></div>
            <div><label for="yp-class">Sınıf / ders</label><input id="yp-class" name="cls" placeholder="ör. 6. sınıf Fen"></div>
            <div><label for="yp-unit">Ünite</label><input id="yp-unit" name="unit" required></div>
            <div><label for="yp-topic">Konu</label><input id="yp-topic" name="topic"></div>
            <div><label for="yp-hours">Ders saati</label><input id="yp-hours" name="hours" type="number" min="0" max="40" value="4"></div>
            <div class="span-2"><label for="yp-out">Öğrenme çıktısı / kazanım</label><input id="yp-out" name="outcome" placeholder="ör. F.6.1.1.1 …"></div>
            <div><label for="yp-method">Yöntem / teknik</label><input id="yp-method" name="method" placeholder="ör. 5E, deney, tartışma"></div>
            <div><label for="yp-assess">Ölçme-değerlendirme</label><input id="yp-assess" name="assess" placeholder="ör. Çıkış kartı, rubrik"></div>
            <div class="span-all"><button class="btn" type="submit">Ekle</button></div>
          </form>
        </section>
        <section class="card" style="margin-top:16px">
          <div class="row wrap" style="justify-content:space-between">
            <h2 style="margin:0">📆 Yıllık plan</h2>
            <div class="row" style="flex:0 1 auto">
              <select id="yp-filter" aria-label="Aya göre filtrele"><option value="">Tüm aylar</option>${MONTHS.map((m) => `<option>${m}</option>`).join("")}</select>
              <button class="btn ghost small" id="yp-csv" type="button">⬇️ CSV</button>
            </div>
          </div>
          <div class="table-wrap"><table class="data"><thead><tr><th>✓</th><th>Ay</th><th>Hafta</th><th>Sınıf</th><th>Ünite / Konu</th><th>Kazanım</th><th>Saat</th><th>Yöntem</th><th>Değerlendirme</th><th></th></tr></thead><tbody id="yp-rows"></tbody></table></div>
          <p class="hint" id="yp-progress"></p>
        </section>`;
      const render = () => {
        const f = $("#yp-filter").value;
        const rows = d.yearPlan.filter((x) => !f || x.month === f)
          .sort((a, b) => MONTHS.indexOf(a.month) - MONTHS.indexOf(b.month));
        $("#yp-rows").innerHTML = rows.length ? rows.map((x) => `
          <tr class="${x.done ? "row-done" : ""}">
            <td><input type="checkbox" data-done="${esc(x.id)}" ${x.done ? "checked" : ""} aria-label="İşlendi"></td>
            <td>${esc(x.month)}</td><td>${esc(x.week)}</td><td>${esc(x.cls)}</td>
            <td><strong>${esc(x.unit)}</strong>${x.topic ? "<br>" + esc(x.topic) : ""}</td>
            <td>${esc(x.outcome)}</td><td>${esc(x.hours)}</td><td>${esc(x.method)}</td><td>${esc(x.assess)}</td>
            <td><button class="btn icon" data-del="${esc(x.id)}" aria-label="Sil" title="Sil">✕</button></td>
          </tr>`).join("") : `<tr><td colspan="10" class="muted">Henüz satır yok.</td></tr>`;
        const done = d.yearPlan.filter((x) => x.done).length;
        $("#yp-progress").textContent = d.yearPlan.length ? `İlerleme: ${done}/${d.yearPlan.length} satır işlendi (%${Math.round((done / d.yearPlan.length) * 100)})` : "";
      };
      render();
      $("#yp-filter").addEventListener("change", render);
      bindForm($("#f-yp"), null, async (fd) => {
        const x = { id: uid(), done: false };
        for (const k of ["month", "week", "cls", "unit", "topic", "hours", "outcome", "method", "assess"]) x[k] = String(fd.get(k) || "").trim();
        if (!x.unit) fail("Ünite adını yazın.");
        d.yearPlan.push(x); queueSave(0);
        const keepMonth = x.month, keepCls = x.cls;
        $("#f-yp").reset(); $("#yp-month").value = keepMonth; $("#yp-class").value = keepCls;
        render();
      });
      $("#yp-rows").addEventListener("click", (ev) => {
        const del = ev.target.dataset.del, done = ev.target.dataset.done;
        if (done) { const x = d.yearPlan.find((y) => y.id === done); x.done = !x.done; }
        else if (del) { if (!confirm("Bu satır silinsin mi?")) return; d.yearPlan = d.yearPlan.filter((y) => y.id !== del); }
        else return;
        queueSave(0); render();
      });
      $("#yp-csv").addEventListener("click", () => {
        const head = ["İşlendi", "Ay", "Hafta", "Sınıf", "Ünite", "Konu", "Kazanım", "Ders saati", "Yöntem", "Değerlendirme"];
        const q = (v) => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`;
        const lines = [head.map(q).join(";")].concat(d.yearPlan.map((x) => [x.done ? "Evet" : "Hayır", x.month, x.week, x.cls, x.unit, x.topic, x.outcome, x.hours, x.method, x.assess].map(q).join(";")));
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
        a.download = `yillik-plan-${todayISO()}.csv`; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      });
    }

    if (sub === "moduller") {
      body.innerHTML = `
        <section class="card">
          <h2>➕ Yeni ders modülü</h2>
          <form id="f-mod" class="form-grid">
            <div class="span-2"><label for="m-title">Modül adı</label><input id="m-title" name="title" required placeholder="ör. Kuvvet ve Hareket — Deney seti"></div>
            <div><label for="m-cls">Sınıf / ders</label><input id="m-cls" name="cls"></div>
            <div><label for="m-dur">Süre</label><input id="m-dur" name="duration" placeholder="ör. 2 ders saati"></div>
            <div class="span-all"><label for="m-desc">İçerik / akış</label><textarea id="m-desc" name="desc" class="short" placeholder="Giriş – Keşfet – Açıkla – Derinleştir – Değerlendir…"></textarea></div>
            <div class="span-2"><label for="m-link">Materyal bağlantısı (isteğe bağlı)</label><input id="m-link" name="link" type="url" placeholder="https://…"></div>
            <div class="span-all"><button class="btn" type="submit">Ekle</button></div>
          </form>
        </section>
        <div class="module-grid" id="mods" style="margin-top:16px"></div>`;
      const STATES = ["Taslak", "Hazır", "Uygulandı"];
      const render = () => {
        $("#mods").innerHTML = d.modules.length ? d.modules.slice().reverse().map((m) => `
          <article class="card module">
            <div class="row" style="justify-content:space-between"><h3>${esc(m.title)}</h3>
              <button class="btn icon" data-del="${esc(m.id)}" aria-label="Sil" title="Sil">✕</button></div>
            <p class="muted">${esc(m.cls)}${m.duration ? " · " + esc(m.duration) : ""}</p>
            ${m.desc ? `<p>${nl2br(m.desc)}</p>` : ""}
            ${safeUrl(m.link) ? `<p><a href="${esc(safeUrl(m.link))}" target="_blank" rel="noopener">🔗 Materyal</a></p>` : ""}
            <select data-state="${esc(m.id)}" aria-label="Durum">${STATES.map((s) => `<option ${s === m.state ? "selected" : ""}>${s}</option>`).join("")}</select>
          </article>`).join("") : `<p class="muted">Henüz modül yok.</p>`;
      };
      render();
      bindForm($("#f-mod"), null, async (fd) => {
        const m = { id: uid(), state: "Taslak" };
        for (const k of ["title", "cls", "duration", "desc", "link"]) m[k] = String(fd.get(k) || "").trim();
        if (!m.title) fail("Modül adını yazın.");
        if (m.link && !safeUrl(m.link)) fail("Bağlantı http:// veya https:// ile başlamalı.");
        d.modules.push(m); queueSave(0); $("#f-mod").reset(); render();
      });
      $("#mods").addEventListener("click", (ev) => {
        const del = ev.target.dataset.del; if (!del) return;
        if (!confirm("Bu modül silinsin mi?")) return;
        d.modules = d.modules.filter((m) => m.id !== del); queueSave(0); render();
      });
      $("#mods").addEventListener("change", (ev) => {
        const id = ev.target.dataset.state; if (!id) return;
        d.modules.find((m) => m.id === id).state = ev.target.value; queueSave(0);
      });
    }

    if (sub === "gunluk") {
      body.innerHTML = `
        <section class="card">
          <h2>➕ Günlük aktivite ekle</h2>
          <form id="f-day" class="form-grid">
            <div><label for="g-date">Tarih</label><input id="g-date" name="date" type="date" value="${todayISO()}" required></div>
            <div><label for="g-cls">Sınıf</label><input id="g-cls" name="cls" placeholder="ör. 7-C"></div>
            <div class="span-2"><label for="g-act">Yapılan etkinlik</label><input id="g-act" name="activity" required placeholder="ör. Basınç deneyi, grup çalışması"></div>
            <div class="span-all"><label for="g-note">Gözlem / not</label><textarea id="g-note" name="note" class="short" placeholder="Öğrenci katılımı, aksayan noktalar, bir sonraki derse not…"></textarea></div>
            <div class="span-all"><button class="btn" type="submit">Ekle</button></div>
          </form>
        </section>
        <section class="card" style="margin-top:16px"><h2>🗒️ Aktivite günlüğü</h2><div id="days"></div></section>`;
      const render = () => {
        const groups = {};
        d.daily.forEach((x) => { (groups[x.date] = groups[x.date] || []).push(x); });
        const dates = Object.keys(groups).sort().reverse();
        $("#days").innerHTML = dates.length ? dates.map((dt) => `
          <h3 class="day-head">${fmtDate(dt)}</h3>
          <ul class="todo-list">${groups[dt].map((x) => `
            <li><span><strong>${esc(x.cls ? x.cls + " · " : "")}${esc(x.activity)}</strong>${x.note ? `<br><span class="muted">${nl2br(x.note)}</span>` : ""}</span>
            <button class="btn icon" data-del="${esc(x.id)}" aria-label="Sil" title="Sil">✕</button></li>`).join("")}</ul>`).join("")
          : `<p class="muted">Henüz kayıt yok.</p>`;
      };
      render();
      bindForm($("#f-day"), null, async (fd) => {
        const x = { id: uid() };
        for (const k of ["date", "cls", "activity", "note"]) x[k] = String(fd.get(k) || "").trim();
        if (!x.activity || !x.date) fail("Tarih ve etkinlik gerekli.");
        d.daily.push(x); queueSave(0);
        $("#g-act").value = ""; $("#g-note").value = ""; render();
      });
      $("#days").addEventListener("click", (ev) => {
        const del = ev.target.dataset.del; if (!del) return;
        d.daily = d.daily.filter((x) => x.id !== del); queueSave(0); render();
      });
    }
  }

  /* ================= Öğrenciler (öğretmen) ================= */
  async function viewStudents(token) {
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    const [students, assignments, subs, acts] = await Promise.all([B.listStudents(), B.listAssignments(), B.listSubmissions(), B.listActivity()]);
    if (!live(token)) return;
    const byUid = Object.fromEntries(students.map((s) => [s.uid, s]));
    const rowsFor = (s) => {
      const assigned = assignments.filter((a) => a.assignees.includes(s.uid)).length;
      const mine = subs.filter((x) => x.uid === s.uid);
      const scores = mine.filter((x) => x.status === "puanlandi" && typeof x.score === "number").map((x) => x.score);
      const last = acts.find((a) => a.uid === s.uid);
      return { assigned, sent: mine.length, avg: avg(scores), last };
    };
    app.innerHTML = `
      <div class="welcome"><div><h1>👥 Öğrencilerim <span class="badge">${students.length}</span></h1>
        <span class="muted">Öğrenciler giriş sayfasındaki "Öğrenci kaydı oluştur" bağlantısıyla kendileri kayıt olur.</span></div></div>
      <section class="card">
        <input id="st-search" type="search" placeholder="Ara: ad, kullanıcı adı, sınıf, numara…" aria-label="Öğrenci ara">
        <div class="table-wrap"><table class="data clickable">
          <thead><tr><th>Öğrenci</th><th>Sınıf</th><th>Son giriş</th><th>Teslim</th><th>Ort. puan</th><th>Son etkinlik</th></tr></thead>
          <tbody id="st-rows"></tbody></table></div>
      </section>
      <section class="card" style="margin-top:16px">
        <h2>📡 Son etkinlikler (tüm öğrenciler)</h2>
        <ul class="timeline">${acts.slice(0, 40).map((a) => actItem(a, nameOf(byUid[a.uid]) || a.username)).join("") || `<li class="muted">Henüz etkinlik yok.</li>`}</ul>
      </section>`;
    const render = () => {
      const q = normUser($("#st-search").value);
      const list = students.filter((s) => !q || normUser([s.username, s.profile.name, s.profile.grade, s.profile.number].join(" ")).includes(q))
        .sort((a, b) => nameOf(a).localeCompare(nameOf(b), "tr"));
      $("#st-rows").innerHTML = list.length ? list.map((s) => {
        const x = rowsFor(s);
        return `<tr data-go="#/ogrenci/${esc(s.uid)}" tabindex="0">
          <td><div class="row" style="gap:10px"><span class="avatar">${esc(initials(nameOf(s)))}</span><span><strong>${esc(nameOf(s))}</strong><br><span class="muted">@${esc(s.username)}</span></span></div></td>
          <td>${esc(s.profile.grade || "—")}</td>
          <td>${fmtStamp(s.lastLogin)}</td>
          <td>${x.sent}/${x.assigned}</td>
          <td>${x.avg ?? "—"}</td>
          <td>${x.last ? `${ACT[x.last.type] ? ACT[x.last.type].icon : "•"} ${esc(x.last.label)}<br><span class="hint">${fmtStamp(x.last.at)}</span>` : "—"}</td>
        </tr>`;
      }).join("") : `<tr><td colspan="6" class="muted">${students.length ? "Eşleşen öğrenci yok." : "Henüz kayıtlı öğrenci yok."}</td></tr>`;
    };
    render();
    $("#st-search").addEventListener("input", render);
    $("#st-rows").addEventListener("click", (ev) => { const tr = ev.target.closest("tr[data-go]"); if (tr) go(tr.dataset.go); });
    $("#st-rows").addEventListener("keydown", (ev) => { const tr = ev.target.closest("tr[data-go]"); if (tr && ev.key === "Enter") go(tr.dataset.go); });
  }

  function actItem(a, who) {
    const t = ACT[a.type] || { icon: "•", label: a.type };
    const url = safeUrl(a.detail);
    return `<li><span class="tl-ic" title="${esc(t.label)}">${t.icon}</span>
      <div><strong>${who ? esc(who) + " — " : ""}${esc(a.label)}</strong>
      ${a.detail ? `<br><span class="muted">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>` : esc(a.detail)}</span>` : ""}
      <br><span class="hint">${fmtStamp(a.at)}</span></div></li>`;
  }

  async function viewStudent(token, sid) {
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    const [s, assignments, subs, acts] = await Promise.all([B.getStudent(sid), B.listAssignments(), B.listSubmissions(), B.listActivity(sid)]);
    if (!live(token)) return;
    if (!s) { app.innerHTML = `<div class="card narrow"><p>Öğrenci bulunamadı.</p><a class="btn" href="#/ogrenciler">Geri</a></div>`; return; }
    const mine = assignments.filter((a) => a.assignees.includes(sid));
    const subOf = (a) => subs.find((x) => x.assignmentId === a.id && x.uid === sid);
    const scores = subs.filter((x) => x.uid === sid && x.status === "puanlandi" && typeof x.score === "number").map((x) => x.score);
    const games = acts.filter((a) => a.type === "oyun").length, sites = acts.filter((a) => a.type === "site").length;
    app.innerHTML = `
      <p><a href="#/ogrenciler">← Öğrencilerim</a></p>
      <div class="welcome">
        <div class="row" style="gap:14px"><span class="avatar big">${esc(initials(nameOf(s)))}</span>
          <div><h1>${esc(nameOf(s))}</h1><span class="muted">@${esc(s.username)}${s.profile.grade ? " · " + esc(s.profile.grade) : ""}</span></div></div>
        <div class="actions">
          <a class="btn small" href="#/mesajlar/${esc(B.convIdOf(me.uid, sid))}">💬 Mesaj gönder</a>
          ${B.canResetPassword ? `<button class="btn ghost small" id="btn-reset" type="button">🔑 Şifre sıfırla</button>` : ""}
          <button class="btn danger small" id="btn-del" type="button">Sil</button>
        </div>
      </div>
      <div class="stats">
        <div class="stat card"><span class="stat-ic">📤</span><span class="stat-n">${subs.filter((x) => x.uid === sid).length}/${mine.length}</span><span class="stat-l">Teslim edilen ödev</span></div>
        <div class="stat card"><span class="stat-ic">⭐</span><span class="stat-n">${avg(scores) ?? "—"}</span><span class="stat-l">Ortalama puan</span></div>
        <div class="stat card"><span class="stat-ic">🎮</span><span class="stat-n">${games}</span><span class="stat-l">Oyun oturumu</span></div>
        <div class="stat card"><span class="stat-ic">🌐</span><span class="stat-n">${sites}</span><span class="stat-l">Site ziyareti</span></div>
      </div>
      <div class="grid">
        <section class="card col-4">
          <h2>🪪 Profil</h2>
          <dl class="info-list">
            <dt>Kullanıcı adı</dt><dd>${esc(s.username)}</dd>
            ${ROLES.student.fields.map((f) => `<dt>${f.label}</dt><dd>${esc(s.profile[f.key] || "—")}</dd>`).join("")}
            <dt>Kayıt</dt><dd>${fmtStamp(s.createdAt)}</dd>
            <dt>Son giriş</dt><dd>${fmtStamp(s.lastLogin)}</dd>
          </dl>
        </section>
        <section class="card col-8">
          <h2>📝 Ödevleri</h2>
          <div class="table-wrap"><table class="data"><thead><tr><th>Ödev</th><th>Son tarih</th><th>Durum</th><th>Puan</th></tr></thead><tbody>
            ${mine.length ? mine.map((a) => { const x = subOf(a); const st = STATUS[x ? x.status : "yok"]; return `
              <tr><td><a href="#/odev/${esc(a.id)}">${esc(a.title)}</a></td><td>${a.due ? fmtDate(a.due) : "—"}</td>
              <td><span class="status ${st.cls}">${st.label}</span></td><td>${x && typeof x.score === "number" ? x.score : "—"}</td></tr>`; }).join("")
              : `<tr><td colspan="4" class="muted">Atanmış ödev yok.</td></tr>`}
          </tbody></table></div>
        </section>
        <section class="card col-12">
          <div class="row wrap" style="justify-content:space-between">
            <h2 style="margin:0">🕓 Etkinlik geçmişi <span class="hint">(yalnızca öğretmen görür)</span></h2>
            <select id="act-filter" style="flex:0 0 180px" aria-label="Etkinlik türü"><option value="">Tüm etkinlikler</option>${Object.entries(ACT).map(([k, v]) => `<option value="${k}">${v.icon} ${v.label}</option>`).join("")}</select>
          </div>
          <ul class="timeline" id="acts"></ul>
        </section>
      </div>`;
    const renderActs = () => {
      const f = $("#act-filter").value;
      const list = acts.filter((a) => !f || a.type === f);
      $("#acts").innerHTML = list.length ? list.slice(0, 300).map((a) => actItem(a)).join("") : `<li class="muted">Kayıt yok.</li>`;
    };
    renderActs();
    $("#act-filter").addEventListener("change", renderActs);
    if ($("#btn-reset")) $("#btn-reset").addEventListener("click", async () => {
      const pw = prompt(`@${s.username} için yeni şifre (en az ${MIN_PW} karakter):`);
      if (pw == null) return;
      if (pw.length < MIN_PW) return alert(`Şifre en az ${MIN_PW} karakter olmalı.`);
      try { await B.resetPassword(sid, pw); alert("Şifre güncellendi. Öğrenciye yeni şifresini iletin."); } catch (e) { alert(e.message); }
    });
    $("#btn-del").addEventListener("click", async () => {
      const msg = B.mode === "supabase"
        ? `@${s.username} öğrencisinin profil ve verileri silinecek. (Giriş hesabını tamamen kaldırmak için Supabase → Authentication → Users kullanın.) Devam edilsin mi?`
        : `@${s.username} öğrencisinin hesabı ve tüm verileri silinecek. Devam edilsin mi?`;
      if (!confirm(msg)) return;
      try { await B.deleteStudent(sid); go("#/ogrenciler"); } catch (e) { alert(e.message); }
    });
  }

  /* ================= Ödevler ================= */
  async function viewAssignments(token) {
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    if (isTeacher()) return viewAssignmentsTeacher(token);
    const [assignments, subs] = await Promise.all([B.listAssignments(), B.listSubmissions()]);
    if (!live(token)) return;
    const subOf = (a) => subs.find((x) => x.assignmentId === a.id);
    const order = { yok: 0, iade: 1, teslim: 2, puanlandi: 3 };
    const list = assignments.slice().sort((a, b) => order[subOf(a) ? subOf(a).status : "yok"] - order[subOf(b) ? subOf(b).status : "yok"]);
    app.innerHTML = `
      <div class="welcome"><div><h1>📝 Ödevlerim</h1><span class="muted">Öğretmeninin gönderdiği ödevler. Cevabını yazıp öğretmenine gönderebilirsin.</span></div></div>
      <div class="assign-list">${list.length ? list.map((a) => {
        const x = subOf(a);
        const st = STATUS[x ? x.status : "yok"];
        const n = a.due ? daysUntil(a.due) : null;
        const canSend = !x || x.status !== "puanlandi";
        return `
        <article class="card assign">
          <div class="row wrap" style="justify-content:space-between">
            <h2 style="margin:0">${esc(a.title)}</h2>
            <span class="status ${st.cls}">${st.label}${x && typeof x.score === "number" && x.status === "puanlandi" ? ` · ${x.score} puan` : ""}</span>
          </div>
          <p class="hint">Gönderildi: ${fmtStamp(a.createdAt)}${a.due ? ` · <span class="${n != null && n < 0 && !x ? "late-text" : ""}">Son tarih: ${fmtDate(a.due)}${n != null && n >= 0 ? ` (${n === 0 ? "bugün" : n + " gün kaldı"})` : n != null && !x ? " (süresi geçti)" : ""}</span>` : ""}</p>
          ${a.body ? `<p>${nl2br(a.body)}</p>` : ""}
          ${safeUrl(a.link) ? `<p><a href="${esc(safeUrl(a.link))}" target="_blank" rel="noopener">🔗 Ödev materyali</a></p>` : ""}
          ${x && x.feedback ? `<div class="feedback"><strong>Öğretmeninin geri bildirimi:</strong><br>${nl2br(x.feedback)}</div>` : ""}
          ${x ? `<details><summary>Gönderdiğim cevap (${fmtStamp(x.submittedAt)})</summary><p>${nl2br(x.text || "—")}</p>${safeUrl(x.link) ? `<p><a href="${esc(safeUrl(x.link))}" target="_blank" rel="noopener">${esc(x.link)}</a></p>` : ""}</details>` : ""}
          ${canSend ? `
          <form class="f-submit" data-id="${esc(a.id)}" data-existing="${x ? "1" : ""}">
            <label>Cevabım</label>
            <textarea name="text" class="short" required placeholder="Cevabını buraya yaz…">${esc(x ? x.text : "")}</textarea>
            <label>Bağlantı (isteğe bağlı)</label>
            <input name="link" type="url" placeholder="ör. Google Drive / Canva bağlantısı" value="${esc(x ? x.link : "")}">
            <p class="error"></p>
            <button class="btn" type="submit">${x ? (x.status === "iade" ? "Düzeltip yeniden gönder" : "Güncelle ve yeniden gönder") : "Öğretmene gönder"}</button>
          </form>` : ""}
        </article>`;
      }).join("") : `<div class="card"><p class="muted">Henüz sana gönderilmiş bir ödev yok.</p></div>`}</div>`;
    $$(".f-submit").forEach((form) => bindForm(form, $(".error", form), async (fd) => {
      const text = String(fd.get("text") || "").trim();
      const link = String(fd.get("link") || "").trim();
      if (!text) fail("Cevabını yaz.");
      if (link && !safeUrl(link)) fail("Bağlantı http:// veya https:// ile başlamalı.");
      const a = assignments.find((y) => y.id === form.dataset.id);
      await B.submit(form.dataset.id, { text, link }, !!form.dataset.existing);
      B.logActivity("teslim", "Ödev teslim etti: " + a.title);
      render();
    }));
  }

  async function viewAssignmentsTeacher(token) {
    const [assignments, subs, students] = await Promise.all([B.listAssignments(), B.listSubmissions(), B.listStudents()]);
    if (!live(token)) return;
    students.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "tr"));
    app.innerHTML = `
      <div class="welcome"><div><h1>📝 Ödevler</h1><span class="muted">Seçtiğiniz öğrencilere istediğiniz zaman ödev gönderin; teslimleri puanlayın veya düzeltme için geri gönderin.</span></div></div>
      <div class="grid">
        <section class="card col-6">
          <h2>📤 Yeni ödev gönder</h2>
          <form id="f-asg">
            <label for="a-title">Başlık</label>
            <input id="a-title" name="title" required placeholder="ör. 3. hafta — Kuvvet çalışma kâğıdı">
            <label for="a-body">Açıklama / yönerge</label>
            <textarea id="a-body" name="body" class="short" placeholder="Ödevin yönergesi, değerlendirme ölçütleri…"></textarea>
            <div class="form-grid">
              <div><label for="a-due">Son tarih</label><input id="a-due" name="due" type="date"></div>
              <div><label for="a-link">Materyal bağlantısı</label><input id="a-link" name="link" type="url" placeholder="https://… (isteğe bağlı)"></div>
            </div>
            <label>Kime?</label>
            <label class="check"><input type="checkbox" id="a-all" checked> Tüm kayıtlı öğrenciler (${students.length})</label>
            <div class="pick-list" id="a-pick" hidden>
              ${students.map((s) => `<label class="check"><input type="checkbox" name="to" value="${esc(s.uid)}"> ${esc(nameOf(s))} <span class="muted">@${esc(s.username)}${s.profile.grade ? " · " + esc(s.profile.grade) : ""}</span></label>`).join("") || `<p class="muted">Kayıtlı öğrenci yok.</p>`}
            </div>
            <p class="error" id="err-asg"></p>
            <button class="btn" type="submit">Ödevi gönder</button>
          </form>
        </section>
        <section class="card col-6">
          <h2>📋 Gönderilen ödevler</h2>
          <ul class="assign-rows">${assignments.length ? assignments.map((a) => {
            const ss = subs.filter((x) => x.assignmentId === a.id);
            const pending = ss.filter((x) => x.status === "teslim").length;
            return `<li>
              <a href="#/odev/${esc(a.id)}"><strong>${esc(a.title)}</strong></a>
              <span class="hint">${fmtStamp(a.createdAt)}${a.due ? " · Son: " + fmtDate(a.due) : ""} · ${a.allStudents ? "Tüm öğrenciler" : a.assignees.length + " öğrenci"}</span>
              <span class="row wrap" style="gap:6px">
                <span class="status st-sent">Teslim ${ss.length}/${a.assignees.length}</span>
                ${pending ? `<span class="status st-back">${pending} değerlendirme bekliyor</span>` : ""}
                <button class="btn ghost small" data-copy="${esc(a.id)}" type="button" title="Bu ödevi forma kopyala (haftalık tekrar için)">⧉ Kopyala</button>
              </span>
            </li>`;
          }).join("") : `<li class="muted">Henüz ödev gönderilmedi.</li>`}</ul>
        </section>
      </div>`;
    $("#a-all").addEventListener("change", (ev) => { $("#a-pick").hidden = ev.target.checked; });
    bindForm($("#f-asg"), $("#err-asg"), async (fd) => {
      const title = String(fd.get("title") || "").trim();
      const link = String(fd.get("link") || "").trim();
      if (!title) fail("Başlık yazın.");
      if (link && !safeUrl(link)) fail("Bağlantı http:// veya https:// ile başlamalı.");
      const all = $("#a-all").checked;
      const assignees = all ? students.map((s) => s.uid) : fd.getAll("to").map(String);
      if (!assignees.length) fail(all ? "Henüz kayıtlı öğrenci yok." : "En az bir öğrenci seçin.");
      await B.addAssignment({ title, body: String(fd.get("body") || "").trim(), due: String(fd.get("due") || ""), link, assignees, allStudents: all });
      render();
    });
    app.querySelector(".assign-rows").addEventListener("click", (ev) => {
      const id = ev.target.dataset.copy; if (!id) return;
      const a = assignments.find((x) => x.id === id);
      $("#a-title").value = a.title; $("#a-body").value = a.body || ""; $("#a-link").value = a.link || ""; $("#a-due").value = "";
      $("#a-title").focus(); $("#a-title").scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  async function viewAssignment(token, aid) {
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    const [assignments, subs, students] = await Promise.all([B.listAssignments(), B.listSubmissions(), B.listStudents()]);
    if (!live(token)) return;
    const a = assignments.find((x) => x.id === aid);
    if (!a) { app.innerHTML = `<div class="card narrow"><p>Ödev bulunamadı.</p><a class="btn" href="#/odevler">Geri</a></div>`; return; }
    const byUid = Object.fromEntries(students.map((s) => [s.uid, s]));
    const rows = a.assignees.map((u) => ({ u, s: byUid[u], x: subs.find((y) => y.assignmentId === aid && y.uid === u) }))
      .sort((p, q) => nameOf(p.s).localeCompare(nameOf(q.s), "tr"));
    app.innerHTML = `
      <p><a href="#/odevler">← Ödevler</a></p>
      <section class="card">
        <div class="row wrap" style="justify-content:space-between">
          <h1 style="margin:0">${esc(a.title)}</h1>
          <button class="btn danger small" id="btn-del-asg" type="button">Ödevi sil</button>
        </div>
        <p class="hint">Gönderildi: ${fmtStamp(a.createdAt)}${a.due ? " · Son tarih: " + fmtDate(a.due) : ""} · ${a.assignees.length} öğrenci</p>
        ${a.body ? `<p>${nl2br(a.body)}</p>` : ""}
        ${safeUrl(a.link) ? `<p><a href="${esc(safeUrl(a.link))}" target="_blank" rel="noopener">🔗 Materyal</a></p>` : ""}
      </section>
      <h2 style="margin:20px 0 10px">Teslimler</h2>
      <div class="assign-list">${rows.map(({ u, s, x }) => {
        const st = STATUS[x ? x.status : "yok"];
        return `<article class="card">
          <div class="row wrap" style="justify-content:space-between">
            <div class="row" style="gap:10px"><span class="avatar">${esc(initials(nameOf(s)))}</span>
              <span><strong>${s ? `<a href="#/ogrenci/${esc(u)}">${esc(nameOf(s))}</a>` : "Silinmiş öğrenci"}</strong>${s ? `<br><span class="muted">@${esc(s.username)}</span>` : ""}</span></div>
            <span class="status ${st.cls}">${st.label}${x && typeof x.score === "number" ? ` · ${x.score} puan` : ""}</span>
          </div>
          ${x ? `
            <p class="hint">Teslim: ${fmtStamp(x.submittedAt)}${x.gradedAt ? " · Son değerlendirme: " + fmtStamp(x.gradedAt) : ""}</p>
            <div class="answer">${nl2br(x.text || "—")}</div>
            ${safeUrl(x.link) ? `<p><a href="${esc(safeUrl(x.link))}" target="_blank" rel="noopener">🔗 ${esc(x.link)}</a></p>` : ""}
            <form class="f-grade form-grid" data-id="${esc(x.id)}">
              <div><label>Puan (0–100)</label><input name="score" type="number" min="0" max="100" value="${typeof x.score === "number" ? x.score : ""}"></div>
              <div class="span-all"><label>Geri bildirim</label><textarea name="feedback" class="short" placeholder="Güçlü yönler, geliştirilmesi gerekenler…">${esc(x.feedback || "")}</textarea></div>
              <div class="span-all actions">
                <button class="btn" type="submit" name="act" value="puanlandi">⭐ Puanla</button>
                <button class="btn ghost" type="submit" name="act" value="iade">↩️ Düzeltme için geri gönder</button>
                <span class="error"></span>
              </div>
            </form>` : `<p class="muted">Henüz teslim etmedi.</p>`}
        </article>`;
      }).join("")}</div>`;
    $$(".f-grade").forEach((form) => bindForm(form, $(".error", form), async (fd, btn) => {
      const status = btn && btn.value === "iade" ? "iade" : "puanlandi";
      const raw = String(fd.get("score") || "").trim();
      const score = raw === "" ? null : Number(raw);
      if (status === "puanlandi" && (score == null || !(score >= 0 && score <= 100))) fail("0 ile 100 arasında bir puan girin.");
      if (score != null && !(score >= 0 && score <= 100)) fail("Puan 0 ile 100 arasında olmalı.");
      const feedback = String(fd.get("feedback") || "").trim();
      if (status === "iade" && !feedback) fail("Geri gönderirken öğrenciye ne düzeltmesi gerektiğini yazın.");
      await B.grade(form.dataset.id, { score, feedback, status });
      render();
    }));
    $("#btn-del-asg").addEventListener("click", async () => {
      if (!confirm("Ödev ve tüm teslimleri silinecek. Emin misiniz?")) return;
      try { await B.deleteAssignment(aid); go("#/odevler"); } catch (e) { alert(e.message); }
    });
  }

  /* ================= Mesajlar ================= */
  async function viewMessages(token, convId) {
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    const [msgs0, dir, settings] = await Promise.all([B.listMessages(), B.directory(), B.getSettings()]);
    if (!live(token)) return;
    let msgs = msgs0;
    const T = isTeacher();
    const byUid = Object.fromEntries(dir.map((u) => [u.uid, u]));
    const label = (u) => (u ? (u.role === "teacher" ? `👨‍🏫 ${u.name || "Öğretmen"}` : u.name || "@" + u.username) : "Silinmiş kullanıcı");
    const teacherU = dir.find((u) => u.role === "teacher");
    const others = dir.filter((u) => u.uid !== me.uid && u.role === "student").sort((a, b) => (a.name || a.username).localeCompare(b.name || b.username, "tr"));
    const contacts = T ? others : [teacherU].filter(Boolean).concat(settings.studentChat ? others : []);

    app.innerHTML = `
      <div class="welcome"><div><h1>💬 Mesajlar</h1>
        <span class="muted">${T ? "Tüm yazışmaları görebilir ve yönetebilirsiniz." : "Mesajların öğretmenin tarafından görülebilir."}</span></div>
        ${T ? `<label class="check switch"><input type="checkbox" id="chat-toggle" ${settings.studentChat ? "checked" : ""}> Öğrenciler birbirine mesaj gönderebilsin</label>` : ""}
      </div>
      <div class="chat">
        <aside class="card chat-side" id="chat-side"></aside>
        <section class="card chat-main" id="chat-main"></section>
      </div>`;

    function renderSide() {
      const lastOf = (cid) => msgs.filter((m) => m.convId === cid).sort((a, b) => b.at.localeCompare(a.at))[0];
      const item = (cid, title, sub) => {
        const n = unreadCount(msgs, cid);
        const last = lastOf(cid);
        return `<a class="conv ${cid === convId ? "active" : ""}" href="#/mesajlar/${esc(cid)}">
          <span class="conv-t">${title}${n ? ` <span class="badge">${n}</span>` : ""}</span>
          <span class="hint">${last ? esc(last.text.slice(0, 40)) : esc(sub || "Yeni sohbet")}</span></a>`;
      };
      let html = `<h2>Kişiler</h2>` + (contacts.length ? contacts.map((u) => item(B.convIdOf(me.uid, u.uid), esc(label(u)), u.role === "student" ? "@" + u.username : "")).join("") : `<p class="muted">${T ? "Henüz kayıtlı öğrenci yok." : "Kişi yok."}</p>`);
      if (T) {
        const between = [...new Set(msgs.filter((m) => !m.participants.includes(me.uid)).map((m) => m.convId))];
        html += `<h2 style="margin-top:16px">Öğrenciler arası</h2>` + (between.length
          ? between.map((cid) => { const [a, b] = cid.split("__"); return item(cid, `${esc(label(byUid[a]))} ↔ ${esc(label(byUid[b]))}`); }).join("")
          : `<p class="muted">Öğrenciler arası yazışma yok.</p>`);
      } else if (!settings.studentChat) {
        html += `<p class="hint" style="margin-top:12px">Öğrenciler arası mesajlaşma şu an öğretmenin tarafından kapalı.</p>`;
      }
      $("#chat-side").innerHTML = html;
    }

    function renderMain() {
      const box = $("#chat-main");
      if (!convId) { box.innerHTML = `<p class="muted center" style="margin-top:40px">Soldan bir kişi veya sohbet seçin.</p>`; return; }
      const parts = convId.split("__");
      const amIn = parts.includes(me.uid);
      if (!amIn && !T) { box.innerHTML = `<p class="error">Bu sohbete erişimin yok.</p>`; return; }
      const other = amIn ? byUid[parts.find((p) => p !== me.uid)] : null;
      const thread = msgs.filter((m) => m.convId === convId).sort((a, b) => a.at.localeCompare(b.at));
      const canSend = amIn && other && (T || other.role === "teacher" || settings.studentChat);
      box.innerHTML = `
        <h2>${amIn ? esc(label(other)) : `${esc(label(byUid[parts[0]]))} ↔ ${esc(label(byUid[parts[1]]))} <span class="hint">(yalnızca görüntüleme)</span>`}</h2>
        <div class="thread" id="thread">${thread.length ? thread.map((m) => `
          <div class="msg ${m.from === me.uid ? "mine" : ""}">
            ${!amIn || m.from !== me.uid ? `<span class="msg-from">${esc(label(byUid[m.from]))}</span>` : ""}
            <div class="bubble">${nl2br(m.text)}</div>
            <span class="hint">${fmtStamp(m.at)}${T ? ` · <button class="btn icon" data-del-msg="${esc(m.id)}" title="Mesajı sil" aria-label="Mesajı sil">✕</button>` : ""}</span>
          </div>`).join("") : `<p class="muted center">Henüz mesaj yok. İlk mesajı yazın.</p>`}</div>
        ${canSend ? `<form id="f-msg" class="row">
            <textarea name="text" rows="2" placeholder="Mesaj yaz… (Enter gönderir, Shift+Enter yeni satır)" required></textarea>
            <button class="btn" type="submit">Gönder</button>
          </form><p class="error" id="err-msg"></p>`
          : amIn ? `<p class="hint">Öğrenciler arası mesajlaşma şu an kapalı.</p>` : ""}`;
      const th = $("#thread"); th.scrollTop = th.scrollHeight;
      if (thread.length) markSeen(convId);
      if (canSend) {
        const ta = $("#f-msg textarea");
        ta.focus();
        ta.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $("#f-msg").requestSubmit(); } });
        bindForm($("#f-msg"), $("#err-msg"), async (fd) => {
          const text = String(fd.get("text") || "").trim();
          if (!text) return;
          if (text.length > 2000) fail("Mesaj en fazla 2000 karakter olabilir.");
          await B.sendMessage(other.uid, text);
          msgs = await B.listMessages();
          renderMain(); renderSide();
        });
      }
    }
    renderSide(); renderMain();

    $("#chat-main").addEventListener("click", async (ev) => {
      const id = ev.target.dataset.delMsg; if (!id) return;
      if (!confirm("Mesaj silinsin mi?")) return;
      try { await B.deleteMessage(id); msgs = msgs.filter((m) => m.id !== id); renderMain(); renderSide(); } catch (e) { alert(e.message); }
    });
    if (T) $("#chat-toggle").addEventListener("change", async (ev) => {
      try { await B.saveSettings({ studentChat: ev.target.checked }); settings.studentChat = ev.target.checked; }
      catch (e) { alert(e.message); ev.target.checked = !ev.target.checked; }
    });

    // Yeni mesajlar için periyodik yenileme (yazılmakta olan metni korur)
    pageTimer = setInterval(async () => {
      if (!live(token)) return;
      try {
        const fresh = await B.listMessages();
        if (!live(token) || fresh.length === msgs.length) return;
        msgs = fresh;
        const ta = $("#f-msg textarea"); const draft = ta ? ta.value : "";
        renderSide(); renderMain();
        const ta2 = $("#f-msg textarea"); if (ta2 && draft) ta2.value = draft;
      } catch (e) { /* sessizce yok say */ }
    }, 8000);
  }

  /* ================= Uygulamalarım ================= */
  const APP_KINDS = {
    online: { icon: "🌐", label: "Online uygulama", group: "🌐 Online uygulamalar", open: "▶ Aç", log: "Online uygulama açtı: ", act: "site" },
    drive: { icon: "📁", label: "Drive", group: "📁 Drive'daki uygulamalar", open: "📁 Drive'da aç", log: "Drive uygulaması açtı: ", act: "site" },
    oyun: { icon: "🎮", label: "Oyun", group: "🎮 Oyunlar", open: "🎮 Oyna", log: "Oyun açtı: ", act: "oyun" },
    site: { icon: "🔗", label: "Site", group: "🔗 Siteler", open: "↗ Aç", log: "Siteye girdi: ", act: "site" },
  };
  const isDriveUrl = (u) => /^https:\/\/(drive|docs)\.google\.com\//i.test(u);

  async function viewResources(token) {
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    const list = await B.listResources();
    if (!live(token)) return;
    const T = isTeacher();
    const visible = T ? list : list.filter((r) => r.visible !== false);
    const groups = ["online", "drive", "oyun", "site"].map((k) => ({ k, items: visible.filter((r) => (APP_KINDS[r.kind] ? r.kind : "site") === k) }));
    const card = (r) => {
      const k = APP_KINDS[r.kind] || APP_KINDS.site;
      return `
        <article class="card module app-${esc(r.kind)}">
          <div class="row" style="justify-content:space-between"><h3>${k.icon} ${esc(r.title)}</h3>
            ${T ? `<button class="btn icon" data-del="${esc(r.id)}" aria-label="Sil" title="Sil">✕</button>` : ""}</div>
          ${r.desc ? `<p class="muted">${esc(r.desc)}</p>` : ""}
          <p class="hint">${k.label}${T ? (r.visible === false ? " · 🔒 Yalnızca ben" : " · 👥 Öğrenciler görebilir") : ""}</p>
          ${r.kind === "drive"
            ? `<a class="btn" href="${esc(safeUrl(r.url))}" target="_blank" rel="noopener" data-open="${esc(r.id)}">${k.open}</a>`
            : `<button class="btn" data-open="${esc(r.id)}" type="button">${k.open}</button>`}
        </article>`;
    };
    app.innerHTML = `
      <div class="welcome"><div><h1>📱 Uygulamalarım</h1>
        <span class="muted">${T ? "Online uygulamalar tek tıkla açılır; Drive'daki uygulamalar için Drive bağlantısı gösterilir. Öğrencilerin panelden açtıkları geçmişlerine kaydedilir." : "Öğretmeninin paylaştığı uygulamalar. (Buradan açtıkların öğretmenin tarafından görülebilir.)"}</span></div></div>
      ${T ? `<section class="card">
        <h2>➕ Uygulama ekle</h2>
        <form id="f-res" class="form-grid">
          <div><label for="r-kind">Tür</label><select id="r-kind" name="kind">
            <option value="online">🌐 Online uygulama</option><option value="drive">📁 Drive</option><option value="oyun">🎮 Oyun</option><option value="site">🔗 Site</option></select></div>
          <div><label for="r-title">Ad</label><input id="r-title" name="title" required placeholder="ör. Kesirler uygulaması"></div>
          <div class="span-2"><label for="r-url" id="r-url-label">Adres (URL)</label><input id="r-url" name="url" type="url" required placeholder="https://…"></div>
          <div class="span-all"><label for="r-desc">Açıklama</label><input id="r-desc" name="desc" placeholder="Ne için kullanılacak? (isteğe bağlı)"></div>
          <div class="span-all"><label class="check"><input type="checkbox" name="visible" checked> Öğrenciler görebilsin</label></div>
          <div class="span-all"><button class="btn" type="submit">Ekle</button><span class="error" id="err-res"></span></div>
        </form></section>` : ""}
      ${groups.filter((g) => g.items.length || (g.k === "oyun")).map((g) => `
        <h2 class="group-head">${APP_KINDS[g.k].group}</h2>
        <div class="module-grid">
          ${g.k === "oyun" ? `<article class="card module builtin">
            <h3>🧮 Hızlı Matematik</h3>
            <p class="muted">Sitenin kendi oyunu · 10 soru, süre tutulur. Skorlar ${T ? "öğrencinin geçmişine" : "öğretmenine"} kaydedilir.</p>
            <a class="btn" href="#/oyun/matematik">🎮 Oyna</a></article>` : ""}
          ${g.items.map(card).join("")}
        </div>`).join("")}
      ${!visible.length && !T ? `<p class="muted">Öğretmenin henüz uygulama paylaşmadı.</p>` : ""}`;

    if (T) {
      const kindSel = $("#r-kind");
      const setHint = () => {
        const drive = kindSel.value === "drive";
        $("#r-url-label").textContent = drive ? "Drive paylaşım bağlantısı" : "Adres (URL)";
        $("#r-url").placeholder = drive ? "https://drive.google.com/…" : "https://…";
      };
      kindSel.addEventListener("change", setHint);
      bindForm($("#f-res"), $("#err-res"), async (fd) => {
        const r = {
          title: String(fd.get("title") || "").trim(), url: String(fd.get("url") || "").trim(),
          kind: APP_KINDS[fd.get("kind")] ? String(fd.get("kind")) : "online",
          desc: String(fd.get("desc") || "").trim(), visible: fd.get("visible") === "on",
        };
        if (!r.title) fail("Uygulama adını yazın.");
        if (!safeUrl(r.url)) fail("Adres http:// veya https:// ile başlamalı.");
        if (r.kind === "drive" && !isDriveUrl(r.url) && !confirm("Bu bağlantı bir Google Drive adresine benzemiyor. Yine de eklensin mi?")) return;
        await B.addResource(r);
        render();
      });
    }
    app.addEventListener("click", onResClick);
    function onResClick(ev) {
      if (!live(token)) { app.removeEventListener("click", onResClick); return; }
      const opener = ev.target.closest("[data-open]");
      const delId = ev.target.dataset.del;
      if (opener) {
        const r = list.find((x) => x.id === opener.dataset.open); const url = safeUrl(r && r.url);
        if (!url) { ev.preventDefault(); return; }
        const k = APP_KINDS[r.kind] || APP_KINDS.site;
        B.logActivity(k.act, k.log + r.title, url);
        if (opener.tagName !== "A") window.open(url, "_blank", "noopener");
      } else if (delId && T) {
        if (!confirm("Bu uygulama silinsin mi?")) return;
        B.deleteResource(delId).then(render).catch((e) => alert(e.message));
      }
    }
  }

  function viewMathGame(token) {
    const TOTAL = 10;
    let i = 0, correct = 0, start = 0, q = null;
    const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
    function next() {
      const op = ["+", "−", "×"][rnd(0, 2)];
      let a, b, ans;
      if (op === "+") { a = rnd(5, 60); b = rnd(5, 40); ans = a + b; }
      else if (op === "−") { a = rnd(10, 80); b = rnd(1, a); ans = a - b; }
      else { a = rnd(2, 12); b = rnd(2, 10); ans = a * b; }
      q = { text: `${a} ${op} ${b}`, ans };
    }
    app.innerHTML = `
      <p><a href="#/uygulamalar">← Uygulamalarım</a></p>
      <section class="card narrow center game" id="game">
        <h2 style="justify-content:center">🧮 Hızlı Matematik</h2>
        <p class="muted">${TOTAL} işlem çöz. Ne kadar hızlı ve doğru olursan o kadar iyi!</p>
        <button class="btn" id="g-start" type="button">Başla</button>
      </section>`;
    $("#g-start").addEventListener("click", () => { start = Date.now(); next(); ask(); });
    function ask() {
      if (!live(token)) return;
      $("#game").innerHTML = `
        <p class="hint">Soru ${i + 1}/${TOTAL} · Doğru: ${correct}</p>
        <div class="g-q">${q.text} = ?</div>
        <form id="g-form" class="row" style="max-width:260px;margin:0 auto">
          <input id="g-ans" type="number" inputmode="numeric" required autocomplete="off" aria-label="Cevap">
          <button class="btn" type="submit">✓</button>
        </form>
        <p id="g-fb" class="g-fb"></p>`;
      $("#g-ans").focus();
      $("#g-form").addEventListener("submit", (ev) => {
        ev.preventDefault();
        const ok = Number($("#g-ans").value) === q.ans;
        if (ok) correct++;
        $("#g-fb").textContent = ok ? "✔ Doğru!" : `✘ Cevap ${q.ans} olmalıydı`;
        $("#g-fb").className = "g-fb " + (ok ? "ok" : "no");
        $("#g-form button").disabled = true;
        setTimeout(() => { i++; if (i < TOTAL) { next(); ask(); } else finish(); }, ok ? 450 : 1100);
      });
    }
    function finish() {
      if (!live(token)) return;
      const sec = Math.round((Date.now() - start) / 1000);
      B.logActivity("oyun", "Hızlı Matematik oynadı", `${correct}/${TOTAL} doğru · ${sec} sn`);
      $("#game").innerHTML = `
        <h2 style="justify-content:center">🏁 Bitti!</h2>
        <div class="g-q">${correct}/${TOTAL}</div>
        <p class="muted">Süre: ${sec} saniye</p>
        <div class="actions" style="justify-content:center"><button class="btn" id="g-again" type="button">Tekrar oyna</button><a class="btn ghost" href="#/uygulamalar">Geri</a></div>`;
      $("#g-again").addEventListener("click", () => render());
    }
  }

  /* ================= Yönlendirme ================= */
  async function render() {
    const token = ++renderToken;
    clearInterval(pageTimer); pageTimer = null;
    await runFlush();
    if (!live(token)) return;
    const [page, arg] = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    setChrome(page);
    try {
      if (!me) {
        if (page === "kayit") viewRegister(); else viewLogin();
      } else {
        const teacherOnly = ["planlar", "ogrenciler", "ogrenci", "odev"];
        if (teacherOnly.includes(page) && !isTeacher()) return go("#/panel");
        const pageKey = page || "panel";
        if (!isTeacher() && pageKey !== lastLoggedPage && PAGE_NAMES[pageKey]) {
          lastLoggedPage = pageKey;
          B.logActivity("sayfa", "Sayfayı açtı: " + PAGE_NAMES[pageKey]);
        }
        switch (page) {
          case "profil": viewProfile(); break;
          case "planlar": await viewPlans(token, arg); break;
          case "ogrenciler": await viewStudents(token); break;
          case "ogrenci": await viewStudent(token, arg); break;
          case "odevler": await viewAssignments(token); break;
          case "odev": await viewAssignment(token, arg); break;
          case "mesajlar": await viewMessages(token, arg); break;
          case "uygulamalar": case "oyunlar": await viewResources(token); break;
          case "oyun": viewMathGame(token); break;
          default: await viewDashboard(token);
        }
      }
    } catch (e) {
      console.error(e);
      if (live(token)) app.innerHTML = `<div class="card narrow"><p class="error">${esc(e.message)}</p><a class="btn" href="#/">Ana sayfa</a></div>`;
    }
    window.scrollTo(0, 0);
  }

  window.addEventListener("beforeunload", () => { if (flushSave) runFlush(); });

  (async function start() {
    app.innerHTML = `<p class="muted center">Yükleniyor…</p>`;
    try { B = await window.OGH.createBackend(); }
    catch (e) {
      app.innerHTML = `<div class="card narrow"><p class="error">Sunucuya bağlanılamadı.</p><p class="muted">${esc(e.message)}</p><p>İnternet bağlantınızı kontrol edip sayfayı yenileyin.</p></div>`;
      return;
    }
    try { await setMe(await B.init()); } catch (e) { console.error(e); me = null; }
    window.addEventListener("hashchange", render);
    render();
  })();
})();
