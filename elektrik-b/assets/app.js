const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WA = document.body.dataset.wa;
const PAGE = document.body.dataset.page;
const API = (document.body.dataset.api || '').replace(/\/+$/, '');
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = matchMedia('(max-width: 720px)');

window.dataLayer = window.dataLayer || [];
function goal(name, label) {
  window.dataLayer.push({ event: name, page: PAGE, label: label || '' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-goal]');
  if (a && !a.matches('[data-goal="form_submit"]')) goal(a.dataset.goal, a.dataset.label || a.textContent.trim().slice(0, 60));
});

function header() {
  const top = $('#top');
  const hero = $('.ch-hero') || $('.lhero');
  if (!top || !hero || !('IntersectionObserver' in window)) { top && top.classList.add('solid'); return; }
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none';
  hero.prepend(sentinel);
  new IntersectionObserver(([e]) => top.classList.toggle('solid', !e.isIntersecting)).observe(sentinel);
}

function dock() {
  const d = $('.dock');
  if (!d) return;
  const anchor = $('#hero-acts') || $('.lhero .acts') || $('.page');
  if (!anchor || !('IntersectionObserver' in window)) { d.classList.add('on'); return; }
  const final = $('.final .acts');
  const seen = new Map();
  const io = new IntersectionObserver(es => {
    es.forEach(e => seen.set(e.target, e.isIntersecting || (e.target === anchor && e.boundingClientRect.top > 0)));
    d.classList.toggle('on', ![...seen.values()].some(Boolean));
  });
  io.observe(anchor);
  if (final) io.observe(final);
}

function menu() {
  const m = $('.menu');
  if (!m) return;
  document.addEventListener('click', e => { if (m.open && !m.contains(e.target)) m.open = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.open) { m.open = false; $('summary', m).focus(); } });
}

function fitChips(root = document) {
  $$('.chips[data-fit]', root).forEach(box => {
    if (box.dataset.fitReady) return;
    box.dataset.fitReady = '1';
    let more = $('.more', box);
    if (!more) {
      more = document.createElement('button');
      more.type = 'button';
      more.className = 'chip more';
      more.hidden = true;
      more.setAttribute('aria-expanded', 'false');
      box.append(more);
    }
    const chips = () => $$('.chip:not(.more)', box);
    const fit = () => {
      const list = chips();
      list.forEach(c => c.classList.remove('cut'));
      if (mobile.matches || box.classList.contains('open')) { more.hidden = true; return; }
      more.hidden = false;
      more.textContent = `Ещё ${list.length}`;
      const gap = parseFloat(getComputedStyle(box).columnGap) || 8;
      const avail = box.clientWidth - 4;
      const w = list.map(c => c.offsetWidth);
      if (w.reduce((a, x) => a + x + gap, -gap) <= avail) { more.hidden = true; return; }
      const keep = new Set(list.filter(c => c.getAttribute('aria-pressed') === 'true'));
      let used = more.offsetWidth + [...keep].reduce((a, c) => a + c.offsetWidth + gap, 0);
      list.forEach((c, k) => {
        if (keep.has(c)) return;
        if (used + w[k] + gap <= avail) { keep.add(c); used += w[k] + gap; } else used = Infinity;
      });
      let cut = 0;
      list.forEach(c => { if (!keep.has(c)) { c.classList.add('cut'); cut++; } });
      more.textContent = `Ещё ${cut}`;
      more.hidden = cut === 0;
    };
    more.addEventListener('click', () => {
      const first = chips().find(c => c.classList.contains('cut'));
      box.classList.add('open');
      more.setAttribute('aria-expanded', 'true');
      fit();
      if (first) first.focus();
    });
    box.refit = fit;
    if ('ResizeObserver' in window) new ResizeObserver(fit).observe(box);
    mobile.addEventListener('change', fit);
    fit();
    if (document.fonts) document.fonts.ready.then(fit);
  });
}

