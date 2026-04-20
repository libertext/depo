/* Av. Yalın Anlatır · Script Studio
   Vanilla JS, no deps. Data lives in localStorage. */

const STORAGE_KEY  = 'yalin-anlatir.archive.v1';
const DRAFT_KEY    = 'yalin-anlatir.draft.v1';
const SETTINGS_KEY = 'yalin-anlatir.settings.v1';

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
      toast('📋 Kopyalandı');
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

      node.querySelector('.a-copy').addEventListener('click', async () => {
        try { await copyText(buildOutput(it)); toast('📋 Kopyalandı'); }
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
  async _call({ system, tool, userMessage, s }) {
    const body = {
      model: s.model || 'claude-opus-4-7',
      max_tokens: 1024,
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

  init() {
    this.modal = $('#modal-ideas');
    $('#btn-ideas').addEventListener('click', () => this.open());
    $('#i-gen').addEventListener('click', () => this.suggest());

    this.modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) { this.close(); return; }
      const item = e.target.closest('.idea-item');
      if (item) this.pick(item.dataset.topic);
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

  pick(topic) {
    if (!topic) return;
    editor.editingId = null;
    editor.els.topic.value = topic;
    editor.render();
    editor.saveDraft();
    this.close();
    editor.els.topic.focus();
    toast('💡 Başlık eklendi — ⚡ Üret\'e bas');
  },

  renderList(topics) {
    const list = $('#ideas-list');
    const empty = $('#ideas-empty');
    list.innerHTML = '';
    if (!topics.length) {
      empty.classList.remove('is-hidden');
      empty.textContent = 'Başlık üretilemedi. Tekrar dene.';
      return;
    }
    empty.classList.add('is-hidden');
    topics.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'idea-item';
      b.dataset.topic = t;
      b.textContent = t;
      list.appendChild(b);
    });
  },

  async suggest() {
    const s = settings.load();
    if (!s.apiKey) {
      toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir');
      this.close();
      settings.open();
      return;
    }
    const area = $('#i-area').value;
    const label = AREA_LABELS[area] || area;
    const btn = $('#i-gen');
    const origLabel = btn.textContent;
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = '⏳ Öneriliyor';
    try {
      const topics = await ai.suggestTopics(label, s);
      this.renderList(topics);
    } catch (e) {
      console.error(e);
      toast('Öneri başarısız: ' + (e.message || 'hata'));
    } finally {
      btn.disabled = false;
      btn.classList.remove('is-loading');
      btn.textContent = origLabel;
    }
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
  }
};

/* ---------------- Boot ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  tabs.init();
  editor.init();
  archive.init();
  settings.init();
  ideas.init();
});
