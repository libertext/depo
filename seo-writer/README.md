# ✍️ SEO Article Writer — SaaS Sürümü

Yapay zeka ile **Google'da üst sıralara çıkacak, SEO uyumlu, çok dilli makaleler** üreten
web uygulaması. Beyaz-etiket (white-label) — kendi markanla ticarileştirmek için hazır.

Müşteriler kendi API anahtarını **girmez**; senin Anthropic hesabınla, kendilerine
verdiğin **erişim jetonu** üzerinden kullanırlar. Anahtar sunucuda gizli kalır.

---

## 🧩 Ne var?

| Özellik | Açıklama |
|---|---|
| **Tek tık makale** | Konu başlığı → tam makale (H1/H2/H3, listeler, sonuç + CTA) |
| **Çok dilli çıktı** | Türkçe, İngilizce, Almanca, Fransızca, İspanyolca, İtalyanca, Portekizce, Hollandaca, Rusça, Arapça |
| **Tam SEO paketi** | SEO başlık, meta açıklama, odak + LSI anahtar kelimeler, SEO & okunabilirlik skoru, ipuçları |
| **SSS bloğu** | "People Also Ask" hedefli soru-cevaplar |
| **Schema.org** | Article + FAQPage JSON-LD (kopyala/indir) |
| **Dışa aktarma** | Markdown, temiz HTML (meta + schema gömülü), tam `.html` dosyası, kopyala |
| **Toplu üretim** | Kategori seç → AI başlık önersin → işaretle → hepsi arşive üretilsin |
| **Arşiv** | localStorage'da saklanır; ara, aç, indir, JSON/CSV dışa aktar, içe aktar |
| **Erişim kontrolü** | Müşteri jetonları + istek başına hız sınırı |

---

## 🚀 Hızlı Başlangıç (Yerel)

Gereksinim: **Node.js 18+**

```bash
cd seo-writer
npm install
cp .env.example .env       # .env dosyasını aç, ANTHROPIC_API_KEY gir
npm start
```

Tarayıcıda `http://localhost:3000` aç. Geliştirmede `ACCESS_TOKENS` boş bırakılırsa
API açık olur (kimlik doğrulama istemez).

---

## 🌐 Yayına Alma (Deploy)

Bu bir Node sunucusu — statik hosting **yetmez**, çünkü API anahtarını gizleyen bir
backend gerekiyor. Önerilen ücretsiz/ucuz seçenekler:

### Render (en kolay — `render.yaml` hazır)
1. Bu repoyu GitHub'a gönder.
2. [render.com](https://render.com) → **New → Blueprint** → repoyu seç.
3. Dashboard'da **ANTHROPIC_API_KEY** ve **ACCESS_TOKENS** değerlerini gir (git'e yazılmaz).
4. Deploy. Sana `https://...onrender.com` adresi verir.

### Railway / Fly.io / VPS
- Başlatma komutu: `node server.js`
- Ortam değişkenleri: en azından `ANTHROPIC_API_KEY` (`.env.example`'a bak).
- `Procfile` da mevcut (`web: node server.js`).

### Vercel notu
Vercel statik + serverless odaklıdır; bu proje kalıcı Express sunucusu olduğundan
Render/Railway daha sorunsuzdur. Vercel isterseniz `server.js`'i bir serverless
fonksiyona sarmanız gerekir.

---

## 💰 Nasıl Ticarileştirilir?

Bu sürüm **abonelik (SaaS)** modeline göre kurulmuştur:

1. **Sunucuyu bir kez yayına al** (yukarıdaki adımlar). Anthropic maliyeti sana ait.
2. **Her müşteri için bir jeton üret:**
   ```bash
   node gen-token.js ali-veli
   # → ali-veli-9f2c1a8b3d4e
   ```
3. Jetonu **ACCESS_TOKENS** ortam değişkenine ekle (virgülle ayır) ve müşteriye ver.
4. Müşteri uygulamayı açar → **⚙️ Ayarlar** → jetonu yapıştırır → kullanır.
5. **Aboneliği bitince** jetonu listeden çıkar — erişimi anında kesilir.

**Fiyatlandırma fikri:** Anthropic maliyetin makale başına birkaç kuruştur; aylık
sabit ücret + adil kullanım (hız sınırı zaten `RATE_LIMIT_PER_MIN` ile korunur), ya da
paket bazlı (ör. "aylık 100 makale") satabilirsin.

**Beyaz-etiket / rebrand:**
- Marka adı & slogan: `app.js` içindeki `BRAND` nesnesi + `index.html` başlığı.
- Renkler: `styles.css` en üstteki `--accent` / `--accent-2` değişkenleri.
- Favicon/emoji: `index.html` `<link rel="icon">`.

> **Güvenlik notu:** Bu jeton sistemi hafif bir kapıdır (paylaşılan sır + hız sınırı).
> Gerçek ödeme/otomatik abonelik (Stripe vb.), kullanıcı başına kota veya kullanım
> takibi istiyorsan bir sonraki adım bir veritabanı + kimlik doğrulama katmanıdır —
> mevcut `/api` uçları bunun üzerine kolayca genişletilebilir.

---

## 🔌 API (kendi arayüzünü yazmak istersen)

Tüm uçlar `Content-Type: application/json` ve (jeton aktifse) `X-Access-Token` başlığı ister.

| Uç | Gövde | Döner |
|---|---|---|
| `GET /api/health` | — | `{ ok, keyConfigured, authRequired, defaultModel }` |
| `POST /api/generate` | `{ topic, language, category, tone, length, keyword?, audience?, competitor?, instructions?, model? }` | tam makale nesnesi |
| `POST /api/topics` | `{ category, language, niche?, model? }` | `{ topics: [...] }` |

`length`: `short` \| `medium` \| `long`.

---

## 📁 Dosyalar

```
seo-writer/
├── server.js        Güvenli Anthropic proxy + statik sunucu (prompt'lar burada)
├── index.html       Uygulama arayüzü
├── styles.css       Tema (açık/koyu, rebrand edilebilir)
├── app.js           Frontend mantığı (bağımlılık yok)
├── gen-token.js     Müşteri erişim jetonu üretici
├── package.json     Bağımlılık: express
├── .env.example     Ortam değişkeni şablonu
├── render.yaml      Render tek-tık deploy blueprint
└── Procfile         Genel süreç tanımı
```

## 🔒 Gizlilik

- Anthropic anahtarı **yalnızca sunucuda**; tarayıcıya hiç gitmez.
- Üretilen makaleler kullanıcının **kendi tarayıcısındaki** `localStorage`'da saklanır.
- Sunucu makaleleri **kaydetmez** — sadece istekleri Anthropic'e iletir.