function finder() {
  const grid = $('#grid');
  const q = $('#q');
  const box = $('#fsym');
  if (!grid || !q || !box) return;
  const cards = $$('.svc', grid);
  const empty = $('#empty');
  const found = $('#found');
  let sym = '';
  const norm = s => s.toLowerCase().replace(/ё/g, 'е').trim();
  const apply = () => {
    const words = norm(q.value).split(/\s+/).filter(w => w.length > 1);
    let shown = 0;
    cards.forEach(c => {
      const k = norm(c.dataset.k);
      const ok = (!sym || c.dataset.sym.split(' ').includes(sym)) && (!words.length || words.some(w => k.includes(w.slice(0, Math.max(4, w.length - 2)))));
      c.hidden = !ok;
      if (ok) shown++;
    });
    grid.classList.toggle('filtering', Boolean(sym || words.length));
    empty.hidden = shown > 0;
    if (found) found.textContent = sym || words.length ? `Найдено услуг: ${shown}` : '';
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('.chip:not(.more)');
    if (!b) return;
    sym = sym === b.dataset.id ? '' : b.dataset.id;
    $$('.chip:not(.more)', box).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === sym)));
    apply();
    if (sym) goal('symptom_filter', b.textContent);
  });
  q.addEventListener('input', apply);
  $('#reset').addEventListener('click', () => {
    sym = '';
    q.value = '';
    $$('.chip', box).forEach(c => c.setAttribute('aria-pressed', 'false'));
    apply();
    q.focus();
  });
}

const PLATFORM = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', file: 'Видео' };

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else n.setAttribute(k, v === true ? '' : v);
  });
  kids.forEach(k => k && n.append(k));
  return n;
}

function iconSvg(name) {
  const tpl = $(`#ico-${name}`);
  return tpl ? tpl.content.firstElementChild.cloneNode(true) : null;
}

