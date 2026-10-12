'use strict';
// Browser implementation of the parts of MIDP 2.0 (lcdui / media / rms) the game uses.

const SCREEN_W = 240, SCREEN_H = 320;

class J_Displayable extends J_Object {
  $init$() { return this; }
  setCommandListener$CommandListener(l) { this.$cmdListener = l; }
  addCommand$Command(c) {}
  removeCommand$Command(c) {}
  getWidth$() { return SCREEN_W; }
  getHeight$() { return SCREEN_H; }
}
class J_Canvas extends J_Displayable {
  $init$() { this.$dirty = true; return this; }
  repaint$() { this.$dirty = true; }
  repaint$int_int_int_int() { this.$dirty = true; }
  serviceRepaints$() { if (this.$dirty) this.$paintNow(); }
  setFullScreenMode$boolean(b) {}
  getGameAction$int(k) {
    switch (k) { case -1: return 1; case -2: return 6; case -3: return 2; case -4: return 5; case -5: return 8; default: return 0; }
  }
  $paintNow() {
    this.$dirty = false;
    const g = J_Display.INSTANCE.$graphics();
    g.$reset();
    this.paint$Graphics(g);
  }
  showNotify$() {}
  hideNotify$() {}
  keyPressed$int(k) {}
  keyReleased$int(k) {}
}
class J_List extends J_Displayable { getSelectedIndex$() { return 0; } }
class J_Command extends J_Object {
  $init$String_int_int(l, t, p) { this.l = l; this.t = t; this.p = p; return this; }
  getLabel$() { return this.l; }
  getPriority$() { return this.p; }
}
class J_MIDlet extends J_Object {
  $init$() { return this; }
  getAppProperty$String(k) { return (window.$props && window.$props[k]) || null; }
  notifyDestroyed$() { if (window.$onDestroyed) window.$onDestroyed(); }
}

class J_Display extends J_Object {
  static getDisplay$MIDlet(m) { return J_Display.INSTANCE; }
  getCurrent$() { return this.cur || null; }
  setCurrent$Displayable(d) {
    if (this.cur && this.cur !== d && this.cur.hideNotify$) { try { this.cur.hideNotify$(); } catch (e) { console.error(e); } }
    const changed = this.cur !== d;
    this.cur = d;
    if (d && changed) { try { d.showNotify$(); } catch (e) { console.error(e); } }
    if (d && d.repaint$) d.repaint$();
  }
  $attach(canvas) { this.canvas = canvas; this.g = new J_Graphics(canvas); }
  $graphics() { return this.g; }
}
J_Display.INSTANCE = new J_Display();

// ---------- fonts ----------
class J_Font extends J_Object {
  constructor(face, style, size) {
    super();
    this.px = size === 8 ? 10 : size === 16 ? 14 : 12;
    this.css = ((style & 1) ? 'bold ' : '') + ((style & 2) ? 'italic ' : '') + this.px + 'px sans-serif';
    this.ascent = this.px; this.height = this.px + 3;
  }
  static getDefaultFont$() { return J_Font.DEFAULT; }
  static getFont$int_int_int(f, s, z) { return new J_Font(f, s, z); }
  $measure(s) { const c = J_Font.mctx; c.font = this.css; return Math.ceil(c.measureText(s).width); }
  stringWidth$String(s) { return this.$measure(s); }
  charWidth$char(c) { return this.$measure(String.fromCharCode(c)); }
  getHeight$() { return this.height; }
}
J_Font.mctx = document.createElement('canvas').getContext('2d');
J_Font.DEFAULT = new J_Font(0, 0, 0);

