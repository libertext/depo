/* Av. Yalın Anlatır · Script Studio
   Vanilla JS, no deps. Data lives in localStorage. */

const STORAGE_KEY  = 'yalin-anlatir.archive.v1';
const DRAFT_KEY    = 'yalin-anlatir.draft.v1';
const SETTINGS_KEY = 'yalin-anlatir.settings.v1';
const RESULTS_KEY  = 'yalin-anlatir.results.v1';
const SEO_STORAGE_KEY = 'seo-writer.articles.v1';
const SEO_DRAFT_KEY   = 'seo-writer.draft.v1';

const EMOJIS = ['⚖️','🚓','👮','🧑‍⚖️','📜','📝','🔒','🔓','💼','🏛️','👤','🚗','🚨','⏱️','📞','💰','🏠','👨‍👩‍👧','💍','📄','🚫','✅','❗','❓','💡','🎯'];

/* ---------------- Storage ---------------- */
const db = {
  list() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  },
  save(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); },
  add(item) {
    const items = db.list();
    items.unshift(item);
    db.save(items);
  },
  update(id, patch) {
    const items = db.list().map(x => x.id === id ? { ...x, ...patch, updatedAt: Date.now() } : x);
    db.save(items);
  },
  remove(id) {
    db.save(db.list().filter(x => x.id !== id));
  },
  find(id) { return db.list().find(x => x.id === id); }
};

/* ---------------- Helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const newId = () => 'y' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const fmtDate = (ts) => {
  const d = new Date(ts);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
       + ' · ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

const countWords = (s) => (s.trim().match(/\S+/g) || []).length;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-show'), 1800);
}

function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); resolve(); }
    catch (e) { reject(e); }
    finally { document.body.removeChild(ta); }
  });
}

/* ---------------- Template assembly ---------------- */
function buildOutput({ topic, content, reels, tags }) {
  const parts = [];
  parts.push(`Konu: ${topic || ''}`.trimEnd());
  parts.push('');
  parts.push(`İçerik: ${content || ''}`.trimEnd());
  parts.push('');
  parts.push('🎬 TikTok–Reels Açıklaması (emojili):');
  parts.push('');
  parts.push((reels || '').trimEnd());
  parts.push('');
  parts.push((tags || '').trim());
  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
}

/* "Konu + içerik" — etiketsiz, sadece başlık ve içerik metni */
function buildTopicContent({ topic, content }) {
  return [(topic || '').trim(), '', (content || '').trim()]
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* "Reels açıklaması" — etiketsiz, sadece emojili blok + hashtag */
function buildReelsCaption({ reels, tags }) {
  return [(reels || '').trim(), '', (tags || '').trim()]
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ---------------- Editor state ---------------- */
const editor = {
  els: {},
  editingId: null,

  init() {
    this.els = {
      topic: $('#f-topic'),
      content: $('#f-content'),
      reels: $('#f-reels'),
      tags: $('#f-tags'),
      preview: $('#preview'),
      cTopic: $('#c-topic'),
      cWords: $('#c-words'),
      cRead: $('#c-read'),
      cBadge: $('#c-badge'),
      saveHint: $('#save-hint'),
    };

    // emoji buttons
    const row = $('#emoji-row');
    EMOJIS.forEach(e => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = e;
      b.title = 'Ekle: ' + e;
      b.addEventListener('click', () => this.insertAtCursor(this.els.reels, e + ' '));
      row.appendChild(b);
    });

    // hashtag chips
    $$('.chip[data-tag]').forEach(c => {
      c.addEventListener('click', () => {
        const cur = this.els.tags.value.trim();
        const tag = c.dataset.tag;
        if (cur.includes(tag)) return;
        this.els.tags.value = cur ? cur + ' ' + tag : tag;
        this.render();
        this.saveDraft();
      });
    });

    // input listeners
    ['topic','content','reels','tags'].forEach(k => {
      this.els[k].addEventListener('input', () => { this.render(); this.saveDraft(); });
    });

    // buttons
    $('#btn-copy').addEventListener('click', () => this.copy());
    $('#btn-copy-tc').addEventListener('click', () => this.copyTopicContent());
    $('#btn-copy-reels').addEventListener('click', () => this.copyReels());
    $('#btn-save').addEventListener('click', () => this.save());
    $('#btn-clear').addEventListener('click', () => this.clear());
    $('#btn-sample').addEventListener('click', () => this.loadSample());
    $('#btn-gen').addEventListener('click', () => this.generate());

    // keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!$('#view-editor').classList.contains('is-active')) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); this.save(); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); this.copy(); }
    });

    this.loadDraft();
    this.render();
  },

  insertAtCursor(ta, text) {
    const s = ta.selectionStart ?? ta.value.length;
    const e = ta.selectionEnd   ?? ta.value.length;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + text.length;
    this.render();
    this.saveDraft();
  },

  getData() {
    return {
      topic:   this.els.topic.value.trim(),
      content: this.els.content.value.trim(),
      reels:   this.els.reels.value.replace(/\s+$/,''),
      tags:    this.els.tags.value.trim(),
    };
  },

  setData(d = {}) {
    this.els.topic.value   = d.topic   || '';
    this.els.content.value = d.content || '';
    this.els.reels.value   = d.reels   || '';
    this.els.tags.value    = d.tags    || '';
    this.render();
  },

  render() {
    const d = this.getData();
    this.els.preview.textContent = buildOutput(d);

    // counters
    this.els.cTopic.textContent = d.topic.length;

    const words = countWords(d.content);
    const readSec = Math.round(words / 2.6); // ~2.6 words/sec TR speech
    this.els.cWords.textContent = words;
    this.els.cRead.textContent  = readSec + ' sn';

    const badge = this.els.cBadge;
    badge.classList.remove('ok','warn','bad');
    if (words === 0) { badge.textContent = '—'; }
    else if (readSec >= 20 && readSec <= 30) { badge.textContent = 'İdeal'; badge.classList.add('ok'); }
    else if (readSec >= 15 && readSec <= 35) { badge.textContent = 'Yakın';  badge.classList.add('warn'); }
    else if (readSec < 15)                   { badge.textContent = 'Kısa';  badge.classList.add('bad'); }
    else                                     { badge.textContent = 'Uzun';  badge.classList.add('bad'); }

    this.els.saveHint.textContent = this.editingId ? '✏️ Mevcut kayıt düzenleniyor.' : '';
  },

  saveDraft() {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...this.getData(), editingId: this.editingId }));
  },

  loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      this.editingId = d.editingId || null;
      this.setData(d);
    } catch {}
  },

  async copy() {
    const d = this.getData();
    if (!d.topic && !d.content) { toast('Önce içerik gir'); return; }
    try {
      await copyText(buildOutput(d));
      toast('📋 Tümü kopyalandı');
    } catch { toast('Kopyalanamadı'); }
  },

  async copyTopicContent() {
    const d = this.getData();
    if (!d.topic && !d.content) { toast('Konu/içerik boş'); return; }
    try {
      await copyText(buildTopicContent(d));
      toast('📝 Konu + İçerik kopyalandı');
    } catch { toast('Kopyalanamadı'); }
  },

  async copyReels() {
    const d = this.getData();
    if (!d.reels && !d.tags) { toast('Reels/hashtag boş'); return; }
    try {
      await copyText(buildReelsCaption(d));
      toast('🎬 Reels açıklaması kopyalandı');
    } catch { toast('Kopyalanamadı'); }
  },

  save() {
    const d = this.getData();
    if (!d.topic || !d.content) { toast('Konu ve içerik gerekli'); return; }
    const now = Date.now();
    if (this.editingId) {
      db.update(this.editingId, d);
      toast('💾 Güncellendi');
    } else {
      db.add({ id: newId(), ...d, createdAt: now, updatedAt: now });
      toast('💾 Arşive kaydedildi');
    }
    this.editingId = null;
    archive.refresh();
    this.saveDraft();
    this.render();
  },

  clear() {
    if (this.els.topic.value || this.els.content.value || this.els.reels.value || this.els.tags.value) {
      if (!confirm('Tüm alanlar temizlensin mi?')) return;
    }
    this.editingId = null;
    this.setData({});
    this.saveDraft();
    toast('🧹 Temizlendi');
  },

  async generate() {
    const topic = this.els.topic.value.trim();
    if (!topic) {
      toast('Önce bir konu başlığı yaz');
      this.els.topic.focus();
      return;
    }
    const s = settings.load();
    if (!s.apiKey) {
      toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir');
      settings.open();
      return;
    }
    const btn = $('#btn-gen');
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = '⏳ Üretiliyor';
    try {
      const out = await ai.generate(topic, s);
      this.els.content.value = out.content || '';
      this.els.reels.value   = out.reels   || '';
      this.els.tags.value    = out.tags    || '';
      this.render();
      this.saveDraft();
      toast('⚡ Üretildi');
    } catch (e) {
      console.error(e);
      toast('Üretim başarısız: ' + (e.message || 'bilinmeyen hata'));
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.textContent = origLabel;
    }
  },

  loadSample() {
    this.editingId = null;
    this.setData({
      topic: 'Üst araması ile araç araması arasındaki fark',
      content: 'Üst araması, kişinin üzerindeki eşyaların kontrolünü kapsar; araç araması ise taşıtın tamamını içerir. Araç araması genellikle daha geniş kapsamlıdır ve daha sıkı usul şartlarına tabidir. Her iki aramada da hukuka uygunluk (yetki, sebep, usul) denetlenir. Kısacası: Kapsam farklı, kurallar daha da önemlidir.',
      reels: '🚓 Üst mü araç mı?\n\n👤 Üst: kişi\n🚗 Araç: tüm taşıt\n⚖️ Araç araması daha sıkı kurallı',
      tags: '#arama #hukuk #cezahukuku #yalınanlatır #avukat',
    });
    this.saveDraft();
  },

  editFrom(item) {
    this.editingId = item.id;
    this.setData(item);
    this.saveDraft();
    tabs.show('editor');
  },
};

