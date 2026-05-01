# ⚡ Tesla Light Show Maker

Web tabanlı, custom Tesla light show üretici. Şarkı yükle → ritme göre otomatik
beat algılansın → seçtiğin pattern stiliyle 30 kanallı (outline / far / stop /
sinyal / closure) bir gösteri üretsin → Tesla aracında oynatabileceğin
`lightshow.fseq` + `lightshow.wav` dosyalarını indir.

> Hiçbir şey sunucuya gitmez — analiz ve export tamamen tarayıcıda olur.

## Hızlı Kullanım

1. `index.html`'e çift tıkla — uygulama tarayıcıda açılır.
2. **🎵 Şarkı** ile mp3/wav/m4a/ogg yükle.
3. Sağdaki kutudan **Stil** seç (Strobe, Chase, Wave, Random, Beat Drop,
   Symmetric) ve **Hassasiyet / Beat süresi** ayarlarını yap.
4. **✨ Otomatik Üret**'e bas — şarkıdaki beat'ler analiz edilip seçtiğin
   pattern ile 50 ms grid'e işlenir.
5. İstersen zaman çizelgesinde hücreleri tıkla / sürükle ile elle düzenle
   (Shift+sürükle = sil). Tesla SVG'sinde ışığa tıklamak da o anki frame'de
   o kanalı toggle eder.
6. **▶** ile çal — Tesla görseli ışıkları gerçek zamanlı yansıtır.
7. **⤓ .fseq** ve **⤓ .wav** ile dosyaları indir. Aynı isim altında bir USB
   sürücüye `LightShow/` klasörüne koy ve aracında oynat.

## Özellikler

- **Beat algılama:** Web Audio API ile spektral enerji bazlı onset detection +
  std-bazlı uyarlanır eşik. BPM tahmini medyan inter-beat aralıktan çıkarılır.
- **6 hazır pattern:** Strobe / Chase / Wave / Random / Beat Drop / Symmetric.
- **Tesla SVG önizleme:** Üstten görünüm, 30 kanal — her grup kendi rengi ve
  glow efekti ile. Çal ve canlı ışıkları gör.
- **50 ms zaman çizelgesi:** xLights-tarzı piano roll, tıkla/sürükle ile elle
  düzenle, zoom (2–40 px/frame), waveform + beat işaretleyici.
- **Tesla uyumlu .fseq export:** v2.0, uncompressed, 50 ms step, 30 kanal,
  Tesla "Light Show" çoğaltıcı ile uyumlu (xLights ile aynı ham format).
- **WAV export:** Yüklediğin sesi 16-bit PCM olarak çıkarır (mp3 → wav
  dönüştürme dahil), `lightshow.wav` adıyla.
- **Proje JSON:** `*.tlsm.json` ile aç/kaydet — beat'ler, kanal verisi.
- **Klavye:** `Space` çal/duraklat · `G` otomatik üret.

## Dosyalar

- `index.html` — UI iskeleti, Tesla SVG inline.
- `styles.css` — koyu tema, Tesla kırmızısı + neon mavi outline glow.
- `app.js` — tüm mantık (Web Audio, beat detect, pattern üretici, .fseq/.wav
  encoder, canvas timeline, SVG senkron). Bağımlılık yok.

## Tesla'ya Yükleme (kısa hatırlatma)

1. USB sürücüde `Boombox` veya `LightShow` klasörü oluştur.
2. `lightshow.fseq` ve `lightshow.wav` dosyalarını koy (aynı isim).
3. USB'i araca tak, **Toybox → Light Show** menüsünden seç.
4. Aracı park konumunda, kapılar kapalı, El freni çekili olmalı.

## Bilinen Sınırlar

- Tesla şu an Light Show için bazı firmware sürümlerinde maksimum süre
  sınırı (~5 dk) ve dosya boyutu sınırı uygular. 3 dakika altında kalmak
  güvenli.
- Closure kanalları (kapı/pencere/bagaj) "ramp" değer alır — bu uygulamada
  on/off (0/255) gönderilir, yumuşak açılma istersen `.fseq`'i xLights'ta aç
  ve değerleri elden geçir.