// ---------- images ----------
class J_Image extends J_Object {
  static $fromRGBA(w, h, rgba) {
    const im = new J_Image(); im.w = w; im.h = h;
    im.cv = $HD.canvasFor(w, h, rgba);
    return im;
  }
  static createImage$String(path) {
    const b = $res.get(path);
    if (!b) throw new J_IOException().$init$String(path);
    return J_Image.createImage$byteA_int_int(b, 0, b.length);
  }
  static createImage$byteA_int_int(bytes, off, len) {
    const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.length);
    let d;
    try { d = $decodePNG(u.subarray(off, off + len)); } catch (e) { throw new J_IllegalArgumentException().$init$String('bad image: ' + e.message); }
    return J_Image.$fromRGBA(d.w, d.h, d.rgba);
  }
  getWidth$() { return this.w; }
  getHeight$() { return this.h; }
}
class J_IllegalArgumentException extends J_RuntimeException {}

// ---------- graphics ----------
class J_Graphics extends J_Object {
  constructor(cv) {
    super(); this.cv = cv; cv.width = SCREEN_W * $HD.k; cv.height = SCREEN_H * $HD.k;
    this.ctx = cv.getContext('2d'); this.ctx.imageSmoothingEnabled = false;
    this.ctx.save(); this.$reset();
  }
  $reset() {
    this.ctx.restore(); this.ctx.save(); this.ctx.scale($HD.k, $HD.k);
    this.cx = 0; this.cy = 0; this.cw = SCREEN_W; this.ch = SCREEN_H;
    this.font = J_Font.DEFAULT; this.setColor$int(0);
  }
  setColor$int(rgb) { this.rgb = rgb; const s = '#' + ('00000' + (rgb & 0xFFFFFF).toString(16)).slice(-6); this.ctx.fillStyle = s; this.style = s; }
  getColor$() { return this.rgb & 0xFFFFFF; }
  setFont$Font(f) { this.font = f; }
  setClip$int_int_int_int(x, y, w, h) {
    this.ctx.restore(); this.ctx.save(); this.ctx.scale($HD.k, $HD.k);
    this.ctx.fillStyle = this.style;
    this.ctx.beginPath(); this.ctx.rect(x, y, Math.max(0, w), Math.max(0, h)); this.ctx.clip();
    this.cx = x; this.cy = y; this.cw = w; this.ch = h;
  }
  getClipX$() { return this.cx; } getClipY$() { return this.cy; } getClipWidth$() { return this.cw; } getClipHeight$() { return this.ch; }
  fillRect$int_int_int_int(x, y, w, h) { if (w > 0 && h > 0) this.ctx.fillRect(x, y, w, h); }
  drawRect$int_int_int_int(x, y, w, h) {
    if (w < 0 || h < 0) return; const c = this.ctx;
    c.fillRect(x, y, w + 1, 1); if (h > 0) c.fillRect(x, y + h, w + 1, 1);
    if (h > 1) { c.fillRect(x, y + 1, 1, h - 1); if (w > 0) c.fillRect(x + w, y + 1, 1, h - 1); }
  }
  drawLine$int_int_int_int(x1, y1, x2, y2) {
    const c = this.ctx;
    if (x1 === x2) { c.fillRect(x1, Math.min(y1, y2), 1, Math.abs(y2 - y1) + 1); return; }
    if (y1 === y2) { c.fillRect(Math.min(x1, x2), y1, Math.abs(x2 - x1) + 1, 1); return; }
    let dx = Math.abs(x2 - x1), dy = -Math.abs(y2 - y1), sx = x1 < x2 ? 1 : -1, sy = y1 < y2 ? 1 : -1, err = dx + dy;
    for (;;) { c.fillRect(x1, y1, 1, 1); if (x1 === x2 && y1 === y2) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x1 += sx; } if (e2 <= dx) { err += dx; y1 += sy; } }
  }
  drawString$String_int_int_int(s, x, y, a) {
    const f = this.font, c = this.ctx; c.font = f.css; c.textBaseline = 'alphabetic';
    const w = Math.ceil(c.measureText(s).width);
    if (a & 8) x -= w; else if (a & 1) x -= (w >> 1);
    let by;
    if (a & 64) by = y; else if (a & 32) by = y - f.height + f.ascent; else if (a & 2) by = y - (f.height >> 1) + f.ascent; else by = y + f.ascent;
    c.fillText(s, x, by);
  }
  drawImage$Image_int_int_int(img, x, y, a) {
    if (!img) return;
    if (a & 8) x -= img.w; else if (a & 1) x -= (img.w >> 1);
    if (a & 32) y -= img.h; else if (a & 2) y -= (img.h >> 1);
    this.ctx.drawImage(img.cv, x, y, img.w, img.h);
  }
}

