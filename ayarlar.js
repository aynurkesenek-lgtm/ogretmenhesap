// ============================================================
//  AYARLAR — Supabase bağlantı bilgileri
//  Supabase > Project Settings > API (Data API) sayfasından alınır.
//
//  SUPABASE_URL      : Project URL
//  SUPABASE_ANON_KEY : "publishable" (anon) anahtar
//
//  ⚠️ "service_role" / "secret" anahtarını ASLA buraya yazmayın.
//  Bu dosya herkese açıktır; güvenliği kurulum.sql içindeki kurallar sağlar.
//  Alanlar boş kalırsa site DEMO MODUNDA çalışır.
// ============================================================

export const SUPABASE_URL = "https://pokvztbgcmlwytxunles.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_dNNjfeF1ObADXxj24LQWag_eILuc5wQ";

// Öğretmen ve öğrenciler kullanıcı adıyla girer; arka planda
// "kullaniciadi@" + bu alan adı kullanılır (kurulum.sql ile aynı olmalı).
export const KULLANICI_ALAN_ADI = "kullanici.ogretmenhesap.app";

// SQL kurulum butonu (kurulum tamamlandı, kapalı). Tekrar gerekirse true yapın.
export const SQL_BUTONU_GOSTER = false;

export const SITE = {
  baslik: "Öğretmen Hesap",
  okul: "Etlik Anadolu İmam Hatip Lisesi",
  yoneticiAdi: "Aynur Kesenek",
  egitimYili: "2026-2027"
};
