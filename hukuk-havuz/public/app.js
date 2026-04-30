/* Hukuk İçerik Havuzu · saf tarayıcı uygulaması */

const STORAGE_KEY  = 'hukuk-havuz.ideas.v1';
const SETTINGS_KEY = 'hukuk-havuz.settings.v1';

const AREA_LABELS = {
  aile:     'Aile Hukuku',
  ceza:     'Ceza Hukuku',
  is:       'İş Hukuku',
  tazminat: 'Tazminat Hukuku',
  kira:     'Kira / Gayrimenkul',
  tuketici: 'Tüketici Hukuku',
  miras:    'Miras Hukuku',
  kvkk:     'KVKK / Dijital',
  borclar:  'Borçlar / Sözleşmeler',
  icra:     'İcra ve İflas',
  idare:    'İdare Hukuku',
  anayasa:  'Anayasa Hukuku',
};

const SYSTEM_PROMPT = `Sen "Av. Yalın Anlatır" TikTok/Reels kanalı için Türk hukuku video konu başlıkları öneren bir editörüsün.

BAŞLIK KURALLARI:
- 4-12 kelime, sade günlük Türkçe.
- Geniş kitleyi ilgilendiren, günlük yaşamdan merak uyandırıcı konular.
- İki kavramı karşılaştır ("X ile Y farkı") veya net soru sor ("X ne demek?").
- Özgün seç; tekrar etme.
- Sadece suggest_topics aracını çağır; başka metin yazma.

HUKUKİ DOĞRULUK: TC mevzuatına uygun (CMK, TCK, TMK, TBK, İK…). Uydurma kavram/kurum yazma.`;

/* ---- storage ---- */
function loadIdeas() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}
function saveIdeas(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}
function loadSettings() {
  try { return { model: 'claude-haiku-4-5-20251001', apiKey: '', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch { return { model: 'claude-haiku-4-5-20251001', apiKey: '' }; }
}

/* ---- state ---- */
let allIdeas   = loadIdeas();
let activeArea = '';
let searchQ    = '';

/* ---- helpers ---- */
const $  = id => document.getElementById(id);
const newId = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

function toast(msg, dur = 2200) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), dur);
}

/* ---- render ---- */
function getFiltered() {
  return allIdeas.filter(i => {
    const areaOk = !activeArea || i.area === activeArea;
    const textOk = !searchQ   || i.topic.toLowerCase().includes(searchQ);
    return areaOk && textOk;
  });
}

function render() {
  const filtered = getFiltered();
  const list     = $('ideas-list');
  $('empty').hidden     = allIdeas.length !== 0;
  $('no-results').hidden = !(allIdeas.length > 0 && filtered.length === 0);
  list.innerHTML = '';

  // en yeni üstte
  [...filtered].reverse().forEach(item => {
    const row = document.createElement('div');
    row.className = 'idea-item';
    row.dataset.id = item.id;

    const topic = document.createElement('span');
    topic.className = 'idea-topic';
    topic.textContent = item.topic;

    const badge = document.createElement('span');
    badge.className = 'idea-area';
    badge.textContent = AREA_LABELS[item.area] || item.area;

    const del = document.createElement('button');
    del.className = 'idea-del';
    del.title = 'Sil';
    del.textContent = '✕';
    del.addEventListener('click', () => deleteIdea(item.id));

    row.append(topic, badge, del);
    list.appendChild(row);
  });

  updateBadges();
}

function updateBadges() {
  $('total-badge').textContent = allIdeas.length + ' fikir';
  $('chip-count-all').textContent = allIdeas.length;
  Object.keys(AREA_LABELS).forEach(area => {
    const chip = document.querySelector(`.area-chip[data-area="${area}"] .chip-count`);
    if (chip) chip.textContent = allIdeas.filter(i => i.area === area).length;
  });
}

function buildAreaChips() {
  const bar = $('area-bar');
  bar.querySelectorAll('[data-area]:not([data-area=""])').forEach(c => c.remove());
  Object.entries(AREA_LABELS).forEach(([key, label]) => {
    const count = allIdeas.filter(i => i.area === key).length;
    const btn = document.createElement('button');
    btn.className = 'area-chip' + (activeArea === key ? ' is-active' : '');
    btn.dataset.area = key;
    btn.innerHTML = `${label} <span class="chip-count">${count}</span>`;
    btn.addEventListener('click', () => {
      activeArea = activeArea === key ? '' : key;
      bar.querySelectorAll('.area-chip').forEach(c =>
        c.classList.toggle('is-active', c.dataset.area === activeArea));
      if (activeArea) $('suggest-area').value = activeArea;
      render();
    });
    bar.appendChild(btn);
  });
}

