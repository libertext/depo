/* UDF → PDF Converter — Vanilla JS, no framework deps beyond CDN libs */

const SETTINGS_KEY = 'udf2pdf.settings.v1';

/* ── Helpers ─────────────────────────────────────────── */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const newId = () => 'f' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const fmtSize = (n) => n < 1024 ? n + ' B' : n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(1) + ' MB';
const escHTML = (s) => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('is-show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('is-show'), 2200);
}

/* ── Settings ────────────────────────────────────────── */
const settings = {
  defaults: { format: 'a4', orient: 'portrait', margin: 15, fontsize: '12pt' },
  load() {
    try { return { ...this.defaults, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch { return { ...this.defaults }; }
  },
  save(v) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(v)); },
  init() {
    $('#btn-settings').addEventListener('click', () => this.open());
    $('#s-save').addEventListener('click', () => {
      this.save({
        format:   $('#s-format').value,
        orient:   $('#s-orient').value,
        margin:   parseInt($('#s-margin').value) || 15,
        fontsize: $('#s-fontsize').value,
      });
      this.closeModal('#modal-settings');
      toast('⚙️ Ayarlar kaydedildi');
    });
    this.initModalClose('#modal-settings');
  },
  open() {
    const s = this.load();
    $('#s-format').value   = s.format;
    $('#s-orient').value   = s.orient;
    $('#s-margin').value   = s.margin;
    $('#s-fontsize').value = s.fontsize;
    this.openModal('#modal-settings');
  },
  openModal(sel) {
    const m = $(sel);
    m.hidden = false;
    m.setAttribute('aria-hidden', 'false');
  },
  closeModal(sel) {
    const m = $(sel);
    m.hidden = true;
    m.setAttribute('aria-hidden', 'true');
  },
  initModalClose(sel) {
    const m = $(sel);
    m.addEventListener('click', (e) => { if (e.target.matches('[data-close]')) this.closeModal(sel); });
    document.addEventListener('keydown', (e) => { if (!m.hidden && e.key === 'Escape') this.closeModal(sel); });
  },
};

