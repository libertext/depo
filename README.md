# Av. Yalın Anlatır · Script Studio

TikTok / Instagram Reels / YouTube Shorts için 20–30 saniyelik hukuki soru-cevap video metinleri hazırlama ve arşivleme uygulaması.

## Nasıl Kullanılır

1. `index.html`'e çift tıkla — uygulama tarayıcıda açılır.
2. **Yeni** sekmesinde Konu / İçerik / Reels açıklaması / Hashtag alanlarını doldur.
3. Sağ panelde tam format önizlemesini gör.
4. **📋 Kopyala** ile panoya al, içerik editörüne yapıştır.
5. **💾 Arşive Kaydet** ile kaydet — **Arşiv** sekmesinde tüm geçmiş duruyor.

## Özellikler

- **Sabit format şablonu:** Konu · İçerik · 🎬 Reels açıklaması · Hashtag'ler
- **Okuma süresi rozeti:** İçerik 20–30 sn hedefine göre `İdeal / Yakın / Kısa / Uzun` etiketi.
- **Emoji paleti:** Reels alanına tek tıkla emoji ekle (⚖️ 🚓 👮 📜 ...).
- **Hashtag çipleri:** Sık kullanılan hashtag'leri tek tıkla ekle.
- **Arşiv:** Kayıtlı tüm scriptler kart görünümünde; arama, kopyalama, düzenleme, silme.
- **Dışa/İçe Aktar:** JSON olarak yedek al, başka cihaza taşı.
- **Otomatik taslak:** Yazarken `localStorage`'a kaydedilir, sayfayı kapatsan bile kaldığın yerden devam.
- **Klavye kısayolları:** `Cmd/Ctrl+S` kaydet · `Cmd/Ctrl+Shift+C` kopyala.

## Dosyalar

- `index.html` — arayüz iskeleti
- `styles.css` — tema (koyu, hukuki/altın vurgulu)
- `app.js` — tüm mantık (dependency yok)
- `.claude/agents/yalin-anlatir.md` — Claude Code subagent tanımı (komut satırından da metin üretmek istersen)

## Veri Nerede?

Tüm kayıtlar senin tarayıcındaki `localStorage` alanında — sunucuya hiçbir şey gitmez. Düzenli yedek için arşivden **⤓ Dışa Aktar**'ı kullan.
