# Çalışkan Hukuk — SEO Tweaks (WordPress eklentisi)

`burakhancaliskan.av.tr` teknik SEO denetiminden ([../burakhancaliskan-av-tr.md](../burakhancaliskan-av-tr.md)) çıkan düzeltmeleri tek tıkla uygulayan WordPress eklentisi. Yoast SEO ile uyumludur, onun yerine geçmez.

## Kapsam

| # | Modül | Raporun ilgili maddesi |
|---|---|---|
| 1 | `meta name="generator"` (Slider Revolution sürüm) sızıntısını kaldır | §10 |
| 2 | XML-RPC + Pingback + RSD + WLW link kapat | §10 |
| 3 | `/wp-json/wp/v2/users` user enumeration kapat | §10 |
| 4 | WP Emoji loader dequeue | §8 |
| 5 | jQuery Migrate dequeue (frontend) | §8 |
| 6 | `html5shiv.js` (IE<9) dequeue | §8 |
| 7 | `Attorney` / `LegalService` JSON-LD enjekte et | §5 |
| 8 | `og:image` + `twitter:image` fallback | §4.3 / §4.4 |
| 9 | HTML çıktıda `http://<kendi-host>` → `https://` | §10 / §3.2 |
| 10 | HSTS + X-Content-Type-Options + Referrer-Policy + Permissions-Policy | §10 |
| 11 | Rota theme `widgetHeading` → semantik `<h2>` | §6 |
| 12 | `tel:` link normalizasyonu (E.164) | §14.2 |
| 13 | TBB Reklam Yasağı admin uyarıları | §11 |

## Kurulum

```bash
# 1) Eklentiyi siteye yükle
cd /path/to/wp-content/plugins/
# bu repodan kopyala:
cp -r /home/user/depo/seo/plugin/caliskan-hukuk-seo .

# 2) ZIP olarak yüklemek istersen:
cd /home/user/depo/seo/plugin && zip -r caliskan-hukuk-seo.zip caliskan-hukuk-seo
# Sonra WP admin → Plugins → Add New → Upload Plugin
```

WP admin → **Plugins** → "Çalışkan Hukuk — SEO Tweaks" → **Activate**.

Sonra **Settings → Çalışkan SEO** menüsünden:
- Modülleri tek tek aç/kapat (gerekmeyenleri devre dışı bırak).
- Ofis bilgilerini doldur (adres, telefon, koordinat, hizmet bölgesi, sameAs).
- "Default og:image URL" alanına 1200×630 brand görsel URL'i gir.

## Mimari notlar

- **Tek output buffer:** `template_redirect` üzerinde tek bir `ob_start([$this,'process_html'])` açılır; HTTPS rewrite, widget heading promotion, og:image fallback, generator strip, tel: normalize hepsi aynı geçişte yapılır → ek perf maliyeti minimum.
- **Yoast ile çakışmaz:** og:image fallback yalnızca HTML'de Yoast/diğer eklenti `og:image` koymadığında enjekte olur (`stripos($html,'property="og:image"') === false` kontrolü).
- **JSON-LD kapsamı:** Default olarak yalnızca anasayfa + iletişim/hakkımızda sayfalarında çıkar. `apply_filters('caliskan_seo_attorney_jsonld_everywhere', '__return_true')` ile her sayfada çıkartılabilir. JSON-LD payload'ı `caliskan_seo_attorney_jsonld` filtresiyle override edilebilir.
- **Güvenli sertleştirme:** REST users endpoint hem `rest_endpoints` filter'ı (rota silme) hem de `rest_authentication_errors` (anonim 401) ile çift kat kapatılır.
- **Idempotent:** Aynı sayfa iki kere proses edilse bile (örn. theme nested ob_start'ı), sonuç aynı kalır (regex'ler `<div class="widgetHeading">` ararken `<h2 class="widgetHeading">`'e dokunmaz; og:image enjeksiyonu mevcut etiket varsa atlar).

## Filter / Hook referansı

```php
// Tüm sayfalarda Attorney JSON-LD çıkart
add_filter('caliskan_seo_attorney_jsonld_everywhere', '__return_true');

// JSON-LD'yi özelleştir
add_filter('caliskan_seo_attorney_jsonld', function ($data) {
    $data['aggregateRating'] = [...]; // dikkat: TBB Reklam Yasağı m.6
    return $data;
});
```

## Doğrulama

Eklentiyi etkinleştirdikten sonra anasayfada `view-source` ile şunları kontrol et:

```bash
# 1) Generator gitti mi?
curl -s https://www.burakhancaliskan.av.tr/ | grep -i 'name="generator"'
# (boş çıktı olmalı)

# 2) Attorney JSON-LD geldi mi?
curl -s https://www.burakhancaliskan.av.tr/ | grep -A1 'data-caliskan="attorney"'

# 3) HSTS başlığı geliyor mu?
curl -sI https://www.burakhancaliskan.av.tr/ | grep -i 'strict-transport-security'

# 4) Mixed content sıfırlandı mı?
curl -s https://www.burakhancaliskan.av.tr/ | grep -oE 'http://www\.burakhancaliskan\.av\.tr[^" ]*' | sort -u
# (boş çıktı olmalı)

# 5) widgetHeading h2'ye yükseldi mi?
curl -s https://www.burakhancaliskan.av.tr/ | grep -c '<h2 class="widgetHeading"'
# (>0 olmalı)

# 6) wp-json/wp/v2/users kapatıldı mı (anonim)?
curl -s -o /dev/null -w "%{http_code}\n" https://www.burakhancaliskan.av.tr/wp-json/wp/v2/users
# (401 olmalı)
```

## Sınırlamalar / yapılmayanlar

- **URL slug kannibalizasyonu** (raporun §3.3'ü) eklenti ile çözülemez — manuel WP admin işidir; eklenti yalnızca tespiti raporda bırakır.
- **Featured image eksikliği** (raporun §7'si) içerik tarafı; her makaleye admin manuel olarak ekleyecek.
- **Slider Revolution kaldırma** (raporun §8 önerisi) eklentiye dahil edilmedi — sahibi siteye banner kararı vermeden kaldırma yapılmaz.
- **Search Console / GMB** entegrasyonları kapsam dışı.
