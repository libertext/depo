# SEO Analizi — burakhancaliskan.av.tr

**Tarih:** 2026-05-01
**Kapsam:** Teknik SEO odaklı, ana sayfa (`/`) HTML kaynağı + iç link grafından çıkarımlanan iç sayfa envanteri.
**Kaynak:** Kullanıcı tarafından sağlanan ana sayfa view-source HTML'i (~230 KB). Sandbox kısıtı nedeniyle robots.txt, sitemap.xml ve gerçek HTTP başlık zinciri canlı doğrulanmadı; bu maddeler "doğrulanmalı" notu ile işaretlendi.
**Stack:** WordPress + Yoast SEO 22.7 + Rota theme (Safirthemes) + Slider Revolution 6.7.41 + Jetpack Boost critical CSS + Owl Carousel + Fancybox + jQuery 3.7.1 + jQuery Migrate 3.4.1 + WP Statistics + Jetpack Stats.

---

## 1. Yönetici Özeti

### Genel Değerlendirme
Site Yoast'in temel teknik SEO öğelerini (title, meta description, canonical, robots, OG, Türkçe `inLanguage`) doğru kuruyor. Ancak bir avukatlık ofisi sitesi için **kritik üç eksik** öne çıkıyor: (1) yapılandırılmış veri yetersiz — `Attorney/LegalService/LocalBusiness` şemaları yok, (2) içerik hiyerarşisi tek seviyeye çökmüş — sayfada yalnızca **1 H1, 0 H2/H3** var, (3) sosyal/SERP önizleme görseli yok — `og:image` ve `twitter:image` tanımlanmamış. Buna ek olarak URL slug yapısında `-2` son ekli **5 sayfalık paralel envanter** (eski/yeni slug'ların aynı anda yayında olması) güçlü bir keyword cannibalization sinyali veriyor.

### Öncelikli Düzeltmeler (Top 5)
1. **URL kannibalizasyonu** — `/istanbul-uyusturucu-avukati-2/` ↔ `/istanbul-uyusturucu-avukati/`, `/cinsel-suclar-avukati/` ↔ `/istanbul-cinsel-suc-avukati/`, `/dolandiricilik-avukati-2/` ↔ `/istanbul-dolandiricilik-avukati/`, `/ncmec-nedir/` ↔ `/ncmec-nedir-ne-ise-yarar-turkiyede-rolu-nedir/`. Hangi sayfanın "ana" olduğuna karar verilmeli; diğeri 301 redirect ile birleştirilmeli.
2. **`Attorney`/`LegalService`/`LocalBusiness` schema** eklenmesi (adres, telefon, açılış saatleri, areaServed, sameAs, image, priceRange).
3. **`og:image` + `twitter:image`** + tüm makalelerin gerçek `featured image`'ları (şu an 36/38 görsel `noimage.png` placeholder).
4. **H1/H2/H3 hiyerarşisi** — tema şablonunda widget başlıklarının `div.widgetHeading > .text` yerine `<h2>` ile sarılması.
5. **HTTP/HTTPS protokol birleşimi** — favicon, logo ve menü `Anasayfa` linki `http://` ile referanslanıyor; HSTS başlığı ve site genelinde `https://www.` 301 zinciri doğrulanmalı.

