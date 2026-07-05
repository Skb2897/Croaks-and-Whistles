/* ============================================================
   Frog Call Atlas -- audio-viz.js
   Renders an oscillogram (waveform envelope) and a spectrogram
   (STFT magnitude, log-scaled) for any audio file, entirely in
   the browser: Web Audio API for decoding + a small hand-rolled
   FFT, canvas for drawing. No server, no external library.

   Usage:
     const viz = AudioViz.attach(containerEl);
     viz.loadFromUrl('assets/audio/foo.mp3');
     // or, before an upload is committed:
     viz.loadFromFile(fileInput.files[0]);
   ============================================================ */

const AudioViz = (function () {
  let sharedCtx = null;
  function getCtx() {
    if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
    return sharedCtx;
  }

  /* Iterative radix-2 Cooley-Tukey FFT, in place. re/im are Float32Array
     of length N (power of two). */
  function fftInPlace(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let tr = re[i]; re[i] = re[j]; re[j] = tr;
        let ti = im[i]; im[i] = im[j]; im[j] = ti;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (-2 * Math.PI) / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let curWr = 1, curWi = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re[i + k], ui = im[i + k];
          const vr = re[i + k + len / 2] * curWr - im[i + k + len / 2] * curWi;
          const vi = re[i + k + len / 2] * curWi + im[i + k + len / 2] * curWr;
          re[i + k] = ur + vr; im[i + k] = ui + vi;
          re[i + k + len / 2] = ur - vr; im[i + k + len / 2] = ui - vi;
          const nwr = curWr * wr - curWi * wi;
          const nwi = curWr * wi + curWi * wr;
          curWr = nwr; curWi = nwi;
        }
      }
    }
  }

  function hammingWindow(N) {
    const w = new Float32Array(N);
    for (let i = 0; i < N; i++) w[i] = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
    return w;
  }

  /* Downsamples channel data to min/max pairs per pixel column -- the
     standard "overview waveform" technique. */
  function computeOscillogram(channelData, width) {
    const samplesPerPx = channelData.length / width;
    const mins = new Float32Array(width);
    const maxs = new Float32Array(width);
    for (let x = 0; x < width; x++) {
      const start = Math.floor(x * samplesPerPx);
      const end = Math.min(channelData.length, Math.floor((x + 1) * samplesPerPx) || start + 1);
      let mn = 1, mx = -1;
      for (let i = start; i < end; i++) {
        const v = channelData[i];
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      if (end === start) { mn = 0; mx = 0; }
      mins[x] = mn; maxs[x] = mx;
    }
    return { mins, maxs };
  }

  function computeSpectrogram(channelData, sampleRate, fftSize, hop) {
    const window = hammingWindow(fftSize);
    const nFrames = Math.max(1, Math.floor((channelData.length - fftSize) / hop) + 1);
    const nBins = fftSize / 2;
    const frames = new Array(nFrames);
    const re = new Float32Array(fftSize);
    const im = new Float32Array(fftSize);
    let maxDb = -Infinity, minDb = Infinity;
    for (let f = 0; f < nFrames; f++) {
      const offset = f * hop;
      for (let i = 0; i < fftSize; i++) {
        const s = channelData[offset + i] || 0;
        re[i] = s * window[i];
        im[i] = 0;
      }
      fftInPlace(re, im);
      const mags = new Float32Array(nBins);
      for (let b = 0; b < nBins; b++) {
        const mag = Math.sqrt(re[b] * re[b] + im[b] * im[b]);
        const db = 20 * Math.log10(mag + 1e-8);
        mags[b] = db;
        if (db > maxDb) maxDb = db;
        if (db < minDb) minDb = db;
      }
      frames[f] = mags;
    }
    return { frames, nBins, sampleRate, fftSize, hop, minDb, maxDb: maxDb === -Infinity ? 0 : maxDb };
  }

  /* Duotone colour ramp: near-black forest -> warm amber/cream, echoing
     the site's herbarium-specimen palette rather than a stock rainbow. */
  function colorForT(t) {
    t = Math.max(0, Math.min(1, t));
    const stops = [
      [14, 26, 19], [31, 61, 46], [93, 122, 79], [196, 168, 92], [250, 240, 210]
    ];
    const pos = t * (stops.length - 1);
    const i0 = Math.floor(pos), i1 = Math.min(stops.length - 1, i0 + 1);
    const f = pos - i0;
    const a = stops[i0], b = stops[i1];
    const r = Math.round(a[0] + (b[0] - a[0]) * f);
    const g = Math.round(a[1] + (b[1] - a[1]) * f);
    const bl = Math.round(a[2] + (b[2] - a[2]) * f);
    return `rgb(${r},${g},${bl})`;
  }

  function drawOscillogram(canvas, osc) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#0e1a13';
    ctx.fillRect(0, 0, w, h);
    const mid = h / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(w, mid); ctx.stroke();
    ctx.fillStyle = '#c4a85c';
    const n = osc.mins.length;
    for (let x = 0; x < w; x++) {
      const idx = Math.floor((x / w) * n);
      const y1 = mid - osc.maxs[idx] * mid * 0.95;
      const y2 = mid - osc.mins[idx] * mid * 0.95;
      ctx.fillRect(x, Math.min(y1, y2), 1, Math.max(1, Math.abs(y2 - y1)));
    }
  }

  function drawSpectrogram(canvas, spec) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const img = ctx.createImageData(w, h);
    const nFrames = spec.frames.length;
    const nyquist = spec.sampleRate / 2;
    const displayMaxHz = Math.min(nyquist, 12000);
    const binsToShow = Math.max(1, Math.round((displayMaxHz / nyquist) * spec.nBins));
    const range = (spec.maxDb - spec.minDb) || 1;
    for (let x = 0; x < w; x++) {
      const frameIdx = Math.min(nFrames - 1, Math.floor((x / w) * nFrames));
      const frame = spec.frames[frameIdx];
      for (let y = 0; y < h; y++) {
        const binIdx = binsToShow - 1 - Math.floor((y / h) * binsToShow);
        const db = frame[Math.max(0, Math.min(binsToShow - 1, binIdx))];
        const t = (db - spec.minDb) / range;
        const [r, g, b] = colorForT(t).match(/\d+/g).map(Number);
        const p = (y * w + x) * 4;
        img.data[p] = r; img.data[p + 1] = g; img.data[p + 2] = b; img.data[p + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  function attach(container, opts) {
    opts = opts || {};
    container.classList.add('viz-block');
    container.innerHTML = `
      <div class="viz-tabs">
        <button type="button" class="tab-btn active" data-tab="oscillogram">Oscillogram</button>
        <button type="button" class="tab-btn" data-tab="spectrogram">Spectrogram</button>
      </div>
      <div class="viz-canvas-wrap">
        <canvas class="viz-canvas" width="900" height="160"></canvas>
      </div>
      <div class="viz-status">Waiting for audio&hellip;</div>
    `;
    const canvas = container.querySelector('canvas');
    const statusEl = container.querySelector('.viz-status');
    const tabBtns = container.querySelectorAll('.tab-btn');
    let currentTab = 'oscillogram';
    let oscData = null, specData = null, decoded = null;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(300, Math.floor(rect.width));
    }

    function redraw() {
      if (!decoded) return;
      if (currentTab === 'oscillogram') {
        if (!oscData) oscData = computeOscillogram(decoded.getChannelData(0), canvas.width);
        drawOscillogram(canvas, oscData);
      } else {
        if (!specData) {
          statusEl.textContent = 'Computing spectrogram\u2026';
          specData = computeSpectrogram(decoded.getChannelData(0), decoded.sampleRate, 1024, 256);
        }
        drawSpectrogram(canvas, specData);
      }
      const dur = decoded.duration;
      statusEl.textContent = `${dur.toFixed(2)}s \u00b7 ${decoded.sampleRate} Hz \u00b7 ${currentTab}`;
    }

    tabBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        tabBtns.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        currentTab = btn.getAttribute('data-tab');
        oscData = currentTab === 'oscillogram' ? oscData : oscData;
        redraw();
      });
    });

    async function decodeArrayBuffer(arrayBuffer) {
      statusEl.textContent = 'Decoding audio\u2026';
      oscData = null; specData = null;
      const ctx = getCtx();
      decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      resizeCanvas();
      redraw();
    }

    return {
      async loadFromUrl(url) {
        try {
          statusEl.textContent = 'Fetching audio\u2026';
          const res = await fetch(url);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const buf = await res.arrayBuffer();
          await decodeArrayBuffer(buf);
        } catch (err) {
          statusEl.textContent = 'Could not load audio: ' + err.message;
        }
      },
      async loadFromFile(file) {
        try {
          const buf = await file.arrayBuffer();
          await decodeArrayBuffer(buf);
        } catch (err) {
          statusEl.textContent = 'Could not decode file: ' + err.message;
        }
      },
      clear() {
        decoded = null; oscData = null; specData = null;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0e1a13';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        statusEl.textContent = 'Waiting for audio\u2026';
      },
    };
  }

  return { attach };
})();
