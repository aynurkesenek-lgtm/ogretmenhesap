/* Öğretmen Hesap — veri altyapısı.
 * window.OGH.createBackend() iki uygulamadan birini döndürür:
 *  - Supabase (js/config.js doldurulmuşsa): tüm hesaplar ve veriler tek veritabanında.
 *  - Yerel/demo: her şey bu cihazın tarayıcısında (localStorage).
 * Her iki uygulama da aynı arayüzü sunar (aşağıdaki dönüş nesnelerine bakın).
 */
(function () {
  "use strict";

  const CFG = window.OGH_CONFIG || {};
  // Supabase girişi e-posta ister: kullanıcı adı → kullanıcıadı@EMAIL_DOMAIN (iç kullanım, e-posta gönderilmez)
  const EMAIL_DOMAIN = String(CFG.emailDomain || "ogretmenhesap.app").trim().toLowerCase();
  const SUPABASE_SDK = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
  const DEFAULT_TIMES = ["08:30", "09:20", "10:10", "11:00", "11:50", "13:20", "14:10", "15:00"];
  const ACTIVITY_LIMIT = 5000;
  // Tek yönetici: öğretmen hesabı. Kullanıcı adı config.js'ten değiştirilebilir.
  const TEACHER_USERNAME = String(CFG.teacherUsername || "rasyonelx").trim().toLowerCase();

  class UserError extends Error {}
  const fail = (msg) => { throw new UserError(msg); };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const nowISO = () => new Date().toISOString();
  const convIdOf = (a, b) => [a, b].sort().join("__");
  const byDateDesc = (k) => (a, b) => String(b[k] || "").localeCompare(String(a[k] || ""));

  function normData(x) {
    x = x || {};
    return {
      schedule: x.schedule && typeof x.schedule === "object" ? x.schedule : {},
      times: Array.isArray(x.times) ? x.times : DEFAULT_TIMES.slice(),
      todos: Array.isArray(x.todos) ? x.todos : [],
      notes: String(x.notes || ""),
      events: Array.isArray(x.events) ? x.events : [],
      yearPlan: Array.isArray(x.yearPlan) ? x.yearPlan : [],
      modules: Array.isArray(x.modules) ? x.modules : [],
      daily: Array.isArray(x.daily) ? x.daily : [],
      gradeSheet: String(x.gradeSheet || ""),
      gradeSyncedAt: x.gradeSyncedAt || null,
    };
  }

  /* ============================ YEREL (DEMO) ============================ */
  function LocalBackend() {
    const KEY = "ogretmenhesap.v4";
    const blank = () => ({ users: [], data: {}, activity: [], resources: [], assignments: [], submissions: [], messages: [], grades: [], announcements: [], settings: { studentChat: false }, session: null });
    let s = null;
    try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { /* erişilemez */ }
    if (!s || !Array.isArray(s.users)) s = blank();
    s = Object.assign(blank(), s);

    const persist = () => {
      try { localStorage.setItem(KEY, JSON.stringify(s)); }
      catch (e) { fail("Veriler kaydedilemedi (tarayıcı depolaması dolu veya kapalı olabilir)."); }
    };
    async function hash(pw, salt) {
      const enc = new TextEncoder();
      if (!(window.crypto && crypto.subtle)) { let h = 0; for (const b of enc.encode(salt + pw)) h = (h * 31 + b) | 0; return "x" + h; }
      const key = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
      return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    const byId = (id) => s.users.find((u) => u.uid === id);
    const me = () => byId(s.session);
    const pub = (u) => (u ? { uid: u.uid, username: u.username, role: u.role } : null);
    const studentView = (u) => ({ uid: u.uid, username: u.username, role: u.role, profile: Object.assign({}, u.profile), createdAt: u.createdAt, lastLogin: u.lastLogin });
    const needTeacher = () => { if (!me() || me().role !== "teacher") fail("Bu işlem yalnızca öğretmene açıktır."); };
    const needLogin = () => { if (!me()) fail("Oturum kapalı. Lütfen yeniden giriş yapın."); return me(); };

    async function create(username, pw, role) {
      if (username === TEACHER_USERNAME) fail("Bu kullanıcı adı alınmış, başka bir tane deneyin.");
      if (s.users.some((u) => u.username === username)) fail("Bu kullanıcı adı alınmış, başka bir tane deneyin.");
      const salt = uid();
      const u = { uid: uid(), username, role, salt, hash: await hash(pw, salt), profile: {}, createdAt: nowISO(), lastLogin: nowISO() };
      s.users.push(u); s.session = u.uid; persist();
      return pub(u);
    }
    async function setPw(u, pw) { u.salt = uid(); u.hash = await hash(pw, u.salt); persist(); }

    return {
      mode: "local",
      canResetPassword: true,
      convIdOf,

      /* Hesap */
      async init() { return pub(me()); },
      registerStudent: (username, pw) => create(username, pw, "student"),
      async login(username, pw) {
        // Demo modu: öğretmen hesabı henüz yoksa, öğretmen kullanıcı adıyla ilk girişte yazılan şifre kaydedilir.
        if (username === TEACHER_USERNAME && !s.users.some((x) => x.role === "teacher")) {
          if (pw.length < 6) fail("Öğretmen şifresi en az 6 karakter olmalı.");
          const salt = uid();
          s.users.unshift({ uid: "teacher", username, role: "teacher", salt, hash: await hash(pw, salt), profile: {}, createdAt: nowISO(), lastLogin: nowISO() });
        }
        const u = s.users.find((x) => x.username === username);
        if (!u || (await hash(pw, u.salt)) !== u.hash) fail("Kullanıcı adı veya şifre hatalı.");
        u.lastLogin = nowISO(); s.session = u.uid; persist();
        return pub(u);
      },
      async logout() { s.session = null; persist(); },
      async changePassword(cur, pw) {
        const u = needLogin();
        if ((await hash(cur, u.salt)) !== u.hash) fail("Mevcut şifre hatalı.");
        await setPw(u, pw);
      },
      async resetPassword(id, pw) { needTeacher(); await setPw(byId(id), pw); },

      /* Profil ve kişisel veriler */
      async getProfile(id) { return Object.assign({}, (byId(id) || {}).profile); },
      async saveProfile(id, p) { byId(id).profile = p; persist(); },
      async getData(id) { return normData(s.data[id]); },
      async saveData(id, d) { s.data[id] = d; persist(); },

      /* Öğrenciler ve rehber */
      async listStudents() { needTeacher(); return s.users.filter((u) => u.role === "student").map(studentView); },
      async getStudent(id) { needTeacher(); const u = byId(id); return u ? studentView(u) : null; },
      async deleteStudent(id) {
        needTeacher();
        s.users = s.users.filter((u) => u.uid !== id);
        delete s.data[id];
        s.activity = s.activity.filter((a) => a.uid !== id);
        s.submissions = s.submissions.filter((x) => x.uid !== id);
        s.grades.forEach((g) => { if (g.userId === id) g.userId = null; });
        persist();
      },
      async directory() { needLogin(); return s.users.map((u) => ({ uid: u.uid, username: u.username, role: u.role, name: (u.profile || {}).name || "" })); },

      /* Etkinlik geçmişi (yalnızca öğretmen okur) */
      async logActivity(type, label, detail) {
        const u = me(); if (!u || u.role !== "student") return;
        s.activity.push({ id: uid(), uid: u.uid, username: u.username, type, label: String(label || ""), detail: String(detail || ""), at: nowISO() });
        if (s.activity.length > ACTIVITY_LIMIT) s.activity = s.activity.slice(-ACTIVITY_LIMIT);
        persist();
      },
      async listActivity(id) { needTeacher(); return s.activity.filter((a) => !id || a.uid === id).sort(byDateDesc("at")); },

      /* Oyun ve site bağlantıları */
      async listResources() {
        const u = needLogin();
        return s.resources.filter((r) => u.role === "teacher" || r.visible !== false).sort(byDateDesc("createdAt"));
      },
      async addResource(r) { needTeacher(); s.resources.push({ id: uid(), ...r, createdAt: nowISO() }); persist(); },
      async deleteResource(id) { needTeacher(); s.resources = s.resources.filter((r) => r.id !== id); persist(); },

      /* Ödevler */
      async listAssignments() {
        const u = needLogin();
        const list = u.role === "teacher" ? s.assignments : s.assignments.filter((a) => a.assignees.includes(u.uid));
        return list.slice().sort(byDateDesc("createdAt"));
      },
      async addAssignment(a) { needTeacher(); s.assignments.push({ id: uid(), ...a, createdAt: nowISO() }); persist(); },
      async deleteAssignment(id) {
        needTeacher();
        s.assignments = s.assignments.filter((a) => a.id !== id);
        s.submissions = s.submissions.filter((x) => x.assignmentId !== id);
        persist();
      },

      /* Teslimler */
      async listSubmissions() {
        const u = needLogin();
        return (u.role === "teacher" ? s.submissions : s.submissions.filter((x) => x.uid === u.uid)).slice();
      },
      async submit(assignmentId, { text, link }) {
        const u = needLogin();
        const a = s.assignments.find((x) => x.id === assignmentId);
        if (!a || !a.assignees.includes(u.uid)) fail("Bu ödev sana atanmamış.");
        const id = assignmentId + "_" + u.uid;
        let sub = s.submissions.find((x) => x.id === id);
        if (sub && sub.status === "puanlandi") fail("Bu ödev puanlandı; yeniden gönderilemez.");
        if (!sub) { sub = { id, assignmentId, uid: u.uid, username: u.username }; s.submissions.push(sub); }
        Object.assign(sub, { text, link, status: "teslim", submittedAt: nowISO() });
        persist();
      },
      async grade(subId, { score, feedback, status }) {
        needTeacher();
        const sub = s.submissions.find((x) => x.id === subId); if (!sub) fail("Teslim bulunamadı.");
        Object.assign(sub, { score, feedback, status, gradedAt: nowISO() });
        persist();
      },

      /* Mesajlar */
      async listMessages() {
        const u = needLogin();
        return (u.role === "teacher" ? s.messages : s.messages.filter((m) => m.participants.includes(u.uid))).slice();
      },
      async sendMessage(to, text) {
        const u = needLogin();
        const target = byId(to); if (!target) fail("Alıcı bulunamadı.");
        if (u.role === "student" && target.role === "student" && !s.settings.studentChat) fail("Öğretmenin öğrenciler arası mesajlaşmayı şu an kapattı.");
        s.messages.push({ id: uid(), from: u.uid, to, participants: [u.uid, to].sort(), convId: convIdOf(u.uid, to), text, at: nowISO() });
        persist();
      },
      async deleteMessage(id) { needTeacher(); s.messages = s.messages.filter((m) => m.id !== id); persist(); },

      /* Duyurular */
      async listAnnouncements() {
        const u = needLogin();
        return s.announcements
          .filter((a) => u.role === "teacher" || !a.recipients || a.recipients.includes(u.uid))
          .sort(byDateDesc("createdAt"));
      },
      async addAnnouncement(a) {
        needTeacher();
        s.announcements.push({ id: uid(), title: a.title, body: a.body || "", recipients: a.recipients || null, createdAt: nowISO() });
        persist();
      },
      async deleteAnnouncement(id) { needTeacher(); s.announcements = s.announcements.filter((a) => a.id !== id); persist(); },

      /* Notlar */
      async listGrades() {
        const u = needLogin();
        return (u.role === "teacher" ? s.grades : s.grades.filter((g) => g.userId === u.uid)).map((g) => ({ ...g }));
      },
      async saveGrades(rows) {
        needTeacher();
        const prev = Object.fromEntries(s.grades.map((g) => [g.schoolNo, g]));
        s.grades = rows.map((r) => ({ ...r, userId: prev[r.schoolNo] ? prev[r.schoolNo].userId : null, updatedAt: nowISO() }));
        persist();
      },
      async linkGrade(schoolNo, userId) {
        needTeacher();
        const g = s.grades.find((x) => x.schoolNo === schoolNo); if (!g) fail("Not satırı bulunamadı.");
        g.userId = userId || null; persist();
      },

      /* Ayarlar */
      async getSettings() { return Object.assign({ studentChat: false }, s.settings); },
      async saveSettings(x) { needTeacher(); s.settings = Object.assign({}, s.settings, x); persist(); },
    };
  }

  /* ============================ SUPABASE ============================ */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const el = document.createElement("script");
      el.src = src; el.onload = res; el.onerror = () => rej(new Error("Yüklenemedi: " + src));
      document.head.appendChild(el);
    });
  }
  const iso = (t) => (t ? new Date(t).toISOString() : null);

  async function SupabaseBackend() {
    if (!window.supabase) await loadScript(SUPABASE_SDK);
    const sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.anonKey);
    const teacherEmail = `${TEACHER_USERNAME}@${EMAIL_DOMAIN}`;
    const toEmail = (u) => `${u}@${EMAIL_DOMAIN}`;
    let current = null;

    const pub = (user) => {
      const email = String(user.email || "").toLowerCase();
      return { uid: user.id, username: email.split("@")[0], role: email === teacherEmail ? "teacher" : "student" };
    };
    const run = async (promise) => { const { data, error } = await promise; if (error) throw error; return data; };
    const needTeacher = () => { if (!current || current.role !== "teacher") fail("Bu işlem yalnızca öğretmene açıktır."); };

    async function touch(user) {
      const u = pub(user);
      const rows = await run(sb.from("profiles").select("id").eq("id", u.uid));
      if (rows.length) await run(sb.from("profiles").update({ last_login: nowISO() }).eq("id", u.uid));
      else await run(sb.from("profiles").insert({ id: u.uid, username: u.username, role: u.role }));
      current = u;
      return u;
    }

    const BAD_LOGIN = "Kullanıcı adı veya şifre hatalı.";
    function message(e) {
      const code = String((e && (e.code || e.error_code)) || "");
      const msg = String((e && e.message) || e || "");
      if (/invalid_credentials|Invalid login credentials/i.test(code + msg)) return BAD_LOGIN;
      if (/user_already_exists|already registered|23505/i.test(code + msg)) return "Bu kullanıcı adı alınmış, başka bir tane deneyin.";
      if (/weak_password|Password should be/i.test(code + msg)) return "Şifre en az 6 karakter olmalı.";
      if (/email_not_confirmed|not confirmed/i.test(code + msg)) return "Supabase'de e-posta doğrulaması açık. Authentication → Sign In / Providers → Email → \"Confirm email\" kapatılmalı.";
      if (/email_address_invalid|invalid format|is invalid/i.test(code + msg)) return "Supabase bu kullanıcı adını kabul etmedi (e-posta alan adı reddedildi). config.js içindeki emailDomain ayarını kontrol edin.";
      if (/signup_disabled|Signups not allowed/i.test(code + msg)) return "Supabase'de yeni kayıtlar kapalı (Authentication ayarlarından açılmalı).";
      if (/rate_limit|too many/i.test(code + msg)) return "Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.";
      if (/42501|row-level security|permission denied/i.test(code + msg)) return "Bu işlem için yetkiniz yok. (Teknik ayrıntı: " + (code ? code + " " : "") + msg.slice(0, 120) + ")";
      if (/42P01|does not exist|schema cache/i.test(code + msg)) return "Veritabanı tabloları bulunamadı. Soldaki 🗄️ SQL butonundaki kodu Supabase SQL Editor'da çalıştırın.";
      if (/Failed to fetch|NetworkError|fetch/i.test(msg)) return "Sunucuya ulaşılamıyor. İnternet bağlantınızı kontrol edin.";
      return "Bir hata oluştu: " + msg;
    }
    // Oturum belirteci süresi dolmuş ya da tarayıcıda kaybolmuşsa istek "giriş yapılmamış" gibi gider ve
    // RLS/yetki hatası döner. Bu durumda oturumu bir kez yenileyip isteği tekrarlarız.
    const isAuthError = (e) => /42501|PGRST301|PGRST302|JWT expired|invalid JWT|permission denied/i.test(String((e && (e.code || "")) + " " + ((e && e.message) || "")));
    async function refreshIfLoggedIn() {
      if (!current) return false;
      try {
        const { data, error } = await sb.auth.refreshSession();
        return !error && !!(data && data.session);
      } catch (_) { return false; }
    }
    const wrap = (fn) => async (...args) => {
      try { return await fn(...args); }
      catch (e) {
        if (e instanceof UserError) throw e;
        if (isAuthError(e) && current) {
          if (await refreshIfLoggedIn()) {
            try { return await fn(...args); }
            catch (e2) { if (e2 instanceof UserError) throw e2; console.error(e2); throw new UserError(message(e2)); }
          }
          throw new UserError("Oturumunuz sona erdi. Lütfen çıkış yapıp yeniden giriş yapın.");
        }
        console.error(e);
        throw new UserError(message(e));
      }
    };

    const mapStudent = (x) => ({ uid: x.id, username: x.username, role: x.role, profile: x.profile || {}, createdAt: iso(x.created_at), lastLogin: iso(x.last_login) });
    const mapAct = (x) => ({ id: x.id, uid: x.user_id, username: x.username, type: x.type, label: x.label, detail: x.detail, at: iso(x.at) });
    const mapRes = (x) => ({ id: x.id, title: x.title, url: x.url, kind: x.kind, desc: x.description || "", visible: x.visible !== false, createdAt: iso(x.created_at) });
    const mapAsg = (x) => ({ id: x.id, title: x.title, body: x.body || "", due: x.due || "", link: x.link || "", assignees: x.assignees || [], allStudents: !!x.all_students, createdAt: iso(x.created_at) });
    const mapSub = (x) => ({ id: x.id, assignmentId: x.assignment_id, uid: x.user_id, username: x.username, text: x.text || "", link: x.link || "", status: x.status, score: x.score == null ? null : Number(x.score), feedback: x.feedback || "", submittedAt: iso(x.submitted_at), gradedAt: iso(x.graded_at) });
    const mapAnn = (x) => ({ id: x.id, title: x.title, body: x.body || "", recipients: x.recipients || null, createdAt: iso(x.created_at) });
    const mapGrade = (x) => ({ schoolNo: x.school_no, firstName: x.first_name || "", lastName: x.last_name || "", scores: Array.isArray(x.scores) ? x.scores : [], average: x.average || "", status: x.status || "", userId: x.user_id || null, updatedAt: iso(x.updated_at) });
    const mapMsg = (x) => ({ id: x.id, from: x.from_id, to: x.to_id, participants: x.participants || [], convId: x.conv_id, text: x.text, at: iso(x.at) });

    return {
      mode: "supabase",
      canResetPassword: false,
      convIdOf,

      /* Hesap */
      init: wrap(async () => {
        const { data } = await sb.auth.getSession();
        current = data && data.session ? pub(data.session.user) : null;
        return current;
      }),
      registerStudent: wrap(async (username, pw) => {
        if (username === TEACHER_USERNAME) fail("Bu kullanıcı adı alınmış, başka bir tane deneyin.");
        const data = await run(sb.auth.signUp({ email: toEmail(username), password: pw }));
        if (!data.session) {
          if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) fail("Bu kullanıcı adı alınmış, başka bir tane deneyin.");
          fail("Kayıt oluşturuldu ancak giriş yapılamadı: Supabase'de \"Confirm email\" kapatılmalı.");
        }
        return touch(data.user);
      }),
      login: wrap(async (username, pw) => touch((await run(sb.auth.signInWithPassword({ email: toEmail(username), password: pw }))).user)),
      logout: async () => { current = null; await sb.auth.signOut(); },
      changePassword: wrap(async (cur, pw) => {
        const { error } = await sb.auth.signInWithPassword({ email: toEmail(current.username), password: cur });
        if (error) fail("Mevcut şifre hatalı.");
        await run(sb.auth.updateUser({ password: pw }));
      }),
      resetPassword: async () => fail("Öğrenci şifresi Supabase panelinden (Authentication → Users) sıfırlanır."),

      /* Profil ve kişisel veriler */
      getProfile: wrap(async (id) => { const r = await run(sb.from("profiles").select("profile").eq("id", id)); return (r[0] && r[0].profile) || {}; }),
      saveProfile: wrap((id, p) => run(sb.from("profiles").update({ profile: p }).eq("id", id))),
      getData: wrap(async (id) => { const r = await run(sb.from("user_data").select("data").eq("id", id)); return normData(r[0] && r[0].data); }),
      saveData: wrap((id, d) => run(sb.from("user_data").upsert({ id, data: d, updated_at: nowISO() }))),

      /* Öğrenciler ve rehber */
      listStudents: wrap(async () => { needTeacher(); return (await run(sb.from("profiles").select("*").eq("role", "student"))).map(mapStudent); }),
      getStudent: wrap(async (id) => { needTeacher(); const r = await run(sb.from("profiles").select("*").eq("id", id)); return r[0] ? mapStudent(r[0]) : null; }),
      deleteStudent: wrap(async (id) => {
        needTeacher();
        await Promise.all([
          run(sb.from("user_data").delete().eq("id", id)),
          run(sb.from("activity").delete().eq("user_id", id)),
          run(sb.from("submissions").delete().eq("user_id", id)),
        ]);
        await run(sb.from("grades").update({ user_id: null }).eq("user_id", id));
        await run(sb.from("profiles").delete().eq("id", id));
      }),
      directory: wrap(async () => (await run(sb.rpc("get_directory"))).map((x) => ({ uid: x.id, username: x.username, role: x.role, name: x.name || "" }))),

      /* Etkinlik geçmişi */
      logActivity: async (type, label, detail) => {
        if (!current || current.role !== "student") return;
        const { error } = await sb.from("activity").insert({ user_id: current.uid, username: current.username, type, label: String(label || ""), detail: String(detail || "") });
        if (error) console.warn("Etkinlik kaydedilemedi", error);
      },
      listActivity: wrap(async (id) => {
        needTeacher();
        let q = sb.from("activity").select("*").order("at", { ascending: false }).limit(2000);
        if (id) q = q.eq("user_id", id);
        return (await run(q)).map(mapAct);
      }),

      /* Oyun ve site bağlantıları */
      listResources: wrap(async () => (await run(sb.from("resources").select("*").order("created_at", { ascending: false }))).map(mapRes)),
      addResource: wrap((r) => run(sb.from("resources").insert({ title: r.title, url: r.url, kind: r.kind, description: r.desc || "", visible: r.visible !== false }))),
      deleteResource: wrap((id) => run(sb.from("resources").delete().eq("id", id))),

      /* Ödevler */
      listAssignments: wrap(async () => (await run(sb.from("assignments").select("*").order("created_at", { ascending: false }))).map(mapAsg)),
      addAssignment: wrap((a) => run(sb.from("assignments").insert({ title: a.title, body: a.body || "", due: a.due || null, link: a.link || "", assignees: a.assignees, all_students: !!a.allStudents }))),
      deleteAssignment: wrap((id) => run(sb.from("assignments").delete().eq("id", id))),

      /* Teslimler */
      listSubmissions: wrap(async () => (await run(sb.from("submissions").select("*"))).map(mapSub)),
      submit: wrap(async (assignmentId, { text, link }, existing) => {
        const id = assignmentId + "_" + current.uid;
        if (existing) await run(sb.from("submissions").update({ text, link, status: "teslim" }).eq("id", id));
        else await run(sb.from("submissions").insert({ id, assignment_id: assignmentId, user_id: current.uid, username: current.username, text, link, status: "teslim" }));
      }),
      grade: wrap((subId, { score, feedback, status }) => run(sb.from("submissions").update({ score, feedback, status, graded_at: nowISO() }).eq("id", subId))),

      /* Mesajlar */
      listMessages: wrap(async () => (await run(sb.from("messages").select("*").order("at", { ascending: true }).limit(5000))).map(mapMsg)),
      sendMessage: wrap((to, text) => run(sb.from("messages").insert({
        from_id: current.uid, to_id: to, participants: [current.uid, to].sort(), conv_id: convIdOf(current.uid, to), text,
      }))),
      deleteMessage: wrap((id) => run(sb.from("messages").delete().eq("id", id))),

      /* Duyurular */
      listAnnouncements: wrap(async () => (await run(sb.from("announcements").select("*").order("created_at", { ascending: false }))).map(mapAnn)),
      addAnnouncement: wrap((a) => run(sb.from("announcements").insert({ title: a.title, body: a.body || "", recipients: a.recipients && a.recipients.length ? a.recipients : null }))),
      deleteAnnouncement: wrap((id) => run(sb.from("announcements").delete().eq("id", id))),

      /* Notlar */
      listGrades: wrap(async () => (await run(sb.from("grades").select("*"))).map(mapGrade)),
      saveGrades: wrap(async (rows) => {
        needTeacher();
        const existing = (await run(sb.from("grades").select("school_no"))).map((x) => x.school_no);
        const keep = new Set(rows.map((r) => r.schoolNo));
        if (rows.length) {
          await run(sb.from("grades").upsert(rows.map((r) => ({
            school_no: r.schoolNo, first_name: r.firstName, last_name: r.lastName, scores: r.scores,
            average: r.average, status: r.status, updated_at: nowISO(),
          }))));
        }
        const gone = existing.filter((n) => !keep.has(n));
        for (const n of gone) await run(sb.from("grades").delete().eq("school_no", n));
      }),
      linkGrade: wrap((schoolNo, userId) => run(sb.from("grades").update({ user_id: userId || null }).eq("school_no", schoolNo))),

      /* Ayarlar */
      getSettings: wrap(async () => { const r = await run(sb.from("settings").select("*").eq("id", 1)); return { studentChat: !!(r[0] && r[0].student_chat) }; }),
      saveSettings: wrap((x) => run(sb.from("settings").upsert({ id: 1, student_chat: !!x.studentChat }))),
    };
  }

  window.OGH = {
    UserError, fail, uid, nowISO, normData, DEFAULT_TIMES, TEACHER_USERNAME, EMAIL_DOMAIN,
    useSupabase: !!(CFG.supabase && CFG.supabase.url && CFG.supabase.anonKey),
    createBackend() { return this.useSupabase ? SupabaseBackend() : Promise.resolve(LocalBackend()); },
  };
})();
