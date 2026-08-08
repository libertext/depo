/* ============================================================================
   RankPen · SEO Article Writer — frontend logic (no dependencies)
   Talks to the secure proxy in server.js. The Anthropic key never touches
   the browser; customers authenticate with an access token.
   ==========================================================================*/
'use strict';

/* ------------------------------- config -------------------------------- */
const BRAND = {
  name: 'RankPen',
  tagline: 'AI SEO Makale Stüdyosu',
};
const SETTINGS_KEY = 'rankpen.settings.v1';
const ARCHIVE_KEY  = 'rankpen.articles.v1';
const DRAFT_KEY    = 'rankpen.draft.v1';

/* ------------------------------- helpers ------------------------------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let toastTimer;
function toast(msg, kind = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast show ' + kind;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2600);
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); return true; } catch { return false; }
    finally { ta.remove(); }
  }
}
function download(filename, content, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime + ';charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const slug = s => (s || 'makale').toLowerCase()
  .replace(/[çÇ]/g,'c').replace(/[ğĞ]/g,'g').replace(/[ıİ]/g,'i')
  .replace(/[öÖ]/g,'o').replace(/[şŞ]/g,'s').replace(/[üÜ]/g,'u')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0, 60) || 'makale';
const fmtDate = ts => new Date(ts).toLocaleDateString('tr-TR', { day:'2-digit', month:'short', year:'numeric' });

/* ------------------------------ settings ------------------------------- */
const settings = {
  data: { token: '', apiBase: '', model: '' },
  load() {
    try { this.data = { ...this.data, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch {}
    return this.data;
  },
  save(patch) {
    this.data = { ...this.data, ...patch };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.data));
  },
  base() {
    const b = (this.data.apiBase || '').trim().replace(/\/+$/, '');
    return b || '/api';
  },
};

