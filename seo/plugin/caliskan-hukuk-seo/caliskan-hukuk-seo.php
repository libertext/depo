<?php
/**
 * Plugin Name:       Çalışkan Hukuk — SEO Tweaks
 * Plugin URI:        https://www.burakhancaliskan.av.tr/
 * Description:       burakhancaliskan.av.tr için yapılan teknik SEO denetiminden çıkan düzeltmeleri tek tıkla uygulayan modüler eklenti. Yoast'ı tamamlar, replace etmez.
 * Version:           1.0.0
 * Requires at least: 6.0
 * Requires PHP:      7.4
 * Author:            Çalışkan Hukuk Bürosu
 * License:           GPL-2.0-or-later
 * Text Domain:       caliskan-seo
 */

if (!defined('ABSPATH')) {
    exit;
}

final class Caliskan_SEO_Tweaks {

    const OPTION_KEY = 'caliskan_seo_tweaks_options';
    const VERSION    = '1.0.0';
    const SLUG       = 'caliskan-seo';

    /** @var array<string,mixed> */
    private static $defaults = [
        // Modül anahtarları
        'remove_generator_meta'   => 1,
        'remove_xmlrpc'           => 1,
        'harden_rest_users'       => 1,
        'remove_emoji'            => 1,
        'remove_jquery_migrate'   => 1,
        'remove_html5shiv'        => 1,
        'add_attorney_jsonld'     => 1,
        'add_default_og_image'    => 1,
        'force_https_assets'      => 1,
        'security_headers'        => 1,
        'fix_widget_headings'     => 1,
        'tbb_admin_warnings'      => 1,
        'normalize_phone_links'   => 1,
        // Avukat / ofis bilgileri (JSON-LD)
        'attorney_name' => 'Av. Burakhan Çalışkan',
        'org_name'      => 'Çalışkan Hukuk Bürosu',
        'phone_intl'    => '+905069762355',
        'phone_display' => '+90 506 976 23 55',
        'email'         => 'av.burakhancaliskan@gmail.com',
        'street'        => 'Cevizli Mah. Ulubey Sok. No:4A D:46 Nursanlar Kartal 1',
        'city'          => 'Kartal',
        'region'        => 'İstanbul',
        'postal'        => '34865',
        'country'       => 'TR',
        'latitude'      => '40.9012',
        'longitude'     => '29.2106',
        'opens'         => '09:00',
        'closes'        => '18:00',
        'days'          => 'Mo-Fr',
        'image_url'     => '',
        'default_og_image' => '',
        'areas_served'  => "İstanbul\nKartal\nPendik\nMaltepe\nSultanbeyli\nSancaktepe\nİstanbul Anadolu Yakası",
        'knows_about'   => "Ceza Hukuku\nCinsel Suçlar\nUyuşturucu Suçları\nMASAK\nDolandırıcılık\nNCMEC raporları",
        'sameas'        => '',
    ];

    /** @var self|null */
    private static $instance = null;

