# 📘 Öğretmen Hesap

Öğretmenler ve öğrenciler için tarayıcıda çalışan, günlük kullanım paneli.

## Özellikler

| Ekran | Öğretmen | Öğrenci |
|---|---|---|
| İlk giriş / kayıt | Ad, okul, branş, sınıflar, iletişim | Ad, okul, sınıf/şube, numara, sınıf öğretmeni, veli iletişim |
| Bilgilerim kartı | ✔ (düzenlenebilir) | ✔ (düzenlenebilir) |
| Bugünkü dersler | Programdan otomatik, o anki ders vurgulu | Aynı |
| Haftalık ders programı | 5 gün × 8 ders, saatler düzenlenebilir | Aynı |
| Yapılacaklar / Ödevlerim | Son tarihli liste, geciken işler kırmızı | Aynı |
| Yaklaşan tarihler | Sınav, toplantı, etkinlik geri sayımı | Aynı |
| Notlarım | Otomatik kaydedilen not alanı | Aynı |
| Yedekle / Yükle | JSON dosyası | Aynı |

Aynı cihazda birden fazla öğretmen ve öğrenci hesabı açılabilir; her hesap PIN ile ayrılır.

## Veri ve gizlilik

- Sunucu **yoktur**. Tüm bilgiler yalnızca kullanılan cihazın tarayıcısında (`localStorage`) saklanır; başka cihazda görünmez.
- Tarayıcı verisi temizlenirse bilgiler silinir → düzenli olarak **Yedekle** kullanın.
- PIN, ortak cihazda hesapları ayırmak içindir; gerçek bir güvenlik katmanı değildir. Öğrencilerin T.C. kimlik no gibi hassas kişisel verileri girilmemelidir (KVKK).

## Yerelde çalıştırma

`index.html` dosyasını tarayıcıda açmanız yeterlidir. Ya da:

```bash
python3 -m http.server 8000
```

## GitHub Pages'te yayınlama

1. Bu dalı `main` dalına birleştirin.
2. GitHub'da **Settings → Pages → Build and deployment → Source: GitHub Actions** seçin.
3. `main`'e her gönderimde `.github/workflows/pages.yml` siteyi otomatik yayınlar.
   Adres: `https://aynurkesenek-lgtm.github.io/ogretmenhesap/`
