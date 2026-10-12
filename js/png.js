'use strict';
// Small synchronous PNG decoder (the MIDlet builds images from raw bytes and expects them immediately).

const $inflate = (() => {
  const LBASE = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258];
  const LEXT = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0];
  const DBASE = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577];
  const DEXT = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13];
  const CLORDER = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];

  function build(lengths, n) {
    const count = new Uint16Array(16), offs = new Uint16Array(16), symbols = new Uint16Array(n);
    for (let i = 0; i < n; i++) count[lengths[i]]++;
    count[0] = 0;
    for (let i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (let i = 0; i < n; i++) if (lengths[i]) symbols[offs[lengths[i]]++] = i;
    return { count, symbols };
  }
  let fixedL = null, fixedD = null;
  function fixed() {
    if (fixedL) return;
    const l = new Uint8Array(288);
    for (let i = 0; i < 144; i++) l[i] = 8; for (let i = 144; i < 256; i++) l[i] = 9; for (let i = 256; i < 280; i++) l[i] = 7; for (let i = 280; i < 288; i++) l[i] = 8;
    fixedL = build(l, 288);
    const d = new Uint8Array(30).fill(5); fixedD = build(d, 30);
  }
  return function inflate(src, start) {
    let pos = start, bitbuf = 0, bitcnt = 0;
    let out = new Uint8Array(Math.max(1024, src.length * 4)), op = 0;
    function need(n) { if (op + n > out.length) { const o = new Uint8Array(Math.max(out.length * 2, op + n)); o.set(out); out = o; } }
    function bits(n) {
      while (bitcnt < n) { bitbuf |= src[pos++] << bitcnt; bitcnt += 8; }
      const v = bitbuf & ((1 << n) - 1); bitbuf >>>= n; bitcnt -= n; return v;
    }
    function decode(h) {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const c = h.count[len];
        if (code - c < first) return h.symbols[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      throw new Error('bad huffman code');
    }
    function codes(lh, dh) {
      for (;;) {
        let sym = decode(lh);
        if (sym < 256) { need(1); out[op++] = sym; }
        else if (sym === 256) return;
        else {
          sym -= 257;
          const len = LBASE[sym] + bits(LEXT[sym]);
          const ds = decode(dh);
          const dist = DBASE[ds] + bits(DEXT[ds]);
          need(len);
          for (let i = 0; i < len; i++) { out[op] = out[op - dist]; op++; }
        }
      }
    }
    let last;
    do {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        bitbuf = 0; bitcnt = 0;
        const len = src[pos] | (src[pos + 1] << 8); pos += 4;
        need(len); out.set(src.subarray(pos, pos + len), op); op += len; pos += len;
      } else if (type === 1) { fixed(); codes(fixedL, fixedD); }
      else if (type === 2) {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        const lengths = new Uint8Array(320);
        for (let i = 0; i < ncode; i++) lengths[CLORDER[i]] = bits(3);
        const lh = build(lengths, 19);
        let i = 0; const ll = new Uint8Array(320);
        while (i < nlen + ndist) {
          const sym = decode(lh);
          if (sym < 16) ll[i++] = sym;
          else {
            let prev = 0, rep;
            if (sym === 16) { prev = ll[i - 1]; rep = 3 + bits(2); }
            else if (sym === 17) rep = 3 + bits(3);
            else rep = 11 + bits(7);
            while (rep--) ll[i++] = prev;
          }
        }
        codes(build(ll.subarray(0, nlen), nlen), build(ll.subarray(nlen, nlen + ndist), ndist));
      } else throw new Error('bad block');
    } while (!last);
    return out.subarray(0, op);
  };
})();

function $decodePNG(b) {
  // b: array-like of bytes (Int8Array/Uint8Array)
  const u = b instanceof Uint8Array ? b : new Uint8Array(b.buffer, b.byteOffset, b.length);
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (u[i] !== sig[i]) throw new Error('not a PNG');
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0, plte = null, trns = null;
  const idat = [];
  const rd32 = (o) => ((u[o] << 24) | (u[o + 1] << 16) | (u[o + 2] << 8) | u[o + 3]) >>> 0;
  while (p < u.length) {
    const len = rd32(p), type = String.fromCharCode(u[p + 4], u[p + 5], u[p + 6], u[p + 7]); const d = p + 8;
    if (type === 'IHDR') { w = rd32(d); h = rd32(d + 4); depth = u[d + 8]; ctype = u[d + 9]; interlace = u[d + 12]; }
    else if (type === 'PLTE') plte = u.subarray(d, d + len);
    else if (type === 'tRNS') trns = u.subarray(d, d + len);
    else if (type === 'IDAT') idat.push(u.subarray(d, d + len));
    else if (type === 'IEND') break;
    p = d + len + 4;
  }
  if (interlace) throw new Error('interlaced PNG unsupported');
  let total = 0; for (const c of idat) total += c.length;
  const z = new Uint8Array(total); let o = 0; for (const c of idat) { z.set(c, o); o += c.length; }
  const raw = $inflate(z, 2);
  const chans = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  const bpp = Math.max(1, (chans * depth) >> 3);
  const stride = (w * chans * depth + 7) >> 3;
  const data = new Uint8Array(stride * h);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[rp++]; const row = y * stride, prev = row - stride;
    for (let x = 0; x < stride; x++) {
      const v = raw[rp++];
      const a = x >= bpp ? data[row + x - bpp] : 0;
      const bb = y > 0 ? data[prev + x] : 0;
      const c = (x >= bpp && y > 0) ? data[prev + x - bpp] : 0;
      let r;
      switch (f) {
        case 0: r = v; break; case 1: r = v + a; break; case 2: r = v + bb; break; case 3: r = v + ((a + bb) >> 1); break;
        default: { const pp = a + bb - c, pa = Math.abs(pp - a), pb = Math.abs(pp - bb), pc = Math.abs(pp - c); r = v + (pa <= pb && pa <= pc ? a : (pb <= pc ? bb : c)); }
      }
      data[row + x] = r & 255;
    }
  }
  const rgba = new Uint8ClampedArray(w * h * 4);
  const maxv = (1 << depth) - 1;
  const sample = (row, idx) => {
    if (depth === 8) return data[row + idx];
    if (depth === 16) return data[row + idx * 2];
    const per = 8 / depth, byte = data[row + ((idx / per) | 0)], shift = 8 - depth * ((idx % per) + 1);
    return (byte >> shift) & maxv;
  };
  for (let y = 0; y < h; y++) {
    const row = y * stride;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; let r, g, bl, a = 255;
      if (ctype === 3) {
        const k = sample(row, x); r = plte[k * 3]; g = plte[k * 3 + 1]; bl = plte[k * 3 + 2]; if (trns && k < trns.length) a = trns[k];
      } else if (ctype === 0) {
        const k = sample(row, x); const s = depth >= 8 ? k : Math.round(k * 255 / maxv); r = g = bl = s;
        if (trns && trns.length >= 2 && k === (((trns[0] << 8) | trns[1]) & maxv)) a = 0;
      } else if (ctype === 2) {
        r = sample(row, x * 3); g = sample(row, x * 3 + 1); bl = sample(row, x * 3 + 2);
      } else if (ctype === 4) { r = g = bl = sample(row, x * 2); a = sample(row, x * 2 + 1); }
      else { r = sample(row, x * 4); g = sample(row, x * 4 + 1); bl = sample(row, x * 4 + 2); a = sample(row, x * 4 + 3); }
      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = bl; rgba[i + 3] = a;
    }
  }
  return { w, h, rgba };
}
