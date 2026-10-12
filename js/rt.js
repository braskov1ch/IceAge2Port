'use strict';
// Minimal Java runtime for the translated MIDlet (only what the game uses).

class J_Object {
  $init$() { return this; }
  equals$Object(o) { return this === o; }
  hashCode$() { return 0; }
  toString$() { return this.constructor.name; }
  getClass$() { return J_Class.INSTANCE; }
}

// ---------- exceptions ----------
class J_Throwable extends Error {
  $init$() { if ($rt.debug) console.warn('throw ' + this.constructor.name, new Error().stack); return this; }
  $init$String(m) { this.message = m == null ? '' : m; if ($rt.debug) console.warn('throw ' + this.constructor.name + ': ' + this.message, new Error().stack); return this; }
  getMessage$() { return this.message; }
  printStackTrace$() { console.error(this.constructor.name + ': ' + this.message + '\n' + this.stack); }
  toString$() { return this.constructor.name + ': ' + this.message; }
}
class J_Exception extends J_Throwable {}
class J_Error extends J_Throwable {}
class J_RuntimeException extends J_Exception {}
class J_NullPointerException extends J_RuntimeException {}
class J_ArithmeticException extends J_RuntimeException {}
class J_IndexOutOfBoundsException extends J_RuntimeException {}
class J_ArrayIndexOutOfBoundsException extends J_IndexOutOfBoundsException {}
class J_NegativeArraySizeException extends J_RuntimeException {}
class J_ClassCastException extends J_RuntimeException {}
class J_IOException extends J_Exception {}
class J_InterruptedException extends J_Exception {}
class J_MediaException extends J_Exception {}
class J_RecordStoreException extends J_Exception {}
class J_RecordStoreFullException extends J_RecordStoreException {}
class J_RecordStoreNotFoundException extends J_RecordStoreException {}
class J_RecordStoreNotOpenException extends J_RecordStoreException {}
class J_InvalidRecordIDException extends J_RecordStoreException {}
class J_OutOfMemoryError extends J_Error {}
class J_StackOverflowError extends J_Error {}

const $rt = {
  wrapEx(e) {
    if (e instanceof J_Throwable) return e;
    if ($rt.debug && !(e instanceof J_Throwable)) console.warn('native error', e);
    if (e instanceof RangeError && /call stack/i.test(e.message)) return new J_StackOverflowError().$init$String('stack overflow');
    if (e instanceof RangeError && /array length|allocation/i.test(e.message)) return new J_OutOfMemoryError().$init$String(e.message);
    if (e instanceof TypeError) { const x = new J_NullPointerException().$init$String(e.message); x.cause = e; if ($rt.debug) console.warn('NPE from TypeError', e); return x; }
    const x = new J_RuntimeException().$init$String(String(e && e.message || e)); x.cause = e; return x;
  },
  debug: /[?&]debug/.test(location.search),
  ci(a, i) {
    if (!(i >= 0 && i < a.length)) throw new J_ArrayIndexOutOfBoundsException().$init$String(String(i));
    return i;
  },
  ag(a, i) { return a[$rt.ci(a, i)]; },
  newArray(code, dims) {
    const make = (d) => {
      const n = dims[d];
      if (n < 0) throw new J_NegativeArraySizeException().$init$String(String(n));
      if (d < dims.length - 1) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = make(d + 1); return a; }
      switch (code) {
        case 'B': return new Int8Array(n);
        case 'S': return new Int16Array(n);
        case 'C': return new Uint16Array(n);
        case 'I': return new Int32Array(n);
        case 'J': case 'D': return new Float64Array(n);
        case 'F': return new Float32Array(n);
        case 'Z': return new Array(n).fill(false);
        default: return new Array(n).fill(null);
      }
    };
    return make(0);
  },
  aclone(a) { return a.slice(); },
  idiv(a, b) { if (b === 0) throw new J_ArithmeticException().$init$String('/ by zero'); return (a / b) | 0; },
  imod(a, b) { if (b === 0) throw new J_ArithmeticException().$init$String('/ by zero'); return (a % b) | 0; },
  lmul(a, b) {
    const r = a * b;
    if (Math.abs(r) < 9007199254740992) return r;
    $rt.bigWarn('lmul', a, b);
    return Number(BigInt.asIntN(64, BigInt(a) * BigInt(b)));
  },
  ldiv(a, b) { if (b === 0) throw new J_ArithmeticException().$init$String('/ by zero'); return Math.trunc(a / b); },
  lmod(a, b) { if (b === 0) throw new J_ArithmeticException().$init$String('/ by zero'); const r = a % b; return r === 0 ? 0 : r; },
  lshl(a, n) {
    n &= 63; const r = a * Math.pow(2, n);
    if (Math.abs(r) < 9007199254740992) return r;
    $rt.bigWarn('lshl', a, n);
    return Number(BigInt.asIntN(64, BigInt(a) << BigInt(n)));
  },
  lshr(a, n) { n &= 63; return Math.floor(a / Math.pow(2, n)); },
  lushr(a, n) { n &= 63; if (a >= 0) return Math.floor(a / Math.pow(2, n)); return Number(BigInt.asUintN(64, BigInt(a)) >> BigInt(n)); },
  land(a, b) { if (a === (a | 0) && b === (b | 0)) return a & b; return Number(BigInt.asIntN(64, BigInt(a) & BigInt(b))); },
  lor(a, b) { if (a === (a | 0) && b === (b | 0)) return a | b; return Number(BigInt.asIntN(64, BigInt(a) | BigInt(b))); },
  lxor(a, b) { if (a === (a | 0) && b === (b | 0)) return a ^ b; return Number(BigInt.asIntN(64, BigInt(a) ^ BigInt(b))); },
  d2i(x) { if (x !== x) return 0; if (x >= 2147483647) return 2147483647; if (x <= -2147483648) return -2147483648; return Math.trunc(x) | 0; },
  d2l(x) { if (x !== x) return 0; return Math.trunc(x); },
  dstr(x) { if (Number.isInteger(x)) return x.toFixed(1); return String(x); },
  str(o) { return o === null ? 'null' : (typeof o === 'object' && o.toString$ ? o.toString$() : String(o)); },
  _warned: {},
  bigWarn(k, a, b) { if (!$rt._warned[k]) { $rt._warned[k] = 1; console.warn('64-bit overflow in ' + k, a, b); } },
};

