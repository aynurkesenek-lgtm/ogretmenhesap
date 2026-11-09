/* Öğretmen Hesap — derleme gerektirmeyen, tarayıcıda çalışan tek sayfa uygulama.
 * Tüm veriler localStorage'da saklanır (sunucu yoktur; GitHub Pages ile uyumludur).
 */
(function () {
  "use strict";

  const STORE_KEY = "ogretmenhesap.v1";
  const THEME_KEY = "ogretmenhesap.theme";
  const DAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma"];
  const PERIODS = 8;
  const DEFAULT_TIMES = ["08:30", "09:20", "10:10", "11:00", "11:50", "13:20", "14:10", "15:00"];

  const ROLES = {
    teacher: {
      label: "Öğretmen", icon: "👩‍🏫",
      fields: [
        { key: "name", label: "Ad Soyad", required: true },
        { key: "school", label: "Okul", required: true },
        { key: "branch", label: "Branş", placeholder: "ör. Fen Bilimleri" },
        { key: "classes", label: "Girdiğim sınıflar", placeholder: "ör. 5-A, 6-B, 7-C" },
        { key: "email", label: "E-posta", type: "email" },
        { key: "phone", label: "Telefon", type: "tel" },
      ],
      todoTitle: "Yapılacaklar", todoPlaceholder: "ör. 6-B sınav kâğıtlarını oku",
    },
    student: {
      label: "Öğrenci", icon: "🧑‍🎓",
      fields: [
        { key: "name", label: "Ad Soyad", required: true },
        { key: "school", label: "Okul", required: true },
        { key: "grade", label: "Sınıf / Şube", placeholder: "ör. 7-C" },
        { key: "number", label: "Okul numarası" },
        { key: "advisor", label: "Sınıf öğretmenim" },
        { key: "parent", label: "Veli iletişim", placeholder: "ör. Annem — 05xx" },
      ],
      todoTitle: "Ödevlerim", todoPlaceholder: "ör. Matematik s. 45-46",
    },
  };

  /* ---------- Depolama ---------- */
  function emptyStore() { return { users: [], data: {}, session: null }; }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s && Array.isArray(s.users)) return s;
    } catch (e) { /* bozuk veya erişilemez */ }
    return emptyStore();
  }
  let store = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); return true; }
    catch (e) { alert("Veriler kaydedilemedi. Tarayıcınız gizli modda olabilir."); return false; }
  }
  function userData(id) {
    if (!store.data[id]) store.data[id] = { schedule: {}, times: DEFAULT_TIMES.slice(), todos: [], notes: "", events: [] };
    const d = store.data[id];
    d.times = d.times || DEFAULT_TIMES.slice();
    d.events = d.events || [];
    return d;
  }
  const currentUser = () => store.users.find((u) => u.id === store.session) || null;

  /* ---------- Yardımcılar ---------- */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const app = $("#app");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const initials = (n) => n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toLocaleUpperCase("tr-TR");
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const fmtDate = (iso) => new Date(iso + "T00:00:00").toLocaleDateString("tr-TR", { day: "numeric", month: "long", weekday: "short" });
  const daysUntil = (iso) => Math.round((new Date(iso + "T00:00:00") - new Date(todayISO() + "T00:00:00")) / 86400000);

  async function hashPin(pin, salt) {
    const bytes = new TextEncoder().encode(salt + ":" + pin);
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest("SHA-256", bytes);
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    let h = 0; for (const b of bytes) h = (h * 31 + b) | 0; return "x" + h; // eski tarayıcı yedeği
  }

  function go(hash) { if (location.hash === hash) render(); else location.hash = hash; }

  /* ---------- Tema ---------- */
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) { /* yok say */ }
  $("#btn-theme").addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme")
      || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* yok say */ }
  });
  $("#btn-logout").addEventListener("click", () => { store.session = null; save(); go("#/"); });

  /* ---------- Ekranlar ---------- */
  function viewHome() {
    const card = (role) => {
      const r = ROLES[role];
      const users = store.users.filter((u) => u.role === role);
      return `
        <section class="card role-card ${role}">
          <h2>${r.icon} ${r.label} Girişi</h2>
          ${users.length ? `<ul class="profile-list">${users.map((u) => `
            <li><button type="button" data-login="${u.id}">
              <span class="avatar">${esc(initials(u.name))}</span>
              <span><strong>${esc(u.name)}</strong><br><span class="muted">${esc(u.school)}</span></span>
            </button></li>`).join("")}</ul>`
            : `<p class="muted">Bu cihazda henüz ${r.label.toLocaleLowerCase("tr-TR")} hesabı yok.</p>`}
          <a class="btn" href="#/kayit/${role}">+ Yeni ${r.label.toLocaleLowerCase("tr-TR")} hesabı</a>
        </section>`;
    };
    app.innerHTML = `
      <div class="hero">
        <h1>Hoş geldiniz</h1>
        <p class="muted">Günlük ders programı, yapılacaklar, notlar ve önemli tarihler tek ekranda.</p>
      </div>
      <div class="roles">${card("teacher")}${card("student")}</div>`;
    app.querySelectorAll("[data-login]").forEach((b) =>
      b.addEventListener("click", () => go("#/giris/" + b.dataset.login)));
  }

  function viewRegister(role) {
    const r = ROLES[role];
    if (!r) return go("#/");
    app.innerHTML = `
      <section class="card narrow role-card ${role}">
        <h2>${r.icon} ${r.label} hesabı oluştur</h2>
        <p class="hint">Bu bilgiler yalnızca bu cihazda saklanır ve her girişte panelinizde görünür.</p>
        <form id="f-reg" novalidate>
          ${r.fields.map((f) => `
            <label for="f-${f.key}">${f.label}${f.required ? " *" : ""}</label>
            <input id="f-${f.key}" name="${f.key}" type="${f.type || "text"}" ${f.required ? "required" : ""}
              placeholder="${esc(f.placeholder || "")}" autocomplete="off">`).join("")}
          <label for="f-pin">4–6 haneli PIN *</label>
          <input id="f-pin" name="pin" type="password" inputmode="numeric" pattern="[0-9]{4,6}" required autocomplete="new-password">
          <p class="hint">PIN, aynı cihazı kullanan kişilerin hesaplarını birbirinden ayırmak içindir; güçlü bir güvenlik önlemi değildir.</p>
          <p class="error" id="reg-err"></p>
          <div class="actions">
            <button class="btn" type="submit">Hesabı oluştur</button>
            <a class="btn ghost" href="#/">Vazgeç</a>
          </div>
        </form>
      </section>`;
    $("#f-name").focus();
    $("#f-reg").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const info = {};
      for (const f of r.fields) info[f.key] = String(fd.get(f.key) || "").trim();
      const pin = String(fd.get("pin") || "");
      const missing = r.fields.filter((f) => f.required && !info[f.key]).map((f) => f.label);
      if (missing.length) return ($("#reg-err").textContent = "Lütfen doldurun: " + missing.join(", "));
      if (!/^\d{4,6}$/.test(pin)) return ($("#reg-err").textContent = "PIN 4–6 haneli rakamlardan oluşmalı.");
      const id = uid();
      const salt = uid();
      store.users.push({ id, role, ...info, salt, pinHash: await hashPin(pin, salt), createdAt: new Date().toISOString() });
      userData(id);
      store.session = id;
      if (save()) go("#/panel");
    });
  }

  function viewLogin(id) {
    const u = store.users.find((x) => x.id === id);
    if (!u) return go("#/");
    const r = ROLES[u.role];
    app.innerHTML = `
      <section class="card narrow role-card ${u.role}">
        <h2><span class="avatar">${esc(initials(u.name))}</span> ${esc(u.name)}</h2>
        <p class="muted">${r.label} · ${esc(u.school)}</p>
        <form id="f-login">
          <label for="l-pin">PIN</label>
          <input id="l-pin" type="password" inputmode="numeric" autocomplete="current-password" required>
          <p class="error" id="login-err"></p>
          <div class="actions">
            <button class="btn" type="submit">Giriş yap</button>
            <a class="btn ghost" href="#/">Geri</a>
          </div>
        </form>
      </section>`;
    $("#l-pin").focus();
    $("#f-login").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      if ((await hashPin($("#l-pin").value, u.salt)) !== u.pinHash) {
        $("#login-err").textContent = "PIN hatalı.";
        $("#l-pin").select();
        return;
      }
      store.session = u.id; save(); go("#/panel");
    });
  }

  function viewEditProfile() {
    const u = currentUser(); if (!u) return go("#/");
    const r = ROLES[u.role];
    app.innerHTML = `
      <section class="card narrow role-card ${u.role}">
        <h2>✏️ Bilgilerimi düzenle</h2>
        <form id="f-edit">
          ${r.fields.map((f) => `
            <label for="e-${f.key}">${f.label}${f.required ? " *" : ""}</label>
            <input id="e-${f.key}" name="${f.key}" type="${f.type || "text"}" value="${esc(u[f.key])}"
              placeholder="${esc(f.placeholder || "")}" ${f.required ? "required" : ""}>`).join("")}
          <label for="e-pin">Yeni PIN (değiştirmeyecekseniz boş bırakın)</label>
          <input id="e-pin" name="pin" type="password" inputmode="numeric" autocomplete="new-password">
          <p class="error" id="edit-err"></p>
          <div class="actions">
            <button class="btn" type="submit">Kaydet</button>
            <a class="btn ghost" href="#/panel">Vazgeç</a>
            <button class="btn danger" type="button" id="btn-del">Hesabı sil</button>
          </div>
        </form>
      </section>`;
    $("#f-edit").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      for (const f of r.fields) {
        const v = String(fd.get(f.key) || "").trim();
        if (f.required && !v) return ($("#edit-err").textContent = f.label + " boş bırakılamaz.");
        u[f.key] = v;
      }
      const pin = String(fd.get("pin") || "");
      if (pin) {
        if (!/^\d{4,6}$/.test(pin)) return ($("#edit-err").textContent = "PIN 4–6 haneli rakamlardan oluşmalı.");
        u.salt = uid(); u.pinHash = await hashPin(pin, u.salt);
      }
      if (save()) go("#/panel");
    });
    $("#btn-del").addEventListener("click", () => {
      if (!confirm("Bu hesap ve tüm verileri bu cihazdan kalıcı olarak silinecek. Emin misiniz?")) return;
      store.users = store.users.filter((x) => x.id !== u.id);
      delete store.data[u.id];
      store.session = null; save(); go("#/");
    });
  }

  function viewDashboard() {
    const u = currentUser(); if (!u) return go("#/");
    const r = ROLES[u.role];
    const d = userData(u.id);
    const now = new Date();
    const dayIdx = now.getDay() - 1; // 0 = Pazartesi
    const isSchoolDay = dayIdx >= 0 && dayIdx < 5;
    const hour = now.getHours() < 12 ? "Günaydın" : now.getHours() < 18 ? "İyi günler" : "İyi akşamlar";

    app.innerHTML = `
      <div class="welcome role-card ${u.role}" style="border:none">
        <div>
          <h1>${hour}, ${esc(u.name.split(" ")[0])} 👋</h1>
          <span class="muted">${now.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
        </div>
        <div class="actions">
          <button class="btn ghost small" id="btn-export" type="button">⬇️ Yedekle</button>
          <label class="btn ghost small" style="margin:0">⬆️ Yedekten yükle<input id="inp-import" type="file" accept="application/json" hidden></label>
        </div>
      </div>

      <div class="grid role-card ${u.role}" style="border:none">
        <section class="card col-4">
          <h2>${r.icon} Bilgilerim <span class="badge">${r.label}</span></h2>
          <dl class="info-list">
            ${r.fields.filter((f) => u[f.key]).map((f) => `<dt>${f.label}</dt><dd>${esc(u[f.key])}</dd>`).join("")}
          </dl>
          <p style="margin:14px 0 0"><a class="btn ghost small" href="#/profil">✏️ Düzenle</a></p>
        </section>

        <section class="card col-4">
          <h2>📅 Bugünkü dersler</h2>
          <div id="today"></div>
        </section>

        <section class="card col-4">
          <h2>⏰ Yaklaşan tarihler</h2>
          <form id="f-event" class="row" style="flex-wrap:wrap">
            <input id="ev-title" placeholder="ör. 7-C yazılı" required style="flex:2 1 140px">
            <input id="ev-date" type="date" required value="${todayISO()}" style="flex:1 1 130px">
            <button class="btn small" type="submit">Ekle</button>
          </form>
          <ul class="todo-list" id="events"></ul>
        </section>

        <section class="card col-6">
          <h2>✅ ${r.todoTitle}</h2>
          <form id="f-todo" class="row" style="flex-wrap:wrap">
            <input id="todo-text" placeholder="${esc(r.todoPlaceholder)}" required style="flex:2 1 160px">
            <input id="todo-due" type="date" title="Son tarih (isteğe bağlı)" style="flex:1 1 130px">
            <button class="btn small" type="submit">Ekle</button>
          </form>
          <ul class="todo-list" id="todos"></ul>
        </section>

        <section class="card col-6">
          <h2>📝 Notlarım <span class="saved" id="notes-saved"></span></h2>
          <textarea id="notes" placeholder="Hızlı notlar… (otomatik kaydedilir)">${esc(d.notes)}</textarea>
        </section>

        <section class="card col-12">
          <h2>🗓️ Haftalık ders programı <span class="saved" id="sched-saved"></span></h2>
          <p class="hint">Hücrelere tıklayarak ${u.role === "teacher" ? "ders ve sınıfı (ör. Fen 6-B)" : "ders adını"} yazın; saatleri de düzenleyebilirsiniz. Otomatik kaydedilir.</p>
          <div class="table-wrap">
            <table class="schedule">
              <thead><tr><th>Saat</th>${DAYS.map((dn, i) => `<th class="${i === dayIdx ? "today" : ""}">${dn}</th>`).join("")}</tr></thead>
              <tbody>
                ${Array.from({ length: PERIODS }, (_, p) => `
                  <tr>
                    <th><input class="time" data-time="${p}" value="${esc(d.times[p] || "")}" aria-label="${p + 1}. ders saati"></th>
                    ${DAYS.map((dn, i) => `<td><input data-cell="${i}-${p}" value="${esc((d.schedule[i] || [])[p] || "")}" aria-label="${dn} ${p + 1}. ders"></td>`).join("")}
                  </tr>`).join("")}
              </tbody>
            </table>
          </div>
        </section>
      </div>`;

    /* Bugünkü dersler */
    function renderToday() {
      const box = $("#today");
      if (!isSchoolDay) { box.innerHTML = `<p class="muted">Bugün hafta sonu, iyi dinlenmeler! 🌿</p>`; return; }
      const lessons = (d.schedule[dayIdx] || []).map((name, p) => ({ name, p })).filter((x) => x.name);
      if (!lessons.length) { box.innerHTML = `<p class="muted">Bugün için ders girilmemiş. Aşağıdaki programı doldurun.</p>`; return; }
      const mins = now.getHours() * 60 + now.getMinutes();
      const toMin = (t) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
      box.innerHTML = `<ul class="today-list">${lessons.map(({ name, p }) => {
        const s = toMin(d.times[p]);
        const cur = s != null && mins >= s && mins < s + 40;
        return `<li class="${cur ? "now" : ""}"><span class="period">${p + 1}. ${esc(d.times[p] || "")}</span><span>${esc(name)}${cur ? " ← şimdi" : ""}</span></li>`;
      }).join("")}</ul>`;
    }
    renderToday();

    /* Ders programı */
    let schedTimer;
    app.querySelector("table.schedule").addEventListener("input", (ev) => {
      const t = ev.target;
      if (t.dataset.cell) {
        const [i, p] = t.dataset.cell.split("-").map(Number);
        d.schedule[i] = d.schedule[i] || [];
        d.schedule[i][p] = t.value.trim();
      } else if (t.dataset.time) {
        d.times[+t.dataset.time] = t.value.trim();
      } else return;
      clearTimeout(schedTimer);
      schedTimer = setTimeout(() => { if (save()) { $("#sched-saved").textContent = "kaydedildi ✓"; renderToday(); } }, 400);
    });

    /* Yapılacaklar / Ödevler */
    function renderTodos() {
      const list = d.todos.slice().sort((a, b) => (a.done - b.done) || (a.due || "9999").localeCompare(b.due || "9999"));
      $("#todos").innerHTML = list.length ? list.map((t) => {
        const late = t.due && !t.done && daysUntil(t.due) < 0;
        return `<li class="${t.done ? "done" : ""}">
          <input type="checkbox" data-toggle="${t.id}" ${t.done ? "checked" : ""} aria-label="Tamamlandı">
          <span>${esc(t.text)}</span>
          ${t.due ? `<span class="due ${late ? "late" : ""}">${fmtDate(t.due)}</span>` : ""}
          <button class="btn icon" data-del="${t.id}" title="Sil" aria-label="Sil">✕</button></li>`;
      }).join("") : `<li class="muted">Liste boş. 🎉</li>`;
    }
    renderTodos();
    $("#f-todo").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const text = $("#todo-text").value.trim(); if (!text) return;
      d.todos.push({ id: uid(), text, due: $("#todo-due").value || "", done: false });
      save(); ev.target.reset(); renderTodos(); $("#todo-text").focus();
    });
    $("#todos").addEventListener("click", (ev) => {
      const tg = ev.target.dataset.toggle, del = ev.target.dataset.del;
      if (tg) { const t = d.todos.find((x) => x.id === tg); t.done = !t.done; }
      else if (del) d.todos = d.todos.filter((x) => x.id !== del);
      else return;
      save(); renderTodos();
    });

    /* Yaklaşan tarihler */
    function renderEvents() {
      const list = d.events.filter((e) => daysUntil(e.date) >= -1).sort((a, b) => a.date.localeCompare(b.date));
      $("#events").innerHTML = list.length ? list.map((e) => {
        const n = daysUntil(e.date);
        const when = n === 0 ? "Bugün" : n === 1 ? "Yarın" : n < 0 ? "Dün" : n + " gün";
        return `<li><span><strong>${esc(e.title)}</strong><br><span class="muted">${fmtDate(e.date)}</span></span>
          <span class="due ${n <= 1 ? "late" : ""}">${when}</span>
          <button class="btn icon" data-del="${e.id}" title="Sil" aria-label="Sil">✕</button></li>`;
      }).join("") : `<li class="muted">Yaklaşan sınav, toplantı veya etkinlik yok.</li>`;
    }
    renderEvents();
    $("#f-event").addEventListener("submit", (ev) => {
      ev.preventDefault();
      const title = $("#ev-title").value.trim(), date = $("#ev-date").value;
      if (!title || !date) return;
      d.events.push({ id: uid(), title, date });
      save(); $("#ev-title").value = ""; renderEvents();
    });
    $("#events").addEventListener("click", (ev) => {
      const del = ev.target.dataset.del; if (!del) return;
      d.events = d.events.filter((x) => x.id !== del); save(); renderEvents();
    });

    /* Notlar */
    let noteTimer;
    $("#notes").addEventListener("input", (ev) => {
      d.notes = ev.target.value;
      $("#notes-saved").textContent = "…";
      clearTimeout(noteTimer);
      noteTimer = setTimeout(() => { if (save()) $("#notes-saved").textContent = "kaydedildi ✓"; }, 500);
    });

    /* Yedekle / Geri yükle (yalnızca bu hesabın verisi) */
    $("#btn-export").addEventListener("click", () => {
      const { pinHash, salt, ...profile } = u;
      const blob = new Blob([JSON.stringify({ app: "ogretmenhesap", version: 1, profile, data: d }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `ogretmenhesap-${u.name.replace(/\s+/g, "_")}-${todayISO()}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $("#inp-import").addEventListener("change", async (ev) => {
      const file = ev.target.files[0]; if (!file) return;
      try {
        const obj = JSON.parse(await file.text());
        if (obj.app !== "ogretmenhesap" || !obj.data) throw new Error("format");
        if (!confirm("Ders programı, yapılacaklar, notlar ve tarihler yedektekilerle değiştirilecek. Devam edilsin mi?")) return;
        const src = obj.data;
        store.data[u.id] = {
          schedule: src.schedule || {}, times: Array.isArray(src.times) ? src.times : DEFAULT_TIMES.slice(),
          todos: Array.isArray(src.todos) ? src.todos : [], notes: String(src.notes || ""),
          events: Array.isArray(src.events) ? src.events : [],
        };
        save(); render();
      } catch (e) { alert("Yedek dosyası okunamadı."); }
    });
  }

  /* ---------- Yönlendirme ---------- */
  function render() {
    const u = currentUser();
    $("#topnav").hidden = !u;
    $("#whoami").textContent = u ? `${ROLES[u.role].icon} ${u.name}` : "";
    const [, page, arg] = (location.hash || "#/").replace(/^#/, "").split("/");
    if (u && (!page || page === "panel")) viewDashboard();
    else if (u && page === "profil") viewEditProfile();
    else if (page === "kayit") viewRegister(arg);
    else if (page === "giris") viewLogin(arg);
    else viewHome();
    window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", render);
  render();
})();
