'use strict';
// "HD" mode: the game logic still runs on the original 240x320 grid, but the picture is drawn on a K-times larger canvas
// and every bitmap is smoothly upscaled once when it is loaded (premultiplied-alpha bicubic + light sharpening).
// It is an upscale of the original art, not redrawn art.
const $HD = (function () {
  let k = 3;
  try {
    const q = new URLSearchParams(location.search).get('hd');
    const s = q !== null ? q : localStorage.getItem('ia2:hd');
    if (s !== null && s !== '') k = Math.max(1, Math.min(4, parseInt(s, 10) || 1));
  } catch (e) {}

  function weights(K) {            // Catmull-Rom taps for each output phase
    const W = [];
    for (let p = 0; p < K; p++) {
      const sx = (p + 0.5) / K - 0.5, f = sx - Math.floor(sx), w = new Float32Array(4);
      const cub = (x) => { x = Math.abs(x); const a = -0.5; return x <= 1 ? (a + 2) * x * x * x - (a + 3) * x * x + 1 : x < 2 ? a * x * x * x - 5 * a * x * x + 8 * a * x - 4 * a : 0; };
      for (let t = 0; t < 4; t++) w[t] = cub(t - 1 - f);
      const s = w[0] + w[1] + w[2] + w[3]; for (let t = 0; t < 4; t++) w[t] /= s;
      W.push({ base: Math.floor(sx), w });
    }
    return W;
  }

  function upscale(w, h, rgba, K) {
    const W = weights(K), ow = w * K, oh = h * K;
    // premultiply
    const src = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const a = rgba[i * 4 + 3] / 255; src[i * 4] = rgba[i * 4] * a; src[i * 4 + 1] = rgba[i * 4 + 1] * a; src[i * 4 + 2] = rgba[i * 4 + 2] * a; src[i * 4 + 3] = rgba[i * 4 + 3]; }
    const tmp = new Float32Array(ow * h * 4);
    for (let y = 0; y < h; y++) for (let ox = 0; ox < ow; ox++) {
      const ph = W[ox % K], bx = Math.floor(ox / K) + ph.base, o = (y * ow + ox) * 4;
      for (let c = 0; c < 4; c++) {
        let v = 0;
        for (let t = 0; t < 4; t++) { let xx = bx + t - 1; xx = xx < 0 ? 0 : xx >= w ? w - 1 : xx; v += src[(y * w + xx) * 4 + c] * ph.w[t]; }
        tmp[o + c] = v;
      }
    }
    const out = new Uint8ClampedArray(ow * oh * 4);
    for (let oy = 0; oy < oh; oy++) {
      const ph = W[oy % K], by = Math.floor(oy / K) + ph.base;
      for (let ox = 0; ox < ow; ox++) {
        let r = 0, g = 0, b = 0, a = 0;
        for (let t = 0; t < 4; t++) { let yy = by + t - 1; yy = yy < 0 ? 0 : yy >= h ? h - 1 : yy; const q = (yy * ow + ox) * 4, wt = ph.w[t]; r += tmp[q] * wt; g += tmp[q + 1] * wt; b += tmp[q + 2] * wt; a += tmp[q + 3] * wt; }
        a = a < 0 ? 0 : a > 255 ? 255 : a;
        const o = (oy * ow + ox) * 4;
        if (a > 0.5) { const m = 255 / a; r *= m; g *= m; b *= m; } else { r = g = b = 0; }
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a;
      }
    }
    return out;
  }

  return {
    k,
    canvasFor(w, h, rgba) {
      const cv = document.createElement('canvas');
      if (k <= 1) { cv.width = w; cv.height = h; cv.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0); return cv; }
      const up = upscale(w, h, rgba, k);
      cv.width = w * k; cv.height = h * k; cv.getContext('2d').putImageData(new ImageData(up, w * k, h * k), 0, 0);
      return cv;
    },
  };
})();
