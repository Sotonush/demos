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
  const hero = $('.hero');
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

function placeholder(platform) {
  const ic = { instagram: 'instagram', tiktok: 'tiktok' }[platform] || 'film';
  return el('span', { class: 'vph' }, [iconSvg(ic), el('span', { text: PLATFORM[platform] || 'Видео' })]);
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
        const media = it.poster ? el('img', { src: it.poster, alt: '' }) : placeholder(it.platform);
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

function normVideo(v) {
  const platform = v.platform || 'file';
  const vertical = v.orientation ? v.orientation === 'vertical' : platform !== 'youtube' && platform !== 'file';
  const poster = absUrl(v.poster_url) || (platform === 'youtube' && v.embed_id ? `https://img.youtube.com/vi/${v.embed_id}/hqdefault.jpg` : '');
  return {
    type: 'video', platform, vertical, poster, url: v.url, title: (v.title || '').trim(),
    embed: platform === 'youtube' && v.embed_id ? `https://www.youtube-nocookie.com/embed/${v.embed_id}?autoplay=1&rel=0&playsinline=1` : '',
  };
}

function reel() {
  if (typeof HTMLDialogElement !== 'function') return null;
  const dlg = el('dialog', { class: 'reel', 'aria-label': 'Видео работ' });
  const panel = el('div', { class: 'rl-p' });
  const bg = el('img', { class: 'rl-bg', alt: '', 'aria-hidden': 'true' });
  const media = el('div', { class: 'rl-m' });
  const card = el('a', { class: 'rl-c', href: '#', target: '_blank', rel: 'noopener', 'data-goal': 'video_external' });
  const close = el('button', { type: 'button', class: 'rl-b rl-x', 'aria-label': 'Закрыть' }, [iconSvg('x')]);
  const up = el('button', { type: 'button', class: 'rl-b rl-up', 'aria-label': 'Предыдущее видео' }, [iconSvg('up')]);
  const down = el('button', { type: 'button', class: 'rl-b rl-dn', 'aria-label': 'Следующее видео' }, [iconSvg('down')]);
  panel.append(bg, media, card);
  dlg.append(panel, close, up, down);
  document.body.append(dlg);
  let items = [];
  let i = 0;
  let opener = null;
  const render = () => {
    const it = items[i];
    media.replaceChildren();
    media.className = `rl-m${it.vertical ? ' vert' : ''}`;
    if (it.poster) { bg.src = it.poster; bg.hidden = false; } else bg.hidden = true;
    if (it.platform === 'youtube' && it.embed) {
      media.append(el('iframe', { src: it.embed, title: it.title || 'Видео YouTube', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin' }));
    } else if (it.platform === 'file') {
      media.append(el('video', { src: it.url, controls: true, autoplay: true, loop: true, playsinline: true, poster: it.poster || null }));
    } else {
      media.append(it.poster ? el('img', { class: 'rl-poster', src: it.poster, alt: '' }) : placeholder(it.platform));
    }
    const name = PLATFORM[it.platform] || 'Источник';
    card.href = it.url;
    card.dataset.label = it.title || it.url;
    card.replaceChildren(
      el('span', { class: 'rl-t' }, [el('small', { text: name }), el('b', { text: it.title || 'Видео работ' })]),
      el('span', { class: 'rl-o' }, [el('span', { text: it.platform === 'file' ? 'Открыть' : `Смотреть в ${name}` }), iconSvg('out')]),
    );
    up.hidden = down.hidden = items.length < 2;
  };
  const go = d => { if (items.length > 1) { i = (i + d + items.length) % items.length; render(); } };
  const open = (list, k, from) => {
    items = list; i = k; opener = from;
    render();
    dlg.showModal();
    close.focus();
  };
  up.addEventListener('click', () => go(-1));
  down.addEventListener('click', () => go(1));
  close.addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { media.replaceChildren(); if (opener) opener.focus(); });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowUp') { e.preventDefault(); go(-1); }
  });
  let y0 = null;
  let x0 = null;
  panel.addEventListener('pointerdown', e => { y0 = e.clientY; x0 = e.clientX; });
  panel.addEventListener('pointerup', e => {
    if (y0 === null) return;
    const dy = e.clientY - y0;
    const dx = e.clientX - x0;
    y0 = null;
    if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) go(dy < 0 ? 1 : -1);
  });
  return { open };
}

async function videos() {
  if (!API || !$('#ico-play')) return;
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
  const first = list[0];
  let thumb;
  if (first.poster) thumb = el('img', { src: first.poster, alt: '', decoding: 'async' });
  else if (first.platform === 'file') thumb = el('video', { src: `${first.url}#t=0.1`, muted: true, playsinline: true, preload: 'metadata', 'aria-hidden': 'true', tabindex: '-1' });
  else thumb = placeholder(first.platform);
  const open = el('button', { type: 'button', class: 'vw-o', 'aria-label': `Смотреть видео: ${first.title || 'работы мастера'}` }, [
    el('span', { class: 'vw-m' }, [thumb]),
    el('span', { class: 'vw-pl', 'aria-hidden': 'true' }, [iconSvg('play')]),
    list.length > 1 ? el('span', { class: 'vw-n', text: `1/${list.length}` }) : null,
  ]);
  const x = el('button', { type: 'button', class: 'vw-x', 'aria-label': 'Скрыть видео' }, [iconSvg('x')]);
  const w = el('div', { class: 'vw', role: 'complementary', 'aria-label': 'Видео работ' }, [open, x]);
  open.addEventListener('click', () => { goal('video_open', first.title || first.url); rl.open(list, 0, open); });
  x.addEventListener('click', () => { w.remove(); try { sessionStorage.setItem('vw-off', '1'); } catch (e) { return; } });
  document.body.append(w);
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
