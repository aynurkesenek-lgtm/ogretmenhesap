# 📘 Öğretmen Hesap

Öğretmen ve öğrenci paneli: ödev gönderme, teslim alma, puanlama, mesajlaşma, öğrenci takibi, planlar ve günlük kullanım araçları. Derleme gerektirmez; GitHub Pages'te çalışır, veriler **Supabase** veritabanında tutulur.

## Roller ve özellikler

| Özellik | Öğretmen (tek yönetici: `rasyonelx`) | Öğrenci |
|---|---|---|
| Giriş / kayıt | Hazır hesap | Kullanıcı adı + şifre ile kendisi kayıt olur |
| Panel | Özet sayılar, ders programı, yapılacaklar, notlar, yaklaşan tarihler | Aynı araçlar + bekleyen ödev / puan özeti |
| Planlarım | Yıllık plan (CSV indirme), ders modülleri, günlük aktiviteler | — |
| Öğrenciler | Tüm öğrenciler, profil, teslim ve puan özeti, **etkinlik geçmişi** | — |
| Ödevler | Tüm ya da seçili öğrencilere gönderme, kopyalayarak haftalık tekrar, puanlama, **düzeltme için geri gönderme** | Ödevi görme, cevap ve bağlantı gönderme, geri bildirimi görme |
| Mesajlar | Öğrencilerle yazışma, **öğrenciler arası tüm yazışmaları görme**, mesaj silme, öğrenciler arası mesajlaşmayı açma/kapama | Öğretmenle ve izin varsa diğer öğrencilerle yazışma |
| Oyun & Siteler | Bağlantı ekleme/silme | Panel üzerinden açma (geçmişe kaydedilir), yerleşik "Hızlı Matematik" oyunu |

**Etkinlik geçmişi** (yalnızca öğretmen görür): girişler, açılan sayfalar, panel üzerinden açılan oyun ve siteler, oyun skorları, ödev teslimleri. Tarayıcı güvenliği gereği sistem dışında ziyaret edilen siteler izlenemez. Öğrencilere, etkinliklerinin ve mesajlarının öğretmen tarafından görülebildiği panelde açıkça bildirilir.

## Supabase kurulumu

1. Sitede soldaki **🗄️ SQL** butonuna tıklayın → **Kopyala** → Supabase **SQL Editor → New query** → yapıştırın → **Run**. (Dosya: `supabase/schema.sql`; tekrar çalıştırılabilir.)
2. **Authentication → Sign In / Providers → Email**: "Confirm email" seçeneğini **kapatın** (kullanıcı adları gerçek e-posta değildir).
3. **Authentication → Users → Add user**: `rasyonelx@ogretmenhesap.app` + öğretmen şifresi, "Auto Confirm User" işaretli. Bunu öğrenciler kayıt olmadan **önce** yapın.
4. **Project Settings → API**: *Project URL* ve *anon / publishable* anahtarı `js/config.js` içine yazın:
   ```js
   supabase: { url: "https://PROJE-ID.supabase.co", anonKey: "..." },
   ```
   Bu anahtar tarayıcıda kullanılmak üzere tasarlanmıştır; veriler satır düzeyi güvenlik (RLS) kurallarıyla korunur. **`service_role` / `secret` anahtarını asla koda yazmayın veya paylaşmayın.**
5. Bağlantı kurulunca `index.html` içindeki "GEÇİCİ" blok ve `js/setup.js` kaldırılacaktır.

`supabase` ayarı boşken site **demo modunda** çalışır (veriler yalnızca o cihazdaki tarayıcıda).

## Güvenlik notları

- İlk girişten sonra öğretmen şifresini **Bilgilerim → Şifre değiştir** bölümünden güçlü bir şifreyle değiştirin.
- RLS kuralları: öğrenci yalnızca kendi verisini, kendisine atanan ödevleri ve taraf olduğu mesajları görür; puan veremez; etkinlik geçmişini okuyamaz. Öğretmen hepsini görür.
- Öğrencilerden T.C. kimlik no gibi hassas kişisel veri istemeyin (KVKK).

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html`, `css/style.css` | Sayfa iskeleti ve görünüm |
| `js/config.js` | Supabase bağlantısı ve öğretmen kullanıcı adı |
| `js/backend.js` | Veri altyapısı (Supabase + demo modu) |
| `js/app.js` | Ekranlar ve yönlendirme |
| `supabase/schema.sql` | Tablolar, fonksiyonlar ve RLS kuralları |
| `js/setup.js` | Geçici SQL penceresi |

## Yerelde çalıştırma ve yayınlama

```bash
python3 -m http.server 8000
```

GitHub Pages: dalı `main`'e birleştirin, **Settings → Pages → Source: GitHub Actions** seçin. Adres: `https://aynurkesenek-lgtm.github.io/ogretmenhesap/`