// ---------- record store (localStorage) ----------
const $rmsMem = {};
function $rmsLoad(name) {
  const k = 'ia2:rms:' + name;
  try { const s = localStorage.getItem(k); if (s) return JSON.parse(s); } catch (e) { if ($rmsMem[k]) return JSON.parse($rmsMem[k]); }
  return $rmsMem[k] ? JSON.parse($rmsMem[k]) : null;
}
function $rmsSave(name, st) {
  const k = 'ia2:rms:' + name, s = JSON.stringify(st);
  $rmsMem[k] = s;
  try { localStorage.setItem(k, s); } catch (e) { /* storage unavailable: keep in memory */ }
}
const $b64 = {
  enc(b) { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i] & 255); return btoa(s); },
  dec(s) { const t = atob(s), o = new Int8Array(t.length); for (let i = 0; i < t.length; i++) o[i] = t.charCodeAt(i); return o; },
};
class J_RecordStore extends J_Object {
  static openRecordStore$String_boolean(name, create) {
    let st = $rmsLoad(name);
    if (!st) { if (!create) throw new J_RecordStoreNotFoundException().$init$String(name); st = { next: 1, recs: {} }; $rmsSave(name, st); }
    const rs = new J_RecordStore(); rs.name = name; rs.st = st; return rs;
  }
  static deleteRecordStore$String(name) {
    const k = 'ia2:rms:' + name; delete $rmsMem[k]; try { localStorage.removeItem(k); } catch (e) {}
  }
  closeRecordStore$() {}
  addRecord$byteA_int_int(d, o, l) { const id = this.st.next++; this.st.recs[id] = $b64.enc(d.subarray ? d.subarray(o, o + l) : d.slice(o, o + l)); $rmsSave(this.name, this.st); return id; }
  setRecord$int_byteA_int_int(id, d, o, l) { if (!(id in this.st.recs)) throw new J_InvalidRecordIDException().$init$String(String(id)); this.st.recs[id] = $b64.enc(d.subarray ? d.subarray(o, o + l) : d.slice(o, o + l)); $rmsSave(this.name, this.st); }
  getRecord$int(id) { if (!(id in this.st.recs)) throw new J_InvalidRecordIDException().$init$String(String(id)); return $b64.dec(this.st.recs[id]); }
  getRecordSize$int(id) { return this.getRecord$int(id).length; }
  getNumRecords$() { return Object.keys(this.st.recs).length; }
}

// ---------- media ----------
class J_Manager extends J_Object {
  static createPlayer$InputStream_String(s, type) {
    const bytes = []; const buf = new Int8Array(4096); let n;
    while ((n = s.read$byteA_int_int(buf, 0, buf.length)) > 0) for (let i = 0; i < n; i++) bytes.push(buf[i] & 255);
    return new J_Player(Uint8Array.from(bytes), type);
  }
}
class J_Player extends J_Object {
  constructor(bytes, type) { super(); this.bytes = bytes; this.type = type; this.loops = 1; this.listener = null; this.h = null; }
  addPlayerListener$PlayerListener(l) { this.listener = l; }
  removePlayerListener$PlayerListener(l) { if (this.listener === l) this.listener = null; }
  setLoopCount$int(n) { this.loops = n; }
  prefetch$() {}
  start$() {
    if (!window.$midi) return;
    this.h = window.$midi.play(this.bytes, this.loops, () => { if (this.listener) this.listener.playerUpdate$Player_String_Object(this, 'endOfMedia', null); });
  }
  stop$() { if (this.h) { this.h.stop(); this.h = null; } }
  deallocate$() { this.stop$(); }
}