    public static function instance(): self {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function boot(): void {
        $opts = $this->opts();

        if ($opts['remove_xmlrpc']) {
            add_filter('xmlrpc_enabled', '__return_false');
            add_filter('wp_headers', static function ($h) {
                unset($h['X-Pingback']);
                return $h;
            });
            remove_action('wp_head', 'rsd_link');
            remove_action('wp_head', 'wlwmanifest_link');
        }

        if ($opts['harden_rest_users']) {
            add_filter('rest_endpoints', [$this, 'restrict_rest_users']);
            add_filter('rest_authentication_errors', [$this, 'block_unauthed_user_routes'], 99);
        }

        if ($opts['remove_emoji']) {
            remove_action('wp_head', 'print_emoji_detection_script', 7);
            remove_action('wp_print_styles', 'print_emoji_styles');
            remove_action('admin_print_scripts', 'print_emoji_detection_script');
            remove_action('admin_print_styles', 'print_emoji_styles');
            remove_filter('the_content_feed', 'wp_staticize_emoji');
            remove_filter('comment_text_rss', 'wp_staticize_emoji');
            remove_filter('wp_mail', 'wp_staticize_emoji_for_email');
            add_filter('emoji_svg_url', '__return_false');
        }

        if ($opts['remove_jquery_migrate']) {
            add_action('wp_default_scripts', [$this, 'dequeue_jquery_migrate']);
        }

        if ($opts['remove_html5shiv']) {
            add_action('wp_enqueue_scripts', [$this, 'dequeue_html5shiv'], 100);
        }

        if ($opts['add_attorney_jsonld']) {
            add_action('wp_head', [$this, 'output_attorney_jsonld'], 50);
        }

        if ($opts['security_headers']) {
            add_action('send_headers', [$this, 'send_security_headers']);
        }

        if (is_admin() && $opts['tbb_admin_warnings']) {
            add_action('admin_notices', [$this, 'tbb_admin_notices']);
        }

        // HTML output buffer (force https + widget H2 + og:image fallback + generator strip + tel normalize)
        if ($this->needs_html_buffer($opts) && !is_admin()) {
            add_action('template_redirect', [$this, 'start_html_buffer'], 1);
            add_action('shutdown', [$this, 'flush_html_buffer'], 0);
        }

        add_action('admin_menu', [$this, 'add_admin_menu']);
        add_action('admin_init', [$this, 'register_settings']);
        add_filter('plugin_action_links_' . plugin_basename(__FILE__), [$this, 'plugin_action_links']);
    }

    private function needs_html_buffer(array $o): bool {
        return $o['force_https_assets']
            || $o['fix_widget_headings']
            || $o['add_default_og_image']
            || $o['remove_generator_meta']
            || $o['normalize_phone_links'];
    }

    /** @return array<string,mixed> */
    private function opts(): array {
        $saved = get_option(self::OPTION_KEY, []);
        return is_array($saved) ? wp_parse_args($saved, self::$defaults) : self::$defaults;
    }

    /* -----------------------------------------------------------------
     *  Output buffer — tek geçişte HTML üzerinde tüm dönüşümler
     * ----------------------------------------------------------------- */

    public function start_html_buffer(): void {
        if (is_feed() || is_robots() || (defined('REST_REQUEST') && REST_REQUEST)) {
            return;
        }
        ob_start([$this, 'process_html']);
    }

    public function flush_html_buffer(): void {
        // Bazı temalar kendi ob_start'ını başlatır; biz iç içe olabiliriz.
        // Sadece bizim açtığımız varsa boşaltılacak.
        while (ob_get_level() > 0) {
            $st = ob_get_status();
            if (!empty($st['name']) && strpos($st['name'], 'process_html') !== false) {
                ob_end_flush();
                break;
            }
            // başkasının buffer'ı; dokunma
            break;
        }
    }

    public function process_html(string $html): string {
        // İçerik HTML değilse (boş, kısa, JSON) bırak
        if (strlen($html) < 200 || stripos($html, '<html') === false) {
            return $html;
        }

        $o = $this->opts();

        if ($o['remove_generator_meta']) {
            $html = preg_replace(
                '~<meta\s+name=["\']generator["\'][^>]*>\s*~i',
                '',
                $html
            ) ?? $html;
        }

        if ($o['force_https_assets']) {
            $home_host = wp_parse_url(home_url(), PHP_URL_HOST);
            if ($home_host) {
                $html = preg_replace_callback(
                    '~(href|src|content|data-src)=(["\'])http://(' . preg_quote($home_host, '~') . '[^"\']*?)\2~i',
                    static function ($m) {
                        return $m[1] . '=' . $m[2] . 'https://' . $m[3] . $m[2];
                    },
                    $html
                ) ?? $html;
            }
        }

        if ($o['fix_widget_headings']) {
            $html = $this->promote_widget_headings($html);
        }

        if ($o['normalize_phone_links']) {
            $html = $this->normalize_phone_links($html);
        }

        if ($o['add_default_og_image'] && !empty($o['default_og_image'])) {
            $img = esc_url($o['default_og_image']);
            // Yoast/diğer eklenti zaten og:image koymadıysa enjekte et
            if (stripos($html, 'property="og:image"') === false
             && stripos($html, "property='og:image'") === false) {
                $inject = "<meta property=\"og:image\" content=\"{$img}\" data-caliskan=\"og-fallback\" />\n";
                $html = preg_replace('~</head>~i', $inject . '</head>', $html, 1) ?? $html;
            }
            if (stripos($html, 'name="twitter:image"') === false
             && stripos($html, "name='twitter:image'") === false) {
                $inject = "<meta name=\"twitter:image\" content=\"{$img}\" data-caliskan=\"twitter-fallback\" />\n";
                $html = preg_replace('~</head>~i', $inject . '</head>', $html, 1) ?? $html;
            }
        }

        return $html;
    }

    private function promote_widget_headings(string $html): string {
        // Rota theme: <div class="widgetHeading"><div class="inner"><div class="text">…</div></div></div>
        $patterns = [
            // 3 katmanlı
            '~<div(\s[^>]*)?class=("|\')(?:[^"\']*\s)?widgetHeading(?:\s[^"\']*)?\2([^>]*)>\s*<div\s+class=("|\')(?:[^"\']*\s)?inner(?:\s[^"\']*)?\4[^>]*>\s*<div\s+class=("|\')(?:[^"\']*\s)?text(?:\s[^"\']*)?\5[^>]*>(.*?)</div>\s*</div>\s*</div>~is'
                => '<h2 class="widgetHeading"><span class="inner"><span class="text">$6</span></span></h2>',
        ];
        foreach ($patterns as $rx => $repl) {
            $new = preg_replace($rx, $repl, $html);
            if ($new !== null) {
                $html = $new;
            }
        }
        return $html;
    }

    private function normalize_phone_links(string $html): string {
        $o = $this->opts();
        $intl = preg_replace('~[^0-9+]~', '', $o['phone_intl']) ?: '+905069762355';
        // tel: linklerini standardize et
        $html = preg_replace_callback(
            '~href=(["\'])tel:([^"\']+)\1~i',
            static function () use ($intl) {
                return 'href="tel:' . $intl . '"';
            },
            $html
        ) ?? $html;
        return $html;
    }

    /* -----------------------------------------------------------------
     *  Modül implementasyonları
     * ----------------------------------------------------------------- */

    public function restrict_rest_users(array $endpoints): array {
        if (isset($endpoints['/wp/v2/users'])) {
            unset($endpoints['/wp/v2/users']);
        }
        if (isset($endpoints['/wp/v2/users/(?P<id>[\d]+)'])) {
            unset($endpoints['/wp/v2/users/(?P<id>[\d]+)']);
        }
        return $endpoints;
    }

    public function block_unauthed_user_routes($result) {
        if (!empty($result)) {
            return $result;
        }
        if (!isset($_SERVER['REQUEST_URI'])) {
            return $result;
        }
        $uri = wp_unslash($_SERVER['REQUEST_URI']);
        if (preg_match('~/wp-json/wp/v2/users(\b|/|\?)~', $uri) && !is_user_logged_in()) {
            return new WP_Error(
                'rest_user_cannot_view',
                __('Sorry, you are not allowed to list users.', 'caliskan-seo'),
                ['status' => 401]
            );
        }
        return $result;
    }

    public function dequeue_jquery_migrate($scripts): void {
        if (!is_admin() && !empty($scripts->registered['jquery'])) {
            $deps = $scripts->registered['jquery']->deps;
            $scripts->registered['jquery']->deps = array_values(array_diff($deps, ['jquery-migrate']));
        }
    }

    public function dequeue_html5shiv(): void {
        wp_dequeue_script('html5shiv');
        wp_deregister_script('html5shiv');
    }

    public function output_attorney_jsonld(): void {
        if (!is_front_page() && !is_home() && !is_page('iletisim') && !is_page('hakkimizda-2') && !is_page('hakkimizda')) {
            // Tüm sayfalarda da çıkmak istenirse aşağıdaki return kaldırılabilir
            // Ama Yoast graph zenginliğiyle çakışmamak için anasayfa + temel kurumsal sayfalarla sınırlı tutuyoruz.
            // İsteyen filtreyle değiştirebilir:
            if (!apply_filters('caliskan_seo_attorney_jsonld_everywhere', false)) {
                return;
            }
        }

        $o     = $this->opts();
        $home  = trailingslashit(home_url());
        $sames = array_values(array_filter(array_map('trim', explode("\n", (string) $o['sameas']))));
        $areas = array_values(array_filter(array_map('trim', explode("\n", (string) $o['areas_served']))));
        $knows = array_values(array_filter(array_map('trim', explode("\n", (string) $o['knows_about']))));

        $data = [
            '@context'      => 'https://schema.org',
            '@type'         => 'Attorney',
            '@id'           => $home . '#attorney',
            'name'          => $o['attorney_name'],
            'alternateName' => $o['org_name'],
            'url'           => $home,
            'telephone'     => $o['phone_display'],
            'email'         => $o['email'],
            'address'       => [
                '@type'           => 'PostalAddress',
                'streetAddress'   => $o['street'],
                'addressLocality' => $o['city'],
                'addressRegion'   => $o['region'],
                'postalCode'      => $o['postal'],
                'addressCountry'  => $o['country'],
            ],
        ];

        if (!empty($o['image_url'])) {
            $data['image'] = $o['image_url'];
        }
        if (!empty($o['latitude']) && !empty($o['longitude'])) {
            $data['geo'] = [
                '@type'     => 'GeoCoordinates',
                'latitude'  => $o['latitude'],
                'longitude' => $o['longitude'],
            ];
        }
        if (!empty($o['days']) && !empty($o['opens']) && !empty($o['closes'])) {
            $data['openingHoursSpecification'] = [[
                '@type'     => 'OpeningHoursSpecification',
                'dayOfWeek' => $this->expand_days((string) $o['days']),
                'opens'     => $o['opens'],
                'closes'    => $o['closes'],
            ]];
        }
        if ($areas) {
            $data['areaServed'] = array_map(static function ($a) {
                return ['@type' => 'AdministrativeArea', 'name' => $a];
            }, $areas);
        }
        if ($knows) {
            $data['knowsAbout'] = $knows;
        }
        if ($sames) {
            $data['sameAs'] = $sames;
        }

        $data = apply_filters('caliskan_seo_attorney_jsonld', $data);

        echo "\n<script type=\"application/ld+json\" data-caliskan=\"attorney\">",
             wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
             "</script>\n";
    }

    /** @return string[] */
    private function expand_days(string $code): array {
        $map = [
            'Mo-Fr' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            'Mo-Sa' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            'Mo-Su' => ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        ];
        return $map[$code] ?? $map['Mo-Fr'];
    }

    public function send_security_headers(): void {
        if (is_admin() || headers_sent()) {
            return;
        }
        header('X-Content-Type-Options: nosniff');
        header('Referrer-Policy: strict-origin-when-cross-origin');
        header('Permissions-Policy: interest-cohort=()');
        if (is_ssl()) {
            // 1 yıl. preload eklenmiyor — önce subdomainlerin tamamı HTTPS olduğundan emin olunmalı.
            header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
        }
    }

    public function tbb_admin_notices(): void {
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen || $screen->base !== 'post') {
            return;
        }
        global $post;
        if (!$post instanceof WP_Post) {
            return;
        }
        $haystack = $post->post_title . ' ' . $post->post_content;
        $patterns = [
            '~ücretsiz\s+(danışma|görüşme|hukuki\s+yardım)~iu' => '"ücretsiz danışmanlık/görüşme" — Reklam Yasağı Yön. m.7-8 kapsamında değerlendirilebilir.',
            '~beraat\s*odaklı|beraat\s+garantisi|kazandır(ır|acağ)~iu' => 'Sonuç vaadi (beraat/kazanma garantisi) — Reklam Yasağı Yön. m.5/9.',
            '~en\s+iyi\s+avukat|en\s+güçlü\s+savunma|uzman\s+avukat~iu' => 'Üstünlük/uzmanlık iması — Reklam Yasağı Yön. m.6.',
            '~(0\s*5\d{2}\s*\d{3}\s*\d{2}\s*\d{2})~u' => 'Yazı içeriğinde telefon numarası — yalnızca künye/iletişim sayfasında olmalı.',
        ];
        $hits = [];
        foreach ($patterns as $rx => $label) {
            if (preg_match_all($rx, $haystack, $m)) {
                $hits[] = $label . ' (' . count($m[0]) . ' eşleşme)';
            }
        }
        if (!$hits) {
            return;
        }
        echo '<div class="notice notice-warning"><p><strong>Çalışkan Hukuk SEO — TBB Reklam Yasağı uyarısı:</strong></p><ul style="list-style:disc;margin-left:20px">';
        foreach ($hits as $h) {
            echo '<li>' . esc_html($h) . '</li>';
        }
        echo '</ul><p><em>Bu uyarı bir hukuki görüş değildir; bağlı olduğunuz baronun reklam kurulu görüşü esastır.</em></p></div>';
    }