/* ---------------- Archive ---------------- */
const archive = {
  init() {
    $('#a-search').addEventListener('input', () => this.refresh());
    $('#btn-export').addEventListener('click', () => this.exportAll());
    $('#btn-import').addEventListener('click', () => $('#file-import').click());
    $('#file-import').addEventListener('change', (e) => this.importFile(e));
    this.refresh();
  },

  refresh() {
    const q = $('#a-search').value.trim().toLowerCase();
    const items = db.list().filter(it => {
      if (!q) return true;
      return (it.topic + ' ' + it.content + ' ' + (it.tags || '') + ' ' + (it.reels || ''))
        .toLowerCase().includes(q);
    });

    $('#archiveCount').textContent = db.list().length;

    const list = $('#archive-list');
    list.innerHTML = '';
    const empty = $('#archive-empty');

    if (items.length === 0) {
      empty.hidden = false;
      if (q) {
        empty.querySelector('h3').textContent = 'Sonuç yok';
        empty.querySelector('p').textContent  = `"${q}" için arşivde kayıt bulunamadı.`;
      } else {
        empty.querySelector('h3').textContent = 'Arşiv boş';
        empty.querySelector('p').innerHTML    = 'Editörde bir video metni oluşturup <b>Arşive Kaydet</b>\'e bas.';
      }
      return;
    }
    empty.hidden = true;

    const tpl = $('#archive-card-tpl');
    items.forEach(it => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.a-title').textContent = it.topic;
      node.querySelector('.a-date').textContent  = fmtDate(it.updatedAt || it.createdAt);
      node.querySelector('.a-content').textContent = it.content;
      node.querySelector('.a-tags').textContent = it.tags || '';

      node.querySelector('.a-copy-tc').addEventListener('click', async () => {
        try { await copyText(buildTopicContent(it)); toast('📝 Konu + İçerik kopyalandı'); }
        catch { toast('Kopyalanamadı'); }
      });
      node.querySelector('.a-copy-reels').addEventListener('click', async () => {
        try { await copyText(buildReelsCaption(it)); toast('🎬 Reels kopyalandı'); }
        catch { toast('Kopyalanamadı'); }
      });
      node.querySelector('.a-copy').addEventListener('click', async () => {
        try { await copyText(buildOutput(it)); toast('📋 Tümü kopyalandı'); }
        catch { toast('Kopyalanamadı'); }
      });
      node.querySelector('.a-edit').addEventListener('click', () => editor.editFrom(it));
      node.querySelector('.a-del').addEventListener('click', () => {
        if (!confirm(`"${it.topic}" silinsin mi?`)) return;
        db.remove(it.id);
        toast('🗑️ Silindi');
        this.refresh();
      });
      list.appendChild(node);
    });
  },

  exportAll() {
    const items = db.list();
    if (items.length === 0) { toast('Arşiv boş'); return; }
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const stamp = new Date().toISOString().slice(0,10);
    a.download = `yalin-anlatir-arsiv-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('⤓ Dışa aktarıldı');
  },

  importFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data)) throw new Error('bad');
        const existing = db.list();
        const byId = new Map(existing.map(x => [x.id, x]));
        let added = 0;
        data.forEach(it => {
          if (!it.topic || !it.content) return;
          const id = it.id || newId();
          if (!byId.has(id)) {
            existing.push({
              id,
              topic: String(it.topic),
              content: String(it.content),
              reels: String(it.reels || ''),
              tags: String(it.tags || ''),
              createdAt: it.createdAt || Date.now(),
              updatedAt: it.updatedAt || Date.now(),
            });
            added++;
          }
        });
        existing.sort((a,b) => (b.updatedAt||0) - (a.updatedAt||0));
        db.save(existing);
        this.refresh();
        toast(`⤒ ${added} kayıt içe aktarıldı`);
      } catch {
        toast('Geçersiz dosya');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  },
};

/* ---------------- Settings ---------------- */
const settings = {
  defaults: { apiKey: '', model: 'claude-opus-4-7' },

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...this.defaults, ...d };
    } catch { return { ...this.defaults }; }
  },

  saveValues(v) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(v)); },

  modal: null,

  init() {
    this.modal = $('#modal-settings');
    $('#btn-settings').addEventListener('click', () => this.open());
    this.modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (!this.modal.hidden && e.key === 'Escape') this.close();
    });
    $('#s-save').addEventListener('click', () => {
      const v = {
        apiKey: $('#s-api-key').value.trim(),
        model:  $('#s-model').value,
      };
      this.saveValues(v);
      this.close();
      toast(v.apiKey ? '⚙️ Ayarlar kaydedildi' : '⚙️ Anahtar boş — üret kullanılmaz');
    });
  },

  open() {
    const s = this.load();
    $('#s-api-key').value = s.apiKey;
    $('#s-model').value   = s.model;
    this.modal.hidden = false;
    this.modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#s-api-key').focus(), 30);
  },

  close() {
    this.modal.hidden = true;
    this.modal.setAttribute('aria-hidden', 'true');
  },
};

/* ---------------- AI (Claude API) ---------------- */
const AI_SYSTEM_PROMPT = `Sen "Av. Yalın Anlatır" karakteri için TikTok / Instagram Reels / YouTube Shorts video metinleri hazırlayan uzman bir Türk hukuk içerik editörüsün.

KARAKTER SESİ:
- Sade, net Türkçe. Hukuki terim kullanınca hemen yanında günlük karşılığını ver.
- Tarafsız, didaktik, güven veren. Yasal tavsiye değil; bilgilendirme.
- Kısa cümleler. 20-30 saniyelik okuma (yaklaşık 55-80 kelime).

GÖREV: Kullanıcı sana bir konu başlığı verecek. Tam olarak "build_script" aracını çağırarak üç alan döndür. Başka metin üretme.

ALAN 1 — content (İçerik paragrafı):
- 3-5 kısa cümle, 55-80 kelime arası.
- 1. cümle: kavramın özü / birinci kavramın tanımı.
- 2. cümle: ikinci kavram veya karşıt durum.
- 3. cümle: usul / şart / hukuka uygunluk vurgusu (yetki, sebep, delil, süre, karar mercii vb.).
- Son cümle MUTLAKA "Kısacası:" ile başlasın ve tek cümlelik net, akılda kalıcı özet olsun.
- "Her somut olay farklıdır", "profesyonel destek alın" gibi uyarıları SIKIŞTIRMA.

ALAN 2 — reels (TikTok-Reels açıklaması, emojili):
- İlk satır: çarpıcı soru veya slogan, başında tema emojisi (⚖️ 🚓 📜 🔒 👮 🧑‍⚖️ 📝 💼 🏛️ vb.).
- Sonra boş satır.
- 3-4 satır: her biri EMOJİ + 2-5 kelimelik kilit ifade. Maddeleme işareti (-, *) KULLANMA.
- Sonra boş satır.
- Son satır: mesajın özeti, tercihen ⚖️ ile.
- Satırları gerçek satır sonu (\\n) ile ayır.

ALAN 3 — tags (Hashtag satırı):
- Boşlukla ayrılmış 5-7 hashtag.
- #hukuk #yalınanlatır #avukat MUTLAKA yer alsın.
- Konuya özgü en az 1-2 hashtag ekle: #arama, #cezahukuku, #tutuklama, #borçlar, #ailehukuku, #iskazasi, #kvkk, #işhukuku, #kira, #miras vb.

HUKUKİ DOĞRULUK:
- Türkiye Cumhuriyeti mevzuatına göre yaz (CMK, TCK, TMK, TBK, İK vb.).
- Emin olmadığın madde numarası, süre veya ceza miktarı UYDURMA. Genel hukuki ilkeyle yetin.
- Tavsiye yönlendirmesi yapma; bilgilendirme tonunda kal.

Her çıktı aynı yapısal tutarlılıkta olsun. Sadece aracı çağır, önsöz veya açıklama ekleme.`;

const IDEAS_SYSTEM_PROMPT = `Sen "Av. Yalın Anlatır" karakteri için TikTok / Reels / Shorts video konu başlıkları öneren Türk hukuk editörüsün.

GÖREV: Kullanıcı bir hukuk alanı verecek. O alanda "suggest_topics" aracını çağırarak 6-8 çarpıcı konu başlığı döndür.

BAŞLIK KURALLARI:
- Her başlık 4-10 kelime arası, sade Türkçe.
- Günlük yaşamda merak edilen, geniş kitleyi ilgilendiren konular seç.
- Tercihen iki kavramı karşılaştır ("X ile Y arasındaki fark") veya net soru sor ("X ne demek?", "X nasıl ispatlanır?").
- Her başlık farklı bir noktayı işlesin; tekrar etme.
- "Hukukta", "Türk hukukunda" gibi gereksiz önek kullanma.
- Karışık alan seçildiyse farklı dallardan (aile, ceza, iş, tazminat, kira, miras, tüketici) dengeli dağılım yap.

HUKUKİ DOĞRULUK:
- Türkiye Cumhuriyeti mevzuatına uygun olsun (CMK, TCK, TMK, TBK, İK vb.).
- Uydurma kurum, süreç veya kavram YAZMA.

Sadece aracı çağır, başka metin üretme.`;

const ai = {
  async _call({ system, tool, userMessage, s, maxTokens = 1024 }) {
    const body = {
      model: s.model || 'claude-opus-4-7',
      max_tokens: maxTokens,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content: userMessage }],
    };

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const err = await res.json();
        detail = err?.error?.message || JSON.stringify(err);
      } catch {
        detail = await res.text().catch(() => '');
      }
      throw new Error(`${res.status} ${(detail || '').slice(0, 160)}`);
    }

    const data = await res.json();
    const block = (data.content || []).find(b => b.type === 'tool_use' && b.name === tool.name);
    if (!block || !block.input) throw new Error('Beklenen araç çağrısı dönmedi');
    return block.input;
  },

  generate(topic, s) {
    return this._call({
      system: AI_SYSTEM_PROMPT,
      tool: {
        name: 'build_script',
        description: 'Av. Yalın Anlatır video metninin üç parçasını döndür.',
        input_schema: {
          type: 'object',
          properties: {
            content: {
              type: 'string',
              description: 'İçerik paragrafı: 3-5 kısa cümle, ~55-80 kelime, son cümle "Kısacası:" ile başlar.',
            },
            reels: {
              type: 'string',
              description: 'TikTok/Reels emoji açıklaması. Çarpıcı emojili başlık satırı + boş satır + 3-4 emojili kilit satır + boş satır + emojili kapanış. Satırlar \\n ile.',
            },
            tags: {
              type: 'string',
              description: 'Boşlukla ayrılmış 5-7 hashtag. #hukuk #yalınanlatır #avukat mutlaka yer alsın.',
            },
          },
          required: ['content', 'reels', 'tags'],
        },
      },
      userMessage: `Konu: ${topic}\n\nBu konu için tam şablonda bir video metni üret.`,
      s,
    });
  },

  async suggestTopics(areaLabel, s) {
    const r = await this._call({
      system: IDEAS_SYSTEM_PROMPT,
      tool: {
        name: 'suggest_topics',
        description: 'Verilen hukuk alanı için video konu başlıklarını döndür.',
        input_schema: {
          type: 'object',
          properties: {
            topics: {
              type: 'array',
              items: { type: 'string' },
              minItems: 6,
              maxItems: 8,
              description: '6-8 adet çarpıcı, kısa konu başlığı.',
            },
          },
          required: ['topics'],
        },
      },
      userMessage: `Alan: ${areaLabel}\n\nBu alan için 6-8 çarpıcı, merak uyandıran video konu başlığı öner. Daha önce çok işlenmemiş ama geniş kitleyi ilgilendiren başlıklar seç.`,
      s,
    });
    return Array.isArray(r.topics) ? r.topics : [];
  },
};

/* ---------------- Ideas (topic suggestions) ---------------- */
const AREA_LABELS = {
  karisik:  'Karışık — hukukun farklı alanlarından dengeli seçim',
  aile:     'Aile Hukuku',
  ceza:     'Ceza Hukuku',
  is:       'İş Hukuku',
  tazminat: 'Tazminat Hukuku',
  kira:     'Kira ve Gayrimenkul Hukuku',
  tuketici: 'Tüketici Hukuku',
  miras:    'Miras Hukuku',
  kvkk:     'KVKK ve Dijital Hukuk',
  borclar:  'Borçlar Hukuku ve Sözleşmeler',
};

const ideas = {
  modal: null,
  pool: [], // {topic, checked}

  init() {
    this.modal = $('#modal-ideas');
    $('#btn-ideas').addEventListener('click', () => this.open());
    $('#i-gen').addEventListener('click', () => this.suggest(false));
    $('#i-add-more').addEventListener('click', () => this.suggest(true));
    $('#i-build').addEventListener('click', () => this.buildSelected());

    $('#i-select-all').addEventListener('change', (e) => {
      const on = e.target.checked;
      this.pool.forEach(p => p.checked = on);
      this.renderList();
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) { this.close(); return; }
      const pickBtn = e.target.closest('.idea-pick');
      if (pickBtn) {
        e.preventDefault();
        this.pickToEditor(pickBtn.dataset.topic);
        return;
      }
      const item = e.target.closest('.idea-item');
      if (item && !e.target.matches('input[type="checkbox"]')) {
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb) {
          cb.checked = !cb.checked;
          this.onToggle(cb);
        }
      }
    });

    this.modal.addEventListener('change', (e) => {
      if (e.target.matches('.idea-check')) this.onToggle(e.target);
    });

    document.addEventListener('keydown', (e) => {
      if (!this.modal.hidden && e.key === 'Escape') this.close();
    });
  },

  open() {
    this.modal.hidden = false;
    this.modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#i-area').focus(), 30);
  },

  close() {
    this.modal.hidden = true;
    this.modal.setAttribute('aria-hidden', 'true');
  },

  pickToEditor(topic) {
    if (!topic) return;
    editor.editingId = null;
    editor.els.topic.value = topic;
    editor.render();
    editor.saveDraft();
    this.close();
    tabs.show('editor');
    editor.els.topic.focus();
    toast('💡 Başlık editöre yapıştı — ⚡ Üret\'e bas');
  },

  onToggle(cb) {
    const topic = cb.dataset.topic;
    const item = this.pool.find(p => p.topic === topic);
    if (item) item.checked = cb.checked;
    cb.closest('.idea-item')?.classList.toggle('is-checked', cb.checked);
    this.updateFooter();
  },

  updateFooter() {
    const sel = this.pool.filter(p => p.checked).length;
    const total = this.pool.length;
    $('#i-count').textContent = `${sel} seçili / ${total}`;
    $('#i-build').disabled = sel === 0;
    const all = $('#i-select-all');
    all.checked = total > 0 && sel === total;
    all.indeterminate = sel > 0 && sel < total;
    $('#ideas-foot').hidden = total === 0;
  },

  renderList() {
    const list = $('#ideas-list');
    const empty = $('#ideas-empty');
    list.innerHTML = '';
    if (!this.pool.length) {
      empty.classList.remove('is-hidden');
      empty.textContent = 'Henüz öneri yok. ⚡ Başlık Öner\'e bas.';
      this.updateFooter();
      return;
    }
    empty.classList.add('is-hidden');
    this.pool.forEach(p => {
      const row = document.createElement('label');
      row.className = 'idea-item' + (p.checked ? ' is-checked' : '');
      row.innerHTML = `
        <input type="checkbox" class="idea-check" data-topic="${escAttr(p.topic)}" ${p.checked ? 'checked' : ''} />
        <span class="idea-text"></span>
        <button type="button" class="idea-pick" data-topic="${escAttr(p.topic)}" title="Sadece bunu editöre at">→ Editör</button>
      `;
      row.querySelector('.idea-text').textContent = p.topic;
      list.appendChild(row);
    });
    this.updateFooter();
  },

  async suggest(append) {
    const s = settings.load();
    if (!s.apiKey) {
      toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir');
      this.close();
      settings.open();
      return;
    }
    const area = $('#i-area').value;
    const label = AREA_LABELS[area] || area;
    const btn = append ? $('#i-add-more') : $('#i-gen');
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = '⏳ Öneriliyor';
    try {
      const topics = await ai.suggestTopics(label, s);
      const newOnes = topics
        .map(t => t.trim())
        .filter(t => t && !this.pool.some(p => p.topic === t));
      if (!append) this.pool = [];
      newOnes.forEach(t => this.pool.push({ topic: t, checked: false }));
      this.renderList();
      if (!newOnes.length) toast('Yeni başlık üretilemedi');
    } catch (e) {
      console.error(e);
      toast('Öneri başarısız: ' + (e.message || 'hata'));
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.textContent = origLabel;
    }
  },

  async buildSelected() {
    const s = settings.load();
    if (!s.apiKey) {
      toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir');
      this.close();
      settings.open();
      return;
    }
    const selected = this.pool.filter(p => p.checked).map(p => p.topic);
    if (!selected.length) { toast('En az 1 başlık seç'); return; }

    const btn = $('#i-build');
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');

    let ok = 0, fail = 0;
    for (let i = 0; i < selected.length; i++) {
      btn.textContent = `⏳ ${i + 1}/${selected.length} üretiliyor`;
      try {
        const out = await ai.generate(selected[i], s);
        results.add({
          id: newId(),
          topic: selected[i],
          content: out.content || '',
          reels:   out.reels   || '',
          tags:    out.tags    || '',
          createdAt: Date.now(),
        });
        ok++;
      } catch (e) {
        console.error('build failed:', selected[i], e);
        fail++;
      }
    }

    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.textContent = origLabel;

    // Üretilenleri havuzdan çıkar (kullanıcı tekrar seçmesin)
    this.pool = this.pool.filter(p => !p.checked);
    this.renderList();
    this.close();

    tabs.show('results');
    if (fail === 0) toast(`✨ ${ok} sonuç üretildi`);
    else toast(`✨ ${ok} başarılı · ${fail} hata`);
  },
};

/* ---------------- Results (toplu üretim çıktıları) ---------------- */
function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const results = {
  list() {
    try { return JSON.parse(localStorage.getItem(RESULTS_KEY) || '[]'); }
    catch { return []; }
  },
  saveAll(items) { localStorage.setItem(RESULTS_KEY, JSON.stringify(items)); },
  add(item) {
    const items = this.list();
    items.unshift(item);
    this.saveAll(items);
    this.refresh();
  },
  remove(id) {
    this.saveAll(this.list().filter(x => x.id !== id));
    this.refresh();
  },
  clearAll() {
    this.saveAll([]);
    this.refresh();
  },

  init() {
    $('#btn-results-clear').addEventListener('click', () => {
      if (!this.list().length) { toast('Liste zaten boş'); return; }
      if (!confirm('Tüm üretilen sonuçlar silinsin mi?')) return;
      this.clearAll();
      toast('🧹 Sonuçlar temizlendi');
    });
    $('#btn-results-archive-all').addEventListener('click', () => this.archiveAll());
    this.refresh();
  },

  refresh() {
    const items = this.list();
    $('#resultsCount').textContent = items.length;

    const list = $('#results-list');
    const empty = $('#results-empty');
    list.innerHTML = '';

    if (!items.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    const tpl = $('#result-card-tpl');
    items.forEach(it => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.r-title').textContent = it.topic;
      node.querySelector('.r-date').textContent  = fmtDate(it.createdAt);
      node.querySelector('.r-content').textContent = it.content;
      node.querySelector('.r-reels').textContent = it.reels;
      node.querySelector('.r-tags').textContent = it.tags || '';

      node.querySelector('.r-copy-tc').addEventListener('click', async () => {
        try { await copyText(buildTopicContent(it)); toast('📝 Konu + İçerik kopyalandı'); }
        catch { toast('Kopyalanamadı'); }
      });
      node.querySelector('.r-copy-reels').addEventListener('click', async () => {
        try { await copyText(buildReelsCaption(it)); toast('🎬 Reels kopyalandı'); }
        catch { toast('Kopyalanamadı'); }
      });
      node.querySelector('.r-edit').addEventListener('click', () => {
        editor.editingId = null;
        editor.setData(it);
        editor.saveDraft();
        tabs.show('editor');
      });
      node.querySelector('.r-save').addEventListener('click', () => {
        const now = Date.now();
        db.add({
          id: newId(),
          topic: it.topic, content: it.content,
          reels: it.reels, tags: it.tags,
          createdAt: now, updatedAt: now,
        });
        archive.refresh();
        toast('💾 Arşive eklendi');
      });
      node.querySelector('.r-del').addEventListener('click', () => {
        if (!confirm('Bu sonuç silinsin mi?')) return;
        this.remove(it.id);
      });
      list.appendChild(node);
    });
  },

  archiveAll() {
    const items = this.list();
    if (!items.length) { toast('Liste boş'); return; }
    const now = Date.now();
    items.forEach(it => {
      db.add({
        id: newId(),
        topic: it.topic, content: it.content,
        reels: it.reels, tags: it.tags,
        createdAt: now, updatedAt: now,
      });
    });
    archive.refresh();
    toast(`💾 ${items.length} sonuç arşive eklendi`);
  },
};

/* ---------------- SEO: System Prompts ---------------- */
const SEO_ARTICLE_SYSTEM_PROMPT = `Sen web siteleri için Google'da üst sıralarda yer alacak, okuyucuyu çeken, SEO uyumlu Türkçe makaleler yazan uzman bir içerik editörüsün.

GÖREV: Kullanıcı konu başlığı, kategori, ton ve uzunluk bilgisi verecek. "write_seo_article" aracını çağırarak eksiksiz bir makale döndür. Başka metin üretme.

SEO BAŞLIĞI (seoTitle): 55-65 karakter arası, kesinlikle. Odak kelimeyi başa yakın koy. Merak uyandıran, tıklanabilir.

META AÇIKLAMA (metaDescription): 150-160 karakter arası, kesinlikle. Odak kelimeyi içersin. Net fayda vaat et, CTA ile bitir.

ODAK ANAHTAR KELİME (focusKeyword): 2-4 kelimelik hedefli arama terimi.

İÇERİK (content) — Markdown formatı:
- # H1 başlığı, ## en az 3 H2, ### gerektiğinde H3
- İlk 100 kelimede odak kelimeyi kullan
- Her H2'de 2-4 paragraf, madde listeleri (- ile), **kalın** vurgu
- Sonuç bölümü + CTA; Kısa ~500 | Orta ~800 | Uzun ~1200 kelime

LSI ANAHTAR KELİMELER (lsiKeywords): 8-12 adet, odak kelimeyle anlam bağı olan, 1-4 kelimelik arama terimleri. Makale içinde kullanılabilecek türde seç.

OKUNABİLİRLİK SKORU (readabilityScore): 0-100 tam sayı. Kısa cümle ve sade kelime = yüksek. Türkçe okuyucu için değerlendir.

OKUNABİLİRLİK SEVİYESİ (readabilityLevel): "Kolay" (80+), "Orta" (50-79) veya "İleri" (0-49).

SCHEMA.ORG (articleSchema): JSON-LD formatında Schema.org Article nesnesi (string). @type:"Article", headline, description, keywords, inLanguage:"tr", datePublished (bugün). Yalnızca JSON nesnesini ver, script etiketi olmadan.

SEO SKORU (seoScore): 0-100; başlık/meta uzunluğu, kelime yoğunluğu, başlık hiyerarşisi, liste kullanımı.

SEO İPUÇLARI (seoTips): 3-5 eyleme geçirilebilir Türkçe madde.

OKUMA SÜRESİ (readingTimeMinutes): ~200 kelime/dk baz alınarak.

Rakip içerik sağlanırsa orada işlenen konuları kapsayacak şekilde daha kapsamlı yaz.

Yalnızca aracı çağır, önsöz veya açıklama ekleme.`;

const SEO_TOPICS_SYSTEM_PROMPT = `Sen web siteleri için içerik stratejisi geliştiren bir SEO uzmanısın.

GÖREV: Kullanıcı bir kategori verecek. "suggest_seo_topics" aracını çağırarak Google'da aranma potansiyeli yüksek 6-8 Türkçe makale başlığı öner.

BAŞLIK KURALLARI:
- 5-12 kelime arası, net ve açıklayıcı
- Long-tail anahtar kelime içersin ("nasıl yapılır", "nedir", "rehber", "ipuçları", "avantajları" gibi)
- Hem evergreen hem güncel konular dengele
- Her başlık farklı bir açıyı ele alsın; tekrar etme
- Geniş kitleyi hedefle, aşırı niş olmayan başlıklar seç

Yalnızca aracı çağır, başka metin üretme.`;

/* ---------------- SEO: AI methods ---------------- */
ai.generateSeoArticle = function({ topic, category, keyword, tone, length, competitor }, s) {
  const lengthMap = { kisa: '~500 kelime', orta: '~800 kelime', uzun: '~1200 kelime' };
  const lengthDesc = lengthMap[length] || '~800 kelime';
  let userMsg = `Konu: ${topic}\nKategori: ${category}\nOdak anahtar kelime: ${keyword || 'Otomatik belirle'}\nTon: ${tone}\nUzunluk hedefi: ${lengthDesc}`;
  if (competitor && competitor.trim()) {
    userMsg += `\n\nRakip referans içerik:\n${competitor.trim().slice(0, 800)}`;
  }
  userMsg += '\n\nBu parametrelerle tam SEO makalesi üret.';
  return this._call({
    system: SEO_ARTICLE_SYSTEM_PROMPT,
    tool: {
      name: 'write_seo_article',
      description: 'SEO uyumlu makaleyi tüm alanlarıyla döndür.',
      input_schema: {
        type: 'object',
        properties: {
          seoTitle:           { type: 'string', description: 'SEO başlığı, 55-65 karakter.' },
          metaDescription:    { type: 'string', description: 'Meta açıklama, 150-160 karakter.' },
          focusKeyword:       { type: 'string', description: 'Odak anahtar kelime (2-4 kelime).' },
          readingTimeMinutes: { type: 'number', description: 'Tahmini okuma süresi (dakika).' },
          seoScore:           { type: 'number', description: 'SEO skoru 0-100.' },
          content:            { type: 'string', description: 'Markdown formatında makale içeriği.' },
          seoTips:            { type: 'array', items: { type: 'string' }, description: '3-5 SEO iyileştirme önerisi.' },
          lsiKeywords:        { type: 'array', items: { type: 'string' }, description: '8-12 LSI anahtar kelime.' },
          readabilityScore:   { type: 'number', description: 'Okunabilirlik skoru 0-100.' },
          readabilityLevel:   { type: 'string', description: '"Kolay", "Orta" veya "İleri".' },
          articleSchema:      { type: 'string', description: 'JSON-LD Schema.org Article nesnesi (string).' },
        },
        required: ['seoTitle', 'metaDescription', 'focusKeyword', 'readingTimeMinutes', 'seoScore', 'content', 'seoTips', 'lsiKeywords', 'readabilityScore', 'readabilityLevel', 'articleSchema'],
      },
    },
    userMessage: userMsg,
    s,
    maxTokens: 6000,
  });
};

ai.suggestSeoTopics = async function(categoryLabel, s) {
  const r = await this._call({
    system: SEO_TOPICS_SYSTEM_PROMPT,
    tool: {
      name: 'suggest_seo_topics',
      description: 'Verilen kategori için makale başlıklarını döndür.',
      input_schema: {
        type: 'object',
        properties: {
          topics: {
            type: 'array',
            items: { type: 'string' },
            minItems: 6,
            maxItems: 8,
            description: '6-8 adet SEO odaklı makale başlığı.',
          },
        },
        required: ['topics'],
      },
    },
    userMessage: `Kategori: ${categoryLabel}\n\nBu kategori için Google'da yüksek aranma potansiyeli olan, long-tail odaklı 6-8 Türkçe makale başlığı öner.`,
    s,
  });
  return Array.isArray(r.topics) ? r.topics : [];
};

