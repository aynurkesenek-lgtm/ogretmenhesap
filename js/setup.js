/* GEÇİCİ: Supabase kurulum SQL'ini gösteren ve kopyalayan pencere.
 * Bağlantı kurulduktan sonra bu dosya ve index.html'deki "GEÇİCİ" blok silinecek. */
(function () {
  "use strict";
  const btn = document.getElementById("btn-sql");
  const dlg = document.getElementById("sql-dialog");
  const pre = document.getElementById("sql-code");
  const msg = document.getElementById("sql-msg");
  if (!btn || !dlg) return;
  let sql = "";

  async function load() {
    if (sql) return;
    try {
      const res = await fetch("supabase/schema.sql", { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      sql = await res.text();
      pre.textContent = sql;
    } catch (e) {
      pre.textContent = "SQL dosyası yüklenemedi. Sayfayı bir web sunucusu üzerinden açın (GitHub Pages veya python3 -m http.server).\nDosya: supabase/schema.sql";
    }
  }

  btn.addEventListener("click", () => {
    load();
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
  });
  dlg.addEventListener("click", (ev) => {
    if (ev.target.hasAttribute("data-close")) dlg.close ? dlg.close() : dlg.removeAttribute("open");
  });
  document.getElementById("sql-copy").addEventListener("click", async () => {
    await load();
    if (!sql) return;
    try {
      await navigator.clipboard.writeText(sql);
      msg.textContent = "✓ Kopyalandı — Supabase SQL Editor'a yapıştırıp Run'a basın.";
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      msg.textContent = "Kod seçildi — Ctrl+C (Mac: Cmd+C) ile kopyalayın.";
    }
  });
})();