    /* -----------------------------------------------------------------
     *  Admin sayfası
     * ----------------------------------------------------------------- */

    public function add_admin_menu(): void {
        add_options_page(
            'Çalışkan Hukuk SEO',
            'Çalışkan SEO',
            'manage_options',
            self::SLUG,
            [$this, 'render_admin']
        );
    }

    public function plugin_action_links(array $links): array {
        $url = admin_url('options-general.php?page=' . self::SLUG);
        array_unshift($links, '<a href="' . esc_url($url) . '">' . esc_html__('Ayarlar', 'caliskan-seo') . '</a>');
        return $links;
    }

    public function register_settings(): void {
        register_setting('caliskan_seo_group', self::OPTION_KEY, [
            'type'              => 'array',
            'sanitize_callback' => [$this, 'sanitize_options'],
            'default'           => self::$defaults,
        ]);
    }

    /** @param mixed $input */
    public function sanitize_options($input): array {
        if (!is_array($input)) {
            return self::$defaults;
        }
        $out = [];
        foreach (self::$defaults as $k => $default) {
            if (is_int($default)) {
                $out[$k] = !empty($input[$k]) ? 1 : 0;
                continue;
            }
            $val = isset($input[$k]) ? wp_unslash((string) $input[$k]) : '';
            if (in_array($k, ['image_url', 'default_og_image'], true)) {
                $out[$k] = esc_url_raw($val);
            } elseif (in_array($k, ['areas_served', 'knows_about', 'sameas'], true)) {
                $out[$k] = sanitize_textarea_field($val);
            } else {
                $out[$k] = sanitize_text_field($val);
            }
        }
        return $out;
    }