function lightbox() {
  const dlg = $('#lb');
  if (!dlg || typeof dlg.showModal !== 'function') return null;
  const box = $('#lb-m', dlg);
  const cap = $('#lb-cap', dlg);
  const num = $('#lb-n', dlg);
  const orig = $('#lb-o', dlg);
  const prev = $('.lb-p', dlg);
  const next = $('.lb-nx', dlg);
  let items = [];
  let i = 0;
  let opener = null;
  const render = () => {
    const it = items[i];
    box.replaceChildren();
    box.classList.toggle('vert', Boolean(it.vertical));
    cap.textContent = it.title || '';
    num.textContent = items.length > 1 ? `${i + 1} из ${items.length}` : '';
    orig.hidden = true;
    orig.classList.remove('big');
    if (it.type === 'img') {
      const img = el('img', { src: it.src, alt: it.alt || '', width: it.w, height: it.h, draggable: 'false' });
      box.append(img);
    } else {
      orig.href = it.url;
      orig.dataset.label = it.title || it.url;
      orig.hidden = false;
      const label = $('span', orig);
      if (it.platform === 'youtube' && it.embed) {
        box.append(el('iframe', { src: it.embed, title: it.title || 'Видео YouTube', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' }));
        label.textContent = 'Открыть оригинал';
      } else if (it.platform === 'file') {
        box.append(el('video', { src: it.url, controls: true, autoplay: true, playsinline: true, poster: it.poster || null }));
        label.textContent = 'Открыть оригинал';
      } else {
        const media = it.poster ? el('img', { src: it.poster, alt: '' }) : placeholder(it, true);
        box.append(el('div', { class: 'lb-card' }, [media]));
        label.textContent = `Смотреть в ${PLATFORM[it.platform] || 'источнике'}`;
        orig.classList.add('big');
      }
    }
    prev.hidden = next.hidden = items.length < 2;
  };
  const go = d => { if (items.length > 1) { i = (i + d + items.length) % items.length; render(); } };
  const open = (list, k, from) => {
    items = list;
    i = k;
    opener = from;
    render();
    dlg.showModal();
    $('.lb-x', dlg).focus();
  };
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  $('.lb-x', dlg).addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg || e.target.classList.contains('lb-in')) dlg.close(); });
  dlg.addEventListener('close', () => { box.replaceChildren(); if (opener) opener.focus(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'Tab') {
      const f = $$('button:not([hidden]), a[href]:not([hidden]), iframe, video', dlg).filter(n => n.offsetParent !== null);
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  let x0 = null;
  let y0 = null;
  box.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; });
  box.addEventListener('pointerup', e => {
    if (x0 === null) return;
    const dx = e.clientX - x0;
    const dy = e.clientY - y0;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
  });
  return { open };
}

function gallery(lb) {
  const links = $$('[data-lb="img"]');
  if (!lb || !links.length) return;
  const list = links.map(a => ({ type: 'img', src: a.getAttribute('href'), title: a.dataset.cap, alt: $('img', a).alt, w: a.dataset.w, h: a.dataset.h }));
  links.forEach((a, k) => a.addEventListener('click', e => { e.preventDefault(); lb.open(list, k, a); }));
}

function absUrl(u) {
  if (!u) return '';
  return /^https?:/i.test(u) ? u : API + (u.startsWith('/') ? '' : '/') + u;
}

function igEmbed(url) {
  const m = /instagram\.com\/(?:[^/]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i.exec(url || '');
  if (!m) return '';
  return `https://www.instagram.com/${m[1].toLowerCase() === 'p' ? 'p' : 'reel'}/${m[2]}/embed/`;
}

function ttEmbed(url) {
  const m = /tiktok\.com\/.*\/video\/(\d+)/i.exec(url || '');
  return m ? `https://www.tiktok.com/player/v1/${m[1]}?autoplay=1&loop=1&music_info=0&description=0` : '';
}

function normVideo(v) {
  const platform = v.platform || 'file';
  const vertical = v.orientation ? v.orientation === 'vertical' : platform !== 'youtube' && platform !== 'file';
  const poster = absUrl(v.poster_url) || (platform === 'youtube' && v.embed_id ? `https://img.youtube.com/vi/${v.embed_id}/hqdefault.jpg` : '');
  const file = absUrl(v.video_file_url) || (platform === 'file' ? v.url : '');
  let embed = '';
  if (platform === 'youtube' && v.embed_id) embed = `https://www.youtube-nocookie.com/embed/${v.embed_id}?autoplay=1&mute=1&playsinline=1&loop=1&playlist=${v.embed_id}&rel=0`;
  else if (platform === 'instagram') embed = igEmbed(v.url);
  else if (platform === 'tiktok') embed = ttEmbed(v.url);
  return { type: 'video', platform, vertical: file ? v.orientation !== 'horizontal' : vertical, poster, file, url: v.url, title: (v.title || '').trim(), embed };
}

function placeholder(it, big) {
  const ic = { instagram: 'instagram', tiktok: 'tiktok', youtube: 'youtube' }[it.platform] || 'film';
  const mk = $('#ico-mark') ? $('#ico-mark').content.firstElementChild.cloneNode(true) : null;
  return el('span', { class: 'vph', 'aria-hidden': 'true' }, [
    el('span', { class: 'vph-mk' }, [mk]),
    el('span', { class: 'vph-t' }, [el('small', {}, [iconSvg(ic), document.createTextNode(PLATFORM[it.platform] || 'Видео')]), big || it.title ? el('b', { text: it.title || 'Работа мастера' }) : null]),
  ]);
}

function safeImg(it) {
  const img = el('img', { src: it.poster, alt: '', loading: 'lazy', decoding: 'async' });
  img.addEventListener('error', () => img.replaceWith(placeholder(it, true)), { once: true });
  return img;
}

function fileVideo(it, extra = {}) {
  return el('video', Object.assign({ src: it.file, playsinline: true, loop: true, preload: 'auto', poster: it.poster || null, 'webkit-playsinline': true }, extra));
}

function reel() {
  if (typeof HTMLDialogElement !== 'function') return null;
  const dlg = el('dialog', { class: 'reel', 'aria-label': 'Видео работ' });
  const panel = el('div', { class: 'rl-p' });
  const bg = el('img', { class: 'rl-bg', alt: '', 'aria-hidden': 'true' });
  const media = el('div', { class: 'rl-m' });
  const card = el('a', { class: 'rl-c', href: '#', target: '_blank', rel: 'noopener', 'data-goal': 'video_external' });
  const dots = el('div', { class: 'rl-dots', 'aria-hidden': 'true' });
  const snd = el('button', { type: 'button', class: 'rl-b rl-snd', 'aria-pressed': 'false', 'aria-label': 'Включить звук' }, [iconSvg('mute')]);
  const close = el('button', { type: 'button', class: 'rl-b rl-x', 'aria-label': 'Закрыть' }, [iconSvg('x')]);
  const up = el('button', { type: 'button', class: 'rl-b rl-up', 'aria-label': 'Предыдущее видео' }, [iconSvg('up')]);
  const down = el('button', { type: 'button', class: 'rl-b rl-dn', 'aria-label': 'Следующее видео' }, [iconSvg('down')]);
  panel.append(bg, media, dots, snd, card);
  dlg.append(panel, close, up, down);
  document.body.append(dlg);
  let items = [];
  let i = 0;
  let opener = null;
  let sound = false;
  let vid = null;
  let pre = null;
  const setSnd = () => {
    snd.replaceChildren(iconSvg(sound ? 'sound' : 'mute'));
    snd.setAttribute('aria-pressed', String(sound));
    snd.setAttribute('aria-label', sound ? 'Выключить звук' : 'Включить звук');
  };
  const play = v => {
    v.muted = !sound;
    const p = v.play();
    if (p && p.catch) p.catch(() => {
      if (!v.muted) { sound = false; setSnd(); v.muted = true; v.play().catch(() => showTap(v)); } else showTap(v);
    });
  };
  const showTap = v => {
    if ($('.rl-tap', media)) return;
    const b = el('button', { type: 'button', class: 'rl-tap', 'aria-label': 'Смотреть' }, [iconSvg('play')]);
    b.addEventListener('click', () => { b.remove(); play(v); });
    media.append(b);
  };
  const preload = () => {
    const nx = items[(i + 1) % items.length];
    if (!nx || !nx.file || items.length < 2) { pre = null; return; }
    if (pre && pre.dataset.src === nx.file) return;
    pre = fileVideo(nx, { muted: true });
    pre.dataset.src = nx.file;
    pre.load();
  };
  const render = () => {
    const it = items[i];
    if (vid) { vid.pause(); vid = null; }
    media.replaceChildren();
    media.className = `rl-m${it.vertical ? ' vert' : ''}`;
    if (it.poster) { bg.src = it.poster; bg.hidden = false; } else bg.hidden = true;
    snd.hidden = !it.file;
    if (it.file) {
      vid = pre && pre.dataset.src === it.file ? pre : fileVideo(it);
      pre = null;
      media.append(vid);
      play(vid);
    } else if (it.embed) {
      media.classList.add('emb');
      media.append(placeholder(it, true), el('iframe', { src: it.embed, title: it.title || `Видео ${PLATFORM[it.platform] || ''}`.trim(), allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', scrolling: 'no' }));
    } else {
      media.append(it.poster ? el('img', { class: 'rl-poster', src: it.poster, alt: '' }) : placeholder(it, true));
    }
    const name = PLATFORM[it.platform] || 'Источник';
    card.href = it.url;
    card.dataset.label = it.title || it.url;
    card.replaceChildren(
      el('span', { class: 'rl-t' }, [el('small', { text: name }), el('b', { text: it.title || 'Работа мастера' })]),
      el('span', { class: 'rl-o' }, [el('span', { text: it.platform === 'file' ? 'Открыть' : `Смотреть в ${name}` }), iconSvg('out')]),
    );
    dots.replaceChildren(...(items.length > 1 ? items.map((_, k) => el('i', { class: k === i ? 'on' : null })) : []));
    up.hidden = down.hidden = items.length < 2;
    preload();
  };
  const go = d => { if (items.length > 1) { i = (i + d + items.length) % items.length; render(); } };
  const open = (list, k, from) => {
    items = list; i = k; opener = from;
    sound = true;
    setSnd();
    dlg.showModal();
    render();
    close.focus({ preventScroll: true });
  };
  snd.addEventListener('click', () => {
    sound = !sound;
    setSnd();
    if (vid) { vid.muted = !sound; if (vid.paused) play(vid); }
  });
  up.addEventListener('click', () => go(-1));
  down.addEventListener('click', () => go(1));
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { if (vid) vid.pause(); vid = null; pre = null; media.replaceChildren(); if (opener) opener.focus(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    if (e.key === 'm' || e.key === 'M') snd.click();
  });
  let wheelAt = 0;
  dlg.addEventListener('wheel', e => {
    e.preventDefault();
    const now = Date.now();
    if (Math.abs(e.deltaY) < 24 || now - wheelAt < 650) return;
    wheelAt = now;
    go(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  let y0 = null;
  let x0 = null;
  panel.addEventListener('pointerdown', e => { y0 = e.clientY; x0 = e.clientX; });
  panel.addEventListener('pointercancel', () => { y0 = null; });
  panel.addEventListener('pointerup', e => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    const dx = e.clientX - x0;
    y0 = null;
    if (Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) go(dy < 0 ? 1 : -1);
    else if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
  });
  return { open };
}

async function videos() {
  if (!API || !$('#ico-play') || PAGE === 'book') return;
  let off = false;
  try { off = sessionStorage.getItem('vw-off') === '1'; } catch (e) { off = false; }
  if (off) return;
  let data;
  try {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = ctl && setTimeout(() => ctl.abort(), 8000);
    const r = await fetch(`${API}/api/videos`, { headers: { Accept: 'application/json' }, credentials: 'omit', signal: ctl && ctl.signal });
    if (t) clearTimeout(t);
    if (!r.ok) return;
    data = await r.json();
  } catch (e) {
    return;
  }
  const raw = (data && data.items || []).filter(v => v && v.url).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (!raw.length) return;
  const rl = reel();
  if (!rl) return;
  const list = raw.map(normVideo);
  const k0 = Math.max(0, list.findIndex(v => v.file));
  const first = list[k0];
  let thumb;
  const w = el('div', { class: 'vw', role: 'complementary', 'aria-label': 'Видео работ' });
  if (first.file) {
    thumb = fileVideo(first, { muted: true, autoplay: true, preload: 'metadata', 'aria-hidden': 'true', tabindex: '-1' });
    thumb.muted = true;
    thumb.addEventListener('playing', () => w.classList.add('playing'));
  } else if (first.poster) thumb = safeImg(first);
  else thumb = placeholder(first, false);
  const open = el('button', { type: 'button', class: 'vw-o', 'aria-label': `Смотреть видео: ${first.title || 'работы мастера'}` }, [
    el('span', { class: 'vw-m' }, [thumb]),
    el('span', { class: 'vw-pl', 'aria-hidden': 'true' }, [iconSvg('play')]),
    list.length > 1 ? el('span', { class: 'vw-n', text: `${list.length} видео` }) : null,
  ]);
  const x = el('button', { type: 'button', class: 'vw-x', 'aria-label': 'Скрыть видео' }, [iconSvg('x')]);
  w.append(open, x);
  open.addEventListener('click', () => { goal('video_open', first.title || first.url); if (thumb.pause) thumb.pause(); rl.open(list, k0, open); });
  x.addEventListener('click', () => { w.remove(); try { sessionStorage.setItem('vw-off', '1'); } catch (e) { return; } });
  document.body.append(w);
  if (thumb.play) thumb.play().catch(() => {});
  const vsec = $('#video');
  if (vsec) {
    vsec.hidden = false;
    $('#vrow').replaceChildren(...list.map((it, k) => {
      const b = el('button', { type: 'button', class: 'vt', 'aria-label': `Смотреть: ${it.title || 'видео работ'}` }, [
        it.poster ? safeImg(it) : it.file ? fileVideo(it, { muted: true, preload: 'metadata', 'aria-hidden': 'true', tabindex: '-1', src: `${it.file}#t=0.1` }) : placeholder(it, true),
        el('span', { class: 'vt-pl', 'aria-hidden': 'true' }, [iconSvg('play')]),
      ]);
      b.addEventListener('click', () => { goal('video_open', it.title || it.url); rl.open(list, k, b); });
      return el('li', {}, [b, it.title ? el('p', { class: 'vt-t', text: it.title }) : null]);
    }));
  }
  const story = $('#story');
  const fin = $('.final');
  const seen = { gate: false, fin: false };
  const upd = () => w.classList.toggle('on', seen.gate && !seen.fin && !$('.reel[open]'));
  if ('IntersectionObserver' in window) {
    const gate = story && mobile.matches ? story : $('.ch-hero') || $('.lhero') || $('.page');
    if (gate) new IntersectionObserver(([e]) => { seen.gate = !e.isIntersecting && e.boundingClientRect.top < 0; upd(); }).observe(gate);
    else seen.gate = true;
    if (fin) new IntersectionObserver(([e]) => { seen.fin = e.isIntersecting; upd(); }).observe(fin);
  } else seen.gate = true;
  upd();
}

function openWa(text) {
  const url = `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  const w = window.open(url, '_blank');
  if (w) w.opener = null; else location.href = url;
}

function phoneDigits(v) {
  let d = v.replace(/\D/g, '');
  if (d.startsWith('996996')) d = d.slice(3);
  if (d.startsWith('9960')) d = '996' + d.slice(4);
  if (d.startsWith('0')) d = '996' + d.slice(1);
  else if (d.length && !d.startsWith('996') && d.length <= 9) d = '996' + d;
  return d.slice(0, 12);
}

function phoneFormat(d) {
  if (!d) return '';
  const p = [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8, 10), d.slice(10, 12)].filter(Boolean);
  return '+' + p.join(' ');
}

function book() {
  const form = $('#book');
  if (!form) return;
  const q = new URLSearchParams(location.search);
  const box = $('#sym');
  const set = new Set();
  const st = { mode: null, soon: '', sending: false, rid: '' };
  const val = id => $(id).value.trim();
  const steps = ['car', 'sym', 'mode', 'tel'];
  if ($(`.chip[data-id="${q.get('s')}"]`, box)) set.add(q.get('s'));
  if (['call', 'come'].includes(q.get('m'))) st.mode = q.get('m');
  const soon = ['Сейчас', 'Через час', 'Вечером', 'Ночью', 'Завтра утром'];
  $('#soon').replaceChildren(...soon.map(t => el('button', { type: 'button', class: 'chip', 'data-t': t, 'aria-pressed': 'false', text: t })));
  const names = () => $$('.chip:not(.more)', box).filter(b => set.has(b.dataset.id)).map(b => b.textContent);
  const problem = () => [...names(), val('#note')].filter(Boolean).join('; ');
  const place = () => (st.mode === 'come' ? st.soon : val('#place'));
  const tel = () => phoneDigits($('#tel').value);
  const done = {
    car: () => Boolean(val('#car')),
    sym: () => Boolean(problem()),
    mode: () => Boolean(st.mode && place()),
    tel: () => tel().length === 12,
  };
  const modeText = () => (st.mode === 'call' ? `Машина стоит: ${place() || '…'}` : st.mode === 'come' ? `Приеду сам: ${place() || '…'}` : '');
  const plain = (withPhone = true) => {
    const l = ['Здравствуйте! Нужна помощь.', `Авто: ${val('#car') || '…'}`, `Что случилось: ${problem() || '…'}`];
    if (st.mode) l.push(modeText());
    if (withPhone && tel().length === 12) l.push(`Телефон: ${phoneFormat(tel())}`);
    if (val('#name')) l.push(`Имя: ${val('#name')}`);
    return l.join('\n');
  };
  const prevLines = new Map();
  const preview = () => {
    const lines = [
      ['hi', null, 'Здравствуйте! Нужна помощь.', ''],
      ['car', 'Авто', val('#car'), 'марка и модель'],
      ['sym', 'Что случилось', problem(), 'поломка'],
      ['mode', st.mode === 'come' ? 'Приеду сам' : 'Где машина', st.mode ? place() : '', st.mode === 'come' ? 'когда приедете' : st.mode === 'call' ? 'адрес или ориентир' : 'стоит или приедете сами'],
      ['tel', 'Телефон', tel().length > 3 ? phoneFormat(tel()) : '', 'номер для звонка'],
    ];
    if (val('#name')) lines.push(['name', 'Имя', val('#name'), '']);
    const out = lines.map(([k, label, v, miss]) => {
      const p = el('p', { 'data-k': k });
      if (label) p.append(el('span', { class: 'k', text: `${label}: ` }));
      p.append(v ? document.createTextNode(v) : el('span', { class: 'mis', text: miss }));
      if (v && prevLines.get(k) !== v && prevLines.has(k)) p.classList.add('new');
      prevLines.set(k, v);
      return p;
    });
    const tm = el('span', { class: 'tm' }, [document.createTextNode('сейчас'), iconSvg('checks')]);
    $('#preview').replaceChildren(...out, tm);
  };
  const missing = () => {
    const m = [];
    if (!done.car()) m.push('машина');
    if (!done.sym()) m.push('что случилось');
    if (!done.mode()) m.push(st.mode === 'call' ? 'где машина' : st.mode === 'come' ? 'когда приедете' : 'стоит или приедете');
    if (!done.tel()) m.push('телефон');
    return m;
  };
  const draw = () => {
    $$('.chip:not(.more)', box).forEach(b => b.setAttribute('aria-pressed', String(set.has(b.dataset.id))));
    $$('#soon .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === st.soon)));
    $$('#mode .opt').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === st.mode)));
    $('#where').hidden = st.mode !== 'call';
    $('#when').hidden = st.mode !== 'come';
    if (st.mode === 'come') fitChips($('#when'));
    let n = 0;
    steps.forEach(k => { const ok = done[k](); $(`[data-step="${k}"]`, form).classList.toggle('ok', ok); if (ok) n++; });
    $('#pbar').style.width = `${(n / steps.length) * 100}%`;
    $('#ptext').textContent = n === steps.length ? 'Всё заполнено' : `Готово ${n} из ${steps.length}`;
    const m = missing();
    const send = $('#send');
    send.setAttribute('aria-disabled', String(m.length > 0));
    $('#need').textContent = m.length ? `Осталось: ${m.join(', ')}` : 'Мастер перезвонит после отправки';
    preview();
  };
  const clearErr = step => {
    const s = $(`[data-step="${step}"]`, form);
    if (!s) return;
    s.classList.remove('bad');
    $$('.ferr', s).forEach(n => n.parentNode.removeChild(n));
    $$('[aria-invalid]', s).forEach(i => i.removeAttribute('aria-invalid'));
  };
  const showErr = (step, target, msg) => {
    const s = $(`[data-step="${step}"]`, form);
    clearErr(step);
    s.classList.add('bad');
    const p = el('p', { class: 'ferr', id: `err-${step}`, text: msg });
    $('.fb', s).append(p);
    const t = $(target, form);
    if (t && t.tagName === 'INPUT') { t.setAttribute('aria-invalid', 'true'); t.setAttribute('aria-describedby', p.id); }
    if (t) t.focus({ preventScroll: true });
    s.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' });
  };
  const check = (needPhone = true) => {
    const checks = [
      [!done.car(), 'car', '#car', 'Напишите марку и модель, например Toyota Camry'],
      [!done.sym(), 'sym', '#sym .chip', 'Отметьте поломку или опишите её своими словами'],
      [!st.mode, 'mode', '#mode .opt', 'Выберите: машина стоит или приедете сами'],
      [st.mode && !place(), 'mode', st.mode === 'call' ? '#place' : '#soon .chip', st.mode === 'call' ? 'Напишите, где стоит машина' : 'Выберите, когда приедете'],
    ];
    if (needPhone) checks.push([!done.tel(), 'tel', '#tel', tel().length > 3 ? 'Номер неполный: нужно +996 и ещё 9 цифр' : 'Укажите телефон, по нему мастер перезвонит']);
    const miss = checks.find(c => c[0]);
    if (miss) { showErr(miss[1], miss[2], miss[3]); return false; }
    return true;
  };
  const touched = new Set();
  box.addEventListener('click', e => {
    const b = e.target.closest('.chip:not(.more)');
    if (!b) return;
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    clearErr('sym');
    draw();
  });
  $('#soon').addEventListener('click', e => { const b = e.target.closest('.chip:not(.more)'); if (!b) return; st.soon = st.soon === b.dataset.t ? '' : b.dataset.t; clearErr('mode'); draw(); });
  $('#mode').addEventListener('click', e => {
    const b = e.target.closest('.opt');
    if (!b) return;
    st.mode = b.dataset.m;
    clearErr('mode');
    draw();
    if (st.mode === 'call') $('#place').focus({ preventScroll: true });
  });
  const telIn = $('#tel');
  telIn.addEventListener('input', () => {
    const d = phoneDigits(telIn.value);
    const f = d.length > 3 || /\d/.test(telIn.value) ? phoneFormat(d) : telIn.value;
    if (telIn.value !== f) telIn.value = f;
  });
  telIn.addEventListener('focus', () => { if (!telIn.value) telIn.value = '+996 '; });
  telIn.addEventListener('blur', () => {
    if (phoneDigits(telIn.value).length <= 3) telIn.value = '';
    touched.add('tel');
    if (telIn.value && !done.tel()) showErr('tel', '#tel', 'Номер неполный: нужно +996 и ещё 9 цифр');
  });
  $$('input', form).forEach(i => i.addEventListener('input', () => { const s = i.closest('[data-step]'); if (s) clearErr(s.dataset.step); draw(); }));
  $$('input', form).forEach(i => i.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || i.id === 'tel' || i.id === 'name') return;
    e.preventDefault();
    const order = ['#car', '#note', '#place', '#tel'];
    const nx = order.slice(order.indexOf(`#${i.id}`) + 1).map(s => $(s)).find(n => n && n.offsetParent !== null);
    if (nx) nx.focus();
  }));

  const show = id => {
    form.hidden = true;
    $('#done').hidden = id !== 'done';
    $('#fail').hidden = id !== 'fail';
    const s = $(`#${id}`);
    s.focus({ preventScroll: true });
    s.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' });
  };
  const submit = async () => {
    if (st.sending) return;
    if (!window.LeadsClient || !API) { show('fail'); $('#fail-t').textContent = 'Сервис заявок сейчас недоступен. Отправьте заявку в WhatsApp или позвоните.'; return; }
    st.sending = true;
    const send = $('#send');
    send.setAttribute('aria-busy', 'true');
    $('span', send).textContent = 'Отправляем…';
    if (!st.rid) st.rid = window.LeadsClient.create({ api: API }).newRequestId();
    const items = [{ title: (names().join(', ') || 'Заявка автоэлектрику').slice(0, 120) }];
    const comment = [`Авто: ${val('#car')}`, `Что случилось: ${problem()}`, modeText()].join('\n').slice(0, 1000);
    try {
      const res = await window.LeadsClient.create({ api: API }).submit({
        kind: 'order',
        client_request_id: st.rid,
        name: val('#name').length >= 2 ? val('#name').slice(0, 80) : 'Клиент',
        phone: phoneFormat(tel()),
        items,
        comment,
        source: bookSource(),
        website: form.website.value,
      });
      goal('form_submit', `запись: ${problem()}`);
      $('#done-t').textContent = `Заявка №${res.number} принята. Мастер перезвонит на ${phoneFormat(tel())}.`;
      $('#done-wa').href = `https://wa.me/${WA}?text=${encodeURIComponent(`${plain()}\nЗаявка №${res.number}`)}`;
      st.rid = '';
      show('done');
    } catch (err) {
      if (err && err.status === 422 && err.fields && err.fields.phone) {
        showErr('tel', '#tel', err.fields.phone);
      } else {
        $('#fail-t').textContent = (err && err.message) || 'Не удалось отправить заявку.';
        show('fail');
      }
    } finally {
      st.sending = false;
      send.removeAttribute('aria-busy');
      $('span', send).textContent = 'Отправить заявку';
    }
  };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!check(true)) return;
    submit();
  });
  $('#retry').addEventListener('click', () => { $('#fail').hidden = true; form.hidden = false; submit(); });
  const waSend = () => { goal('whatsapp', 'заявка в WhatsApp'); openWa(plain()); };
  $('#wa-send').addEventListener('click', () => { if (check(false)) waSend(); });
  $('#fail-wa').addEventListener('click', waSend);
  draw();
}

header();
dock();
menu();
fitChips();
finder();
const LB = lightbox();
gallery(LB);
videos();
book();

const SRC_KEY = 'el-src';
const UTM_KEY = 'el-utm';
const NOT_SERVICE = ['index', 'prices', 'book', 'visit', '404', 'admin'];

function ssGet(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }
function ssSet(k, v) { try { if (v) sessionStorage.setItem(k, v); else sessionStorage.removeItem(k); } catch (e) { return; } }

function trackSource() {
  const utm = new URLSearchParams(location.search).get('utm_source');
  if (utm) ssSet(UTM_KEY, `utm:${utm.trim().slice(0, 36)}`);
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href*="book.html"]');
    if (!a) return;
    let src = '';
    if (a.closest('.ch:not(.ch-hero)')) src = '3d';
    else if (PAGE === 'prices') src = 'prices';
    else if (PAGE && !NOT_SERVICE.includes(PAGE)) src = `service:${PAGE}`;
    else if (a.closest('.hero, #hero-acts')) src = 'hero';
    ssSet(SRC_KEY, src);
  }, true);
}

