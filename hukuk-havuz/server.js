require('dotenv').config();
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app  = express();
const PORT = process.env.PORT || 3000;
const DATA = path.join(__dirname, 'data', 'ideas.json');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* ---- veri okuma/yazma ---- */
function readIdeas() {
  try { return JSON.parse(fs.readFileSync(DATA, 'utf8')); }
  catch { return []; }
}
function saveIdeas(list) {
  fs.writeFileSync(DATA, JSON.stringify(list, null, 2));
}

/* ---- alan etiketleri ---- */
const AREAS = {
  aile:     'Aile Hukuku',
  ceza:     'Ceza Hukuku',
  is:       'İş Hukuku',
  tazminat: 'Tazminat Hukuku',
  kira:     'Kira ve Gayrimenkul',
  tuketici: 'Tüketici Hukuku',
  miras:    'Miras Hukuku',
  kvkk:     'KVKK / Dijital Hukuk',
  borclar:  'Borçlar / Sözleşmeler',
  icra:     'İcra ve İflas',
  idare:    'İdare Hukuku',
  anayasa:  'Anayasa Hukuku',
};

/* ============================================================
   GET /api/ideas  →  tüm fikirler
   ============================================================ */
app.get('/api/ideas', (_req, res) => {
  res.json(readIdeas());
});

/* ============================================================
   POST /api/suggest  →  AI ile yeni fikirler üret
   body: { area: 'ceza' }
   ============================================================ */
app.post('/api/suggest', async (req, res) => {
  const { area } = req.body || {};
  if (!area || !AREAS[area]) {
    return res.status(400).json({ error: 'Geçerli bir alan gönderilmedi.' });
  }

  const areaLabel   = AREAS[area];
  const allIdeas    = readIdeas();
  const sameArea    = allIdeas.filter(i => i.area === area).map(i => i.topic);
  // AI'ya sadece son 15 başlığı gönder — input token maliyetini sınırla
  const avoidList   = sameArea.slice(-15);
  const avoidNote   = avoidList.length
    ? `\n\nBu başlıkları TEKRAR ETME:\n${avoidList.map(t => `- ${t}`).join('\n')}`
    : '';

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',   // en uygun maliyetli model
      max_tokens: 512,
      system: [
        {
          type: 'text',
          text: `Sen "Av. Yalın Anlatır" TikTok/Reels kanalı için Türk hukuku video konu başlıkları öneren bir editörüsün.

BAŞLIK KURALLARI:
- 4-12 kelime, sade günlük Türkçe.
- Günlük yaşamdan, geniş kitleyi ilgilendiren merak uyandırıcı konular.
- İki kavramı karşılaştır ("X ile Y farkı") veya net soru sor ("X ne demek?").
- Özgün seç; tekrar etme.
- Sadece suggest_topics aracını çağır; başka metin yazma.

HUKUKİ DOĞRULUK: TC mevzuatına uygun (CMK, TCK, TMK, TBK, İK…). Uydurma kavram/kurum yazma.`,
          cache_control: { type: 'ephemeral' }, // sistem prompt'u önbelleğe al
        },
      ],
      tools: [
        {
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
        },
      ],
      tool_choice: { type: 'tool', name: 'suggest_topics' },
      messages: [
        {
          role: 'user',
          content: `Alan: ${areaLabel}${avoidNote}\n\nBu alan için 6-8 yeni, özgün video konu başlığı öner.`,
        },
      ],
    });

    const block = msg.content.find(b => b.type === 'tool_use' && b.name === 'suggest_topics');
    if (!block?.input?.topics) throw new Error('Araç çağrısı beklenen biçimde dönmedi.');

    const existing    = new Set(allIdeas.map(i => i.topic.toLowerCase().trim()));
    const newTopics   = block.input.topics
      .map(t => t.trim())
      .filter(t => t && !existing.has(t.toLowerCase()));

    const now     = Date.now();
    const newItems = newTopics.map(t => ({
      id:        'h' + now.toString(36) + Math.random().toString(36).slice(2, 5),
      topic:     t,
      area,
      createdAt: now,
    }));

    saveIdeas([...allIdeas, ...newItems]);

    // token kullanımını logla (maliyet takibi)
    const usage = msg.usage;
    console.log(
      `[suggest] ${areaLabel} +${newItems.length} fikir | ` +
      `in:${usage.input_tokens} cache_hit:${usage.cache_read_input_tokens ?? 0} out:${usage.output_tokens}`
    );

    res.json({ added: newItems.length, items: newItems });
  } catch (err) {
    console.error('[suggest error]', err.message);
    res.status(500).json({ error: err.message });
  }
});

/* ============================================================
   DELETE /api/ideas/:id  →  fikri sil
   ============================================================ */
app.delete('/api/ideas/:id', (req, res) => {
  const updated = readIdeas().filter(i => i.id !== req.params.id);
  saveIdeas(updated);
  res.json({ ok: true });
});

/* ============================================================
   GET /api/areas  →  alanlar + sayılar
   ============================================================ */
app.get('/api/areas', (_req, res) => {
  const counts = {};
  readIdeas().forEach(i => { counts[i.area] = (counts[i.area] || 0) + 1; });
  const result = Object.entries(AREAS).map(([key, label]) => ({
    key, label, count: counts[key] || 0,
  }));
  res.json(result);
});

app.listen(PORT, () => {
  console.log(`\n✅  Hukuk Havuz → http://localhost:${PORT}\n`);
});
