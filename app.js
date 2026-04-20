/* Av. Yalın Anlatır · Script Studio
   Vanilla JS, no deps. Data lives in localStorage. */

const STORAGE_KEY = 'yalin-anlatir.archive.v1';
const DRAFT_KEY   = 'yalin-anlatir.draft.v1';

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
});
