'use strict';
// Tiny Standard MIDI File player on top of Web Audio (the original game ships its music as .mid).
(function () {
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('ia2:muted') === '1'; } catch (e) {}

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5;
    const comp = ctx.createDynamicsCompressor(); master.connect(comp); comp.connect(ctx.destination);
    return ctx;
  }

  // ---------- parse ----------
  function parse(b) {
    let p = 0;
    const u32 = () => ((b[p++] << 24) | (b[p++] << 16) | (b[p++] << 8) | b[p++]) >>> 0;
    const u16 = () => (b[p++] << 8) | b[p++];
    const tag = () => String.fromCharCode(b[p++], b[p++], b[p++], b[p++]);
    if (tag() !== 'MThd') throw new Error('not midi');
    u32(); u16(); const ntr = u16(); const div = u16();
    const events = [];
    for (let t = 0; t < ntr; t++) {
      if (tag() !== 'MTrk') break;
      const len = u32(), end = p + len; let tick = 0, run = 0;
      const vlq = () => { let v = 0, c; do { c = b[p++]; v = (v << 7) | (c & 127); } while (c & 128); return v; };
      while (p < end) {
        tick += vlq(); let st = b[p];
        if (st & 128) { p++; if (st < 0xF0) run = st; } else st = run;
        if (st === 0xFF) { const type = b[p++], l = vlq(); if (type === 0x51) events.push({ tick, k: 'tempo', v: (b[p] << 16) | (b[p + 1] << 8) | b[p + 2] }); p += l; }
        else if (st === 0xF0 || st === 0xF7) { const l = vlq(); p += l; }
        else {
          const ch = st & 15, hi = st >> 4;
          if (hi === 0x9 || hi === 0x8) { const n = b[p++], v = b[p++]; events.push({ tick, k: (hi === 0x9 && v > 0) ? 'on' : 'off', ch, n, v }); }
          else if (hi === 0xA || hi === 0xB || hi === 0xE) { const a = b[p++], c = b[p++]; if (hi === 0xB) events.push({ tick, k: 'cc', ch, a, c }); }
          else if (hi === 0xC) events.push({ tick, k: 'prog', ch, a: b[p++] });
          else p++;
        }
      }
      p = end;
    }
    events.sort((x, y) => x.tick - y.tick);
    const notes = []; const prog = new Array(16).fill(0), vol = new Array(16).fill(100), expr = new Array(16).fill(127);
    const open = {}; let tempo = 500000, last = 0, time = 0;
    for (const e of events) {
      time += (e.tick - last) * tempo / (div * 1e6); last = e.tick;
      if (e.k === 'tempo') tempo = e.v;
      else if (e.k === 'prog') prog[e.ch] = e.a;
      else if (e.k === 'cc') { if (e.a === 7) vol[e.ch] = e.c; else if (e.a === 11) expr[e.ch] = e.c; }
      else if (e.k === 'on') {
        const key = e.ch * 128 + e.n, nt = { t: time, d: 0, ch: e.ch, n: e.n, v: e.v, pr: prog[e.ch], g: (vol[e.ch] / 127) * (expr[e.ch] / 127) };
        (open[key] = open[key] || []).push(nt); notes.push(nt);
      } else if (e.k === 'off') { const q = open[e.ch * 128 + e.n]; if (q && q.length) { const nt = q.shift(); nt.d = Math.max(0.03, time - nt.t); } }
    }
    for (const nt of notes) if (!nt.d) nt.d = Math.max(0.1, time - nt.t);
    return { notes, length: time };
  }

  // ---------- voices ----------
  function noiseBuf() {
    if (noiseBuf.b) return noiseBuf.b;
    const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return (noiseBuf.b = b);
  }
  function env(g, t, a, d, s, r, dur, peak) {
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * s), t + a + d);
    g.gain.setValueAtTime(Math.max(0.0001, peak * s), t + Math.max(a + d, dur)); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + d, dur) + r);
  }
  function drum(out, t, n, vel, nodes) {
    const peak = 0.55 * vel;
    if (n === 35 || n === 36) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(160, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      env(g, t, 0.002, 0.05, 0.3, 0.12, 0.05, peak * 1.3); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.3); nodes.push(o);
    } else if ((n >= 41 && n <= 50 && ![42, 44, 46, 49].includes(n))) {
      const o = ctx.createOscillator(), g = ctx.createGain(); const f = 70 + (n - 41) * 18; o.frequency.setValueAtTime(f * 1.8, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
      env(g, t, 0.002, 0.08, 0.2, 0.12, 0.05, peak); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35); nodes.push(o);
    } else {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf(); const f = ctx.createBiquadFilter(), g = ctx.createGain();
      const hat = [42, 44, 46, 49, 51, 52, 55, 57, 59].includes(n), snare = n === 38 || n === 40 || n === 37 || n === 39;
      f.type = hat ? 'highpass' : 'bandpass'; f.frequency.value = hat ? 6500 : (snare ? 1800 : 1200);
      const len = hat ? (n === 46 || n >= 49 ? 0.25 : 0.05) : 0.14;
      env(g, t, 0.001, len * 0.5, 0.2, len, 0.01, peak * (hat ? 0.5 : 0.9));
      s.connect(f); f.connect(g); g.connect(out); s.start(t); s.stop(t + len + 0.2); nodes.push(s);
    }
  }
  function tone(out, t, nt, nodes) {
    const f0 = 440 * Math.pow(2, (nt.n - 69) / 12), p = nt.pr, vel = (nt.v / 127) * nt.g;
    let type = 'triangle', a = 0.005, d = 0.25, s = 0.4, r = 0.08, cut = 0, peak = 0.22 * vel;
    if (p < 8) { type = 'triangle'; d = 0.6; s = 0.15; }
    else if (p < 16) { type = 'sine'; d = 0.35; s = 0.1; r = 0.2; }
    else if (p < 24) { type = 'square'; s = 0.8; d = 0.05; cut = 2200; peak *= 0.6; }
    else if (p < 32) { type = 'sawtooth'; d = 0.4; s = 0.2; cut = 1800; peak *= 0.6; }
    else if (p < 40) { type = 'sawtooth'; d = 0.3; s = 0.6; cut = 700; peak *= 0.9; }
    else if (p < 56) { type = 'sawtooth'; a = 0.08; d = 0.2; s = 0.8; r = 0.15; cut = 1600; peak *= 0.45; }
    else if (p < 64) { type = 'sawtooth'; a = 0.03; d = 0.15; s = 0.7; cut = 2500; peak *= 0.5; }
    else if (p < 80) { type = 'square'; a = 0.02; s = 0.7; cut = 2000; peak *= 0.4; }
    else if (p < 88) { type = 'square'; s = 0.7; cut = 3000; peak *= 0.4; }
    else if (p < 104) { type = 'sine'; a = 0.12; s = 0.8; r = 0.25; }
    else { type = 'triangle'; d = 0.3; s = 0.3; }
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f0;
    env(g, t, a, d, s, r, nt.d, peak);
    let last = o; if (cut) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(cut + f0, 9000); o.connect(f); last = f; }
    last.connect(g); g.connect(out); o.start(t); o.stop(t + Math.max(a + d, nt.d) + r + 0.05); nodes.push(o);
  }

  function schedule(song, out, t0, nodes) {
    for (const nt of song.notes) {
      const t = t0 + nt.t; if (nt.ch === 9) drum(out, t, nt.n, nt.v / 127 * nt.g, nodes); else tone(out, t, nt, nodes);
    }
  }

  let unlocked = false, pending = null;
  const cache = new Map();
  window.$midiParse = parse;
  window.$midi = {
    unlock() {
      unlocked = true; const c = ensure(); if (c && c.state === 'suspended') c.resume();
      if (pending) { const q = pending; pending = null; q.start(); }
    },
    suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { if (ctx && unlocked && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; try { localStorage.setItem('ia2:muted', muted ? '1' : '0'); } catch (e) {} if (master) master.gain.value = muted ? 0 : 0.5; },
    play(bytes, loops, onEnd) {
      if (!unlocked) {   // browsers only allow audio after a user gesture: start on the first key/tap
        const w = { real: null, stopped: false, stop() { this.stopped = true; if (this.real) this.real.stop(); if (pending === this) pending = null; },
          start() { if (!this.stopped) this.real = window.$midi.play(bytes, loops, onEnd); } };
        pending = w; return w;
      }
      const c = ensure(); if (!c) return { stop() {} };
      let key = bytes.length + ':' + bytes[bytes.length - 1] + ':' + bytes[20]; let song = cache.get(key);
      if (!song) { try { song = parse(bytes); } catch (e) { console.warn('midi parse', e); return { stop() {} }; } cache.set(key, song); }
      const out = c.createGain(); out.connect(master);
      let nodes = [], stopped = false, iter = 0, endAt = 0, timer = null;
      const total = loops === 0 ? 1 : loops;       // -1 = forever
      const run = () => {
        if (stopped) return;
        const start = Math.max(c.currentTime + 0.05, endAt); schedule(song, out, start, nodes); endAt = start + song.length + 0.4; iter++;
        if (nodes.length > 4000) nodes = nodes.slice(-2000);
      };
      run();
      timer = setInterval(() => {
        if (stopped) return;
        if (c.currentTime >= endAt - 0.1) {
          if (total < 0 || iter < total) run();
          else { stopped = true; clearInterval(timer); setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 500); if (onEnd) onEnd(); }
        }
      }, 100);
      return {
        stop() {
          if (stopped) return; stopped = true; clearInterval(timer);
          try { out.gain.cancelScheduledValues(0); out.gain.setValueAtTime(0, c.currentTime); } catch (e) {}
          for (const n of nodes) { try { n.stop(); } catch (e) {} }
          setTimeout(() => { try { out.disconnect(); } catch (e) {} }, 100);
        },
      };
    },
  };
})();