### Hızlı Kazanımlar (Top 5)
1. `meta name="generator"` üzerinden Slider Revolution sürüm sızıntısını kapatma (`remove_action('wp_head', ...)` veya plugin'in built-in seçeneği).
2. Görsel dosya isimlerinde Türkçe karakter ve `®` karakteri var (`Mor-Minimalist-Gu®zellik-Logosu-3-2.png`, `Av.BurakhanÇalişkan-1.png`) → ASCII slug'a normalize edilmeli; bazı CDN/cache katmanlarında 404 veya yanlış MIME üretebilir.
3. `BreadcrumbList` JSON-LD yalnızca 1 öğe ("Anasayfa") içeriyor — Yoast'in breadcrumb ayarı tüm sayfalarda zenginleştirilmeli.
4. Favicon dosya adı **"Mor-Minimalist-Güzellik-Logosu"** — bir önceki güzellik/kozmetik şablonundan kalmış; baroya hitap eden bir hukuk logo asetiyle yeniden adlandırılmalı (kalıntı dosya adları içerikten brand mismatch sinyali verir).
5. Twitter card için `twitter:title`, `twitter:description`, `twitter:image`, `twitter:site` — Yoast → Sosyal sekmesinden tek tıkla doldurulabilir.

---

## 2. Metodoloji ve Kapsam Kısıtları

| Alan | Erişim | Yöntem |
|---|---|---|
| Ana sayfa HTML | ✅ | Kullanıcı tarafından yapıştırılan `view-source` |
| robots.txt | ❌ | Sandbox `host_not_allowed` döndü — kullanıcı tarafında doğrulama gerekli |
| sitemap.xml / sitemap_index.xml | ❌ | Aynı kısıt |
| HTTP başlıkları (status, redirect chain, HSTS, cache) | ❌ | Aynı kısıt |
| Lighthouse / PageSpeed Insights | ❌ | İstemci dışı erişim — kullanıcı tarafında çalıştırılmalı |
| Search Console / GA / GSC index coverage | ❌ | Hesap erişimi gerekli |
| İç sayfaların HTML'i | 🟡 | Yalnızca link envanteri çıkarıldı; sayfa-bazlı SEO çıkarımsal |

Raporda "🔍 doğrulanmalı" etiketi taşıyan maddeler kullanıcının canlı sitede komut çalıştırmasıyla netleşir; bunun için bölüm 12'de hazır komut bloğu var.

---

## 3. Crawlability ve Indexlenebilirlik

### 3.1 Robots Direktifleri
```html
<meta name='robots' content='index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' />
```
- ✅ `index, follow` doğru.
- ✅ `max-image-preview:large` Discover/SERP zengin görsel için iyi.
- ✅ `max-snippet:-1` ve `max-video-preview:-1` sınırsız önizleme verir.
- 🔍 **Doğrulanmalı:** `https://www.burakhancaliskan.av.tr/robots.txt` ve `/sitemap_index.xml` Yoast'in standart çıktıları olarak yayında olmalı. Yoast 22.7 sitemap'i otomatik üretir; Search Console'a manuel gönderim önerilir.

### 3.2 Canonical & Pagination
```html
<link rel="canonical" href="https://www.burakhancaliskan.av.tr/" />
<link rel="next" href="https://www.burakhancaliskan.av.tr/page/2/" />
```
- ✅ Canonical https + www tek versiyonu işaret ediyor.
- ✅ Anasayfa için `rel=next` doğru, `rel=prev` yokluğu beklenen.
- ⚠️ **Site `http://burakhancaliskan.av.tr/` (non-www, http) üzerinden de açılıyor**; canonical tek versiyon işaret ettiği için Google bunu çoğunlukla tolere eder, ancak 301 zinciri eksikse host duplikasyonu ve "Duplicate, Google chose different canonical" sinyali oluşur. Beklenen zincir:
  - `http://burakhancaliskan.av.tr/` → `https://burakhancaliskan.av.tr/` (HSTS preload öncesi 301)
  - `https://burakhancaliskan.av.tr/` → `https://www.burakhancaliskan.av.tr/` (301)
  - Tek hop kalması için NGINX/Apache seviyesinde tek adımda hedef host'a 301 yazılması.

### 3.3 URL Yapısı / Slug Hijyeni — KRİTİK
İç link grafından çıkarılan envantere göre şu **paralel slug çiftleri** mevcut:

| Birincil görünen | İkincil (`-2` ekli ya da paralel) | Risk |
|---|---|---|
| `/istanbul-uyusturucu-avukati/` | `/istanbul-uyusturucu-avukati-2/` (menüde) | Kannibalizasyon |
| `/ceza-avukati-2/` (menüde) | (`/ceza-avukati/` muhtemelen var, doğrulanmalı) | Eski/yeni çakışması |
| `/hakkimizda-2/` (menüde) | (`/hakkimizda/` doğrulanmalı) | Aynı |
| `/dolandiricilik-avukati-2/` | `/istanbul-dolandiricilik-avukati/` | Kannibalizasyon |
| `/istanbul-bosanma-avukati-2/` | (`/istanbul-bosanma-avukati/` doğrulanmalı) | Eski/yeni |
| `/cinsel-suclar-avukati/` | `/istanbul-cinsel-suc-avukati/` | Kannibalizasyon |
| `/ncmec-nedir/` | `/ncmec-nedir-ne-ise-yarar-turkiyede-rolu-nedir/` | Kannibalizasyon |

**`-2` son eki** WordPress'in mevcut bir slug ile çakıştığında otomatik atadığı son ektir. Bu, temizlenmemiş eski içeriğin yayında olduğunu güçlü biçimde gösterir.

**Aksiyon:**
1. Search Console > Performance'da her bir slug çiftinin tıklama/impression payı kıyaslanır.
2. Daha iyi performans gösteren **ana** seçilir; diğeri `wp_redirect( ..., 301 )` ile yönlendirilir.
3. Tüm iç linkler kanonik slug'a güncellenir (özellikle ana menü `/ceza-avukati-2/` ve `/hakkimizda-2/` slug'larını taşıyor; bu da Yoast'in "iç linklerden gelen sinyalleri zayıf URL'ye dağıtması" anlamına gelir).
4. 301'lerden sonra Yoast Redirection ya da plugin (`Redirection`, `301 Redirects`) ile log tutulur.

### 3.4 hreflang
Hiç hreflang etiketi yok. Site yalnızca Türkçe yayın yaptığı için **doğru durum**; ileride EN sürüm açılırsa `<link rel="alternate" hreflang="tr" />` ve `<link rel="alternate" hreflang="x-default" />` çiftinin eklenmesi gerekir.

---

## 4. Title, Meta Description, OG, Twitter

### 4.1 Title
```
İstanbul Ceza Avukatı - Av. Burakhan Çalışkan
```
- 45 karakter (660px civarı, SERP'de tam görünür) ✅
- "İstanbul ceza avukatı" birincil hedef anahtar kelime, başta ✅
- Brand sonda ✅
- ⚠️ Ayraç olarak `-` yerine `|` veya `·` daha okunaklı olabilir; SEO etkisi yok.

### 4.2 Meta description
```
İstanbul ceza avukatı Av. Burakhan Çalışkan; İstanbul uyuşturucu avukatı ve İstanbul cinsel suçlar avukatı olarak hassas dosyalarda profesyonel savunma desteği sunar.
```
- 158 karakter ✅ (Google'ın ~160 char kesiminde)
- Üç hedef kelime ("ceza avukatı", "uyuşturucu avukatı", "cinsel suçlar avukatı") tek cümlede ✅
- ⚠️ "Profesyonel savunma desteği" gibi nitelendirici ifadeler **TBB Reklam Yasağı Yönetmeliği** kapsamında ihtiyatla değerlendirilmeli — bkz. Bölüm 11.
- ⚠️ CTA yok; "Ücretsiz ön görüşme" ya da "Randevu için arayın" eklenebilir ama yine Reklam Yasağı'na takılır. Yerine somut bilgi ("15 yıllık ceza hukuku tecrübesi") önerilir.

### 4.3 Open Graph
| Etiket | Değer | Durum |
|---|---|---|
| `og:locale` | `tr_TR` | ✅ |
| `og:type` | `website` | ✅ |
| `og:title` | `Av. Burakhan Çalışkan` | ⚠️ `<title>` ile uyumsuz, "İstanbul Ceza Avukatı" anahtar kelimesi kayboldu |
| `og:description` | (title ile aynı) | ✅ |
| `og:url` | `https://www.burakhancaliskan.av.tr/` | ✅ |
| `og:site_name` | `Av. Burakhan Çalışkan` | ✅ |
| `og:image` | **YOK** | ❌ kritik |
| `og:image:width/height/alt` | **YOK** | ❌ |

**Etki:** WhatsApp/Telegram/LinkedIn/Facebook paylaşımlarında **boş kart** çıkar, site brand-less görünür. 1200×630 boyutunda, üzerinde "Av. Burakhan Çalışkan — İstanbul Ceza Avukatı" yazılı bir görsel yüklenip Yoast → Sosyal sekmesinden default OG image olarak işaretlenmeli. Ayrıca her makaleye featured image atanmalı (zaten 36/38 görselin `noimage.png` olması bu işin baştan beri ihmal edildiğini gösteriyor).

### 4.4 Twitter Card
```
twitter:card = summary_large_image
```
- `twitter:title`, `twitter:description`, `twitter:image`, `twitter:site`, `twitter:creator` **yok**.
- `summary_large_image` modu için `twitter:image` zorunluluğu var; sağlanmadığında Twitter (X) `og:image` fallback'ine düşer — o da yok. Kart zenginleşmez.

---

## 5. Yapılandırılmış Veri (JSON-LD) — KRİTİK

Mevcut graph (`@graph` içinde 3 düğüm):

| @type | Değerlendirme |
|---|---|
| `CollectionPage` | ✅ Anasayfa için Yoast'in default'u |
| `WebSite` (with `SearchAction`) | ✅ Sitelinks Search Box uygun |
| `BreadcrumbList` | ⚠️ tek `ListItem` ("Anasayfa") — anasayfa için doğru ama iç sayfalarda zenginleşmesi gerekir |

**Kritik Eksikler:**
- `Attorney` veya `LegalService` (Schema.org `Attorney` türü `LocalBusiness`'in alt tipidir).
- `Person` (Av. Burakhan Çalışkan için — yazar otoritesi / E-E-A-T).
- `Organization` / `LocalBusiness` (Çalışkan Hukuk Bürosu — sayfada açıkça ifade ediliyor).
- `Place` / `PostalAddress` (Cevizli mh., Ulubey Sk., No:4A D:46, 34865 Kartal/İstanbul).
- `ContactPoint` (telefon: +90 506 976 23 55).
- `OpeningHoursSpecification`.
- `FAQPage` (makale içerikleri "X nedir? cezası ne kadar?" Q&A formatında — FAQ schema ile rich result çıkarılabilir).
- `Article` / `BlogPosting` (her köşe yazısı/makale için — şu an muhtemelen Yoast otomatik ekliyor, makale sayfaları teyit edilmeli).
- `BreadcrumbList` zenginleştirme (Anasayfa → Kategori → Yazı).

**Önerilen ek JSON-LD (ana sayfaya gömmek üzere — Yoast ücretsiz sürümünde ek snippet için "Insert Headers and Footers" plugin'i veya `functions.php` üzerinden):**

```json
{
  "@context": "https://schema.org",
  "@type": "Attorney",
  "@id": "https://www.burakhancaliskan.av.tr/#attorney",
  "name": "Av. Burakhan Çalışkan",
  "alternateName": "Çalışkan Hukuk Bürosu",
  "url": "https://www.burakhancaliskan.av.tr/",
  "image": "https://www.burakhancaliskan.av.tr/wp-content/uploads/2022/09/Av.BurakhanCaliskan-1.png",
  "telephone": "+90-506-976-23-55",
  "email": "av.burakhancaliskan@gmail.com",
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Cevizli Mah. Ulubey Sok. No:4A D:46 Nursanlar Kartal 1",
    "addressLocality": "Kartal",
    "addressRegion": "İstanbul",
    "postalCode": "34865",
    "addressCountry": "TR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": "40.9012",
    "longitude": "29.2106"
  },
  "areaServed": [
    {"@type":"AdministrativeArea","name":"İstanbul"},
    {"@type":"City","name":"Kartal"},
    {"@type":"City","name":"Pendik"},
    {"@type":"City","name":"Maltepe"},
    {"@type":"City","name":"Sultanbeyli"},
    {"@type":"City","name":"Sancaktepe"}
  ],
  "openingHoursSpecification": [{
    "@type":"OpeningHoursSpecification",
    "dayOfWeek":["Monday","Tuesday","Wednesday","Thursday","Friday"],
    "opens":"09:00","closes":"18:00"
  }],
  "knowsAbout": [
    "Ceza Hukuku","Cinsel Suçlar","Uyuşturucu Suçları",
    "MASAK","Dolandırıcılık","NCMEC raporları"
  ],
  "sameAs": [
    "https://www.linkedin.com/in/...",
    "https://www.instagram.com/...",
    "https://x.com/..."
  ]
}
```

**Doğrulama:** [Schema Markup Validator](https://validator.schema.org/) ve [Google Rich Results Test](https://search.google.com/test/rich-results).

> ⚠️ **TBB Reklam Yasağı uyarısı:** `priceRange` ve `aggregateRating` alanları avukatlık hizmetleri için kullanılırken dikkatli olunmalı; Türkiye Barolar Birliği Avukatlık Reklam Yasağı Yönetmeliği bu tür ifadeleri kısıtlar. `priceRange` etrafında `$$` gibi soyut bir aralık yerine alanı tamamen kaldırmak daha güvenli.

---

## 6. İçerik Hiyerarşisi (H1-H6) — KRİTİK

Sayfanın tüm `<h1>..<h6>` envanteri:

| Seviye | Sayı | İçerik |
|---|---|---|
| H1 | 1 | "Av. Burakhan Çalışkan" (logo bloğunda) |
| H2 | **0** | — |
| H3 | **0** | — |
| H4-H6 | **0** | — |

**Sorun:** Sayfada en az şu mantıksal bölümler var ve her biri H2 olmalı:
- "İstanbul Ceza, Uyuşturucu ve Cinsel Suçlar Avukatı" (giriş bölümü)
- "Cinsel Suçlar Avukatı" (hizmet bloğu)
- "İstanbul Uyuşturucu Avukatı" (hizmet bloğu)
- "NCMEC Nedir?" (hizmet bloğu)
- "Kartal Ceza Avukatı" (hizmet bloğu)
- "Cinsel Suçlar Avukatı" (makale bloğu) — H2
- "İstanbul Ceza Avukatı" (makale bloğu) — H2
- "Köşe Yazıları" (makale bloğu) — H2

Şu an bu başlıklar `<div class="widgetHeading"><div class="text">…</div></div>` olarak işaretleniyor; tarayıcılar için görsel başlık ama arama motoru için **düz metin**. Bu, Google'ın "topic clustering" ve "passage indexing" sinyallerini zayıflatır.

**Aksiyon (Rota theme):** `wp-content/themes/rota/template-parts/widgets/...` veya benzeri şablonlarda `widgetHeading .text` blokunu `<h2 class="widgetHeading">` ya da içine `<h2>` semantik etiketi ekleyecek biçimde patch'lemek gerekir. Child theme ile yapılması zorunlu (theme update'lerde override'ın silinmemesi için).

**Bonus:** H1'de "İstanbul Ceza Avukatı" anahtar kelimesi yok (yalnızca brand). Site logosunun yanına h1 ile brand bırakmak yaygındır; ancak SEO açısından **anasayfanın main content alanında** "İstanbul Ceza, Uyuşturucu ve Cinsel Suçlar Avukatı" gibi bir başlık `<h1>`, bunun altında brand `<h2>` veya `<p class="brand">` olmalı.

---

## 7. Görsel SEO

| Metric | Değer | Yorum |
|---|---|---|
| Toplam `<img>` | 38 | OK |
| `alt` attribute eksik | 0 | ✅ |
| `alt=""` (decorative) | 0 | ✅ |
| Tekrar eden alt metni | "Av. Burakhan Çalışkan" 3×, "İstanbul Uyuşturucu Avukatı" 3×, "Müstehcenlik Suçu Nedir?" 2×, "Cinsel Suçlar Avukatı" 2×, "Evde Hassas Terazi…" 2×, "Evde Kenevir Yetiştirme Cezası" 2× | ⚠️ duplicate alt |
| `loading="lazy"` | 36/38 | ✅ |
| Modern format (WebP/AVIF) | Tespit edilmedi (PNG ağırlıklı) | ❌ |
| `srcset` / responsive | Tespit edilmedi (Yoast/WP genelde otomatik üretir) | 🔍 doğrulanmalı |
| Featured image (gerçek kapak) | **2/38** (yalnızca logo) — geri kalan 36 görsel `noimage.png` placeholder | ❌ kritik |

**Kritik bulgu:** Tüm makale kartlarında `wp-content/themes/rota/images/noimage.png` kullanılıyor — yani **hiçbir makaleye featured image atanmamış**. Bu:
- Google Discover'da yer alma şansını sıfırlar (Discover featured image gerektirir).
- Image search'te görünmez.
- Sosyal paylaşımda boş kart üretir.
- Rich snippet `BlogPosting > image` zorunlu alanı eksik kalır.

**Aksiyon:**
1. WordPress admin → her yazıya 1200×800 px featured image ekle (konuya uygun, telifsiz görsel + brand watermark).
2. Görsel dosya isimlerini ASCII slug ile yükle (`mustehcenlik-sucu-cezasi.webp` gibi).
3. WebP / AVIF dönüştürücü plugin (örn. ShortPixel, EWWW Image Optimizer) ile yeniden encode et.
4. Mevcut görsel dosya isimlerinde **Türkçe karakter ve `®`** var (`Mor-Minimalist-Gu®zellik-Logosu-3-2.png`, `Av.BurakhanÇalişkan-1.png`) — bazı CDN'lerde URL escaping hatası ve 404 üretir; ASCII'ye normalize et.

---

## 8. Performans / Core Web Vitals (statik analiz)

🔍 **Gerçek ölçüm yapılmadı**; aşağıdaki tespitler kod kalıplarına dayalı.

### Yüklenen kaynaklar
- **CSS (5):** `gutenberg.css`, `style.css`, `prota.css` (font), `fancybox.min.css`, `rs6.css` (Slider Revolution)
- **JS (9):** `jquery.min.js (3.7.1)`, `jquery-migrate.min.js (3.4.1)`, `scripts.js`, `owl.carousel.min.js`, `jquery.fancybox.min.js`, `rbtools.min.js (SR)`, `rs6.min.js (SR)`, `html5shiv.js (IE<9!)`, `e-202618.js (Jetpack Stats)`

### Sorunlar
1. **`html5shiv.js`** — IE<9 desteği için. 2026'da gereksiz; kaldır.
2. **jQuery + jQuery Migrate** — Migrate sadece eski jQuery API uyumluluğu için. `wp_dequeue_script('jquery-migrate')` ile kaldırılabilir.
3. **Slider Revolution 6.7.41** — Anasayfada başlangıçta gerekli, ama RevSlider çekirdek ~120 KB minified + animasyon assets. Eğer hero alanında durağan bir banner yeterliyse SR komple kaldırılıp temaya CSS-only hero bölümü konabilir; bu **300-500 KB** kaynak ve **300+ ms TBT** kazanır.
4. **Owl Carousel + Fancybox** — eğer aktif olarak kullanılmıyorsa conditional load (sadece galeri/lightbox bulunan sayfalarda).
5. **Critical CSS** — Jetpack Boost `style id="jetpack-boost-critical-css"` ile inlinelenmiş ✅. Ancak inline blok ~30 KB; Boost'in "Defer non-essential JavaScript" ve "Lazy Image Loading" modüllerinin de açık olduğu doğrulanmalı.
6. **CSS `media="not all"` + `onload="this.media='all'"`** pattern — render-blocking CSS'i async yüklüyor ✅. Bu kalıp Boost'in "Defer non-essential CSS" özelliği.
7. **Font (Prota)** — kendi sunucudan, ama `font-display: swap` ve `<link rel="preload" as="font" crossorigin>` doğrulanmalı (HTML head'de görünmüyor).
8. **WP Statistics + Jetpack Stats** — iki ayrı analitik sistemi. Biri (WP Statistics) yerel veritabanı yazıyor, diğeri Jetpack. Birini seçip diğerini kaldırmak daha sağlıklı; çift istek (DB load + 3rd party JS) gereksiz.
9. **`stats.wp.com/e-202618.js`** — Jetpack stats; üçüncü taraf, defer yapılmalı (zaten `defer` attribute'u var ✅).
10. **`maximum-scale=5`** — viewport içinde mevcut. Erişilebilirlik için **doğru** (kullanıcının zoom'unu kısıtlamıyor); modern Lighthouse'da hata değil. ✅
11. **WP Emoji loader** — hâlâ enqueued. Kaldırılırsa ufak kazanım: `add_action('init', function(){ remove_action('wp_head', 'print_emoji_detection_script', 7); remove_action('wp_print_styles', 'print_emoji_styles'); });`

### Beklenen LCP / CLS / INP riskleri
- **LCP:** Slider Revolution hero görseli LCP element olabilir — `fetchpriority="high"` ve `<link rel="preload" as="image">` ile öne çekilmeli.
- **CLS:** SR slider yükselip indikçe `min-height` rezervasyonu yoksa shift üretir; `setREVStartSize()` script'i bunu önlemeye çalışıyor ama mobile için doğrulanmalı.
- **INP:** Fancybox + Owl + jQuery Migrate kombinasyonu ana thread'i meşgul edebilir.

### Test önerisi
- [PageSpeed Insights](https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.burakhancaliskan.av.tr%2F) — mobile + desktop ayrı.
- [WebPageTest](https://www.webpagetest.org/) — Istanbul (4G) profili.
- Chrome DevTools → Performance → Record (mobil emülasyonu, 4× CPU throttle).

---

## 9. Mobil Uyum

```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5" />
```
- ✅ `width=device-width, initial-scale=1` doğru.
- ✅ `maximum-scale=5` accessibility-friendly (kullanıcı zoom'a izin veriyor).
- 🔍 Tema CSS'inde `@media (max-width:1100px)` ve `(max-width:768px)` breakpoint'leri var — mobil hamburger menü yapısı çalışıyor görünüyor.
- 🔍 Mobile-Friendly Test ([search.google.com/test/mobile-friendly](https://search.google.com/test/mobile-friendly)) ile doğrulama önerilir (Google bu aracı 2023 sonu emekliye ayırdı; alternatif: Search Console > Sayfa deneyimi raporu).

---

## 10. Güvenlik & Sürüm Hijyeni

| Bulgu | Risk | Aksiyon |
|---|---|---|
| `meta name="generator"` Slider Revolution sürüm sızıntısı (`6.7.41`) | Düşük-Orta — saldırgan reconnaissance kolaylaşır; SR 6.x serisi eski CVE'lerle anılır | `<meta>` etiketini `functions.php` üzerinden filtre ile kaldır; SR'ı 6.7.x'in son sürümüne (eğer 6.7.41 son değilse) güncelle |
| Yoast SEO 22.7 | Düşük — fonksiyonel olarak çalışır, ama 23.x/24.x/25.x'te schema iyileştirmeleri ve performans yamaları var | WP admin → Pluginler → Güncelle |
| WordPress REST API endpoint açık (`<link rel="https://api.w.org/" href="…/wp-json/" />`) | Düşük — kullanıcı listesi `/wp-json/wp/v2/users` enumerasyon noktası | `disable-json-api` plugin veya filter ile sertleştir |
| XML-RPC RSD link açık (`xmlrpc.php?rsd`) | Orta — brute-force pingback amplifikasyon | `xmlrpc.php` 403 ya da plugin ile kapat (artık çoğu site bunu kullanmıyor) |
| RSS feed açık (`/feed/`, `/comments/feed/`) | Düşük — içerik scraping kolaylaşır | İsteğe bağlı; SEO açısından `/feed/` faydalı (Google News, Discover) |
| WP Statistics + Jetpack Stats çift analitik | Düşük — gereksiz network ve DB yükü | Birini kaldır |
| Favicon dosya adı **"Mor-Minimalist-Güzellik-Logosu"** | Düşük — brand asset hijyeni | Yeni hukuk-temalı favicon yükle (32×32, 192×192, 512×512 + apple-touch-icon 180×180) |
| Görsel dosyada `®` özel karakteri (`Gu®zellik`) | Düşük — bazı proxy/CDN'lerde 404 | Tüm görsellere ASCII slug ile yeniden yükle |
| Mixed content (`http://` referanslar HTML içinde 43 adet — favicon `<link rel="shortcut icon" href="http://...">`, tema CSS değişkeninde `noimage.png` URL'i `http://`) | Orta — modern tarayıcılar HTTPS sayfada HTTP image yüklemesini "upgrade-insecure-requests" ile düzeltebilir; ama bazıları blokluyor | Tema dosyalarında ve seçeneklerde `http://` → `https://` toplu replace; WP DB için `Better Search Replace` plugin |

🔍 **Doğrulanmalı:**
```bash
curl -I https://www.burakhancaliskan.av.tr/ | grep -i "strict-transport-security\|x-frame-options\|content-security-policy\|x-content-type-options\|referrer-policy"
```
Beklenen başlıklar: `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.

---

## 11. TBB Reklam Yasağı Yönetmeliği Notu (kapsam dışı ama kritik)

Site içeriğinde geçen şu ifadeler **1136 sayılı Avukatlık Kanunu m.55** ve **TBB Avukatlık Meslek Kuralları m.7-8** ile **Avukatlık Reklam Yasağı Yönetmeliği** açısından risk taşır:

| İfade (sitedeki haliyle) | Risk |
|---|---|
| "ücretsiz danışmanlık için arayınız" (birden çok yazıda) | Madde 7/8 — ücret/koşul reklamı |
| "beraat odaklı avukatlık yapar" | Sonuç vaadi — açık yasak |
| "en güçlü savunmayı hak eder", "profesyonel savunma desteği" | Kalite üstünlüğü iması |
| "Bizi Arayın" (CTA buton metni) | Direkt müvekkil çağrısı; yönetmelikçe sınırlı |
| "İletişim: 0506 976 23 55" — yazı içeriklerinin başına/sonuna gömülü | Yazı içeriğinde değil yalnızca künyede yer almalı |
| WhatsApp button + canlı sohbet baloncuğu "Size nasıl yardımcı olabiliriz?" | Yönetmelik m.10 kapsamında değerlendirilebilir |

**SEO ile kesişimi:** Google E-E-A-T ve YMYL (Your Money Your Life) kategorisinde hukuki içeriklerde "sonuç garantisi", "en iyi" gibi nitelendirmeler Quality Rater Guidelines bazında **Low Quality** sinyali oluşturur. İfade temizliği hem mevzuat hem SEO açısından kazanım sağlar.

> Bu rapor TBB uyumu için bir hukuki görüş niteliğinde değildir; bağlı olduğunuz baronun reklam kurulu görüşü esas alınmalıdır.

---

## 12. Önceliklendirilmiş Aksiyon Listesi

### 0–7 gün (Hızlı kazanımlar)
| # | Aksiyon | Etki | Çaba |
|---|---|---|---|
| 1 | Yoast → Sosyal sekmesinden default `og:image` ve `twitter:image` belirle (1200×630 brand görsel) | Yüksek | XS |
| 2 | `<meta name="generator">` Slider Revolution etiketini kaldır (`functions.php` filtresi) | Düşük | XS |
| 3 | Favicon'u hukuk temalı yeni asetle değiştir | Düşük (brand) | XS |
| 4 | WP Statistics ↔ Jetpack Stats arasında birini seç ve diğerini kaldır | Düşük | XS |
| 5 | Yoast SEO ve Slider Revolution güncellemelerini uygula | Orta (güvenlik) | XS |
| 6 | `html5shiv.js` ve jQuery Migrate dequeue | Düşük (perf) | S |
| 7 | Tüm görsel URL'lerinde Türkçe/`®` karakterleri ASCII'ye normalize et | Düşük | S |

### 7–30 gün (Yapısal düzeltmeler)
| # | Aksiyon | Etki | Çaba |
|---|---|---|---|
| 8 | URL slug kannibalizasyonunu çöz: `-2`'li sayfaları tek bir kanonik URL'a 301 ile birleştir; iç linkleri güncelle | **Çok Yüksek** | M |
| 9 | `Attorney`/`LegalService` JSON-LD'sini ana sayfaya ekle (Bölüm 5 örneği) | Yüksek | S |
| 10 | Tüm makalelere featured image ekle (36 yazı) | Yüksek | M-L |
| 11 | Rota theme'de child theme oluştur ve `widgetHeading` bloklarına `<h2>` semantik etiket ekle | Yüksek | M |
| 12 | TBB Reklam Yasağı uyumlu içerik temizliği ("ücretsiz", "beraat odaklı", "en güçlü" → tarafsız ifadeler) | Yüksek (mevzuat + E-E-A-T) | M |
| 13 | HTTP→HTTPS protokol birleşimini server-level 301 ile sağla; HSTS ekle | Yüksek (kanonik) | S |
| 14 | XML-RPC ve `wp-json` user enumeration sertleştirmesi | Düşük (güvenlik) | S |

### 30–90 gün (Stratejik)
| # | Aksiyon | Etki | Çaba |
|---|---|---|---|
| 15 | İçerik clusterleme: "İstanbul Ceza Avukatı" pillar + alt başlıklar (Cinsel Suçlar / Uyuşturucu / Dolandırıcılık / MASAK) hub-spoke yapısı | Çok Yüksek | L |
| 16 | Slider Revolution'ı kaldırıp CSS-only hero ile değiştir (perf kazanımı: -300/500 KB, -200/400ms TBT) | Yüksek | L |
| 17 | WebP/AVIF dönüşümü + responsive `srcset` doğrulaması | Orta | M |
| 18 | Google Business Profile (GMB) yerel SEO bağlantısı: profil oluştur/optimize et, NAP tutarlılığı, kategori "Avukat — Ceza", inceleme stratejisi | Yüksek (yerel) | M |
| 19 | İç sayfaların Search Console kaplaması raporunu çıkar; "Crawled - currently not indexed" ve "Discovered - not indexed" sayfaları içerik genişletme/birleştirme | Yüksek | M |
| 20 | Backlink profili analizi (Ahrefs/Semrush/Moz) ve kaliteli barolu/hukuk dergisi linkleri | Yüksek | L |

---

## 13. Kullanıcı Tarafında Çalıştırılması Gereken Doğrulama Komutları

Sandbox'tan erişilemediği için aşağıdakileri kendi makinende çalıştırıp çıktıları paylaşırsan ikinci tur derinleştirme yaparım.

### 13.1 HTTP başlık zinciri (canonical/HSTS doğrulaması)
```bash
# 1) Non-www HTTP
curl -sI -L -A "Mozilla/5.0" http://burakhancaliskan.av.tr/ | tee /tmp/h1.txt

# 2) Non-www HTTPS
curl -sI -L -A "Mozilla/5.0" https://burakhancaliskan.av.tr/ | tee /tmp/h2.txt

# 3) www HTTP
curl -sI -L -A "Mozilla/5.0" http://www.burakhancaliskan.av.tr/ | tee /tmp/h3.txt

# 4) www HTTPS (final canonical)
curl -sI -A "Mozilla/5.0" https://www.burakhancaliskan.av.tr/ | tee /tmp/h4.txt
```
Beklenen sonuç: 1, 2, 3 hepsi → `301` → `https://www.burakhancaliskan.av.tr/`. 4'te `200` ve `Strict-Transport-Security: max-age=…` başlığı.

### 13.2 robots.txt ve sitemap
```bash
curl -s https://www.burakhancaliskan.av.tr/robots.txt
curl -s https://www.burakhancaliskan.av.tr/sitemap_index.xml | head -100
```

### 13.3 Slug kannibalizasyon kontrolü
```bash
for slug in ceza-avukati ceza-avukati-2 hakkimizda hakkimizda-2 \
    istanbul-uyusturucu-avukati istanbul-uyusturucu-avukati-2 \
    cinsel-suclar-avukati istanbul-cinsel-suc-avukati \
    dolandiricilik-avukati-2 istanbul-dolandiricilik-avukati \
    istanbul-bosanma-avukati istanbul-bosanma-avukati-2 \
    ncmec-nedir ncmec-nedir-ne-ise-yarar-turkiyede-rolu-nedir; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "https://www.burakhancaliskan.av.tr/$slug/")
  echo "$code  /$slug/"
done
```
200 dönen tüm sayfalar canlı; 301 dönenler zaten birleşmiş. Hangi çiftin **iki sayfasının da 200** olduğu acil düzeltme listesidir.

### 13.4 Schema validasyonu
- https://validator.schema.org/ → URL kutusuna `https://www.burakhancaliskan.av.tr/` yapıştır.
- https://search.google.com/test/rich-results → aynı URL.

### 13.5 PageSpeed Insights
- https://pagespeed.web.dev/analysis?url=https%3A%2F%2Fwww.burakhancaliskan.av.tr%2F&form_factor=mobile
- `Performance`, `Accessibility`, `Best Practices`, `SEO` skorlarını paylaş.

### 13.6 Search Console (hesap erişimi gerekli)
- Performance: 3 aylık tıklama/impression top 50 sorgu ve top 50 sayfa.
- Coverage / Pages: "Not indexed" sebepleri.
- Enhancements > Breadcrumbs / Sitelinks searchbox / Sitemaps.

---

## 14. Ekler

### 14.1 Tespit edilen iç sayfa envanteri (47 URL, dedupe edilmiş)
```
/                                       (anasayfa)
/calisma-prensiplerimiz/
/category/istanbul-ceza-avukati/
/category/kose-yazisi/
/category/makaleler/
/ceza-avukati-2/
/chatgpt-ile-kisa-bir-sohbet-yapay-zeka-halusinasyonu-uydurma-yargitay-ictihatlari/
/cinsel-suc-yargilamalarinda-kadinin-beyani-esastir-ilkesi-elestirisi/
/cinsel-suc-yargilamalarinda-medyanin-golgesi/
/cinsel-suclar-avukati/
/cinsel-suclarda-iftira-ve-yargitayin-hatali-yaklasimi/
/delilden-cok-algiya-dayali-mahkumiyetler-yarginin-populizme-teslim-olmasi/
/dolandiricilik-avukati-2/
/ekibimiz/
/evde-hassas-terazi-bulundurmanin-cezasi/
/evde-kenevir-yetistirme-cezasi/
/fuhus-cezasi-nedir-fuhus-sucu-nedir/
/grok-ozelinde-yapay-zekanin-cezai-sorumlulugu-meselesi/
/hakkimizda-2/
/hayasizca-hareket-sucu-ve-cezasi/
/iletisim/
/istanbul-bosanma-avukati-2/
/istanbul-cinsel-suc-avukati/
/istanbul-dolandiricilik-avukati/
/istanbul-uyusturucu-avukati-2/
/istanbul-uyusturucu-avukati/
/istanbulda-avukat-secerken-nelere-dikkat-edilmeli/
/kartal-ceza-avukati/
/masak-avukati/
/metamfetamin-cezasi-nedir/
/metamfetamin-kullananlar-nasil-anlasilir/
/musta-tasima-cezasi/
/mustehcenlik-sucu-nedir/
/ncmec-nedir-ne-ise-yarar-turkiyede-rolu-nedir/
/ncmec-nedir/
/ogrencinin-ogretmene-cinsel-istismar-iftirasina-karsi-ne-yapilmali/
/one-alim-talebi-ornegi/
/online-katalog/
/sosyal-medya-uzerinden-cinsel-taciz-dolandiriciligi/
/suca-suruklenen-cocuk-kavramini-ve-mattia-ahmet-minguzzi-cinayeti/
/taciz-iftirasi/
/tutuklama-istisna-olmasi-gereken-kural-kural-olan-istisna-oldu/
/uyusturucu-kullanma-savunma-dilekcesi-tck-191/
/uyusturucu-suclarinda-hassas-terazi-cezasi/
/uyusturucu-ticareti-savunma-dilekcesi/
/yapay-zeka-ve-ceza-hukuku-sorumluluk-kimde/
```

### 14.2 Tespit edilen telefon formatları (NAP tutarsızlığı)
HTML içinde **6 farklı telefon görünümü** bulundu:
- `5069762355`
- `905069762355` (WhatsApp linkinde)
- `0506 976 23 55`
- `0 506 976 23 55`
- `05069762355`
- `05550000000` ⚠️ (placeholder gibi görünüyor — tema/widget bir yerde dummy değer kalmış olabilir; kullanıcı tarafında aranıp düzeltilmeli)

**NAP tutarlılığı için tek format:** `+90 506 976 23 55` (uluslararası), `tel:+905069762355` (link), `0506 976 23 55` (görüntü).

### 14.3 Adres
```
Cevizli Mahallesi, Ulubey Sokak, No: 4A D: 46
Nursanlar Kartal 1 — 34865 Kartal/İstanbul
```
Bu bilgi şu an yalnızca düz metin; `Attorney > address > PostalAddress` JSON-LD'sine + footer microdata'sına + Google Business Profile'a aynı yazımla girilmeli.

### 14.4 Görsel dosya isim kalıntıları
- `/wp-content/uploads/2022/09/Mor-Minimalist-Gu®zellik-Logosu-3-2.png` → favicon
- `/wp-content/uploads/2022/09/Av.BurakhanÇalişkan-1.png` → logo
- `/wp-content/themes/rota/images/noimage.png` → 36 makale kartında placeholder

---

**Sonraki tur:** Bölüm 13'teki komut çıktılarını yapıştırırsan robots.txt + sitemap + HTTP başlık zinciri + slug kannibalizasyon listesi netleşir; rapora ek olarak ikinci bir "doğrulama sonrası bulgular" bölümü çıkarırım.
