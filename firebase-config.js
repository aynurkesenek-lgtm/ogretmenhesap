// ============================================================
//  AYARLAR — Firebase kurulumundan sonra burayı doldurun.
//  (README.md dosyasındaki "Buluta bağlama" adımlarına bakın.)
//
//  Bu bilgiler gizli değildir; güvenliği firestore.rules sağlar.
//  apiKey boş kaldığı sürece site DEMO MODUNDA çalışır:
//  veriler yalnızca o tarayıcıda saklanır.
// ============================================================

export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Öğretmen hesabının e-posta adresi (Firebase'de bu adresle hesap açın).
// Aynı adresi firestore.rules dosyasına da yazın.
export const OGRETMEN_EPOSTA = "ogretmen@ornek.com";

// Öğrenciler e-posta yerine kullanıcı adıyla girer.
// Arka planda "kullaniciadi@" + bu alan adı kullanılır (gerçek e-posta gerekmez).
export const OGRENCI_ALAN_ADI = "ogrenci.ogretmenhesap.app";

// Sayfa başlığında görünecek bilgiler
export const SITE = {
  baslik: "Öğretmen Hesap",
  okul: "Etlik Anadolu İmam Hatip Lisesi",
  ogretmenAdi: "Aynur Kesenek"
};
