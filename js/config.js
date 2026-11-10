/* ============================================================
 * SİTE AYARLARI
 * ------------------------------------------------------------
 * supabase: null bırakılırsa site "DEMO MODU"nda çalışır
 *   (hesaplar ve veriler yalnızca kullanılan cihazda saklanır).
 *
 * Supabase bağlanınca TÜM sistem (hesaplar, planlar, ödevler,
 * mesajlar, etkinlik geçmişi) tek veritabanında tutulur.
 * ============================================================ */
window.OGH_CONFIG = {
  // Tek yönetici (öğretmen) hesabının kullanıcı adı.
  // Değiştirirseniz supabase/schema.sql içindeki teacher_email() da değişmeli.
  teacherUsername: "rasyonelx",

  // Kullanıcı adları Supabase'e "kullaniciadi@emailDomain" olarak iletilir (e-posta gönderilmez).
  emailDomain: "ogretmenhesap.app",

  // Uygulamalarım → Oyunlar bölümünde gösterilen Google Drive oyun klasörü
  // (klasör "Bağlantıya sahip olan herkes görüntüleyebilir" olarak paylaşılmış olmalı).
  gamesDriveFolder: "https://drive.google.com/drive/folders/1drU1LxRUHlHhF0xlzBBskqiCqjbsrtPD?usp=sharing",

  // Supabase → Project Settings → API (Data API) bölümünden:
  //   url:     Project URL  (https://PROJE-ID.supabase.co)
  //   anonKey: "anon public" / "publishable" anahtar
  // ⚠️ "service_role" / "secret" anahtarını ASLA buraya yazmayın.
  // Örnek:
  // supabase: { url: "https://abcd1234.supabase.co", anonKey: "eyJhbGciOi..." },
  // Öğretmen Hesap Supabase projesi (ogretmenpanel). Publishable anahtar tarayıcıda kullanılmak üzere tasarlanmıştır;
  // veriler supabase/schema.sql içindeki RLS kurallarıyla korunur.
  supabase: {
    url: "https://pokvztbgcmlwytxunles.supabase.co",
    anonKey: "sb_publishable_dNNjfeF1ObADXxj24LQWag_eILuc5wQ",
  },
};