/* ── UDF Parser ─────────────────────────────────────── */
const parser = {
  async parse(file) {
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);

    const isPK  = bytes[0] === 0x50 && bytes[1] === 0x4B;         // ZIP magic PK
    const isCFB = bytes[0] === 0xD0 && bytes[1] === 0xCF;         // OLE/CFB (old DOC)

    if (isPK) {
      return await this.parseZip(ab, file.name);
    }

    // Try text-based formats with multiple encodings
    const encodings = ['utf-8', 'windows-1254', 'iso-8859-9', 'utf-16le'];
    for (const enc of encodings) {
      try {
        const text = new TextDecoder(enc, { fatal: true }).decode(ab);
        const trimmed = text.trimStart();
        if (trimmed.startsWith('{\\rtf')) return this.parseRTF(text);
        if (/^<\?xml|^<html/i.test(trimmed) || trimmed.includes('xmlns')) return this.parseXMLorHTML(text);
        if (enc === 'utf-8' || enc === 'windows-1254') {
          // Plain text or unrecognised structure
          return this.parseText(text, file.name);
        }
      } catch { /* bad encoding, try next */ }
    }

    if (isCFB) throw new Error('Eski Word (.doc / OLE) formatı: doğrudan dönüştürme desteklenmiyor. Lütfen dosyayı önce .docx olarak kaydedin.');
    throw new Error('Dosya formatı tanınamadı');
  },

  /* ---------- ZIP-based UDF ---------- */
  async parseZip(ab, filename) {
    if (!window.JSZip) throw new Error('JSZip kütüphanesi yüklenemedi');
    const zip = await JSZip.loadAsync(ab);
    const names = Object.keys(zip.files).filter(k => !zip.files[k].dir);

    // UYAP / ODF priority candidates
    const xmlCandidates = [
      'content.xml', 'Content.xml',
      'document.xml', 'Document.xml',
      'body.xml', 'meta.xml',
      'word/document.xml',         // DOCX
    ];
    for (const name of xmlCandidates) {
      if (zip.files[name]) {
        const text = await zip.files[name].async('string');
        const result = this.parseXMLorHTML(text);
        // Collect images from zip to embed
        result.images = await this.extractImages(zip);
        return result;
      }
    }

    // Any XML
    const xmlFile = names.find(n => /\.xml$/i.test(n) && !n.startsWith('_rels'));
    if (xmlFile) {
      const text = await zip.files[xmlFile].async('string');
      return this.parseXMLorHTML(text);
    }

    // Any HTML
    const htmlFile = names.find(n => /\.html?$/i.test(n));
    if (htmlFile) {
      const text = await zip.files[htmlFile].async('string');
      return { html: text, method: 'zip-html' };
    }

    // Any RTF
    const rtfFile = names.find(n => /\.rtf$/i.test(n));
    if (rtfFile) {
      const text = await zip.files[rtfFile].async('string');
      return this.parseRTF(text);
    }

    throw new Error('ZIP içinde desteklenen dosya bulunamadı. İçerik: ' + names.slice(0, 8).join(', '));
  },

  async extractImages(zip) {
    const images = {};
    const imgNames = Object.keys(zip.files).filter(n => /\.(png|jpg|jpeg|gif|svg)$/i.test(n));
    for (const name of imgNames.slice(0, 20)) {
      try {
        const b64 = await zip.files[name].async('base64');
        const ext = name.split('.').pop().toLowerCase();
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        images[name] = `data:${mime};base64,${b64}`;
      } catch { /* skip bad image */ }
    }
    return images;
  },

  /* ---------- XML / HTML dispatcher ---------- */
  parseXMLorHTML(text) {
    const trimmed = text.trimStart();

    // Detect HTML
    if (/^<!doctype html|^<html/i.test(trimmed)) {
      return { html: text, method: 'html' };
    }

    const xmlParser = new DOMParser();
    const doc = xmlParser.parseFromString(text, 'application/xml');
    const parseErr = doc.querySelector('parsererror');
    if (parseErr) {
      // Try as HTML
      const hdoc = xmlParser.parseFromString(text, 'text/html');
      return { html: hdoc.body.innerHTML, method: 'xml-as-html' };
    }

    const root = doc.documentElement;
    const ns  = root.namespaceURI || '';
    const tag = root.tagName.toLowerCase();

    // ODF (OpenDocument)
    if (ns.includes('opendocument') || tag.includes('document-content') || tag === 'office:document-content') {
      return this.parseODF(doc);
    }

    // OOXML / DOCX
    if (tag === 'w:document' || root.querySelector('w\\:body') || ns.includes('schemas.openxmlformats')) {
      return this.parseDOCX(doc);
    }

    // UYAP-specific or generic XML
    return this.parseGenericXML(doc);
  },

  /* ---------- ODF (OpenDocument) ---------- */
  parseODF(doc) {
    const nsText   = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
    const nsOffice = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';

    const bodyEl = doc.getElementsByTagNameNS(nsOffice, 'body')[0]
                || this.queryByLocalName(doc, 'body')
                || doc.documentElement;

    const html = this.odfToHTML(bodyEl);
    return { html: `<div class="odf-doc doc-body">${html}</div>`, method: 'odf' };
  },

  odfToHTML(node) {
    let out = '';
    for (const child of node.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        out += escHTML(child.textContent);
        continue;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) continue;
      const local = child.localName;
      const inner = this.odfToHTML(child);

      switch (local) {
        case 'p':
          out += `<p>${inner || '&nbsp;'}</p>`; break;
        case 'h': {
          const lvl = Math.min(parseInt(child.getAttribute('text:outline-level') || '1') + 1, 6);
          out += `<h${lvl}>${inner}</h${lvl}>`; break;
        }
        case 'span': out += `<span>${inner}</span>`; break;
        case 'line-break': out += '<br>'; break;
        case 'tab': out += '&emsp;'; break;
        case 's': out += ' '.repeat(parseInt(child.getAttribute('text:c') || '1')); break;
        case 'table': out += `<table class="doc-table">${inner}</table>`; break;
        case 'table-row': out += `<tr>${inner}</tr>`; break;
        case 'table-cell': out += `<td>${inner || '&nbsp;'}</td>`; break;
        case 'list': out += `<ul>${inner}</ul>`; break;
        case 'list-item': out += `<li>${inner}</li>`; break;
        case 'a': {
          const href = child.getAttribute('xlink:href') || '#';
          out += `<a href="${escHTML(href)}">${inner}</a>`; break;
        }
        case 'frame': break; // images handled separately
        default: out += inner;
      }
    }
    return out;
  },

  /* ---------- DOCX (word/document.xml) ---------- */
  parseDOCX(doc) {
    let html = '';
    const body = doc.querySelector('body') || doc.getElementsByTagName('w:body')[0] || doc.documentElement;

    for (const el of body.children) {
      const local = el.localName;
      if (local === 'p' || local === 'p'.replace(/[^p]/,'')) {
        const styleEl = el.querySelector('[w\\:val]') || el.getElementsByTagName('w:val')[0];
        const style = styleEl?.getAttribute('w:val') || el.getAttribute('w:styleId') || '';
        const textNodes = el.getElementsByTagName('w:t');
        const text = [...textNodes].map(t => t.textContent).join('');

        if (!text.trim()) { html += '<p>&nbsp;</p>'; continue; }

        const hMatch = style.match(/heading\s*(\d)|ba[sş]l[ıi]k\s*(\d)/i);
        if (hMatch) {
          const lvl = Math.min(parseInt(hMatch[1] || hMatch[2] || '1') + 1, 6);
          html += `<h${lvl}>${escHTML(text)}</h${lvl}>`;
        } else {
          html += `<p>${escHTML(text)}</p>`;
        }
      } else if (local === 'tbl') {
        html += '<table class="doc-table">';
        for (const row of el.getElementsByTagName('w:tr')) {
          html += '<tr>';
          for (const cell of row.getElementsByTagName('w:tc')) {
            const cellText = [...cell.getElementsByTagName('w:t')].map(t => t.textContent).join('');
            html += `<td>${escHTML(cellText) || '&nbsp;'}</td>`;
          }
          html += '</tr>';
        }
        html += '</table>';
      }
    }

    return { html: `<div class="doc-body">${html}</div>`, method: 'docx' };
  },

  /* ---------- Generic XML (UYAP-specific or unknown) ---------- */
  parseGenericXML(doc) {
    // Walk the tree and collect text blocks
    const paragraphs = [];
    const knownSkip = new Set(['style', 'styles', 'script', 'meta', 'link', 'head', 'metadata']);

    const walk = (node, depth) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t) paragraphs.push({ text: t, depth });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const local = node.localName.toLowerCase();
      if (knownSkip.has(local)) return;
      for (const child of node.childNodes) walk(child, depth + 1);
    };

    walk(doc.documentElement, 0);

    // Build HTML: deeper nodes that are leaf-level text → <p>
    // Shallow ones (depth < 3) with text → treat as headings
    let html = '';
    let prevDepth = -1;
    for (const { text, depth } of paragraphs) {
      if (depth <= 2 && text.length < 120) {
        html += `<h3>${escHTML(text)}</h3>`;
      } else {
        html += `<p>${escHTML(text)}</p>`;
      }
      prevDepth = depth;
    }

    return { html: `<div class="doc-body">${html}</div>`, method: 'generic-xml' };
  },

  /* ---------- RTF ---------- */
  parseRTF(rtf) {
    let text = rtf;

    // Unicode escapes \uNNNN?
    text = text.replace(/\\u(-?\d+)\??/g, (_, n) => {
      const code = parseInt(n);
      return String.fromCharCode(code < 0 ? code + 65536 : code);
    });

    // Turkish Windows-1254 escape sequences \'HH
    text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
      const cp = parseInt(hex, 16);
      // Windows-1254 specific
      const win1254map = {0xd0:'Ğ',0xf0:'ğ',0xdd:'İ',0xfd:'ı',0xde:'Ş',0xfe:'ş',0xc7:'Ç',0xe7:'ç',0xd6:'Ö',0xf6:'ö',0xdc:'Ü',0xfc:'ü'};
      return win1254map[cp] || (cp < 128 ? String.fromCharCode(cp) : '');
    });

    // Remove nested groups (up to 5 passes for deeply nested RTF)
    for (let i = 0; i < 6; i++) text = text.replace(/\{[^{}]*\}/g, ' ');
    // Remove control words
    text = text.replace(/\\[a-z]+\d*\b\s?/gi, ' ');
    text = text.replace(/\\./g, '');
    text = text.replace(/[{}]/g, '');

    const paras = text.split(/\n+/)
      .map(l => l.replace(/\s+/g, ' ').trim())
      .filter(l => l.length > 0);

    const html = paras.map(l => `<p>${escHTML(l)}</p>`).join('\n');
    return { html: `<div class="doc-body">${html}</div>`, method: 'rtf' };
  },

  /* ---------- Plain text fallback ---------- */
  parseText(text) {
    const paras = text.split(/\n{2,}/)
      .map(block => block.replace(/\n/g, ' ').trim())
      .filter(b => b.length > 0);

    if (paras.length === 0) throw new Error('Dosya boş görünüyor');

    const html = paras.map(p => `<p>${escHTML(p)}</p>`).join('\n');
    return { html: `<div class="doc-body">${html}</div>`, method: 'text' };
  },

  /* ---------- Utility ---------- */
  queryByLocalName(node, localName) {
    const iter = document.createNodeIterator(node, NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) { return n.localName === localName ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP; }
    });
    return iter.nextNode();
  },
};

