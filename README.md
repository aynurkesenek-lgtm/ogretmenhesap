# Öğretmen Hesap

Öğretmen ve öğrenciler için kişisel çalışma paneli. Herkes kendi hesabıyla girer ve yalnızca kendi ekranını görür.

| Öğretmen paneli | Öğrenci paneli |
|---|---|
| Bugün: o günün dersleri, yapılacaklar, son notlar | Bugün: bekleyen ödevler, son duyurular |
| Görevlerim (tarihli yapılacaklar) | Ödevlerim (tamamladım işareti) |
| Haftalık ders programı | Yapılacaklarım (kişisel liste) |
| Notlarım (yalnızca öğretmen görür) | Duyurular (kendi sınıfına ait) |
| Duyurular (sınıfa ya da herkese) | Hesabım (şifre değiştirme) |
| Ödevler + kimin tamamladığını izleme | |
| Öğrenci hesabı açma ve kapatma | |

## Çalışma modları

- **Demo modu** (varsayılan): `firebase-config.js` içindeki `apiKey` boş olduğu sürece veriler yalnızca o tarayıcıda saklanır. Sayfayı denemek için kullanılır.
  Öğretmen girişi: `ogretmen@ornek.com` / `123456`
- **Bulut modu**: Firebase ayarları girildiğinde tüm veriler Google Firebase'de (Firestore) saklanır. Hangi cihazdan girilirse girilsin aynı veriler görünür.

## Buluta bağlama (bir kez, yaklaşık 15 dakika)

1. <https://console.firebase.google.com> adresinde Google hesabınızla **Proje ekle** deyin (örn. `ogretmenhesap`). Google Analytics gerekmez.
2. **Build → Authentication → Başlayın → E-posta/Şifre**'yi etkinleştirin.
3. **Authentication → Users → Kullanıcı ekle**: Öğretmen e-postanızı ve güçlü bir şifre girin.
4. **Build → Firestore Database → Veritabanı oluştur**. Konum olarak `eur3 (Europe)` seçin, **üretim modunda** başlatın.
5. **Firestore → Kurallar** sekmesine `firestore.rules` dosyasının içeriğini yapıştırın. İçindeki `ogretmen@ornek.com` adresini kendi e-postanızla değiştirip **Yayınla**'ya basın.
6. **Proje ayarları (⚙️) → Genel → Uygulamalarınız → Web (</>)** ile bir web uygulaması ekleyin. Çıkan `firebaseConfig` değerlerini `firebase-config.js` dosyasına yapıştırın. Aynı dosyadaki `OGRETMEN_EPOSTA` alanını da güncelleyin.
7. **Authentication → Ayarlar → Yetkili alan adları** listesine `aynurkesenek-lgtm.github.io` adresini ekleyin.

Bundan sonra sayfayı yenilediğinizde üstteki "Demo modu" şeridi kaybolur ve site bulut modunda çalışır.

## Öğrenci hesapları

- Hesapları öğretmen, **Öğrenciler** sayfasından açar. Öğrenciden e-posta istenmez; kullanıcı adı ve şifre verilir.
- Kişisel veri olarak yalnızca **ad soyad** ve **sınıf** tutulur (KVKK gereği veri en aza indirilir).
- Ayrılan öğrencinin hesabı **Kapat** düğmesiyle pasif hâle getirilir. Pasif hesap hiçbir veriye erişemez.
- Bir öğrenci şifresini unutursa: Firebase Console → Authentication → Users bölümünden hesabı silip aynı kullanıcı adıyla yeniden açabilirsiniz.

## Güvenlik notları

- `firebase-config.js` içindeki bilgiler gizli değildir; erişimi `firestore.rules` kuralları sınırlar.
- Öğretmen alanına (notlar, görevler, program) yalnızca öğretmen hesabı erişebilir.
- Öğrenciler yalnızca kendi kaydını, kendi listesini, duyuruları ve ödevleri görebilir.
- Sayfaya öğrenci notu, fotoğrafı ya da hassas bilgi koymayın.

## Dosyalar

| Dosya | Görev |
|---|---|
| `index.html` | Sayfa iskeleti |
| `style.css` | Görünüm (açık/koyu tema, mobil uyumlu) |
| `app.js` | Ekranlar ve işleyiş |
| `data.js` | Veri katmanı (Firebase ya da demo) |
| `firebase-config.js` | Ayarlar (Firebase bilgileri, öğretmen e-postası, okul adı) |
| `firestore.rules` | Bulut veritabanı güvenlik kuralları |
