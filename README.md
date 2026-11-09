# Öğretmen Hesap

Yönetici, öğretmen ve öğrenciler için çalışma paneli. Herkes kendi hesabıyla girer ve yalnızca kendi ekranını görür. Tüm veriler **Supabase** (PostgreSQL) veritabanında tutulur.

## Roller

| Rol | Kim? | Yetkiler |
|---|---|---|
| **Yönetici** | Tek kişi (ilk açılan hesap) | Öğretmen ekranlarının tamamı + kullanıcı açma, kapatma, şifre sıfırlama, silme |
| **Öğretmen** | Yöneticinin açtığı hesaplar | Kendi yıllık planları, modülleri, günlük aktiviteleri, notları, programı; sınıflara duyuru ve ödev |
| **Öğrenci** | Yöneticinin açtığı hesaplar | Kendi sınıfının duyuru ve ödevleri, ödev işaretleme, kişisel yapılacaklar |

## Öğretmen ekranları

- **Bugün:** o günün dersleri, aktiviteleri, yapılacakları, son notlar
- **Günlük Aktiviteler:** her gün için ders içi etkinlik planı ve "yapıldı" işareti
- **Yıllık Planlar:** ders ve sınıf düzeyine göre haftalık plan (Excel'den toplu yapıştırma)
- **Ders Modülleri:** ünite/konu içerikleri, ders akışı, kaynak bağlantıları
- **Ders Programı, Görevlerim, Notlarım** (etiketli), **Duyurular, Ödevler** (kimin tamamladığını izleme)

## Kurulum (Supabase)

1. Supabase projesinde **SQL Editor → New query** açın. Sitedeki **🛠️ SQL Kurulum** butonundan kodu kopyalayıp yapıştırın ve **Run** deyin. Kod `kurulum.sql` dosyasında da duruyor.
2. **Authentication → Users → Add user → Create new user** ile kendi e-posta ve şifrenizi girin, **Auto Confirm User** seçeneğini işaretleyin. İlk açılan bu hesap **yönetici** olur.
3. **Authentication → Sign In / Providers** bölümünde **Allow new users to sign up** seçeneğini kapatın. Böylece hesapları yalnızca yönetici açabilir.
4. **Project Settings → API (Data API)** sayfasındaki **Project URL** ve **anon / publishable** anahtarını `ayarlar.js` dosyasına yazın.
5. Kurulum bitince `ayarlar.js` dosyasında `SQL_BUTONU_GOSTER = false` yapın.

> ⚠️ `service_role` / `secret` anahtarını hiçbir dosyaya yazmayın. `anon` anahtarı herkese açık olabilir; verileri veritabanındaki satır düzeyi güvenlik (RLS) kuralları korur.

`ayarlar.js` boş kaldığı sürece site **demo modunda** çalışır: veriler yalnızca o tarayıcıda saklanır. Demo yönetici girişi: `yonetici` / `123456`.

## Güvenlik ve KVKK

- Öğretmen ve öğrenciler e-posta yerine **kullanıcı adıyla** girer; öğrenciden e-posta istenmez.
- Öğrenci için yalnızca **ad soyad** ve **sınıf** tutulur.
- Öğretmenin planları, notları ve aktiviteleri yalnızca kendisine (ve yöneticiye) açıktır.
- Öğrenciler yalnızca kendi sınıflarının duyuru ve ödevlerini, kendi teslim kayıtlarını görür.
- Kapatılan hesap hiçbir veriye erişemez.

## Dosyalar

| Dosya | Görev |
|---|---|
| `index.html` | Sayfa iskeleti |
| `style.css` | Görünüm (açık/koyu tema, mobil uyumlu) |
| `app.js` | Ekranlar ve işleyiş |
| `data.js` | Veri katmanı (Supabase ya da demo) |
| `ayarlar.js` | Supabase bağlantı bilgileri ve site ayarları |
| `kurulum.sql` | Veritabanı tabloları, güvenlik kuralları, yönetici fonksiyonları |