/* -------------------------------- API ---------------------------------- */
const api = {
  async _post(path, payload) {
    const headers = { 'Content-Type': 'application/json' };
    if (settings.data.token) headers['X-Access-Token'] = settings.data.token;
    let res;
    try {
      res = await fetch(settings.base() + path, {
        method: 'POST', headers, body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Sunucuya ulaşılamadı. Sunucu adresini ve internet bağlantınızı kontrol edin.');
    }
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || `Hata ${res.status}`);
    return data;
  },
  generate(params) { return this._post('/generate', params); },
  topics(params)   { return this._post('/topics', params); },
  async health() {
    try {
      const res = await fetch(settings.base() + '/health');
      return await res.json();
    } catch { return null; }
  },
};

/* --------------------------- markdown → HTML --------------------------- */
function mdToHtml(text) {
  if (!text) return '';
  const esc = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const inline = s => esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" rel="noopener">$1</a>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*(?!\*)(.+?)\*(?!\*)/g, '$1<em>$2</em>');

  const lines = text.split('\n');
  const out = []; let inUl = false; let pBuf = [];
  const flushP  = () => { if (pBuf.length) { out.push('<p>' + pBuf.join(' ') + '</p>'); pBuf = []; } };
  const flushUl = () => { if (inUl) { out.push('</ul>'); inUl = false; } };

  for (const raw of lines) {
    if (raw.startsWith('### '))      { flushP(); flushUl(); out.push(`<h3>${inline(raw.slice(4))}</h3>`); }
    else if (raw.startsWith('## '))  { flushP(); flushUl(); out.push(`<h2>${inline(raw.slice(3))}</h2>`); }
    else if (raw.startsWith('# '))   { flushP(); flushUl(); out.push(`<h1>${inline(raw.slice(2))}</h1>`); }
    else if (/^\s*[-*]\s+/.test(raw)){ flushP(); if (!inUl){ out.push('<ul>'); inUl = true; } out.push(`<li>${inline(raw.replace(/^\s*[-*]\s+/, ''))}</li>`); }
    else if (raw.trim() === '')      { flushP(); flushUl(); }
    else                             { flushUl(); pBuf.push(inline(raw)); }
  }
  flushP(); flushUl();
  return out.join('\n');
}

/* Build a full, SEO-ready standalone HTML document for download. */
function articleToFullHtml(a) {
  const langMap = { 'Türkçe':'tr','English':'en','Deutsch':'de','Français':'fr','Español':'es',
    'Italiano':'it','Português':'pt','Nederlands':'nl','Русский':'ru','العربية':'ar' };
  const lang = langMap[a.language] || 'tr';
  const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  let schema = '';
  if (a.articleSchema) {
    try { schema = `<script type="application/ld+json">\n${JSON.stringify(JSON.parse(a.articleSchema), null, 2)}\n</script>`; }
    catch { schema = `<script type="application/ld+json">${a.articleSchema}</script>`; }
  }
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(a.seoTitle || a.topic)}</title>
<meta name="description" content="${esc(a.metaDescription)}">
<meta name="keywords" content="${esc([a.focusKeyword, ...(a.lsiKeywords||[])].filter(Boolean).join(', '))}">
<meta property="og:title" content="${esc(a.seoTitle || a.topic)}">
<meta property="og:description" content="${esc(a.metaDescription)}">
<meta property="og:type" content="article">
${schema}
</head>
<body>
<article>
${mdToHtml(a.content)}
</article>
</body>
</html>`;
}

/* --------------------------- current article --------------------------- */
let current = null; // the article object shown in the Write view

/* ------------------------------ write UI ------------------------------- */
const write = {
  init() {
    $('#f-topic').addEventListener('input', e => { $('#c-topic').textContent = e.target.value.length; });
    $('#btn-gen').addEventListener('click', () => this.generate());
    $('#f-topic').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.generate(); } });
    $('#btn-clear').addEventListener('click', () => this.clear());
    $('#btn-ideas').addEventListener('click', () => ideas.open());

    $('#toggle-advanced').addEventListener('click', () => this._toggle('#advanced-box', '#advanced-icon'));
    $('#toggle-schema').addEventListener('click', () => this._toggle('#schema-box', '#schema-icon'));
    $('#btn-copy-schema').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (current?.articleSchema && await copy(current.articleSchema)) toast('Schema kopyalandı ✓', 'ok');
    });

    $('#btn-copy-md').addEventListener('click',   () => current && copy(current.content).then(ok => toast(ok ? 'Markdown kopyalandı ✓' : 'Kopyalanamadı', ok ? 'ok' : 'err')));
    $('#btn-copy-html').addEventListener('click', () => current && copy(mdToHtml(current.content)).then(ok => toast(ok ? 'HTML kopyalandı ✓' : 'Kopyalanamadı', ok ? 'ok' : 'err')));
    $('#btn-copy-meta').addEventListener('click', () => this.copyMeta());
    $('#btn-download').addEventListener('click', () => current && download(slug(current.topic) + '.md', this.asMarkdownFile(current), 'text/markdown'));
    $('#btn-download-html').addEventListener('click', () => current && download(slug(current.topic) + '.html', articleToFullHtml(current), 'text/html'));
    $('#btn-save').addEventListener('click', () => this.save());

    // restore draft params
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      if (d.topic) $('#f-topic').value = d.topic;
      if (d.language) $('#f-language').value = d.language;
    } catch {}
    $('#c-topic').textContent = $('#f-topic').value.length;
  },
  _toggle(boxSel, iconSel) {
    const box = $(boxSel), icon = $(iconSel);
    box.hidden = !box.hidden;
    icon.textContent = box.hidden ? '▶' : '▼';
  },
  params() {
    return {
      topic:       $('#f-topic').value.trim(),
      language:    $('#f-language').value,
      category:    $('#f-category').value,
      tone:        $('#f-tone').value,
      length:      $('#f-length').value,
      keyword:     $('#f-keyword').value.trim(),
      audience:    $('#f-audience').value.trim(),
      competitor:  $('#f-competitor').value.trim(),
      instructions:$('#f-instructions').value.trim(),
      model:       settings.data.model || undefined,
    };
  },
  async generate() {
    const p = this.params();
    if (!p.topic) { toast('Önce bir konu başlığı yaz', 'err'); $('#f-topic').focus(); return; }
    if (settings.data.needsAuth && !settings.data.token) { toast('Önce ⚙️ Ayarlar\'dan erişim jetonu gir', 'err'); openSettings(); return; }

    const btn = $('#btn-gen');
    btn.classList.add('is-loading');
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ topic: p.topic, language: p.language }));
    try {
      const out = await api.generate(p);
      current = { ...out, topic: p.topic, language: p.language, category: p.category };
      this.render(current);
      toast('Makale hazır 🎉', 'ok');
    } catch (e) {
      toast(e.message || 'Üretim başarısız', 'err');
    } finally {
      btn.classList.remove('is-loading');
    }
  },
  render(a) {
    $('#article-preview').innerHTML = mdToHtml(a.content);

    // reading badge
    const rb = $('#reading-badge');
    rb.hidden = false;
    rb.textContent = `⏱ ${a.readingTimeMinutes || '—'} dk okuma`;

    // meta
    $('#meta-box').hidden = false;
    $('#write-actions').hidden = false;

    $('#m-title').textContent = a.seoTitle || '';
    setLen($('#m-title-len'), (a.seoTitle||'').length, 55, 65, 'başlık');
    $('#m-desc').textContent = a.metaDescription || '';
    setLen($('#m-desc-len'), (a.metaDescription||'').length, 150, 160, 'açıklama');
    $('#m-keyword').textContent = a.focusKeyword || '—';

    setScore($('#m-seo-bar'), $('#m-seo-num'), a.seoScore);
    setScore($('#m-read-bar'), $('#m-read-num'), a.readabilityScore, a.readabilityLevel);

    // LSI
    const lsiSec = $('#lsi-section'), chips = $('#lsi-chips');
    chips.innerHTML = '';
    if (Array.isArray(a.lsiKeywords) && a.lsiKeywords.length) {
      lsiSec.hidden = false;
      a.lsiKeywords.forEach(k => {
        const b = document.createElement('button');
        b.className = 'lsi-chip'; b.type = 'button'; b.textContent = k;
        b.addEventListener('click', async () => { if (await copy(k)) toast('Kopyalandı: ' + k, 'ok'); });
        chips.appendChild(b);
      });
    } else lsiSec.hidden = true;

    // tips
    const tips = $('#tips-list'); tips.innerHTML = '';
    (a.seoTips || []).forEach(t => {
      const d = document.createElement('div'); d.className = 'tip';
      d.innerHTML = '<span>💡</span><span></span>'; d.lastChild.textContent = t;
      tips.appendChild(d);
    });

    // schema
    const schemaRow = $('#schema-row');
    if (a.articleSchema) {
      schemaRow.hidden = false;
      try { $('#schema-pre').textContent = JSON.stringify(JSON.parse(a.articleSchema), null, 2); }
      catch { $('#schema-pre').textContent = a.articleSchema; }
    } else schemaRow.hidden = true;

    // FAQ
    this.renderFaq(a.faq);
  },
  renderFaq(faq) {
    const block = $('#faq-block'), list = $('#faq-list');
    list.innerHTML = '';
    if (!Array.isArray(faq) || !faq.length) { block.hidden = true; return; }
    block.hidden = false;
    faq.forEach(item => {
      const el = document.createElement('div'); el.className = 'faq-item';
      const q = document.createElement('div'); q.className = 'faq-q'; q.textContent = item.question;
      const a = document.createElement('div'); a.className = 'faq-a';
      const p = document.createElement('p'); p.style.margin = '10px 0 0'; p.textContent = item.answer; a.appendChild(p);
      q.addEventListener('click', () => el.classList.toggle('open'));
      el.append(q, a); list.appendChild(el);
    });
  },
  asMarkdownFile(a) {
    const lines = [];
    lines.push(`<!-- SEO Title: ${a.seoTitle} -->`);
    lines.push(`<!-- Meta Description: ${a.metaDescription} -->`);
    lines.push(`<!-- Focus Keyword: ${a.focusKeyword} -->`);
    lines.push('');
    lines.push(a.content || '');
    if (Array.isArray(a.faq) && a.faq.length) {
      lines.push('\n## SSS');
      a.faq.forEach(f => { lines.push(`\n**${f.question}**\n\n${f.answer}`); });
    }
    return lines.join('\n');
  },
  copyMeta() {
    if (!current) return;
    const txt =
      `SEO Başlık: ${current.seoTitle}\n` +
      `Meta Açıklama: ${current.metaDescription}\n` +
      `Odak Kelime: ${current.focusKeyword}\n` +
      `LSI: ${(current.lsiKeywords||[]).join(', ')}`;
    copy(txt).then(ok => toast(ok ? 'Meta + LSI kopyalandı ✓' : 'Kopyalanamadı', ok ? 'ok' : 'err'));
  },
  save() {
    if (!current) { toast('Önce bir makale üret', 'err'); return; }
    archive.add(current);
    toast('Arşive kaydedildi 💾', 'ok');
  },
  clear() {
    ['#f-topic','#f-keyword','#f-audience','#f-competitor','#f-instructions'].forEach(s => $(s).value = '');
    $('#c-topic').textContent = '0';
    $('#meta-box').hidden = true; $('#write-actions').hidden = true;
    $('#faq-block').hidden = true; $('#reading-badge').hidden = true;
    $('#article-preview').innerHTML = '<div class="empty-preview"><div class="empty-art">📄</div><p>Bir konu başlığı gir ve <strong>⚡ Üret</strong>\'e bas.</p></div>';
    current = null;
    localStorage.removeItem(DRAFT_KEY);
  },
  loadFrom(a) {
    current = a;
    $('#f-topic').value = a.topic || a.seoTitle || '';
    $('#c-topic').textContent = $('#f-topic').value.length;
    if (a.language) $('#f-language').value = a.language;
    this.render(a);
    switchTab('write');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },
};

function setLen(el, len, min, max, label) {
  el.textContent = `${len} karakter (ideal ${min}-${max})`;
  el.className = 'meta-hint ' + (len >= min && len <= max ? 'ok' : (len < min ? 'warn' : 'bad'));
}
function setScore(bar, num, val, level) {
  const v = Math.min(100, Math.max(0, Math.round(val || 0)));
  bar.style.width = v + '%';
  bar.className = 'score-bar ' + (v >= 75 ? 'good' : v >= 50 ? 'warn' : 'bad');
  num.textContent = level ? `${v} / 100 · ${level}` : `${v} / 100`;
}

/* ------------------------------ archive -------------------------------- */
const archive = {
  all() { try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; } },
  write(items) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(items)); this.render(); },
  add(a) {
    const items = this.all();
    items.unshift({ ...a, id: 'a' + Date.now() + Math.random().toString(36).slice(2,6), savedAt: Date.now() });
    this.write(items);
  },
  remove(id) { this.write(this.all().filter(x => x.id !== id)); },
  render() {
    const items = this.all();
    $('#archiveCount').textContent = items.length;
    const q = ($('#a-search').value || '').toLowerCase().trim();
    const filtered = q ? items.filter(a =>
      (a.topic||'').toLowerCase().includes(q) ||
      (a.seoTitle||'').toLowerCase().includes(q) ||
      (a.focusKeyword||'').toLowerCase().includes(q)) : items;

    const list = $('#archive-list'), empty = $('#archive-empty');
    list.innerHTML = '';
    if (!filtered.length) { empty.hidden = false; empty.querySelector('h3').textContent = q ? 'Sonuç yok' : 'Arşiv boş'; return; }
    empty.hidden = true;
    const tpl = $('#archive-card-tpl');
    filtered.forEach(a => {
      const node = tpl.content.cloneNode(true);
      node.querySelector('.a-title').textContent = a.seoTitle || a.topic;
      node.querySelector('.a-lang').textContent = a.language || 'Türkçe';
      node.querySelector('.a-keyword').textContent = a.focusKeyword ? '🎯 ' + a.focusKeyword : '';
      node.querySelector('.a-score').textContent = a.seoScore != null ? '· SEO ' + Math.round(a.seoScore) : '';
      node.querySelector('.a-date').textContent = fmtDate(a.savedAt);
      node.querySelector('.a-desc').textContent = a.metaDescription || '';
      node.querySelector('.a-load').addEventListener('click', () => write.loadFrom(a));
      node.querySelector('.a-copy-md').addEventListener('click', () => copy(a.content).then(ok => toast(ok?'Markdown kopyalandı ✓':'Hata', ok?'ok':'err')));
      node.querySelector('.a-copy-html').addEventListener('click', () => copy(mdToHtml(a.content)).then(ok => toast(ok?'HTML kopyalandı ✓':'Hata', ok?'ok':'err')));
      node.querySelector('.a-download').addEventListener('click', () => download(slug(a.topic)+'.md', write.asMarkdownFile(a), 'text/markdown'));
      node.querySelector('.a-del').addEventListener('click', () => {
        if (confirm('Bu makale silinsin mi?')) { this.remove(a.id); toast('Silindi'); }
      });
      list.appendChild(node);
    });
  },
  init() {
    $('#a-search').addEventListener('input', () => this.render());
    $('#btn-export').addEventListener('click', () => {
      const items = this.all();
      if (!items.length) return toast('Arşiv boş', 'err');
      download('seo-makaleler.json', JSON.stringify(items, null, 2), 'application/json');
    });
    $('#btn-export-csv').addEventListener('click', () => this.exportCsv());
    $('#btn-import').addEventListener('click', () => $('#file-import').click());
    $('#file-import').addEventListener('change', e => this.import(e));
    this.render();
  },
  exportCsv() {
    const items = this.all();
    if (!items.length) return toast('Arşiv boş', 'err');
    const cell = s => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const rows = [['Başlık','SEO Başlık','Meta Açıklama','Odak Kelime','Dil','SEO Skoru','Tarih']
      .map(cell).join(',')];
    items.forEach(a => rows.push([
      a.topic, a.seoTitle, a.metaDescription, a.focusKeyword, a.language,
      a.seoScore, new Date(a.savedAt).toLocaleDateString('tr-TR')
    ].map(cell).join(',')));
    download('seo-makaleler.csv', '﻿' + rows.join('\n'), 'text/csv');
  },
  import(e) {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(reader.result);
        if (!Array.isArray(imported)) throw 0;
        const existing = this.all();
        const ids = new Set(existing.map(x => x.id));
        const merged = [...imported.filter(x => x.id && !ids.has(x.id)), ...existing];
        this.write(merged);
        toast(`${imported.length} makale içe aktarıldı ✓`, 'ok');
      } catch { toast('Geçersiz JSON dosyası', 'err'); }
      e.target.value = '';
    };
    reader.readAsText(file);
  },
};

/* --------------------------- ideas modal ------------------------------- */
const ideas = {
  async open() {
    openModal('#modal-ideas');
    const list = $('#ideas-list'), empty = $('#ideas-empty');
    list.innerHTML = ''; empty.hidden = false; empty.textContent = 'Yükleniyor…';
    try {
      const { topics } = await api.topics({
        category: $('#f-category').value,
        language: $('#f-language').value,
      });
      if (!topics.length) { empty.textContent = 'Öneri alınamadı.'; return; }
      empty.hidden = true;
      topics.forEach(t => {
        const row = document.createElement('div'); row.className = 'idea-row';
        const s = document.createElement('span'); s.textContent = t; row.appendChild(s);
        row.addEventListener('click', () => {
          $('#f-topic').value = t; $('#c-topic').textContent = t.length;
          closeModal('#modal-ideas'); $('#f-topic').focus();
          toast('Konu forma eklendi — ⚡ Üret\'e bas', 'ok');
        });
        list.appendChild(row);
      });
    } catch (e) { empty.hidden = false; empty.textContent = e.message || 'Hata'; }
  },
};

/* ----------------------------- bulk view ------------------------------- */
const bulk = {
  picked: new Set(),
  init() {
    // mirror category + language options from the write form
    $('#bulk-category').innerHTML = $('#f-category').innerHTML;
    $('#bulk-language').innerHTML = $('#f-language').innerHTML;
    $('#bulk-suggest').addEventListener('click', () => this.suggest());
    $('#bulk-select-all').addEventListener('change', e => this.toggleAll(e.target.checked));
    $('#bulk-build').addEventListener('click', () => this.build());
  },
  async suggest() {
    const btn = $('#bulk-suggest'); btn.classList.add('is-loading');
    this.picked.clear(); this.refreshFoot();
    try {
      const { topics } = await api.topics({
        category: $('#bulk-category').value,
        language: $('#bulk-language').value,
        niche: $('#bulk-niche').value.trim() || undefined,
      });
      const list = $('#bulk-list'); list.innerHTML = '';
      $('#bulk-empty').hidden = topics.length > 0;
      if (!topics.length) { $('#bulk-empty').textContent = 'Öneri alınamadı.'; return; }
      topics.forEach((t, i) => {
        const row = document.createElement('label'); row.className = 'idea-row';
        const cb = document.createElement('input'); cb.type = 'checkbox'; cb.dataset.topic = t;
        const s = document.createElement('span'); s.textContent = t;
        cb.addEventListener('change', () => {
          if (cb.checked) this.picked.add(t); else this.picked.delete(t);
          row.classList.toggle('picked', cb.checked); this.refreshFoot();
        });
        row.append(cb, s); list.appendChild(row);
      });
      $('#bulk-foot').hidden = false;
    } catch (e) { toast(e.message || 'Hata', 'err'); }
    finally { btn.classList.remove('is-loading'); }
  },
  toggleAll(on) {
    $$('#bulk-list input[type=checkbox]').forEach(cb => {
      cb.checked = on; cb.dispatchEvent(new Event('change'));
    });
  },
  refreshFoot() {
    $('#bulk-count').textContent = this.picked.size + ' seçili';
    $('#bulk-build').disabled = this.picked.size === 0;
  },
  async build() {
    const topics = [...this.picked];
    if (!topics.length) return;
    const language = $('#bulk-language').value;
    const category = $('#bulk-category').value;
    const length   = $('#bulk-length').value;

    const prog = $('#bulk-progress'), fill = $('#bulk-progress-fill'), label = $('#bulk-progress-label');
    prog.hidden = false; $('#bulk-build').disabled = true;
    let done = 0, ok = 0;
    for (const topic of topics) {
      label.textContent = `Üretiliyor: "${topic}" (${done+1}/${topics.length})`;
      try {
        const out = await api.generate({ topic, language, category, length, model: settings.data.model || undefined });
        archive.add({ ...out, topic, language, category });
        ok++;
      } catch (e) {
        toast(`"${topic}" başarısız: ${e.message}`, 'err');
      }
      done++;
      fill.style.width = Math.round(done / topics.length * 100) + '%';
    }
    label.textContent = `Bitti ✓ ${ok}/${topics.length} makale arşive kaydedildi.`;
    $('#bulk-build').disabled = false;
    toast(`${ok} makale üretildi 🎉`, 'ok');
  },
};

/* ---------------------------- settings UI ------------------------------ */
function openSettings() {
  $('#s-token').value = settings.data.token || '';
  $('#s-api-base').value = settings.data.apiBase || '';
  $('#s-model').value = settings.data.model || '';
  $('#s-health').hidden = true;
  openModal('#modal-settings');
  checkHealth();
}
async function checkHealth() {
  const dot = $('#conn-dot');
  const h = await api.health();
  const note = $('#s-health');
  if (!h) {
    dot.className = 'conn-dot bad';
    note.hidden = false; note.className = 'health-note bad';
    note.textContent = '✗ Sunucuya ulaşılamıyor. Sunucu adresini kontrol edin.';
    settings.data.needsAuth = false;
    return;
  }
  settings.data.needsAuth = !!h.authRequired;
  dot.className = 'conn-dot ok';
  note.hidden = false; note.className = 'health-note ok';
  note.textContent = `✓ Sunucu bağlı · Model: ${h.defaultModel} · ${h.authRequired ? 'Jeton gerekli' : 'Açık erişim'}` +
    (h.keyConfigured ? '' : ' · ⚠ Sunucuda API anahtarı yok');
}
function initSettings() {
  $('#btn-settings').addEventListener('click', openSettings);
  $('#s-save').addEventListener('click', () => {
    settings.save({
      token:   $('#s-token').value.trim(),
      apiBase: $('#s-api-base').value.trim(),
      model:   $('#s-model').value,
    });
    closeModal('#modal-settings');
    toast('Ayarlar kaydedildi ✓', 'ok');
    checkHealth();
  });
  $('#s-test').addEventListener('click', async () => {
    // temporarily apply base for the test
    const prevBase = settings.data.apiBase;
    settings.data.apiBase = $('#s-api-base').value.trim();
    await checkHealth();
    settings.data.apiBase = prevBase;
  });
}

/* ------------------------------- modals -------------------------------- */
function openModal(sel) { const m = $(sel); m.hidden = false; m.setAttribute('aria-hidden','false'); }
function closeModal(sel) { const m = $(sel); m.hidden = true; m.setAttribute('aria-hidden','true'); }
document.addEventListener('click', e => {
  if (e.target.matches('[data-close]')) {
    const modal = e.target.closest('.modal'); if (modal) closeModal('#' + modal.id);
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.modal:not([hidden])').forEach(m => closeModal('#' + m.id));
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); write.generate(); }
  if ((e.metaKey || e.ctrlKey) && (e.key === 's' || e.key === 'S')) { e.preventDefault(); write.save(); }
});

/* ------------------------------- tabs ---------------------------------- */
function switchTab(name) {
  $$('.tab').forEach(t => {
    const on = t.dataset.tab === name;
    t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  $$('.view').forEach(v => {
    const on = v.id === 'view-' + name;
    v.classList.toggle('is-active', on); v.hidden = !on;
  });
}
$$('.tab').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

/* -------------------------------- boot --------------------------------- */
function boot() {
  $('#brand-name').textContent = BRAND.name;
  $('#brand-tag').textContent = BRAND.tagline;
  document.title = `${BRAND.name} · ${BRAND.tagline}`;

  settings.load();
  write.init();
  archive.init();
  bulk.init();
  initSettings();
  checkHealth();

  // First-run nudge
  if (!settings.data.token && !settings.data.apiBase) {
    api.health().then(h => { if (h && h.authRequired) setTimeout(openSettings, 400); });
  }
}
boot();
