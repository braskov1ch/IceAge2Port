'use strict';
(async function () {
  const canvas = document.getElementById('screen');
  J_Display.INSTANCE.$attach(canvas);

  // ---- layout: integer scale where possible ----
  function layout() {
    const reserve = document.body.classList.contains('touch') ? 150 : 90;
    const s = Math.min(window.innerWidth / SCREEN_W, (window.innerHeight - reserve) / SCREEN_H);
    const k = s >= 1 ? Math.floor(s * 2) / 2 : s;   // 0.5 steps keep pixels reasonably crisp
    canvas.style.width = Math.floor(SCREEN_W * k) + 'px';
    canvas.style.height = Math.floor(SCREEN_H * k) + 'px';
  }
  if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
  window.addEventListener('resize', layout); layout();

  // ---- resources ----
  const b64 = (t) => { const bin = atob(t), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  if (window.$assets) {                       // single-file build: works when index.html is simply double-clicked
    for (const k in window.$assets) $res.map.set(k, b64(window.$assets[k]));
  } else {
    const files = await (await fetch('assets/manifest.json')).json();
    await Promise.all(files.map(async (f) => {
      const r = await fetch('assets/res/' + f);
      $res.map.set(f, new Uint8Array(await r.arrayBuffer()));
    }));
  }

  // ---- language: Russian by default, English (original) via the footer link or ?lang=en ----
  let lang = 'ru';
  try { lang = new URLSearchParams(location.search).get('lang') || localStorage.getItem('ia2:lang') || 'ru'; } catch (e) {}
  if (lang !== 'en') lang = 'ru';
  if (lang === 'ru' && $res.map.has('lang_ru.dat')) $res.map.set('lang.dat', $res.map.get('lang_ru.dat'));
  const langLink = document.getElementById('lang');
  langLink.textContent = lang === 'ru' ? 'English' : 'Русский';
  langLink.onclick = () => { try { localStorage.setItem('ia2:lang', lang === 'ru' ? 'en' : 'ru'); } catch (e) {} const u = new URL(location.href); u.searchParams.delete('lang'); location.href = u.toString(); };
  const hdLink = document.getElementById('hdlink');
  hdLink.textContent = ($HD.k > 1 ? 'HD: ' + (lang === 'ru' ? 'вкл' : 'on') : 'HD: ' + (lang === 'ru' ? 'выкл' : 'off'));
  hdLink.onclick = () => { try { localStorage.setItem('ia2:hd', $HD.k > 1 ? '1' : '3'); } catch (e) {} const u = new URL(location.href); u.searchParams.delete('hd'); location.href = u.toString(); };
  if (lang === 'en') document.getElementById('hint').textContent = '→ run · ← brake · ↑ jump · Enter select · Q menu/pause · Esc back · M sound';

  // ---- start the game ----
  $clinitAll(['class_0', 'class_2', 'class_1', 'class_3', 'GameMIDletIce2']);
  const midlet = new GameMIDletIce2().$init$();
  window.$midlet = midlet;
  midlet.startApp$();

  // ---- paint loop (the game requests repaints via Canvas.repaint) ----
  (function frame() {
    const d = J_Display.INSTANCE, cur = d.cur;
    if (cur && cur.$dirty) { try { cur.$paintNow(); } catch (e) { console.error('paint failed', e); cur.$dirty = false; } }
    requestAnimationFrame(frame);
  })();

  // ---- input ----
  const KEYMAP = {
    ArrowUp: -1, ArrowDown: -2, ArrowLeft: -3, ArrowRight: -4,
    Enter: -5, Space: -5, NumpadEnter: -5,
    KeyQ: -6, F1: -6, KeyW: -1, KeyS: -2, KeyA: -3, KeyD: -4,
    Escape: -7, Backspace: -7, KeyE: -7, F2: -7,
    NumpadMultiply: 42,
  };
  const down = new Set();
  // The game polls key state once per frame, so a very short tap could be lost: keep every press for at least ~70 ms.
  const pressedAt = new Map();
  function sendNow(code, pressed) {
    const cur = J_Display.INSTANCE.cur; if (!cur) return;
    try { pressed ? cur.keyPressed$int(code) : cur.keyReleased$int(code); } catch (e) { console.error('key failed', e); }
  }
  function send(code, pressed) {
    if (pressed) { pressedAt.set(code, performance.now()); sendNow(code, true); return; }
    const t0 = pressedAt.get(code) || 0, held = performance.now() - t0;
    if (held >= 70) sendNow(code, false); else setTimeout(() => sendNow(code, false), 70 - held);
  }
  function codeFor(ev) {
    if (KEYMAP[ev.code] !== undefined) return KEYMAP[ev.code];
    if (/^Digit\d$/.test(ev.code)) return 48 + Number(ev.code[5]);
    if (/^Numpad\d$/.test(ev.code)) return 48 + Number(ev.code[6]);
    if (ev.key === '*') return 42; if (ev.key === '#') return 35;
    return null;
  }
  window.addEventListener('keydown', (ev) => {
    if (window.$midi) window.$midi.unlock();
    if (ev.code === 'KeyM' && !ev.repeat) { window.$midi && window.$midi.toggleMute(); return; }
    const c = codeFor(ev); if (c === null) return;
    ev.preventDefault(); if (down.has(ev.code)) return; down.add(ev.code); send(c, true);
  });
  window.addEventListener('keyup', (ev) => {
    const c = codeFor(ev); if (c === null) return;
    ev.preventDefault(); down.delete(ev.code); send(c, false);
  });
  window.addEventListener('blur', () => { for (const code of [...down]) { down.delete(code); } });

  // touch / mouse buttons
  document.querySelectorAll('.btn').forEach((b) => {
    const k = Number(b.dataset.k);
    const press = (e) => { e.preventDefault(); if (window.$midi) window.$midi.unlock(); b.classList.add('on'); send(k, true); };
    const release = (e) => { e.preventDefault(); if (b.classList.contains('on')) { b.classList.remove('on'); send(k, false); } };
    b.addEventListener('pointerdown', press); b.addEventListener('pointerup', release);
    b.addEventListener('pointercancel', release); b.addEventListener('pointerleave', release);
  });
  // tapping the screen = Enter (menus)
  canvas.addEventListener('pointerdown', (e) => { if (window.$midi) window.$midi.unlock(); send(-5, true); setTimeout(() => send(-5, false), 80); });

  // pause when the tab is hidden
  document.addEventListener('visibilitychange', () => {
    const cur = J_Display.INSTANCE.cur; if (!cur) return;
    try { document.hidden ? cur.hideNotify$() : cur.showNotify$(); } catch (e) { console.error(e); }
    if (window.$midi) { document.hidden ? window.$midi.suspend() : window.$midi.resume(); }
  });
  window.$onDestroyed = () => { document.getElementById('hint').textContent = 'Игра завершена. Обновите страницу, чтобы начать заново.'; };
})().catch((e) => { console.error('boot failed', e); document.body.insertAdjacentHTML('beforeend', '<pre style="color:#f88">' + e.stack + '</pre>'); });
