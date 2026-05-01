/* Tesla Light Show Maker
   Web tabanlı, custom · ritme göre otomatik beat-sync show üretici.
   Vanilla JS — no deps. Audio: Web Audio API. Export: .fseq v2.0 + .wav. */

(() => {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  //  Sabitler & kanal listesi
  // ─────────────────────────────────────────────────────────────
  const STEP_MS = 50;            // Tesla light show frame süresi
  const MAX_CH  = 30;

  const CHANNELS = [
    { id: 0,  name: 'Outline Sol Ön',     group: 'outline'   },
    { id: 1,  name: 'Outline Sağ Ön',     group: 'outline'   },
    { id: 2,  name: 'Outline Sol Yan',    group: 'outline'   },
    { id: 3,  name: 'Outline Sağ Yan',    group: 'outline'   },
    { id: 4,  name: 'Outline Sol Arka',   group: 'outline'   },
    { id: 5,  name: 'Outline Sağ Arka',   group: 'outline'   },
    { id: 6,  name: 'Far Sol İç',         group: 'headlight' },
    { id: 7,  name: 'Far Sol Dış',        group: 'headlight' },
    { id: 8,  name: 'Far Sağ İç',         group: 'headlight' },
    { id: 9,  name: 'Far Sağ Dış',        group: 'headlight' },
    { id: 10, name: 'Uzun Far',           group: 'headlight' },
    { id: 11, name: 'Sis Far',            group: 'headlight' },
    { id: 12, name: 'Stop Sol',           group: 'tail'      },
    { id: 13, name: 'Stop Sağ',           group: 'tail'      },
    { id: 14, name: 'Geri Vites',         group: 'tail'      },
    { id: 15, name: 'Plaka',              group: 'tail'      },
    { id: 16, name: 'Sinyal Sol',         group: 'signal'    },
    { id: 17, name: 'Sinyal Sağ',         group: 'signal'    },
    { id: 18, name: 'Yan Sinyal Sol',     group: 'signal'    },
    { id: 19, name: 'Yan Sinyal Sağ',     group: 'signal'    },
    { id: 20, name: 'Kapı Ön Sol',        group: 'closure'   },
    { id: 21, name: 'Kapı Ön Sağ',        group: 'closure'   },
    { id: 22, name: 'Kapı Arka Sol',      group: 'closure'   },
    { id: 23, name: 'Kapı Arka Sağ',      group: 'closure'   },
    { id: 24, name: 'Pencere Sol Ön',     group: 'closure'   },
    { id: 25, name: 'Pencere Sağ Ön',     group: 'closure'   },
    { id: 26, name: 'Bagaj',              group: 'closure'   },
    { id: 27, name: 'Frunk',              group: 'closure'   },
    { id: 28, name: 'Şarj Portu',         group: 'closure'   },
    { id: 29, name: 'Aynalar',            group: 'closure'   },
  ];

  // ─────────────────────────────────────────────────────────────
  //  Uygulama durumu
  // ─────────────────────────────────────────────────────────────
  const state = {
    audioBuffer: null,              // AudioBuffer
    audioName: '',
    duration: 0,
    frameCount: 0,
    frames: [],                     // frames[f] = Uint8Array(MAX_CH)
    beats: [],                      // saniye cinsinden
    bpm: null,
    isPlaying: false,
    audioCtx: null,
    sourceNode: null,
    startedAt: 0,                   // audioCtx.currentTime - offset when started
    startOffset: 0,                 // saniye, pause/seek offset
    pxPerFrame: 8,
    rowHeight: 22,
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  // ─────────────────────────────────────────────────────────────
  //  Yardımcılar
  // ─────────────────────────────────────────────────────────────
  function fmtTime(s) {
    if (!isFinite(s)) s = 0;
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    const ds = Math.floor((s * 10) % 10);
    return `${m}:${String(ss).padStart(2, '0')}.${ds}`;
  }

  let toastTimer;
  function toast(msg, kind = '') {
    const el = $('#toast');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.hidden = true), 2500);
  }

  function ensureFrames() {
    state.frameCount = Math.max(1, Math.ceil(state.duration * 1000 / STEP_MS));
    if (state.frames.length !== state.frameCount) {
      const next = new Array(state.frameCount);
      for (let i = 0; i < state.frameCount; i++) {
        next[i] = state.frames[i] || new Uint8Array(MAX_CH);
      }
      state.frames = next;
    }
  }

  function clearFrames() {
    for (let i = 0; i < state.frameCount; i++) {
      state.frames[i] = new Uint8Array(MAX_CH);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Audio yükle & dekode et
  // ─────────────────────────────────────────────────────────────
  async function loadAudioFile(file) {
    if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await state.audioCtx.decodeAudioData(arrayBuffer.slice(0));
    state.audioBuffer = buffer;
    state.audioName = file.name.replace(/\.[^.]+$/, '');
    state.duration = buffer.duration;
    state.startOffset = 0;
    ensureFrames();
    drawWaveform();
    drawRuler();
    drawGrid();
    updateTime();
    updateFrameDisplay();
    toast(`Yüklendi: ${file.name} · ${fmtTime(buffer.duration)}`, 'ok');
  }

  // ─────────────────────────────────────────────────────────────
  //  Beat tespiti (energy onset)
  // ─────────────────────────────────────────────────────────────
  function detectBeats(audioBuffer, sensitivity) {
    const sr = audioBuffer.sampleRate;
    const ch = audioBuffer.numberOfChannels;
    const N  = audioBuffer.length;
    const a = audioBuffer.getChannelData(0);
    const b = ch > 1 ? audioBuffer.getChannelData(1) : null;

    const win = 1024;
    const hop = 512;
    const energies = [];
    for (let i = 0; i + win < N; i += hop) {
      let s = 0;
      for (let j = 0; j < win; j++) {
        const v = b ? (a[i + j] + b[i + j]) * 0.5 : a[i + j];
        s += v * v;
      }
      energies.push(Math.sqrt(s / win));
    }
    // adaptive threshold using local mean & std
    const lookback = 24;
    const baseMul = 1.10 + (10 - sensitivity) * 0.06;   // sens 10 → 1.10, sens 1 → 1.64
    const minGap = 0.12; // s
    const beats = [];
    for (let i = lookback; i < energies.length; i++) {
      let mean = 0;
      for (let k = i - lookback; k < i; k++) mean += energies[k];
      mean /= lookback;
      let varSum = 0;
      for (let k = i - lookback; k < i; k++) {
        const d = energies[k] - mean;
        varSum += d * d;
      }
      const std = Math.sqrt(varSum / lookback);
      const thr = mean * baseMul + std * 0.6;
      const next = energies[i + 1] ?? 0;
      if (
        energies[i] > thr &&
        energies[i] > energies[i - 1] &&
        energies[i] >= next &&
        energies[i] > 0.008
      ) {
        const t = (i * hop) / sr;
        if (beats.length === 0 || t - beats[beats.length - 1] > minGap) {
          beats.push(t);
        }
      }
    }
    return beats;
  }

  function estimateBpm(beats) {
    if (beats.length < 4) return null;
    const ivals = [];
    for (let i = 1; i < beats.length; i++) ivals.push(beats[i] - beats[i - 1]);
    ivals.sort((x, y) => x - y);
    const med = ivals[Math.floor(ivals.length / 2)];
    if (med <= 0) return null;
    let bpm = 60 / med;
    while (bpm < 70)  bpm *= 2;
    while (bpm > 180) bpm /= 2;
    return Math.round(bpm);
  }

  // ─────────────────────────────────────────────────────────────
  //  Pattern üretici
  // ─────────────────────────────────────────────────────────────
  function generateShow() {
    if (!state.audioBuffer) { toast('Önce şarkı yükle.', 'error'); return; }
    const sens = +$('#sensitivity').value;
    const pulse = Math.max(1, +$('#pulseLen').value || 2);
    const style = $('#patternStyle').value;
    const includeClosures = $('#includeClosures').checked;
    const autoSignals = $('#autoSignals').checked;

    state.beats = detectBeats(state.audioBuffer, sens);
    state.bpm = estimateBpm(state.beats);
    $('#bpmDisplay').textContent = `BPM: ${state.bpm ?? '--'}`;
    $('#beatsDisplay').textContent = `beats: ${state.beats.length}`;

    clearFrames();

    const outline    = [0, 1, 2, 3, 4, 5];
    const headlights = [6, 7, 8, 9];
    const tails      = [12, 13];
    const signals    = [16, 17, 18, 19];
    const closures   = [20, 21, 22, 23, 24, 25, 26, 27, 28, 29];

    const setRange = (chs, frameIdx) => {
      for (let p = 0; p < pulse; p++) {
        const f = frameIdx + p;
        if (f < 0 || f >= state.frameCount) continue;
        const row = state.frames[f];
        for (const c of chs) row[c] = 1;
      }
    };

    state.beats.forEach((t, i) => {
      const f = Math.floor(t * 1000 / STEP_MS);
      let chs = [];
      switch (style) {
        case 'strobe': {
          chs = [...outline, ...headlights];
          if (i % 2 === 0) chs.push(...tails);
          break;
        }
        case 'chase': {
          const order = [0, 1, 3, 5, 4, 2];      // saat yönünde outline
          chs = [order[i % order.length]];
          if (i % 4 === 0) chs.push(10);          // long beam
          break;
        }
        case 'wave': {
          const stage = i % 3;
          if (stage === 0) chs = [...headlights, 10];
          else if (stage === 1) chs = [2, 3, 18, 19];
          else chs = [...tails, 4, 5, 14];
          break;
        }
        case 'random': {
          const pool = includeClosures
            ? [...outline, ...headlights, ...tails, ...closures]
            : [...outline, ...headlights, ...tails];
          const k = 2 + Math.floor(Math.random() * 4);
          chs = [];
          while (chs.length < k) {
            const c = pool[Math.floor(Math.random() * pool.length)];
            if (!chs.includes(c)) chs.push(c);
          }
          break;
        }
        case 'beatdrop': {
          if (i % 4 === 0) {
            chs = [...outline, ...headlights, 10, ...tails, ...signals];
          } else {
            chs = i % 2 === 0 ? [0, 1, 6, 8] : [4, 5, 12, 13];
          }
          break;
        }
        case 'symmetric': {
          const pairs = [
            [0, 1], [6, 8], [7, 9], [2, 3], [4, 5], [12, 13], [16, 17],
          ];
          chs = pairs[i % pairs.length];
          if (i % 8 === 0) chs = [...chs, 10];
          break;
        }
      }
      if (autoSignals && i % 6 === 0) chs.push(16, 17);
      if (includeClosures && i % 8 === 0) chs.push(closures[i % closures.length]);
      setRange(chs, f);
    });

    drawGrid();
    drawWaveform();
    syncSvg(getCurrentFrame());
    toast(`${state.beats.length} beat algılandı · ${state.bpm ?? '--'} BPM`, 'ok');
  }

  // ─────────────────────────────────────────────────────────────
  //  Çizim — waveform, ruler, grid
  // ─────────────────────────────────────────────────────────────
  function setupCanvasHiDPI(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    const W = Math.max(1, Math.floor(w));
    const H = Math.max(1, Math.floor(h));
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  function drawWaveform() {
    const canvas = $('#waveformCanvas');
    const totalW = state.frameCount * state.pxPerFrame;
    const h = 56;
    const wrap = canvas.parentElement;
    wrap.style.width = (totalW + 14) + 'px';   // not used (parent handles), but keeps layout
    const ctx = setupCanvasHiDPI(canvas, totalW, h);
    ctx.clearRect(0, 0, totalW, h);

    if (state.audioBuffer) {
      const data = state.audioBuffer.getChannelData(0);
      const N = data.length;
      const step = Math.max(1, Math.floor(N / totalW));
      ctx.fillStyle = '#3a4658';
      ctx.beginPath();
      for (let x = 0; x < totalW; x++) {
        let min = 1, max = -1;
        const start = x * step;
        for (let i = 0; i < step; i++) {
          const v = data[start + i] || 0;
          if (v < min) min = v;
          if (v > max) max = v;
        }
        const y1 = ((1 - max) * 0.5) * h;
        const y2 = ((1 - min) * 0.5) * h;
        ctx.fillRect(x, y1, 1, Math.max(1, y2 - y1));
      }
    }
    // beats
    ctx.fillStyle = 'rgba(227,25,55,0.55)';
    for (const t of state.beats) {
      const x = (t * 1000 / STEP_MS) * state.pxPerFrame;
      ctx.fillRect(x, 0, 1.5, h);
    }
  }

  function drawRuler() {
    const canvas = $('#rulerCanvas');
    const totalW = state.frameCount * state.pxPerFrame;
    const h = 22;
    const ctx = setupCanvasHiDPI(canvas, totalW, h);
    ctx.clearRect(0, 0, totalW, h);
    ctx.fillStyle = '#0d1117';
    ctx.fillRect(0, 0, totalW, h);
    ctx.font = '10px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#8b97a8';
    const tickEverySec = state.pxPerFrame >= 6 ? 1 : (state.pxPerFrame >= 3 ? 2 : 5);
    for (let s = 0; s <= state.duration + 0.001; s += tickEverySec) {
      const x = (s * 1000 / STEP_MS) * state.pxPerFrame;
      ctx.fillRect(x, h - 6, 1, 6);
      ctx.fillText(`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`, x + 3, 12);
    }
  }

  function drawGrid() {
    const labelsEl = $('#channelLabels');
    if (!labelsEl.children.length) {
      const frag = document.createDocumentFragment();
      CHANNELS.forEach((c) => {
        const row = document.createElement('div');
        row.className = `row group-${c.group}`;
        row.textContent = c.name;
        frag.appendChild(row);
      });
      labelsEl.appendChild(frag);
    }
    const canvas = $('#gridCanvas');
    const totalW = state.frameCount * state.pxPerFrame;
    const totalH = MAX_CH * state.rowHeight;
    const ctx = setupCanvasHiDPI(canvas, totalW, totalH);
    ctx.clearRect(0, 0, totalW, totalH);

    // arka plan + satır çizgileri
    for (let r = 0; r < MAX_CH; r++) {
      ctx.fillStyle = r % 2 === 0 ? '#0e1420' : '#10172278';
      ctx.fillRect(0, r * state.rowHeight, totalW, state.rowHeight);
    }
    // dikey grid (her saniye + her beat 4 frame)
    ctx.fillStyle = '#1a2231';
    const secEvery = Math.round(1000 / STEP_MS); // 20 frame = 1s
    for (let f = 0; f < state.frameCount; f++) {
      const x = f * state.pxPerFrame;
      if (f % secEvery === 0) {
        ctx.fillStyle = '#22304a';
        ctx.fillRect(x, 0, 1, totalH);
        ctx.fillStyle = '#1a2231';
      } else if (f % 4 === 0 && state.pxPerFrame >= 6) {
        ctx.fillRect(x, 0, 1, totalH);
      }
    }
    // beat dikey çizgiler
    ctx.fillStyle = 'rgba(227,25,55,0.18)';
    for (const t of state.beats) {
      const x = (t * 1000 / STEP_MS) * state.pxPerFrame;
      ctx.fillRect(x, 0, 1, totalH);
    }
    // hücreler
    for (let f = 0; f < state.frameCount; f++) {
      const row = state.frames[f];
      if (!row) continue;
      const x = f * state.pxPerFrame;
      for (let c = 0; c < MAX_CH; c++) {
        if (!row[c]) continue;
        const y = c * state.rowHeight + 2;
        ctx.fillStyle = colorForGroup(CHANNELS[c].group);
        ctx.fillRect(x, y, Math.max(1, state.pxPerFrame - 1), state.rowHeight - 4);
      }
    }
    $('#zoomLabel').textContent = `${state.pxPerFrame} px / frame`;
  }

  function colorForGroup(g) {
    return {
      outline:   '#57f5ff',
      headlight: '#ffe27a',
      tail:      '#ff3a4a',
      signal:    '#ffb454',
      closure:   '#c084fc',
    }[g] || '#e6edf3';
  }

  // ─────────────────────────────────────────────────────────────
  //  Grid etkileşim (tıkla / sürükle)
  // ─────────────────────────────────────────────────────────────
  function setupGridInteraction() {
    const canvas = $('#gridCanvas');
    let painting = null;        // 'add' | 'erase' | null
    let lastCell = null;

    const cellFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const f = Math.floor(x / state.pxPerFrame);
      const c = Math.floor(y / state.rowHeight);
      if (f < 0 || f >= state.frameCount || c < 0 || c >= MAX_CH) return null;
      return { f, c };
    };

    canvas.addEventListener('mousedown', (e) => {
      const cell = cellFromEvent(e);
      if (!cell) return;
      const cur = state.frames[cell.f][cell.c];
      painting = e.shiftKey ? 'erase' : (cur ? 'erase' : 'add');
      applyPaint(cell);
      lastCell = cell;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!painting) return;
      const cell = cellFromEvent(e);
      if (!cell || (lastCell && cell.f === lastCell.f && cell.c === lastCell.c)) return;
      applyPaint(cell);
      lastCell = cell;
    });
    window.addEventListener('mouseup', () => { painting = null; lastCell = null; });

    function applyPaint({ f, c }) {
      state.frames[f][c] = painting === 'add' ? 1 : 0;
      // satır + sütun bölgesini hızlı yeniden çiz (tek hücre)
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const x = f * state.pxPerFrame;
      const y = c * state.rowHeight;
      ctx.fillStyle = c % 2 === 0 ? '#0e1420' : '#101722';
      ctx.fillRect(x, y, state.pxPerFrame, state.rowHeight);
      // beat çizgisi varsa korumak için tüm satırı tam yeniden çizmek yerine kenarları ekle
      if (state.frames[f][c]) {
        ctx.fillStyle = colorForGroup(CHANNELS[c].group);
        ctx.fillRect(x, y + 2, Math.max(1, state.pxPerFrame - 1), state.rowHeight - 4);
      }
      syncSvg(getCurrentFrame());
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Playback
  // ─────────────────────────────────────────────────────────────
  function play() {
    if (!state.audioBuffer) { toast('Önce şarkı yükle.', 'error'); return; }
    if (state.isPlaying) return;
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    const src = state.audioCtx.createBufferSource();
    src.buffer = state.audioBuffer;
    src.connect(state.audioCtx.destination);
    src.start(0, state.startOffset);
    state.sourceNode = src;
    state.startedAt = state.audioCtx.currentTime - state.startOffset;
    state.isPlaying = true;
    $('#playBtn').textContent = '❚❚';
    src.onended = () => {
      if (state.isPlaying) stop(true);
    };
    requestAnimationFrame(tick);
  }

  function pause() {
    if (!state.isPlaying) return;
    state.startOffset = state.audioCtx.currentTime - state.startedAt;
    if (state.sourceNode) state.sourceNode.stop();
    state.isPlaying = false;
    $('#playBtn').textContent = '▶';
  }

  function stop(natural = false) {
    if (state.sourceNode) {
      try { state.sourceNode.onended = null; state.sourceNode.stop(); } catch (e) {}
    }
    state.isPlaying = false;
    state.startOffset = natural ? state.duration : 0;
    if (natural) state.startOffset = 0;
    $('#playBtn').textContent = '▶';
    updateTime();
    updatePlayhead();
    syncSvg(getCurrentFrame());
  }

  function getCurrentFrame() {
    let t = state.startOffset;
    if (state.isPlaying) t = state.audioCtx.currentTime - state.startedAt;
    t = Math.max(0, Math.min(state.duration, t));
    return Math.floor(t * 1000 / STEP_MS);
  }

  function tick() {
    if (!state.isPlaying) return;
    updateTime();
    updatePlayhead();
    syncSvg(getCurrentFrame());
    if (state.audioCtx.currentTime - state.startedAt >= state.duration) {
      stop(true);
      return;
    }
    requestAnimationFrame(tick);
  }

  function updateTime() {
    const t = state.isPlaying ? (state.audioCtx.currentTime - state.startedAt) : state.startOffset;
    $('#timeDisplay').textContent = `${fmtTime(t)} / ${fmtTime(state.duration)}`;
    $('#seek').value = state.duration ? Math.round((t / state.duration) * 1000) : 0;
    updateFrameDisplay();
  }
  function updateFrameDisplay() {
    $('#frameDisplay').textContent = `frame ${getCurrentFrame()} / ${state.frameCount}`;
  }
  function updatePlayhead() {
    const f = getCurrentFrame();
    const x = f * state.pxPerFrame;
    const ph = $('#playhead');
    ph.style.transform = `translateX(${140 + x}px)`;
    // otomatik scroll
    const scroller = $('#gridScroll');
    const left = scroller.scrollLeft;
    const view = scroller.clientWidth;
    if (x + 140 < left || x + 140 > left + view - 60) {
      scroller.scrollLeft = Math.max(0, x - view * 0.3);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  SVG senkron (seçili frame'i ışıkları yansıt)
  // ─────────────────────────────────────────────────────────────
  function syncSvg(frameIdx) {
    const row = state.frames[frameIdx] || new Uint8Array(MAX_CH);
    if (window.Car3D && window.Car3D.syncChannels) {
      window.Car3D.syncChannels(row);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  .fseq v2.0 (uncompressed, Tesla uyumlu) export
  // ─────────────────────────────────────────────────────────────
  function buildFseq() {
    const channelCount = MAX_CH;
    const frameCount = state.frameCount;
    const headerLen = 32;
    const dataOffset = headerLen;
    const totalSize = dataOffset + frameCount * channelCount;

    const buf = new ArrayBuffer(totalSize);
    const view = new DataView(buf);
    // 'PSEQ'
    view.setUint8(0, 0x50); view.setUint8(1, 0x53);
    view.setUint8(2, 0x45); view.setUint8(3, 0x51);
    view.setUint16(4, dataOffset, true);     // channel data offset
    view.setUint8(6, 0);                     // minor version
    view.setUint8(7, 2);                     // major version
    view.setUint16(8, headerLen, true);      // header length
    view.setUint32(10, channelCount, true);  // channel count
    view.setUint32(14, frameCount, true);    // frame count
    view.setUint8(18, STEP_MS);              // step time ms
    view.setUint8(19, 0);                    // flags
    view.setUint8(20, 0);                    // compression type: none
    view.setUint8(21, 0);                    // num compression blocks
    view.setUint8(22, 0);                    // num sparse ranges
    view.setUint8(23, 0);                    // flags2
    // 24..31: unique id (8 bytes) — timestamp ms
    const id = BigInt(Date.now());
    view.setBigUint64(24, id, true);

    const u8 = new Uint8Array(buf, dataOffset);
    for (let f = 0; f < frameCount; f++) {
      const row = state.frames[f];
      const off = f * channelCount;
      for (let c = 0; c < channelCount; c++) {
        u8[off + c] = row && row[c] ? 255 : 0;
      }
    }
    return buf;
  }

  function downloadBlob(buf, name, type = 'application/octet-stream') {
    const blob = new Blob([buf], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  // ─────────────────────────────────────────────────────────────
  //  WAV export (16-bit PCM)
  // ─────────────────────────────────────────────────────────────
  function audioBufferToWav(buffer) {
    const numCh = Math.min(buffer.numberOfChannels, 2);
    const sr = buffer.sampleRate;
    const N  = buffer.length;
    const bps = 2;
    const blockAlign = numCh * bps;
    const dataSize = N * blockAlign;
    const buf = new ArrayBuffer(44 + dataSize);
    const v = new DataView(buf);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    v.setUint32(4, 36 + dataSize, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    v.setUint32(16, 16, true);
    v.setUint16(20, 1, true);          // PCM
    v.setUint16(22, numCh, true);
    v.setUint32(24, sr, true);
    v.setUint32(28, sr * blockAlign, true);
    v.setUint16(32, blockAlign, true);
    v.setUint16(34, 16, true);
    writeStr(36, 'data');
    v.setUint32(40, dataSize, true);

    const channels = [];
    for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
    let off = 44;
    for (let i = 0; i < N; i++) {
      for (let c = 0; c < numCh; c++) {
        let s = Math.max(-1, Math.min(1, channels[c][i]));
        v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        off += 2;
      }
    }
    return buf;
  }

  // ─────────────────────────────────────────────────────────────
  //  Proje JSON
  // ─────────────────────────────────────────────────────────────
  function exportProject() {
    const data = {
      version: 1,
      audioName: state.audioName,
      duration: state.duration,
      frameCount: state.frameCount,
      bpm: state.bpm,
      beats: state.beats,
      // frames: array of arrays of channel-indices (sparse)
      frames: state.frames.map((r) => {
        const idx = [];
        for (let c = 0; c < MAX_CH; c++) if (r[c]) idx.push(c);
        return idx;
      }),
    };
    const json = JSON.stringify(data);
    downloadBlob(new TextEncoder().encode(json), `${state.audioName || 'show'}.tlsm.json`, 'application/json');
    toast('Proje indirildi.', 'ok');
  }

  function importProject(text) {
    const d = JSON.parse(text);
    state.duration = d.duration || (d.frameCount * STEP_MS / 1000);
    state.frameCount = d.frameCount || Math.ceil(state.duration * 1000 / STEP_MS);
    state.frames = new Array(state.frameCount);
    for (let f = 0; f < state.frameCount; f++) {
      state.frames[f] = new Uint8Array(MAX_CH);
      const idx = (d.frames && d.frames[f]) || [];
      for (const c of idx) state.frames[f][c] = 1;
    }
    state.beats = d.beats || [];
    state.bpm   = d.bpm  || null;
    $('#bpmDisplay').textContent = `BPM: ${state.bpm ?? '--'}`;
    $('#beatsDisplay').textContent = `beats: ${state.beats.length}`;
    drawWaveform();
    drawRuler();
    drawGrid();
    syncSvg(getCurrentFrame());
    toast('Proje yüklendi.', 'ok');
  }

  // ─────────────────────────────────────────────────────────────
  //  Olay bağlantıları
  // ─────────────────────────────────────────────────────────────
  function bind() {
    $('#loadAudioBtn').addEventListener('click', () => $('#audioFile').click());
    $('#audioFile').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try { await loadAudioFile(f); }
      catch (err) { console.error(err); toast('Ses dosyası okunamadı.', 'error'); }
    });

    $('#autoGenBtn').addEventListener('click', generateShow);

    $('#clearBtn').addEventListener('click', () => {
      if (!state.frameCount) return;
      clearFrames(); drawGrid(); syncSvg(getCurrentFrame());
      toast('Tüm kanallar temizlendi.');
    });

    $('#exportFseqBtn').addEventListener('click', () => {
      if (!state.frameCount) { toast('Önce show üret.', 'error'); return; }
      const buf = buildFseq();
      downloadBlob(buf, `${state.audioName || 'lightshow'}.fseq`);
      toast('lightshow.fseq indirildi.', 'ok');
    });
    $('#exportWavBtn').addEventListener('click', () => {
      if (!state.audioBuffer) { toast('Önce şarkı yükle.', 'error'); return; }
      const buf = audioBufferToWav(state.audioBuffer);
      downloadBlob(buf, `${state.audioName || 'lightshow'}.wav`, 'audio/wav');
      toast('lightshow.wav indirildi.', 'ok');
    });

    $('#saveProjectBtn').addEventListener('click', exportProject);
    $('#loadProjectBtn').addEventListener('click', () => $('#projectFile').click());
    $('#projectFile').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { importProject(await f.text()); }
      catch (err) { console.error(err); toast('Proje okunamadı.', 'error'); }
    });

    $('#playBtn').addEventListener('click', () => state.isPlaying ? pause() : play());
    $('#stopBtn').addEventListener('click', () => stop());

    $('#seek').addEventListener('input', (e) => {
      if (!state.duration) return;
      const wasPlaying = state.isPlaying;
      if (wasPlaying) pause();
      state.startOffset = (+e.target.value / 1000) * state.duration;
      updateTime();
      updatePlayhead();
      syncSvg(getCurrentFrame());
      if (wasPlaying) play();
    });

    $('#sensitivity').addEventListener('input', (e) => $('#sensVal').textContent = e.target.value);

    // Yatay scroll senkronu: grid kayarken ruler & waveform da kaysın
    $('#gridScroll').addEventListener('scroll', (e) => {
      const x = e.target.scrollLeft;
      $('#rulerCanvas').style.transform = `translateX(${-x}px)`;
      $('#waveformCanvas').style.transform = `translateX(${-x}px)`;
    });

    $('#zoomIn').addEventListener('click', () => {
      state.pxPerFrame = Math.min(40, state.pxPerFrame + 2);
      drawAll();
    });
    $('#zoomOut').addEventListener('click', () => {
      state.pxPerFrame = Math.max(2, state.pxPerFrame - 2);
      drawAll();
    });

    // 3D model üzerinde ışık tıklayınca → o kanalı seçili frame'de toggle
    const wireCar3DClick = () => {
      if (!window.Car3D || !window.Car3D.onLightClick) return;
      window.Car3D.onLightClick((ch) => {
        if (!state.frameCount) return;
        const f = getCurrentFrame();
        state.frames[f][ch] ^= 1;
        drawGrid();
        syncSvg(f);
      });
    };
    if (window.Car3D) wireCar3DClick();
    else window.addEventListener('car3d-ready', () => {
      wireCar3DClick();
      syncSvg(getCurrentFrame());
    }, { once: true });

    // Klavye kısayolları
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') { e.preventDefault(); state.isPlaying ? pause() : play(); }
      if (e.code === 'KeyG') generateShow();
    });

    window.addEventListener('resize', () => {
      // grid scroller width değişebilir; canvas'lar pxPerFrame bazlı olduğundan yeniden çizmeye gerek yok.
    });
  }

  function drawAll() {
    drawWaveform();
    drawRuler();
    drawGrid();
    updatePlayhead();
  }

  // ─────────────────────────────────────────────────────────────
  //  Boot
  // ─────────────────────────────────────────────────────────────
  function init() {
    state.duration = 0;
    state.frameCount = 0;
    state.frames = [];
    bind();
    setupGridInteraction();
    drawAll();
    syncSvg(0);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