/* ── PDF Generator ───────────────────────────────────── */
const pdfGen = {
  buildPrintHTML(html, title, cfg) {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8"/>
<title>${escHTML(title)}</title>
<style>
  @page { size: ${cfg.format} ${cfg.orient}; margin: ${cfg.margin}mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Times New Roman', serif;
    font-size: ${cfg.fontsize};
    line-height: 1.7;
    color: #111;
    background: #fff;
  }
  h1,h2,h3,h4,h5,h6 { font-weight: 700; margin: 14pt 0 6pt; line-height: 1.3; }
  h1 { font-size: 1.4em; } h2 { font-size: 1.2em; } h3 { font-size: 1.05em; }
  p { margin: 5pt 0; }
  table { width: 100%; border-collapse: collapse; margin: 10pt 0; }
  td, th { border: 1px solid #999; padding: 4pt 6pt; vertical-align: top; }
  ul, ol { margin: 6pt 0 6pt 20pt; }
  li { margin: 2pt 0; }
  .doc-raw { font-family: 'Courier New', monospace; white-space: pre-wrap; word-break: break-word; }
  a { color: inherit; text-decoration: none; }
  img { max-width: 100%; }
</style>
</head>
<body>${html}</body>
</html>`;
  },

  async generateBlob(html, title) {
    const cfg = settings.load();
    if (!window.html2pdf) throw new Error('html2pdf kütüphanesi yüklenemedi');

    const printHtml = this.buildPrintHTML(html, title, cfg);
    const container = document.createElement('div');
    container.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;';
    container.innerHTML = printHtml.replace(/^[\s\S]*<body>/, '').replace(/<\/body>[\s\S]*$/, '');
    document.body.appendChild(container);

    try {
      const formatMap = { a4: 'a4', a3: 'a3', letter: 'letter' };
      const blob = await html2pdf()
        .set({
          margin: cfg.margin,
          filename: title,
          html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
          jsPDF: { unit: 'mm', format: formatMap[cfg.format] || 'a4', orientation: cfg.orient, compress: true },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(container)
        .outputPdf('blob');
      return blob;
    } finally {
      document.body.removeChild(container);
    }
  },

  download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },

  printWindow(html, title) {
    const cfg = settings.load();
    const printHtml = this.buildPrintHTML(html, title, cfg);
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) { toast('Pop-up engellendi — lütfen pop-up\'a izin ver'); return; }
    win.document.open();
    win.document.write(printHtml);
    win.document.close();
    win.addEventListener('load', () => { win.focus(); win.print(); });
  },
};

/* ── App State ───────────────────────────────────────── */
const app = {
  files: [], // { id, file, status, result: { html, method }, pdfBlob, error }
  activePreviewId: null,

  /* ── Lifecycle ── */
  init() {
    settings.init();
    this.bindDrop();
    this.bindFileInput();
    this.bindControls();
    this.bindPreviewModal();
    this.renderList();
  },

  /* ── Drop zone ── */
  bindDrop() {
    const zone = $('#drop-zone');

    zone.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-browse')) $('#file-input').click();
    });
    $('#btn-browse').addEventListener('click', (e) => {
      e.stopPropagation();
      $('#file-input').click();
    });
    zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file-input').click(); } });

    zone.addEventListener('dragenter', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragover',  (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', (e) => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('is-over'); });
    zone.addEventListener('drop', (e) => {
      e.preventDefault();
      zone.classList.remove('is-over');
      this.addFiles([...e.dataTransfer.files]);
    });
  },

  bindFileInput() {
    $('#file-input').addEventListener('change', (e) => {
      this.addFiles([...e.target.files]);
      e.target.value = '';
    });
  },

  bindControls() {
    $('#btn-add-more').addEventListener('click', () => $('#file-input').click());
    $('#btn-clear-all').addEventListener('click', () => {
      if (!this.files.length) return;
      if (!confirm('Tüm dosyalar listeden kaldırılsın mı?')) return;
      this.files = [];
      this.renderList();
    });
    $('#btn-convert-all').addEventListener('click', () => this.convertAll());
    $('#btn-download-zip').addEventListener('click', () => this.downloadZip());
  },

  /* ── File management ── */
  addFiles(newFiles) {
    const udf = newFiles.filter(f => /\.udf$/i.test(f.name));
    if (!udf.length) { toast('Sadece .udf uzantılı dosyalar kabul edilir'); return; }
    const before = this.files.length;
    udf.forEach(f => {
      if (!this.files.some(x => x.file.name === f.name && x.file.size === f.size)) {
        this.files.push({ id: newId(), file: f, status: 'pending', result: null, pdfBlob: null, error: null });
      }
    });
    const added = this.files.length - before;
    if (!added) { toast('Seçilen dosyalar zaten listede'); return; }
    toast(`📂 ${added} dosya eklendi`);
    this.renderList();
  },

  /* ── Rendering ── */
  renderList() {
    const list = $('#file-list');
    const bar  = $('#controls-bar');
    const empty = $('#list-empty');
    const dlZip = $('#btn-download-zip');

    list.innerHTML = '';

    if (!this.files.length) {
      bar.hidden = true;
      empty.hidden = true;
      return;
    }

    bar.hidden = false;
    empty.hidden = true;

    $('#file-count').textContent = `${this.files.length} dosya`;

    const donePDFs = this.files.filter(f => f.status === 'done' && f.pdfBlob).length;
    dlZip.disabled = donePDFs < 2;
    dlZip.textContent = donePDFs >= 2 ? `📦 ZIP İndir (${donePDFs})` : '📦 ZIP İndir';

    const tpl = $('#file-card-tpl');
    this.files.forEach(item => {
      const node = tpl.content.firstElementChild.cloneNode(true);
      node.dataset.id = item.id;

      node.querySelector('.fc-name').textContent = item.file.name;
      node.querySelector('.fc-size').textContent = fmtSize(item.file.size);

      const statusEl = node.querySelector('.fc-status');
      const labels = { pending: 'Bekliyor', parsing: 'Okunuyor…', ready: 'Hazır', converting: 'Dönüştürülüyor…', done: 'PDF Hazır', error: 'Hata' };
      statusEl.textContent = labels[item.status] || item.status;
      statusEl.className = `fc-status badge ${item.status}`;

      if (item.status === 'converting' || item.status === 'parsing') {
        node.classList.add('is-converting');
        node.querySelector('.fc-icon').textContent = '⏳';
      } else if (item.status === 'done') {
        node.querySelector('.fc-icon').textContent = '✅';
      } else if (item.status === 'error') {
        node.querySelector('.fc-icon').textContent = '❌';
        if (item.error) {
          const sizeEl = node.querySelector('.fc-size');
          sizeEl.textContent = item.error.slice(0, 80);
          sizeEl.style.color = '#ef4444';
        }
      }

      const previewBtn = node.querySelector('.fc-preview');
      const dlBtn      = node.querySelector('.fc-download');
      const rmBtn      = node.querySelector('.fc-remove');

      const canPreview = item.result?.html;
      previewBtn.disabled = !canPreview;
      dlBtn.disabled = item.status !== 'done' || !item.pdfBlob;

      previewBtn.addEventListener('click', () => this.openPreview(item.id));
      dlBtn.addEventListener('click', () => {
        const name = item.file.name.replace(/\.udf$/i, '.pdf');
        pdfGen.download(item.pdfBlob, name);
        toast(`⬇️ ${name} indiriliyor`);
      });
      rmBtn.addEventListener('click', () => {
        this.files = this.files.filter(x => x.id !== item.id);
        this.renderList();
      });

      list.appendChild(node);
    });
  },

  /* ── Conversion ── */
  async convertAll() {
    const pending = this.files.filter(f => f.status === 'pending' || f.status === 'ready' || f.status === 'error');
    if (!pending.length) { toast('Dönüştürülecek dosya yok'); return; }

    const btn = $('#btn-convert-all');
    btn.disabled = true;
    btn.classList.add('is-loading');
    btn.textContent = `⏳ 0/${pending.length}`;

    let ok = 0, fail = 0;
    for (let i = 0; i < pending.length; i++) {
      btn.textContent = `⏳ ${i + 1}/${pending.length}`;
      const item = pending[i];

      try {
        // Step 1: parse
        this.setStatus(item.id, 'parsing');
        const result = await parser.parse(item.file);
        item.result = result;

        // Step 2: generate PDF
        this.setStatus(item.id, 'converting');
        const title = item.file.name.replace(/\.udf$/i, '');
        item.pdfBlob = await pdfGen.generateBlob(result.html, title);

        this.setStatus(item.id, 'done');
        ok++;
      } catch (e) {
        console.error('Conversion error:', item.file.name, e);
        item.error = e.message || 'Bilinmeyen hata';
        this.setStatus(item.id, 'error');
        fail++;
      }
    }

    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.textContent = '⚡ Hepsini Dönüştür';
    this.renderList();

    if (fail === 0) toast(`✅ ${ok} dosya başarıyla dönüştürüldü`);
    else toast(`✅ ${ok} başarılı · ❌ ${fail} hata`);
  },

  setStatus(id, status) {
    const item = this.files.find(f => f.id === id);
    if (item) item.status = status;
    this.renderList();
  },

  /* ── ZIP batch download ── */
  async downloadZip() {
    if (!window.JSZip) { toast('JSZip yüklenemedi'); return; }
    const ready = this.files.filter(f => f.status === 'done' && f.pdfBlob);
    if (ready.length < 2) { toast('En az 2 PDF hazır olmalı'); return; }

    const btn = $('#btn-download-zip');
    btn.disabled = true;
    btn.textContent = '⏳ Paketleniyor…';

    try {
      const zip = new JSZip();
      ready.forEach(item => {
        const name = item.file.name.replace(/\.udf$/i, '.pdf');
        zip.file(name, item.pdfBlob);
      });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
      const stamp = new Date().toISOString().slice(0, 10);
      pdfGen.download(blob, `udf-pdf-toplu-${stamp}.zip`);
      toast(`📦 ${ready.length} PDF ZIP olarak indirildi`);
    } catch (e) {
      toast('ZIP oluşturulamadı: ' + (e.message || ''));
    }

    btn.disabled = false;
    btn.textContent = `📦 ZIP İndir (${ready.length})`;
  },

  /* ── Preview Modal ── */
  bindPreviewModal() {
    const modal = $('#modal-preview');
    modal.addEventListener('click', (e) => {
      if (e.target.matches('[data-close]')) this.closePreview();
    });
    document.addEventListener('keydown', (e) => { if (!modal.hidden && e.key === 'Escape') this.closePreview(); });

    $('#btn-dl-single').addEventListener('click', () => {
      const item = this.files.find(f => f.id === this.activePreviewId);
      if (!item) return;
      if (item.pdfBlob) {
        pdfGen.download(item.pdfBlob, item.file.name.replace(/\.udf$/i, '.pdf'));
      } else if (item.result?.html) {
        toast('PDF henüz oluşturulmadı — önce Dönüştür\'e bas');
      }
    });

    $('#btn-print-single').addEventListener('click', () => {
      const item = this.files.find(f => f.id === this.activePreviewId);
      if (item?.result?.html) pdfGen.printWindow(item.result.html, item.file.name);
    });
  },

  openPreview(id) {
    const item = this.files.find(f => f.id === id);
    if (!item?.result?.html) return;
    this.activePreviewId = id;

    $('#preview-title').textContent = item.file.name;
    $('#preview-content').innerHTML = item.result.html;
    $('#btn-dl-single').disabled = !item.pdfBlob;

    const modal = $('#modal-preview');
    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
  },

  closePreview() {
    const modal = $('#modal-preview');
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
    this.activePreviewId = null;
  },
};

/* ── Boot ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => app.init());