/* ---- sil ---- */
function deleteIdea(id) {
  allIdeas = allIdeas.filter(i => i.id !== id);
  saveIdeas(allIdeas);
  render();
  toast('🗑️ Silindi');
}

/* ---- AI ile fikir öner ---- */
async function suggestIdeas() {
  const s = loadSettings();
  if (!s.apiKey) {
    toast('Önce ⚙️ Ayarlar\'dan API anahtarı gir');
    openSettings();
    return;
  }

  const area      = $('suggest-area').value;
  const areaLabel = AREA_LABELS[area] || area;
  const existing  = allIdeas.filter(i => i.area === area).map(i => i.topic).slice(-15);
  const avoidNote = existing.length
    ? `\n\nBu başlıkları TEKRAR ETME:\n${existing.map(t => `- ${t}`).join('\n')}`
    : '';

  const btn = $('suggest-btn');
  btn.disabled = true;
  btn.classList.add('is-loading');
  btn.textContent = '⏳ Üretiliyor…';

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': s.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: s.model,
        max_tokens: 512,
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [{
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
                description: '6-8 özgün, çarpıcı konu başlığı.',
              },
            },
            required: ['topics'],
          },
        }],
        tool_choice: { type: 'tool', name: 'suggest_topics' },
        messages: [{
          role: 'user',
          content: `Alan: ${areaLabel}${avoidNote}\n\nBu alan için 6-8 yeni, özgün video konu başlığı öner.`,
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err?.error?.message || `HTTP ${res.status}`).slice(0, 120));
    }

    const data  = await res.json();
    const block = data.content?.find(b => b.type === 'tool_use' && b.name === 'suggest_topics');
    if (!block?.input?.topics) throw new Error('Araç yanıtı beklenen biçimde değil');

    const existingSet = new Set(allIdeas.map(i => i.topic.toLowerCase().trim()));
    const newItems = block.input.topics
      .map(t => t.trim())
      .filter(t => t && !existingSet.has(t.toLowerCase()))
      .map(t => ({ id: newId(), topic: t, area, createdAt: Date.now() }));

    allIdeas.push(...newItems);
    saveIdeas(allIdeas);

    // filtreyi önerilen alana çek
    activeArea = area;
    buildAreaChips();
    document.querySelector('.area-chip[data-area=""]')?.classList.remove('is-active');
    document.querySelector(`.area-chip[data-area="${area}"]`)?.classList.add('is-active');
    render();

    toast(`✅ ${newItems.length} yeni fikir eklendi`);
  } catch (e) {
    toast('Hata: ' + e.message, 4000);
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.textContent = '➕ Fikir Öner';
  }
}

/* ---- ayarlar modal ---- */
function openSettings() {
  const s = loadSettings();
  $('s-api-key').value = s.apiKey;
  $('s-model').value   = s.model;
  $('modal-settings').hidden = false;
}
function closeSettings() {
  $('modal-settings').hidden = true;
}

/* ---- init ---- */
document.addEventListener('DOMContentLoaded', () => {
  buildAreaChips();
  render();

  $('search').addEventListener('input', e => {
    searchQ = e.target.value.trim().toLowerCase();
    render();
  });

  $('suggest-btn').addEventListener('click', suggestIdeas);

  $('btn-settings').addEventListener('click', openSettings);

  $('s-save').addEventListener('click', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      apiKey: $('s-api-key').value.trim(),
      model:  $('s-model').value,
    }));
    closeSettings();
    toast('⚙️ Kaydedildi');
  });

  $('modal-settings').addEventListener('click', e => {
    if (e.target.matches('[data-close]')) closeSettings();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSettings();
  });

  $('area-bar').querySelector('[data-area=""]').addEventListener('click', () => {
    activeArea = '';
    document.querySelectorAll('.area-chip').forEach(c =>
      c.classList.toggle('is-active', c.dataset.area === ''));
    render();
  });
});