// ---------- String / boxed values live on JS primitives ----------
function defProto(proto, name, fn) { Object.defineProperty(proto, name, { value: fn, writable: true, configurable: true, enumerable: false }); }
defProto(String.prototype, 'length$', function () { return this.length; });
defProto(String.prototype, 'charAt$int', function (i) { if (i < 0 || i >= this.length) throw new J_IndexOutOfBoundsException().$init$String(String(i)); return this.charCodeAt(i); });
defProto(String.prototype, 'equals$Object', function (o) { return this.valueOf() === o; });
defProto(String.prototype, 'hashCode$', function () { let h = 0; for (let i = 0; i < this.length; i++) h = (Math.imul(h, 31) + this.charCodeAt(i)) | 0; return h; });
defProto(String.prototype, 'indexOf$String', function (s) { return this.indexOf(s); });
defProto(String.prototype, 'substring$int', function (a) { if (a < 0 || a > this.length) throw new J_IndexOutOfBoundsException().$init$String(String(a)); return this.substring(a); });
defProto(String.prototype, 'substring$int_int', function (a, b) { if (a < 0 || b > this.length || a > b) throw new J_IndexOutOfBoundsException().$init$String(a + ',' + b); return this.substring(a, b); });
defProto(String.prototype, 'toLowerCase$', function () { return this.toLowerCase(); });
defProto(String.prototype, 'toUpperCase$', function () { return this.toUpperCase(); });
defProto(String.prototype, 'trim$', function () { return this.trim(); });
defProto(String.prototype, 'toString$', function () { return this.valueOf(); });

class J_String { static $new$String(s) { return s; } }
class J_Integer {
  static $new$int(n) { return n; }
  static parseInt$String(s) { if (s == null || !/^[+-]?\d+$/.test(s)) throw new J_RuntimeException().$init$String('NumberFormatException: ' + s); return parseInt(s, 10) | 0; }
}
class J_Byte { static parseByte$String(s) { return (J_Integer.parseInt$String(s) << 24) >> 24; } }
class J_Math {
  static abs$int(a) { return a < 0 ? (-a | 0) : a; }
  static max$int_int(a, b) { return a > b ? a : b; }
  static min$int_int(a, b) { return a < b ? a : b; }
}
class J_PrintStream { println$String(s) { console.log(s); } println$Object(s) { console.log(s); } println$int(s) { console.log(s); } }
class J_System {
  static arraycopy$Object_int_Object_int_int(src, sp, dst, dp, n) {
    if (sp < 0 || dp < 0 || n < 0 || sp + n > src.length || dp + n > dst.length) throw new J_ArrayIndexOutOfBoundsException().$init$String('arraycopy');
    if (src === dst && sp < dp) { for (let i = n - 1; i >= 0; i--) dst[dp + i] = src[sp + i]; }
    else for (let i = 0; i < n; i++) dst[dp + i] = src[sp + i];
  }
  static currentTimeMillis$() { return Date.now(); }
  static gc$() {}
}
J_System.out = new J_PrintStream();