/* ---------------- SEO: Markdown renderer ---------------- */
function simpleMarkdown(text) {
  if (!text) return '';
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = s => s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');

  const lines = text.split('\n');
  const out = [];
  let inUl = false;
  let pBuf = [];

  const flushP = () => {
    if (pBuf.length) { out.push('<p>' + pBuf.join(' ') + '</p>'); pBuf = []; }
  };
  const flushUl = () => {
    if (inUl) { out.push('</ul>'); inUl = false; }
  };

  for (const raw of lines) {
    if (raw.startsWith('### ')) {
      flushP(); flushUl();
      out.push(`<h3>${inline(esc(raw.slice(4)))}</h3>`);
    } else if (raw.startsWith('## ')) {
      flushP(); flushUl();
      out.push(`<h2>${inline(esc(raw.slice(3)))}</h2>`);
    } else if (raw.startsWith('# ')) {
      flushP(); flushUl();
      out.push(`<h1>${inline(esc(raw.slice(2)))}</h1>`);
    } else if (raw.startsWith('- ') || raw.startsWith('* ')) {
      flushP();
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inline(esc(raw.slice(2)))}</li>`);
    } else if (raw.trim() === '') {
      flushP(); flushUl();
    } else {
      flushUl();
      pBuf.push(inline(esc(raw)));
    }
  }
  flushP(); flushUl();
  return out.join('');
}

/* ---------------- SEO: Database ---------------- */
const seoDB = {
  list() {
    try { return JSON.parse(localStorage.getItem(SEO_STORAGE_KEY) || '[]'); }
    catch { return []; }
  },
  save(items) { localStorage.setItem(SEO_STORAGE_KEY, JSON.stringify(items)); },
  add(item) {
    const items = this.list();
    items.unshift(item);
    this.save(items);
  },
  remove(id) { this.save(this.list().filter(x => x.id !== id)); },
  update(id, newData) {
    const items = this.list();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return;
    const old = items[idx];
    const versions = old.versions || [];
    versions.unshift({
      seoTitle: old.seoTitle, metaDescription: old.metaDescription,
      content: old.content, focusKeyword: old.focusKeyword,
      seoScore: old.seoScore, savedAt: Date.now(),
    });
    items[idx] = { ...old, ...newData, versions, updatedAt: Date.now() };
    this.save(items);
  },
  setDate(id, date) {
    const items = this.list();
    const idx = items.findIndex(x => x.id === id);
    if (idx === -1) return;
    items[idx].targetDate = date || null;
    this.save(items);
  },
};

/* ---------------- SEO: Category labels ---------------- */
const SEO_CATEGORY_LABELS = {
  genel:     'Genel / Karışık',
  teknoloji: 'Teknoloji / Yazılım',
  saglik:    'Sağlık / Yaşam',
  finans:    'Finans / Ekonomi',
  hukuk:     'Hukuk / Mevzuat',
  egitim:    'Eğitim / Kişisel Gelişim',
  is:        'İş / Girişim',
  yemek:     'Yemek / Tarif',
  seyahat:   'Seyahat / Gezi',
  moda:      'Moda / Güzellik',
  spor:      'Spor / Fitness',
  ev:        'Ev / Dekorasyon',
  oyun:      'Oyun / Eğlence',
};

/* ---------------- SEO: Editor ---------------- */
const seoEditor = {
  currentArticle: null,
  currentSchema:  null,

  init() {
    $('#seo-topic').addEventListener('input', () => {
      $('#seo-c-topic').textContent = $('#seo-topic').value.length;
    });
    $('#seo-btn-gen').addEventListener('click', () => this.generate());
    $('#seo-btn-clear').addEventListener('click', () => this.clear());
    $('#seo-btn-copy-article').addEventListener('click', () => this.copyArticle());
    $('#seo-btn-copy-meta').addEventListener('click', () => this.copyMeta());
    $('#seo-btn-save').addEventListener('click', () => this.save());
    $('#seo-btn-copy-schema').addEventListener('click', () => this.copySchema());

    $('#seo-toggle-competitor').addEventListener('click', () => {
      const box  = $('#seo-competitor-box');
      const icon = $('#seo-competitor-icon');
      box.hidden = !box.hidden;
      icon.textContent = box.hidden ? '▶' : '▼';
    });
    $('#seo-toggle-schema').addEventListener('click', () => {
      const box  = $('#seo-schema-box');
      const icon = $('#seo-schema-icon');
      box.hidden = !box.hidden;
      icon.textContent = box.hidden ? '▶' : '▼';
    });
  },

  async generate() {
    const topic = $('#seo-topic').value.trim();
    if (!topic) { toast('Önce bir konu başlığı yaz'); $('#seo-topic').focus(); return; }

    const s = settings.load();
    if (!s.apiKey) { toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir'); settings.open(); return; }

    const btn = $('#seo-btn-gen');
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = '⏳ Yazılıyor…';

    try {
      const out = await ai.generateSeoArticle({
        topic,
        category:   SEO_CATEGORY_LABELS[$('#seo-category').value] || $('#seo-category').value,
        keyword:    $('#seo-keyword').value.trim(),
        tone:       $('#seo-tone').value,
        length:     $('#seo-length').value,
        competitor: $('#seo-competitor').value.trim(),
      }, s);
      this.currentArticle = { ...out, topic, category: $('#seo-category').value };
      this.showArticle(out);
      toast('⚡ Makale üretildi');
    } catch (e) {
      console.error(e);
      toast('Üretim başarısız: ' + (e.message || 'bilinmeyen hata'));
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.textContent = origLabel;
    }
  },

  showArticle(data) {
    $('#seo-article-preview').innerHTML = simpleMarkdown(data.content || '');
    $('#seo-meta-box').hidden = false;

    // SEO title
    $('#seo-meta-title').textContent = data.seoTitle || '';
    const tLen  = (data.seoTitle || '').length;
    const tHint = $('#seo-meta-title-len');
    tHint.textContent = `${tLen} karakter — ${tLen < 55 ? 'çok kısa' : tLen > 65 ? 'çok uzun' : 'ideal ✓'}`;
    tHint.style.color = tLen >= 55 && tLen <= 65 ? 'var(--ok)' : 'var(--warn)';

    // Meta description
    $('#seo-meta-desc').textContent = data.metaDescription || '';
    const dLen  = (data.metaDescription || '').length;
    const dHint = $('#seo-meta-desc-len');
    dHint.textContent = `${dLen} karakter — ${dLen < 150 ? 'kısa' : dLen > 160 ? 'uzun' : 'ideal ✓'}`;
    dHint.style.color = dLen >= 150 && dLen <= 160 ? 'var(--ok)' : 'var(--warn)';

    // Focus keyword
    $('#seo-meta-keyword').textContent = data.focusKeyword || '—';

    // SEO score
    const sc = Math.min(100, Math.max(0, Math.round(data.seoScore || 0)));
    const scBar = $('#seo-score-bar');
    scBar.style.width      = sc + '%';
    scBar.style.background = sc >= 80 ? 'var(--ok)' : sc >= 60 ? 'var(--warn)' : 'var(--danger)';
    $('#seo-score-num').textContent = sc + ' / 100';

    // Readability score
    const rs = Math.min(100, Math.max(0, Math.round(data.readabilityScore || 0)));
    const rsBar = $('#seo-read-bar');
    rsBar.style.width      = rs + '%';
    rsBar.style.background = rs >= 80 ? 'var(--ok)' : rs >= 50 ? 'var(--warn)' : 'var(--danger)';
    $('#seo-read-num').textContent = `${rs} / 100 · ${data.readabilityLevel || '—'}`;

    // LSI keywords — clickable chips
    const lsiSection = $('#seo-lsi-section');
    const lsiChips   = $('#seo-lsi-chips');
    lsiChips.innerHTML = '';
    if (data.lsiKeywords && data.lsiKeywords.length) {
      lsiSection.hidden = false;
      data.lsiKeywords.forEach(kw => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'seo-lsi-chip';
        b.textContent = kw;
        b.title = 'Kopyala: ' + kw;
        b.addEventListener('click', async () => {
          try { await copyText(kw); toast('📋 ' + kw); }
          catch { toast('Kopyalanamadı'); }
        });
        lsiChips.appendChild(b);
      });
    } else {
      lsiSection.hidden = true;
    }

    // Internal link suggestions from archive
    this.showInternalLinks(data.focusKeyword, data.content);

    // SEO tips
    const tipsEl = $('#seo-tips-list');
    tipsEl.innerHTML = '';
    (data.seoTips || []).forEach(tip => {
      const d = document.createElement('div');
      d.className = 'seo-tip';
      d.textContent = '💡 ' + tip;
      tipsEl.appendChild(d);
    });

    // Schema.org JSON-LD
    this.currentSchema = data.articleSchema || null;
    const schemaRow = $('#seo-schema-row');
    if (data.articleSchema) {
      schemaRow.hidden = false;
      $('#seo-schema-pre').textContent = data.articleSchema;
      $('#seo-schema-box').hidden = true;
      $('#seo-schema-icon').textContent = '▶';
    } else {
      schemaRow.hidden = true;
    }

    // Reading badge
    const badge = $('#seo-reading-badge');
    badge.hidden = false;
    badge.textContent = `⏱️ ${Math.max(1, Math.round(data.readingTimeMinutes || 1))} dk okuma`;
  },

  showInternalLinks(focusKeyword, content) {
    const section   = $('#seo-intlinks-section');
    const container = $('#seo-intlinks');
    container.innerHTML = '';

    const all = seoDB.list();
    if (all.length < 1) { section.hidden = true; return; }

    const curKw      = (focusKeyword || '').toLowerCase();
    const curContent = (content || '').toLowerCase();

    const scored = all
      .filter(it => it.id !== this.currentArticle?.id)
      .map(it => {
        const titleWords = (it.seoTitle || it.topic || '').toLowerCase().split(/\s+/);
        const kw = (it.focusKeyword || '').toLowerCase();
        let score = 0;
        if (kw && curContent.includes(kw)) score += 3;
        if (kw && curKw === kw) score -= 5;
        titleWords.forEach(w => { if (w.length > 3 && curContent.includes(w)) score++; });
        return { ...it, _score: score };
      })
      .filter(it => it._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, 4);

    if (!scored.length) { section.hidden = true; return; }
    section.hidden = false;

    scored.forEach(it => {
      const title = it.seoTitle || it.topic || '—';
      const row = document.createElement('div');
      row.className = 'seo-intlink';
      const titleSpan = document.createElement('span');
      titleSpan.className = 'seo-intlink-title';
      titleSpan.textContent = title;
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'seo-intlink-copy';
      copyBtn.textContent = '📋 Başlık';
      copyBtn.addEventListener('click', async () => {
        try { await copyText(title); toast('📋 Başlık kopyalandı'); }
        catch { toast('Kopyalanamadı'); }
      });
      row.appendChild(titleSpan);
      row.appendChild(copyBtn);
      container.appendChild(row);
    });
  },

  clear() {
    if ($('#seo-topic').value || this.currentArticle) {
      if (!confirm('Editör temizlensin mi?')) return;
    }
    $('#seo-topic').value      = '';
    $('#seo-keyword').value    = '';
    $('#seo-competitor').value = '';
    $('#seo-c-topic').textContent = '0';
    this.currentArticle = null;
    this.currentSchema  = null;
    $('#seo-meta-box').hidden = true;
    $('#seo-reading-badge').hidden = true;
    $('#seo-competitor-box').hidden = true;
    $('#seo-competitor-icon').textContent = '▶';
    $('#seo-article-preview').innerHTML = `
      <div class="seo-empty-preview">
        <div class="empty-art">📄</div>
        <p>Konu başlığı gir ve <strong>⚡ Üret</strong>'e bas.</p>
      </div>`;
    toast('🧹 Temizlendi');
  },

  async copyArticle() {
    if (!this.currentArticle?.content) { toast('Önce bir makale üret'); return; }
    try { await copyText(this.currentArticle.content); toast('📋 Makale kopyalandı'); }
    catch { toast('Kopyalanamadı'); }
  },

  async copyMeta() {
    if (!this.currentArticle) { toast('Önce bir makale üret'); return; }
    const a   = this.currentArticle;
    const lsi = (a.lsiKeywords || []).join(', ');
    const text = `SEO Başlık: ${a.seoTitle || ''}\n\nMeta Açıklama: ${a.metaDescription || ''}\n\nOdak Anahtar Kelime: ${a.focusKeyword || ''}${lsi ? '\n\nLSI Kelimeler: ' + lsi : ''}`;
    try { await copyText(text); toast('🔖 Meta + LSI kopyalandı'); }
    catch { toast('Kopyalanamadı'); }
  },

  async copySchema() {
    if (!this.currentSchema) { toast('Schema.org mevcut değil'); return; }
    const wrapped = `<script type="application/ld+json">\n${this.currentSchema}\n<\/script>`;
    try { await copyText(wrapped); toast('📋 Schema.org kopyalandı'); }
    catch { toast('Kopyalanamadı'); }
  },

  save() {
    if (!this.currentArticle) { toast('Önce bir makale üret'); return; }
    seoDB.add({
      id: newId(),
      ...this.currentArticle,
      topic:      $('#seo-topic').value.trim(),
      category:   $('#seo-category').value,
      createdAt:  Date.now(),
      targetDate: null,
      versions:   [],
    });
    seoArchive.refresh();
    toast('💾 Makale arşive kaydedildi');
  },

  loadFrom(item) {
    $('#seo-topic').value = item.topic || item.seoTitle || '';
    $('#seo-c-topic').textContent = $('#seo-topic').value.length;
    this.currentArticle = item;
    this.currentSchema  = item.articleSchema || null;
    this.showArticle(item);
    tabs.show('seo');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};

/* ---------------- SEO: Ideas (topic suggestions) ---------------- */
const seoIdeas = {
  modal: null,
  pool: [],

  init() {
    this.modal = $('#modal-seo-ideas');
    $('#seo-btn-ideas').addEventListener('click', () => this.open());
    $('#si-gen').addEventListener('click', () => this.suggest(false));
    $('#si-add-more').addEventListener('click', () => this.suggest(true));
    $('#si-build').addEventListener('click', () => this.buildSelected());

    $('#si-select-all').addEventListener('change', (e) => {
      const on = e.target.checked;
      this.pool.forEach(p => p.checked = on);
      this.renderList();
    });

    this.modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) { this.close(); return; }
      const pickBtn = e.target.closest('.seo-idea-pick');
      if (pickBtn) { e.preventDefault(); this.pickToEditor(pickBtn.dataset.topic); return; }
      const item = e.target.closest('.idea-item');
      if (item && !e.target.matches('input[type="checkbox"]')) {
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb) { cb.checked = !cb.checked; this.onToggle(cb); }
      }
    });

    this.modal.addEventListener('change', (e) => {
      if (e.target.matches('.seo-idea-check')) this.onToggle(e.target);
    });

    document.addEventListener('keydown', (e) => {
      if (!this.modal.hidden && e.key === 'Escape') this.close();
    });
  },

  open() {
    this.modal.hidden = false;
    this.modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#si-category').focus(), 30);
  },

  close() {
    this.modal.hidden = true;
    this.modal.setAttribute('aria-hidden', 'true');
  },

  pickToEditor(topic) {
    if (!topic) return;
    $('#seo-topic').value = topic;
    $('#seo-c-topic').textContent = topic.length;
    this.close();
    tabs.show('seo');
    $('#seo-topic').focus();
    toast('💡 Başlık editöre yapıştı — ⚡ Üret\'e bas');
  },

  onToggle(cb) {
    const topic = cb.dataset.topic;
    const item = this.pool.find(p => p.topic === topic);
    if (item) item.checked = cb.checked;
    cb.closest('.idea-item')?.classList.toggle('is-checked', cb.checked);
    this.updateFooter();
  },

  updateFooter() {
    const sel   = this.pool.filter(p => p.checked).length;
    const total = this.pool.length;
    $('#si-count').textContent = `${sel} seçili / ${total}`;
    $('#si-build').disabled = sel === 0;
    const all = $('#si-select-all');
    all.checked       = total > 0 && sel === total;
    all.indeterminate = sel > 0 && sel < total;
    $('#seo-ideas-foot').hidden = total === 0;
  },

  renderList() {
    const list  = $('#seo-ideas-list');
    const empty = $('#seo-ideas-empty');
    list.innerHTML = '';
    if (!this.pool.length) {
      empty.classList.remove('is-hidden');
      empty.textContent = 'Henüz öneri yok. ⚡ Konu Öner\'e bas.';
      this.updateFooter();
      return;
    }
    empty.classList.add('is-hidden');
    this.pool.forEach(p => {
      const row = document.createElement('label');
      row.className = 'idea-item' + (p.checked ? ' is-checked' : '');
      row.innerHTML = `
        <input type="checkbox" class="seo-idea-check" data-topic="${escAttr(p.topic)}" ${p.checked ? 'checked' : ''} />
        <span class="idea-text"></span>
        <button type="button" class="idea-pick seo-idea-pick" data-topic="${escAttr(p.topic)}" title="Editöre at">→ Editör</button>
      `;
      row.querySelector('.idea-text').textContent = p.topic;
      list.appendChild(row);
    });
    this.updateFooter();
  },

  async suggest(append) {
    const s = settings.load();
    if (!s.apiKey) { toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir'); this.close(); settings.open(); return; }

    const cat   = $('#si-category').value;
    const label = SEO_CATEGORY_LABELS[cat] || cat;
    const btn   = append ? $('#si-add-more') : $('#si-gen');
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = '⏳ Öneriliyor…';

    try {
      const topics = await ai.suggestSeoTopics(label, s);
      const newOnes = topics.map(t => t.trim()).filter(t => t && !this.pool.some(p => p.topic === t));
      if (!append) this.pool = [];
      newOnes.forEach(t => this.pool.push({ topic: t, checked: false }));
      this.renderList();
      if (!newOnes.length) toast('Yeni konu üretilemedi');
    } catch (e) {
      console.error(e);
      toast('Öneri başarısız: ' + (e.message || 'hata'));
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.textContent = origLabel;
    }
  },

  async buildSelected() {
    const s = settings.load();
    if (!s.apiKey) { toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir'); this.close(); settings.open(); return; }

    const selected = this.pool.filter(p => p.checked).map(p => p.topic);
    if (!selected.length) { toast('En az 1 konu seç'); return; }

    const btn = $('#si-build');
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');

    const cat    = SEO_CATEGORY_LABELS[$('#si-category').value] || $('#si-category').value;
    const tone   = $('#seo-tone').value;
    const length = $('#seo-length').value;
    let ok = 0, fail = 0;

    for (let i = 0; i < selected.length; i++) {
      btn.textContent = `⏳ ${i + 1}/${selected.length} yazılıyor`;
      try {
        const out = await ai.generateSeoArticle({ topic: selected[i], category: cat, keyword: '', tone, length, competitor: '' }, s);
        seoDB.add({ id: newId(), ...out, topic: selected[i], category: $('#si-category').value, createdAt: Date.now(), targetDate: null, versions: [] });
        ok++;
      } catch (e) {
        console.error('SEO toplu üretim hatası:', selected[i], e);
        fail++;
      }
    }

    this.pool = this.pool.filter(p => !p.checked);
    this.renderList();
    this.close();
    seoArchive.refresh();
    tabs.show('seo');

    if (fail === 0) toast(`✨ ${ok} makale üretildi ve arşive kaydedildi`);
    else toast(`✨ ${ok} başarılı · ${fail} hata`);

    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.textContent = origLabel;
  },
};

/* ---------------- SEO: Archive ---------------- */
const seoArchive = {
  calendarVisible: false,

  init() {
    $('#seo-btn-export').addEventListener('click', () => this.exportJson());
    $('#seo-btn-export-csv').addEventListener('click', () => this.exportCsv());
    $('#seo-btn-clear-archive').addEventListener('click', () => this.clearAll());
    $('#seo-btn-calendar').addEventListener('click', () => this.toggleCalendar());
    this.refresh();
  },

  refresh() {
    const items = seoDB.list();
    $('#seoCount').textContent = items.length;

    const list  = $('#seo-archive-list');
    const empty = $('#seo-archive-empty');
    list.innerHTML = '';

    if (!items.length) { empty.hidden = false; return; }
    empty.hidden = true;

    const tpl = $('#seo-article-tpl');
    items.forEach(it => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.querySelector('.seo-a-title').textContent = it.seoTitle || it.topic || '—';
      node.querySelector('.a-date').textContent       = fmtDate(it.updatedAt || it.createdAt);

      const kwEl = node.querySelector('.seo-a-keyword');
      kwEl.textContent = it.focusKeyword ? '🔑 ' + it.focusKeyword : '';
      kwEl.hidden = !it.focusKeyword;

      const scoreEl = node.querySelector('.seo-a-score');
      if (it.seoScore != null) {
        const sc = Math.round(it.seoScore);
        scoreEl.textContent = `SEO ${sc}/100`;
        scoreEl.className   = 'seo-a-score badge ' + (sc >= 80 ? 'ok' : sc >= 60 ? 'warn' : 'bad');
      } else {
        scoreEl.hidden = true;
      }

      const versEl = node.querySelector('.seo-a-versions');
      const vCount = (it.versions || []).length;
      if (vCount > 0) {
        versEl.hidden = false;
        versEl.textContent = `📋 ${vCount} sürüm`;
      }

      node.querySelector('.seo-a-desc').textContent = it.metaDescription || '';

      const dateInput = node.querySelector('.seo-a-target-date');
      dateInput.value = it.targetDate || '';
      dateInput.addEventListener('change', (e) => {
        seoDB.setDate(it.id, e.target.value);
        if (this.calendarVisible) this.renderCalendar();
        toast('📅 Yayın tarihi güncellendi');
      });

      node.querySelector('.seo-a-copy-article').addEventListener('click', async () => {
        try { await copyText(it.content || ''); toast('📋 Makale kopyalandı'); }
        catch { toast('Kopyalanamadı'); }
      });
      node.querySelector('.seo-a-copy-meta').addEventListener('click', async () => {
        try {
          const lsi  = (it.lsiKeywords || []).join(', ');
          const text = `SEO Başlık: ${it.seoTitle || ''}\n\nMeta Açıklama: ${it.metaDescription || ''}\n\nOdak Anahtar Kelime: ${it.focusKeyword || ''}${lsi ? '\n\nLSI Kelimeler: ' + lsi : ''}`;
          await copyText(text); toast('🔖 Meta + LSI kopyalandı');
        } catch { toast('Kopyalanamadı'); }
      });
      node.querySelector('.seo-a-regen').addEventListener('click', () => this.regenerate(it));
      node.querySelector('.seo-a-edit').addEventListener('click', () => seoEditor.loadFrom(it));
      node.querySelector('.seo-a-del').addEventListener('click', () => {
        if (!confirm(`"${it.seoTitle || it.topic}" silinsin mi?`)) return;
        seoDB.remove(it.id);
        this.refresh();
        toast('🗑️ Silindi');
      });
      list.appendChild(node);
    });

    if (this.calendarVisible) this.renderCalendar();
  },

  async regenerate(item) {
    const s = settings.load();
    if (!s.apiKey) { toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir'); settings.open(); return; }
    if (!confirm(`"${item.seoTitle || item.topic}" yeniden yazılsın mı?\nMevcut sürüm geçmişe kaydedilir.`)) return;

    toast('⏳ Yeniden yazılıyor…');
    try {
      const out = await ai.generateSeoArticle({
        topic:      item.topic || item.seoTitle || '',
        category:   SEO_CATEGORY_LABELS[item.category] || 'Genel / Karışık',
        keyword:    item.focusKeyword || '',
        tone:       'bilgilendirici',
        length:     'orta',
        competitor: '',
      }, s);
      seoDB.update(item.id, out);
      this.refresh();
      toast('✅ Yeniden yazıldı · eski sürüm geçmişte');
    } catch (e) {
      console.error(e);
      toast('Başarısız: ' + (e.message || 'hata'));
    }
  },

  toggleCalendar() {
    this.calendarVisible = !this.calendarVisible;
    $('#seo-calendar-view').hidden = !this.calendarVisible;
    $('#seo-btn-calendar').textContent = this.calendarVisible ? '📅 Takvimi Kapat' : '📅 Takvim';
    if (this.calendarVisible) this.renderCalendar();
  },

  renderCalendar() {
    const list = $('#seo-calendar-list');
    list.innerHTML = '';
    const items      = seoDB.list();
    const withDate   = items.filter(it => it.targetDate).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
    const noDate     = items.filter(it => !it.targetDate);

    [...withDate, ...noDate].forEach(it => {
      const div = document.createElement('div');
      div.className = 'seo-cal-item';
      const sc = it.seoScore != null ? `SEO ${Math.round(it.seoScore)}/100` : '';

      const dateEl = document.createElement('span');
      dateEl.className = 'seo-cal-date';
      dateEl.textContent = it.targetDate
        ? new Date(it.targetDate).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
        : '📌 Tarihsiz';

      const titleEl = document.createElement('span');
      titleEl.className = 'seo-cal-title';
      titleEl.textContent = it.seoTitle || it.topic || '—';

      const scoreEl = document.createElement('span');
      scoreEl.className = 'seo-cal-score';
      scoreEl.textContent = sc;

      div.appendChild(dateEl);
      div.appendChild(titleEl);
      div.appendChild(scoreEl);
      list.appendChild(div);
    });

    if (!items.length) {
      const p = document.createElement('p');
      p.style.cssText = 'color:var(--muted);text-align:center;padding:16px;margin:0;font-size:13px';
      p.textContent = 'Henüz kayıtlı makale yok.';
      list.appendChild(p);
    }
  },

  exportJson() {
    const items = seoDB.list();
    if (!items.length) { toast('Arşiv boş'); return; }
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-makaleler-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('⤓ JSON dışa aktarıldı');
  },

  exportCsv() {
    const items = seoDB.list();
    if (!items.length) { toast('Arşiv boş'); return; }
    const e = s => '"' + String(s || '').replace(/"/g, '""') + '"';
    const rows = [
      ['SEO Başlık','Meta Açıklama','Odak Anahtar Kelime','LSI Kelimeler','SEO Skoru','Okunabilirlik','Okunabilirlik Seviyesi','Yayın Tarihi','İçerik (Markdown)'].map(e).join(','),
      ...items.map(it => [
        it.seoTitle || '',
        it.metaDescription || '',
        it.focusKeyword || '',
        (it.lsiKeywords || []).join('; '),
        it.seoScore != null ? it.seoScore : '',
        it.readabilityScore != null ? it.readabilityScore : '',
        it.readabilityLevel || '',
        it.targetDate || '',
        it.content || '',
      ].map(e).join(',')),
    ];
    const blob = new Blob(['﻿' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-makaleler-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast('⤓ CSV indirildi — Excel\'e yapıştırmaya hazır');
  },

  clearAll() {
    if (!seoDB.list().length) { toast('Arşiv zaten boş'); return; }
    if (!confirm('Tüm SEO makaleler silinsin mi?')) return;
    seoDB.save([]);
    this.refresh();
    toast('🧹 SEO arşivi temizlendi');
  },
};

/* ---------------- Tabs ---------------- */
const tabs = {
  init() {
    $$('.tab').forEach(btn => {
      btn.addEventListener('click', () => this.show(btn.dataset.tab));
    });
  },
  show(name) {
    $$('.tab').forEach(b => {
      const active = b.dataset.tab === name;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    $$('.view').forEach(v => {
      const active = v.id === 'view-' + name;
      v.classList.toggle('is-active', active);
      v.hidden = !active;
    });
    if (name === 'archive') archive.refresh();
    if (name === 'results') results.refresh();
    if (name === 'seo') seoArchive.refresh();
  }
};

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  tabs.init();
  editor.init();
  archive.init();
  results.init();
  settings.init();
  ideas.init();
  seoEditor.init();
  seoIdeas.init();
  seoArchive.init();
});
