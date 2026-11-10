# 📘 Öğretmen Hesap

Öğretmen ve öğrenci paneli: ödev gönderme, teslim alma, puanlama, mesajlaşma, öğrenci takibi, planlar ve günlük kullanım araçları. Derleme gerektirmez; GitHub Pages'te çalışır, veriler **Supabase** veritabanında tutulur.

## Roller ve özellikler

| Özellik | Öğretmen (tek yönetici: `rasyonelx`) | Öğrenci |
|---|---|---|
| Giriş / kayıt | Hazır hesap | Kullanıcı adı + şifre ile kendisi kayıt olur |
| Panel | Özet sayılar, **duyuru yayınlama** (tüm ya da seçili öğrencilere), ders programı, yapılacaklar, notlar, yaklaşan tarihler | **Duyurular** (yeni olanlar işaretli), aynı araçlar + bekleyen ödev / puan özeti |
| Planlarım | Yıllık plan (**Excel/Word'den toplu yapıştırma**, CSV indirme), ders modülleri, günlük aktiviteler | — |
| Öğrenciler | Tüm öğrenciler, profil, teslim ve puan özeti, **etkinlik geçmişi** | — |
| Ödevler | Tüm ya da seçili öğrencilere gönderme, kopyalayarak haftalık tekrar, puanlama, **düzeltme için geri gönderme** | Ödevi görme, cevap ve bağlantı gönderme, geri bildirimi görme |
| Notlar | Google Tablosundaki not çizelgesini bağlantıyla veya yapıştırarak aktarma, satırları öğrenci hesaplarına bağlama (okul numarası eşleşirse otomatik), sınıf ortalaması | **Notlarım**: yalnızca kendi yazılı/performans notları, ortalama ve durum |
| Mesajlar | Öğrencilerle yazışma, **öğrenciler arası tüm yazışmaları görme**, mesaj silme, öğrenciler arası mesajlaşmayı açma/kapama | Öğretmenle ve izin varsa diğer öğrencilerle yazışma |
| Uygulamalarım | Online uygulama, Drive, oyun ve site ekleme; "öğrenciler görebilsin / yalnızca ben" seçimi | Online uygulamaları tek tıkla açma, Drive uygulamaları için "Drive'da aç" bağlantısı (açılanlar geçmişe kaydedilir), yerleşik "Hızlı Matematik" oyunu |

**Etkinlik geçmişi** (yalnızca öğretmen görür): girişler, açılan sayfalar, panel üzerinden açılan oyun ve siteler, oyun skorları, ödev teslimleri. Tarayıcı güvenliği gereği sistem dışında ziyaret edilen siteler izlenemez. Öğrencilere, etkinliklerinin ve mesajlarının öğretmen tarafından görülebildiği panelde açıkça bildirilir.

## Supabase kurulumu

1. Supabase **SQL Editor → New query** → `supabase/schema.sql` dosyasının tamamını yapıştırın → **Run** (tekrar çalıştırılabilir).
2. **Authentication → Sign In / Providers → Email**: "Confirm email" seçeneğini **kapatın** (kullanıcı adları gerçek e-posta değildir).
3. **Authentication → Users → Add user**: `rasyonelx@ogretmenhesap.app` + öğretmen şifresi, "Auto Confirm User" işaretli. Bunu öğrenciler kayıt olmadan **önce** yapın.
4. **Project Settings → API**: *Project URL* ve *anon / publishable* anahtarı `js/config.js` içine yazın:
   ```js
   supabase: { url: "https://PROJE-ID.supabase.co", anonKey: "..." },
   ```
   Bu anahtar tarayıcıda kullanılmak üzere tasarlanmıştır; veriler satır düzeyi güvenlik (RLS) kurallarıyla korunur. **`service_role` / `secret` anahtarını asla koda yazmayın veya paylaşmayın.**
5. Authentication ayarlarında **Allow new users to sign up** açık olmalıdır.

Site şu an **ogretmenpanel** Supabase projesine bağlıdır. `supabase` ayarı boş bırakılırsa site **demo modunda** çalışır (veriler yalnızca o cihazdaki tarayıcıda).

### Mevcut projeyi güncelleme

Kurulumu daha önce yapılmış projelerde `supabase/guncelleme_01_duyurular_temizlik.sql` dosyasını SQL Editor'da bir kez çalıştırın. Duyurular tablosunu ekler ve aynı projeye önceden kurulmuş ikinci sürümün (`kurulum.sql`) kalıntılarını kaldırır. O tablolarda veri varsa hiçbir şey silmeden durur.

## Güvenlik notları

- İlk girişten sonra öğretmen şifresini **Bilgilerim → Şifre değiştir** bölümünden güçlü bir şifreyle değiştirin.
- RLS kuralları: öğrenci yalnızca kendi verisini, kendisine atanan ödevleri ve taraf olduğu mesajları görür; puan veremez; etkinlik geçmişini okuyamaz. Öğretmen hepsini görür.
- Öğrencilerden T.C. kimlik no gibi hassas kişisel veri istemeyin (KVKK).
- Not tablosu bağlantısı koda yazılmaz; yalnızca öğretmenin veritabanındaki özel verisinde saklanır. "Bağlantıya sahip olan herkes" paylaşımı, bağlantıyı bilen herkesin notları görmesine izin verir; paylaşımı kısıtlayıp **yapıştırarak içe aktar** yöntemini kullanmak daha güvenlidir.

## Dosyalar

| Dosya | İçerik |
|---|---|
| `index.html`, `css/style.css` | Sayfa iskeleti ve görünüm |
| `js/config.js` | Supabase bağlantısı ve öğretmen kullanıcı adı |
| `js/backend.js` | Veri altyapısı (Supabase + demo modu) |
| `js/app.js` | Ekranlar ve yönlendirme |
| `supabase/schema.sql` | Tablolar, fonksiyonlar ve RLS kuralları |

## Yerelde çalıştırma ve yayınlama

```bash
python3 -m http.server 8000
```

GitHub Pages: dalı `main`'e birleştirin, **Settings → Pages → Source: GitHub Actions** seçin. Adres: `https://aynurkesenek-lgtm.github.io/ogretmenhesap/`
