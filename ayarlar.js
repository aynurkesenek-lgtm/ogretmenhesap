// ============================================================
//  AYARLAR — Supabase bağlantı bilgileri
//  Supabase > Project Settings > API (Data API) sayfasından alınır.
//
//  SUPABASE_URL      : Project URL  ("https://pokvztbgcmlwytxunles.supabase.co")
//  SUPABASE_ANON_KEY :"sb_publishable_dNNjfeF1ObADXxj24LQWag_eILuc5wQ"
//
//  ⚠️ "service_role" / "secret" anahtarını ASLA buraya yazmayın.
//  Bu dosya herkese açıktır; güvenliği kurulum.sql içindeki kurallar sağlar.
//  Alanlar boş kaldığı sürece site DEMO MODUNDA çalışır.
// ============================================================

export const SUPABASE_URL = "https://pokvztbgcmlwytxunles.supabase.co";
export const SUPABASE_ANON_KEY = "sb_publishable_dNNjfeF1ObADXxj24LQWag_eILuc5wQ";

// Öğretmen ve öğrenciler kullanıcı adıyla girer; arka planda
// "kullaniciadi@" + bu alan adı kullanılır (kurulum.sql ile aynı olmalı).
export const KULLANICI_ALAN_ADI = "kullanici.ogretmenhesap.app";

// Kurulum bitince false yapın: sol menüdeki "SQL Kurulum" butonu kalkar.
export const SQL_BUTONU_GOSTER = true;

export const SITE = {
  baslik: "Öğretmen Hesap",
  okul: "Etlik Anadolu İmam Hatip Lisesi",
  yoneticiAdi: "Aynur Kesenek",
  egitimYili: "2026-2027"
};