    public function render_admin(): void {
        if (!current_user_can('manage_options')) {
            return;
        }
        $o = $this->opts();
        $modules = [
            'remove_generator_meta'  => ['Generator meta sızıntısını kaldır', '<meta name="generator"> etiketlerini siler (Slider Revolution sürüm sızıntısı dahil).'],
            'remove_xmlrpc'          => ['XML-RPC ve Pingback\'i kapat', 'xmlrpc.php saldırı yüzeyini kaldırır, RSD/WLW link\'lerini head\'den siler.'],
            'harden_rest_users'      => ['REST kullanıcı listesini gizle', '/wp-json/wp/v2/users endpoint\'ini anonim erişime kapatır.'],
            'remove_emoji'           => ['WP Emoji loader\'ı kaldır', '~10 KB JS + 1 HTTP request kazandırır.'],
            'remove_jquery_migrate'  => ['jQuery Migrate\'i frontend\'den kaldır', 'Eski jQuery API uyumluluğu için yüklenir; modern temalarda gerekmez. Tema testi öner.'],
            'remove_html5shiv'       => ['html5shiv\'i kaldır', 'IE&lt;9 desteği. 2026\'da gereksiz.'],
            'add_attorney_jsonld'    => ['Attorney/LegalService JSON-LD ekle', 'Schema.org Attorney + PostalAddress + areaServed + openingHours enjekte eder. (Filter: caliskan_seo_attorney_jsonld_everywhere)'],
            'add_default_og_image'   => ['og:image / twitter:image fallback', 'Yoast koymadıysa belirlediğin URL\'i sosyal kart görseli olarak kullanır.'],
            'force_https_assets'     => ['HTML\'deki http://&lt;kendi-host&gt; URL\'lerini https\'e çevir', 'Mixed-content riskini azaltır.'],
            'security_headers'       => ['Güvenlik başlıkları gönder', 'HSTS (1 yıl), X-Content-Type-Options, Referrer-Policy, Permissions-Policy.'],
            'fix_widget_headings'    => ['<div class="widgetHeading"> bloklarını &lt;h2&gt;\'ye yükselt', 'Rota theme widget başlıklarını semantik H2\'ye çevirir.'],
            'normalize_phone_links'  => ['tel: linklerini tek formata getir', 'Tüm tel: linkleri "phone_intl" alanındaki E.164 formata yazılır.'],
            'tbb_admin_warnings'     => ['Yazı düzenleme ekranında TBB Reklam Yasağı uyarısı', '"ücretsiz danışma", "beraat odaklı", "en iyi avukat" gibi ifadelerde uyarı çıkarır.'],
        ];
        $fields = [
            'attorney_name'    => ['Avukat adı', 'text'],
            'org_name'         => ['Hukuk bürosu adı', 'text'],
            'phone_intl'       => ['Telefon (E.164, ör. +905069762355)', 'text'],
            'phone_display'    => ['Telefon (görüntü, ör. +90 506 976 23 55)', 'text'],
            'email'            => ['E-posta', 'text'],
            'street'           => ['Adres (sokak)', 'text'],
            'city'             => ['İlçe', 'text'],
            'region'           => ['İl', 'text'],
            'postal'           => ['Posta kodu', 'text'],
            'country'          => ['Ülke kodu (TR)', 'text'],
            'latitude'         => ['Enlem', 'text'],
            'longitude'        => ['Boylam', 'text'],
            'opens'            => ['Açılış (HH:MM)', 'text'],
            'closes'           => ['Kapanış (HH:MM)', 'text'],
            'days'             => ['Çalışma günleri (Mo-Fr / Mo-Sa / Mo-Su)', 'text'],
            'image_url'        => ['Avukat fotoğrafı URL (Schema image)', 'text'],
            'default_og_image' => ['Default og:image URL (1200×630)', 'text'],
            'areas_served'     => ['Hizmet bölgeleri (her satıra bir)', 'textarea'],
            'knows_about'      => ['Uzmanlık alanları (her satıra bir)', 'textarea'],
            'sameas'           => ['Sosyal medya / sameAs URL\'leri (her satıra bir)', 'textarea'],
        ];
        ?>
        <div class="wrap">
            <h1>Çalışkan Hukuk — SEO Tweaks <small style="font-weight:400">v<?php echo esc_html(self::VERSION); ?></small></h1>
            <p><code>burakhancaliskan.av.tr</code> teknik SEO denetiminden çıkan düzeltmeleri tek tıkla uygular. Yoast SEO ile uyumludur, onun yerine geçmez.</p>
            <form method="post" action="options.php">
                <?php settings_fields('caliskan_seo_group'); ?>

                <h2>Modüller</h2>
                <table class="form-table" role="presentation">
                    <tbody>
                    <?php foreach ($modules as $key => $mod): ?>
                        <tr>
                            <th scope="row" style="vertical-align:top">
                                <label>
                                    <input type="checkbox"
                                           name="<?php echo esc_attr(self::OPTION_KEY . '[' . $key . ']'); ?>"
                                           value="1" <?php checked(!empty($o[$key])); ?>/>
                                    <?php echo esc_html($mod[0]); ?>
                                </label>
                            </th>
                            <td><?php echo wp_kses_post($mod[1]); ?></td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>

                <h2>Ofis ve Avukat Bilgileri (JSON-LD)</h2>
                <p class="description">Attorney/LegalService schema bu alanlardan üretilir.</p>
                <table class="form-table" role="presentation">
                    <tbody>
                    <?php foreach ($fields as $key => $f):
                        $val = (string) ($o[$key] ?? ''); ?>
                        <tr>
                            <th scope="row"><label for="caliskan_<?php echo esc_attr($key); ?>"><?php echo esc_html($f[0]); ?></label></th>
                            <td>
                                <?php if ($f[1] === 'textarea'): ?>
                                    <textarea id="caliskan_<?php echo esc_attr($key); ?>"
                                              name="<?php echo esc_attr(self::OPTION_KEY . '[' . $key . ']'); ?>"
                                              rows="5" cols="60" class="large-text code"><?php echo esc_textarea($val); ?></textarea>
                                <?php else: ?>
                                    <input type="text" id="caliskan_<?php echo esc_attr($key); ?>"
                                           class="regular-text"
                                           name="<?php echo esc_attr(self::OPTION_KEY . '[' . $key . ']'); ?>"
                                           value="<?php echo esc_attr($val); ?>"/>
                                <?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    </tbody>
                </table>

                <?php submit_button(); ?>
            </form>

            <hr/>
            <h2>Doğrulama</h2>
            <ul>
                <li><a target="_blank" rel="noopener" href="https://validator.schema.org/#url=<?php echo rawurlencode(home_url('/')); ?>">Schema Markup Validator</a></li>
                <li><a target="_blank" rel="noopener" href="https://search.google.com/test/rich-results?url=<?php echo rawurlencode(home_url('/')); ?>">Google Rich Results Test</a></li>
                <li><a target="_blank" rel="noopener" href="https://pagespeed.web.dev/analysis?url=<?php echo rawurlencode(home_url('/')); ?>&form_factor=mobile">PageSpeed Insights</a></li>
            </ul>
        </div>
        <?php
    }
}

add_action('plugins_loaded', static function () {
    Caliskan_SEO_Tweaks::instance()->boot();
});