function bookSource() {
  return (ssGet(UTM_KEY) || ssGet(SRC_KEY) || '').slice(0, 40) || undefined;
}

function priceNum(n) { return Number(n).toLocaleString('ru-RU').replace(/\s/g, ' '); }

function swapPrice(node, sv) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  let t = walker.nextNode();
  while (t) {
    if (/^\s*(от\s*)?\d[\d\s ]*\s*$/.test(t.nodeValue)) {
      t.nodeValue = t.nodeValue.replace(/\d[\d\s ]*\d|\d/, priceNum(sv.price_from));
      return true;
    }
    t = walker.nextNode();
  }
  return false;
}

function applyPrices(items) {
  const by = {};
  items.forEach(s => { if (s && s.slug && s.published !== false && (s.price_from || s.price_text)) by[s.slug] = s; });
  $$('[data-ps]').forEach(n => {
    const sv = by[n.dataset.ps];
    if (!sv) return;
    if (sv.price_from) {
      if (!swapPrice(n, sv)) { n.textContent = `от ${priceNum(sv.price_from)} сом`; n.classList.remove('ask'); }
    } else if (sv.price_text) {
      n.textContent = sv.price_text;
    }
  });
  if (PAGE !== 'index') return;
  $$('a[href$=".html"]').forEach(a => {
    if (a.closest('[data-ps], header, footer, nav')) return;
    const sv = by[(a.getAttribute('href') || '').replace(/\.html$/, '')];
    if (sv && sv.price_from) swapPrice(a, sv);
  });
}

async function loadPrices() {
  if (!API || PAGE === 'admin' || !('fetch' in window)) return;
  try {
    const r = await fetch(`${API}/api/services`, { headers: { Accept: 'application/json' }, credentials: 'omit' });
    if (!r.ok) return;
    const data = await r.json();
    if (data && Array.isArray(data.items) && data.items.length) applyPrices(data.items);
  } catch (e) {
    return;
  }
}

trackSource();
loadPrices();