class J_Class {
  getResourceAsStream$String(path) {
    const b = $res.get(path);
    if (!b) return null;
    return new J_ByteArrayInputStream().$init$byteA(b);
  }
}
J_Class.INSTANCE = new J_Class();
const $res = { map: new Map(), get(p) { return this.map.get(p.replace(/^\//, '')) || null; } };

// ---------- threads (cooperative) ----------
class J_Thread extends J_Object {
  $init$() { this.target = null; return this; }
  $init$Runnable(r) { this.target = r; return this; }
  start$() {
    const run = () => { try { this.run$(); } catch (e) { console.error('thread died', e); } };
    if (this.target) requestAnimationFrame(run); else setTimeout(run, 0);
  }
  run$() { if (this.target) this.target.run$(); }
  static sleep$long(ms) {
    // cannot block in the browser: only honour tiny sleeps (the frame loop spins on sleep(1))
    const end = performance.now() + Math.min(ms, 2);
    while (performance.now() < end) { /* spin */ }
  }
  static yield$() {}
}

// ---------- collections / text ----------
class J_StringBuffer extends J_Object {
  $init$() { this.s = ''; return this; }
  $init$int(n) { this.s = ''; return this; }
  append$String(x) { this.s += (x === null ? 'null' : x); return this; }
  append$int(x) { this.s += x; return this; }
  toString$() { return this.s; }
  length$() { return this.s.length; }
}
class J_Vector extends J_Object {
  $init$() { this.a = []; return this; }
  addElement$Object(o) { this.a.push(o); }
  elementAt$int(i) { if (i < 0 || i >= this.a.length) throw new J_ArrayIndexOutOfBoundsException().$init$String(String(i)); return this.a[i]; }
  size$() { return this.a.length; }
}
class J_Hashtable extends J_Object {
  $init$int(n) { this.m = new Map(); return this; }
  $init$() { this.m = new Map(); return this; }
  get$Object(k) { const v = this.m.get(k); return v === undefined ? null : v; }
  put$Object_Object(k, v) { const o = this.m.get(k); this.m.set(k, v); return o === undefined ? null : o; }
  remove$Object(k) { const o = this.m.get(k); this.m.delete(k); return o === undefined ? null : o; }
}
class J_Random extends J_Object {
  $init$long(seed) { this.seed = (BigInt(seed) ^ 0x5DEECE66Dn) & ((1n << 48n) - 1n); return this; }
  $init$() { return this.$init$long(Date.now()); }
  next(bits) { this.seed = (this.seed * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n); return Number(BigInt.asIntN(32, this.seed >> BigInt(48 - bits))); }
  nextInt$() { return this.next(32); }
}

// ---------- streams ----------
class J_InputStream extends J_Object {
  close$() {}
}
class J_ByteArrayInputStream extends J_InputStream {
  $init$byteA(b) { this.buf = b; this.pos = 0; this.end = b.length; return this; }
  read$() { return this.pos < this.end ? this.buf[this.pos++] & 255 : -1; }
  read$byteA_int_int(dst, off, len) {
    if (len === 0) return 0;
    if (this.pos >= this.end) return -1;
    const n = Math.min(len, this.end - this.pos);
    for (let i = 0; i < n; i++) dst[off + i] = this.buf[this.pos + i];
    this.pos += n; return n;
  }
  skip$long(n) { const k = Math.max(0, Math.min(n, this.end - this.pos)); this.pos += k; return k; }
  available$() { return this.end - this.pos; }
}
class J_FilterInputStream extends J_InputStream {
  close$() { if (this.in_) this.in_.close$(); }
}
class J_DataInputStream extends J_FilterInputStream {
  $init$InputStream(i) { this.in_ = i; return this; }
  rb() { const b = this.in_.read$(); if (b < 0) throw new J_IOException().$init$String('EOF'); return b; }
  readByte$() { return (this.rb() << 24) >> 24; }
  readShort$() { const a = this.rb(), b = this.rb(); return ((a << 8 | b) << 16) >> 16; }
  readInt$() { const a = this.rb(), b = this.rb(), c = this.rb(), d = this.rb(); return (a << 24 | b << 16 | c << 8 | d) | 0; }
  readUTF$() {
    const n = (this.rb() << 8) | this.rb(); const bytes = new Uint8Array(n);
    for (let i = 0; i < n; i++) bytes[i] = this.rb();
    return new TextDecoder('utf-8').decode(bytes);
  }
  read$byteA_int_int(d, o, l) { return this.in_.read$byteA_int_int(d, o, l); }
  skipBytes$int(n) { return this.in_.skip$long(n); }
}
class J_OutputStream extends J_Object { close$() {} }
class J_ByteArrayOutputStream extends J_OutputStream {
  $init$() { this.a = []; return this; }
  write$int(b) { this.a.push(b & 255); }
  write$byteA_int_int(b, o, l) { for (let i = 0; i < l; i++) this.a.push(b[o + i] & 255); }
  toByteArray$() { return Int8Array.from(this.a); }
}
class J_DataOutputStream extends J_OutputStream {
  $init$OutputStream(o) { this.o = o; return this; }
  writeInt$int(v) { this.o.write$int(v >>> 24); this.o.write$int(v >>> 16); this.o.write$int(v >>> 8); this.o.write$int(v); }
}
