=== Çalışkan Hukuk — SEO Tweaks ===
Contributors: caliskanhukuk
Tags: seo, schema, attorney, legalservice, security, performance
Requires at least: 6.0
Tested up to: 6.7
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

burakhancaliskan.av.tr için yapılan teknik SEO denetiminden çıkan düzeltmeleri tek tıkla uygular. Yoast SEO ile uyumludur.

== Description ==

Bu eklenti, ana sayfanın HTML kaynağı üzerinden yapılan teknik SEO denetimi sonucunda tespit edilen aşağıdaki sorunları düzeltir:

* Slider Revolution / WP `meta name="generator"` sürüm sızıntısının kaldırılması
* XML-RPC ve `wp-json/wp/v2/users` enumeration sertleştirmesi
* WP Emoji loader, jQuery Migrate ve `html5shiv.js` dequeue
* `Attorney` (Schema.org / LegalService) JSON-LD enjeksiyonu — adres, telefon, çalışma saatleri, hizmet bölgesi, sameAs
* `og:image` ve `twitter:image` fallback (Yoast koymadıysa)
* HTML çıktısındaki `http://<kendi-host>` referanslarının `https://`'e dönüştürülmesi
* HSTS, X-Content-Type-Options, Referrer-Policy ve Permissions-Policy başlıkları
* Rota theme'in `<div class="widgetHeading">` bloklarının semantik `<h2>` yapısına yükseltilmesi
* `tel:` link normalizasyonu (E.164)
* Yazı düzenleme ekranında TBB Avukatlık Reklam Yasağı uyarıları ("ücretsiz danışmanlık", "beraat odaklı", "en iyi avukat" vb.)

Her modül ayar sayfasından bağımsız olarak açılıp kapatılabilir.

== Installation ==

1. `caliskan-hukuk-seo` klasörünü `/wp-content/plugins/` altına kopyala (ya da Plugins → Add New → Upload Plugin ile ZIP olarak yükle).
2. WordPress admin → Plugins → "Çalışkan Hukuk — SEO Tweaks" eklentisini etkinleştir.
3. Settings → Çalışkan SEO menüsünden modülleri ve ofis bilgilerini düzenle.
4. Schema.org çıktısını [validator.schema.org](https://validator.schema.org/) ve Google Rich Results Test ile doğrula.

== Frequently Asked Questions ==

= Yoast SEO ile çakışır mı? =

Hayır. Eklenti Yoast'in JSON-LD graph'ına dokunmaz; ek olarak `Attorney` düğümü ekler. `og:image` fallback ise yalnızca Yoast tarafından eklenmediyse çalışır.

= jQuery Migrate kaldırınca tema bozulur mu? =

Modern temalarda gerekmez ama Rota theme'in eski JS'leri Migrate'e bağımlıysa konsol hataları görebilirsin. Bu modülü kapatmak güvenlidir.

= TBB Reklam Yasağı uyarıları nereden çıkar? =

Yazı düzenleme ekranında, başlık + içerik üzerinde regex taraması yapılır. Eşleşme varsa admin notice gösterir. Eşleşmeyi bulmak siteyi yayınlamayı engellemez; yalnızca uyarıdır.

= Eklenti site URL'imi değiştirebilir mi? =

Yalnızca **HTML çıktıdaki** `http://<kendi-host>` referansları runtime'da `https://`'e çevrilir. Veritabanına yazmaz. Kalıcı düzeltme için `Better Search Replace` plugin'i ile DB'de toplu replace önerilir.

= Hangi WP / PHP sürümleri destekleniyor? =

WP 6.0+, PHP 7.4+.

== Changelog ==

= 1.0.0 =
* İlk sürüm.
