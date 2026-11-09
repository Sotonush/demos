(() => {
  const { wa: WA, base: BASE, items: ITEMS, cats: CATS, api: API } = window.NEKO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byId = id => ITEMS.find(i => i.id === id);
  const catName = c => (CATS.find(x => x.id === c) || {}).t || '';
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} сом`;
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  const goods = n => `${n} ${plural(n, 'товар', 'товара', 'товаров')}`;
  const MAX = 20;
  const KEY = 'neko-cart-v1';
  const MKEY = 'neko-my-orders-v2';
  const PKEY = 'neko-pending-v1';
  const TKEY = 'neko-owner-token';
  const POLL_MS = 5000;
  const PAGE = document.body.dataset.page;
  const PICKUP = 'ГУМ Чынар, проспект Чуй, 92, 3 этаж, бутик C7';
  const svg = (d, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true"${cls ? ` class="${cls}"` : ''}>${d}</svg>`;
  const ICON = {
    minus: svg('<path d="M6 12h12"/>'),
    plus: svg('<path d="M12 6v12M6 12h12"/>'),
    trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
    check: svg('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    back: svg('<path d="M19 12H5M11 6l-6 6 6 6"/>'),
    retry: svg('<path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5"/>'),
    wa: svg('<path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.9L2.3 21.8l4.8-1.3A9.8 9.8 0 1 0 12 2.2Zm5.7 13.9c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.7-3.1-1.3-5.1-4.5-5.3-4.7-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.3Z"/>', 'fill')
  };
  const STATUS = [
    { id: 'new', t: 'Новый', tab: 'Новые', act: 'Принять заказ' },
    { id: 'accepted', t: 'Принят', tab: 'Принятые', act: 'Заказ собран' },
    { id: 'ready', t: 'Готов', tab: 'Готовые', act: 'Выдать заказ' },
    { id: 'done', t: 'Выдан', tab: 'Выданные', act: '' }
  ];
  const CANCELLED = { id: 'cancelled', t: 'Отменён', tab: 'Отменённые' };
  const ALL_STATUS = [...STATUS, CANCELLED];
  const FINAL = ['done', 'cancelled'];
  const stIndex = s => STATUS.findIndex(x => x.id === s);
  const stTitle = s => (ALL_STATUS.find(x => x.id === s) || STATUS[0]).t;
  const leads = window.LeadsClient && API ? window.LeadsClient.create({ api: API }) : null;
  const NO_CLIENT = 'Не удалось загрузить страницу целиком. Обновите её.';

  function store(key, fallback) {
    let memory = fallback();
    return {
      get() {
        try { const raw = localStorage.getItem(key); if (raw) memory = JSON.parse(raw); } catch (e) { }
        return memory;
      },
      set(v) {
        memory = v;
        try { if (v === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); } catch (e) { }
      }
    };
  }
  const cartStore = store(KEY, () => ({}));
  const mineStore = store(MKEY, () => []);
  const pendingStore = store(PKEY, () => null);

  function readCart() {
    const clean = {};
    for (const [id, q] of Object.entries(cartStore.get() || {})) {
      const n = Math.min(MAX, Math.floor(Number(q)));
      if (byId(id) && n > 0) clean[id] = n;
    }
    return clean;
  }
  let cart = readCart();
  const qty = id => cart[id] || 0;
  function setQty(id, n) {
    const next = Math.max(0, Math.min(MAX, n));
    if (next) cart[id] = next; else delete cart[id];
    cartStore.set(cart);
    sync(id);
  }
  function totalsOf(entries) {
    let count = 0, sum = 0, ask = 0;
    entries.forEach(([id, q]) => { const it = byId(id); if (!it) return; count += q; if (it.p) sum += it.p * q; else ask += q; });
    return { count, sum, ask };
  }
  const totals = () => totalsOf(Object.entries(cart));
  function orderTotals(o) {
    let count = 0, sum = 0, ask = 0;
    (o.items || []).forEach(x => { const q = x.qty || 1; count += q; if (x.price) sum += x.price * q; else ask += q; });
    return { count, sum, ask };
  }

  function readMine() {
    const list = mineStore.get();
    return Array.isArray(list) ? list.filter(x => x && typeof x.t === 'string') : [];
  }
  function remember(ref) {
    const list = readMine().filter(x => x.t !== ref.t);
    list.unshift(ref);
    mineStore.set(list.slice(0, 30));
  }
  function logOf(history) {
    const log = {};
    (history || []).forEach(h => { log[h.status] = h.at; });
    return log;
  }
  function when(iso) {
    const d = new Date(iso);
    const t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return `сегодня, ${t}`;
    return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}, ${t}`;
  }
  const digits = s => String(s || '').replace(/\D/g, '');
  function waPhone(s) {
    let d = digits(s);
    if (d.length === 10 && d[0] === '0') d = '996' + d.slice(1);
    if (d.length === 9) d = '996' + d;
    return d;
  }
  function prettyPhone(s) {
    const d = waPhone(s);
    if (d.length === 12 && d.startsWith('996')) return `+996 ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}`;
    return s;
  }
  function failHtml(text, hint) {
    return `<div class="fail-t"><b>${esc(text)}</b>${hint ? `<span>${esc(hint)}</span>` : ''}</div><button class="btn line sm" type="button" data-retry>${ICON.retry}Повторить</button>`;
  }
  const errText = e => (e && e.message) || 'Что-то пошло не так. Попробуйте ещё раз';

  function stepper(id, label) {
    const q = qty(id);
    return `<div class="step"><button type="button" data-dec="${id}" aria-label="Убрать одну штуку: ${esc(label)}">${ICON.minus}</button><output aria-live="polite"><b>${q}</b><small>в корзине</small></output><button type="button" data-inc="${id}" aria-label="Добавить ещё одну: ${esc(label)}"${q >= MAX ? ' disabled' : ''}>${ICON.plus}</button></div>`;
  }
  function renderAct(el, pop) {
    const id = el.dataset.add;
    const it = byId(id);
    const q = qty(id);
    el.innerHTML = q ? stepper(id, it.t) : `<button class="add" type="button" data-inc="${id}">${ICON.plus}В корзину</button>`;
    const host = el.closest('[data-item]');
    if (host) {
      host.classList.toggle('in-cart', q > 0);
      const mark = $('.in', host);
      if (mark) mark.textContent = q ? `В корзине · ${q}` : '';
    }
    if (pop && motion) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }

  function roll(el, value) {
    const old = el.lastElementChild;
    if (old && old.textContent === String(value)) return;
    [...el.children].forEach(c => { if (c !== old) c.remove(); });
    if (!motion || !old) { el.innerHTML = `<span>${value}</span>`; return; }
    old.className = 'roll-out';
    old.setAttribute('aria-hidden', 'true');
    const next = document.createElement('span');
    next.className = 'roll-in';
    next.textContent = value;
    el.appendChild(next);
    setTimeout(() => { if (old.parentNode) old.remove(); next.className = ''; }, 320);
  }

  function packet() {
    const p = $('[data-packet]');
    if (!p) return;
    const t = totals();
    const show = t.count > 0 && PAGE !== 'cart';
    $('[data-packet-n]').textContent = `В корзине ${goods(t.count)}`;
    $('[data-packet-sum]').textContent = t.sum ? (t.ask ? `${money(t.sum)} + по запросу` : money(t.sum)) : 'цена по запросу';
    if (show && p.hidden) {
      p.hidden = false;
      if (motion) { p.classList.add('off'); requestAnimationFrame(() => requestAnimationFrame(() => p.classList.remove('off'))); }
    } else if (!show) p.hidden = true;
    document.body.classList.toggle('has-packet', show);
  }

  function myOrdersLink() {
    const has = readMine().length > 0;
    $$('[data-myorders]').forEach(a => { a.hidden = !has; });
  }

  function sync(changed, initial) {
    const t = totals();
    $$('[data-count]').forEach(el => { if (initial) el.innerHTML = `<span>${t.count}</span>`; else roll(el, t.count); });
    $$('[data-add]').forEach(el => renderAct(el, el.dataset.add === changed));
    $$('.cartbtn').forEach(b => b.classList.toggle('is-zero', t.count === 0));
    packet();
    live();
    if (PAGE === 'cart') renderCart(changed);
  }

  let toastTimer;
  function toast(html) {
    const el = $('[data-toast]');
    if (!el) return;
    el.innerHTML = html;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.classList.remove('show'); setTimeout(() => { el.hidden = true; }, 250); }, 3200);
  }

  document.addEventListener('click', e => {
    const inc = e.target.closest('[data-inc]');
    const dec = e.target.closest('[data-dec]');
    const rm = e.target.closest('[data-rm]');
    if (inc) { const id = inc.dataset.inc; const wasAdd = inc.classList.contains('add'); setQty(id, qty(id) + 1); if (wasAdd) focusAfter(id, 'inc'); }
    else if (dec) { const id = dec.dataset.dec; setQty(id, qty(id) - 1); focusAfter(id, qty(id) ? 'dec' : 'inc'); }
    else if (rm) removeLine(rm.dataset.rm);
  });
  function focusAfter(id, kind) {
    const el = $(`[data-${kind}="${id}"]`);
    if (el && (document.activeElement === document.body || !document.activeElement)) el.focus({ preventScroll: true });
  }

  window.addEventListener('storage', e => {
    if (e.key === KEY) { cart = readCart(); sync(); }
    if (e.key === MKEY) myOrdersLink();
  });

  function smooth() {
    if (!motion || !window.Lenis || matchMedia('(pointer: coarse)').matches || PAGE === 'owner') return;
    const lenis = new window.Lenis({ lerp: 0.12, wheelMultiplier: 0.95 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  }

  function moreQuotes() {
    $$('[data-more]').forEach(b => {
      b.addEventListener('click', () => {
        const box = document.getElementById(b.dataset.more);
        box.hidden = false;
        b.setAttribute('aria-expanded', 'true');
        b.remove();
        const first = box.querySelector('figure');
        if (first) { first.setAttribute('tabindex', '-1'); first.focus({ preventScroll: true }); }
      });
    });
  }

  function catalog() {
    const chips = $$('.chips button');
    const only = $('#only-price');
    const cards = $$('#grid .box');
    const params = new URLSearchParams(location.search);
    let cat = CATS.some(c => c.id === params.get('cat')) ? params.get('cat') : 'all';
    only.checked = params.get('price') === '1';
    function apply() {
      chips.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === cat)));
      let n = 0;
      cards.forEach(c => {
        const show = (cat === 'all' || c.dataset.cat === cat) && (!only.checked || c.hasAttribute('data-priced'));
        c.hidden = !show;
        if (show) n++;
      });
      $('#found').textContent = `${cat === 'all' ? 'Все разделы' : catName(cat)}: ${goods(n)}${only.checked ? ' с ценой' : ''}`;
      $('#none').hidden = n > 0;
      const q = new URLSearchParams();
      if (cat !== 'all') q.set('cat', cat);
      if (only.checked) q.set('price', '1');
      const s = q.toString();
      history.replaceState(null, '', s ? `?${s}` : location.pathname);
      const on = $('.chips [aria-pressed="true"]');
      if (on && on.scrollIntoView && document.readyState === 'complete') on.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: motion ? 'smooth' : 'auto' });
    }
    $('.chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { cat = b.dataset.f; apply(); } });
    only.addEventListener('change', apply);
    $('#reset').addEventListener('click', () => { cat = 'all'; only.checked = false; apply(); });
    apply();
  }

  function cardHtml(it) {
    return `<article class="box" data-item="${it.id}" data-cat="${it.c}"><div class="band"><span class="no">№${it.no}</span><span class="tag">${esc(catName(it.c))}</span><span class="in" aria-hidden="true"></span></div>`
      + `<a class="win" data-win href="item.html?id=${it.id}" tabindex="-1" aria-hidden="true"><img src="img/${it.id}.webp" alt="" width="800" height="1000" loading="lazy" decoding="async"></a>`
      + `<div class="meta"><h3 class="name"><a href="item.html?id=${it.id}">${esc(it.t)}</a></h3>${it.p ? `<p class="price">${money(it.p)}</p>` : '<p class="price ask">Цена по запросу</p>'}</div>`
      + `<div class="act" data-add="${it.id}"></div></article>`;
  }

  function item() {
    const it = byId(new URLSearchParams(location.search).get('id'));
    if (!it) { location.replace('catalog.html'); return; }
    document.title = `${it.t}, Neko`;
    const ask = `Здравствуйте! Интересует товар с сайта Neko: ${it.t} (№${it.no}).\nФото: ${BASE}/img/${it.id}.webp`;
    $('#item').innerHTML = `<figure class="item-win win" data-win><img src="img/${it.id}.webp" alt="${esc(it.t)}" width="800" height="1000" fetchpriority="high"></figure>
      <div class="item-info" data-item="${it.id}">
      <nav class="crumbs" aria-label="Путь"><a href="catalog.html">Каталог</a><span aria-hidden="true">/</span><a href="catalog.html?cat=${it.c}">${esc(catName(it.c))}</a></nav>
      <p class="item-no"><span class="no">№${it.no}</span><span class="in" aria-hidden="true"></span></p>
      <h1>${esc(it.t)}</h1>
      <p class="big${it.p ? '' : ' ask'}">${it.p ? money(it.p) : 'Цена по запросу'}</p>
      ${it.p ? '<p class="small">Цена с ценника в магазине.</p>' : '<p class="small">Магазин назовёт цену и наличие в ответ на заказ.</p>'}
      <div class="act act-big" data-add="${it.id}"></div>
      <a class="ask-link" href="https://wa.me/${WA}?text=${encodeURIComponent(ask)}">${ICON.wa}Спросить о товаре в WhatsApp</a>
      <dl class="rows"><div><dt>Самовывоз</dt><dd>ГУМ Чынар, 3 этаж, бутик C7</dd></div><div><dt>Доставка</dt><dd>По Кыргызстану, стоимость подтвердит магазин</dd></div><div><dt>Часы</dt><dd>Ежедневно 10:00–22:00</dd></div></dl></div>`;
    const pool = ITEMS.filter(i => i.c === it.c && i.id !== it.id);
    const rest = ITEMS.filter(i => i.c !== it.c);
    const pick = [...pool, ...rest].slice(0, 4);
    $('#related').innerHTML = pick.map(cardHtml).join('');
    $('#more-cat').href = `catalog.html?cat=${it.c}`;
  }

  const SAMPLE = { igris: 1, chiikawa: 2 };
  function compose(entries) {
    const lines = ['Заказ с сайта Neko', ''];
    const t = totalsOf(entries);
    entries.forEach(([id, q], k) => {
      const it = byId(id);
      if (!it) return;
      lines.push(`${k + 1}. ${it.t} (№${it.no})`);
      lines.push(it.p ? `   ${q} шт × ${money(it.p)} = ${money(it.p * q)}` : `   ${q} шт, цена по запросу`);
    });
    lines.push('');
    if (t.sum) lines.push(`${t.ask ? 'Итого по ценникам' : 'Итого'}: ${money(t.sum)}`);
    if (t.ask) lines.push(t.sum ? 'Цену остальных товаров назовёт магазин.' : 'Цены и наличие назовёт магазин.');
    lines.push('');
    lines.push('Получение: самовывоз, ГУМ Чынар, 3 этаж, бутик C7');
    return lines.join('\n');
  }
  function live() {
    const el = $('#live-msg');
    if (!el) return;
    const own = Object.keys(cart).length > 0;
    $('#live-h').textContent = own ? 'Ваша корзина' : 'Пример заказа';
    el.textContent = compose(Object.entries(own ? cart : SAMPLE));
  }

  function lineHtml(id) {
    const it = byId(id);
    const q = qty(id);
    return `<li class="cline" data-line="${id}"><a class="line-img" data-win href="item.html?id=${id}" tabindex="-1" aria-hidden="true"><img src="img/${id}.webp" alt="" width="800" height="1000"></a>
      <div class="line-info"><a href="item.html?id=${id}">${esc(it.t)}</a><p><span class="no">№${it.no}</span>${it.p ? `${money(it.p)} за шт.` : 'цена по запросу'}</p></div>
      <button class="rm" type="button" data-rm="${id}" aria-label="Убрать из корзины: ${esc(it.t)}">${ICON.trash}</button>
      ${stepper(id, it.t)}
      <p class="line-total${it.p ? '' : ' ask'}">${it.p ? money(it.p * q) : 'по запросу'}</p></li>`;
  }

  function removeLine(id) {
    const li = $(`[data-line="${id}"]`);
    if (li && motion) { li.classList.add('gone'); setTimeout(() => setQty(id, 0), 200); }
    else setQty(id, 0);
  }

  function sumHtml(t) {
    return `<div><dt>Товаров</dt><dd>${t.count}</dd></div>`
      + (t.ask ? `<div><dt>Цена по запросу</dt><dd>${goods(t.ask)}</dd></div>` : '')
      + `<div class="total"><dt>${t.ask ? 'Итого по ценникам' : 'Итого'}</dt><dd>${t.sum ? money(t.sum) : '—'}</dd></div>`;
  }

  function renderCart(changed) {
    const ids = Object.keys(cart);
    const list = $('#lines');
    const existing = $$('[data-line]', list).map(l => l.dataset.line);
    if (changed && existing.join() === ids.join()) {
      const li = $(`[data-line="${changed}"]`);
      if (li) li.outerHTML = lineHtml(changed);
    } else list.innerHTML = ids.map(lineHtml).join('');
    $('#empty').hidden = ids.length > 0;
    $('#order').classList.toggle('is-empty', !ids.length);
    const t = totals();
    const sum = $('#sum');
    sum.hidden = !ids.length;
    sum.innerHTML = ids.length ? sumHtml(t) : '';
    $('#submit-sum').textContent = t.sum ? money(t.sum) + (t.ask ? ' +' : '') : '';
    if (ids.length) $('#err-cart').textContent = '';
  }

  function checkout() {
    const form = $('#form');
    const fail = $('#send-fail');
    const how = () => form.how.value;
    let sending = false;
    let waitOnline = false;
    function setHow() {
      const d = how() === 'delivery';
      $('#addr-wrap').hidden = !d;
      $('#pickup-hint').hidden = d;
    }
    const err = (id, text, field) => {
      $(`#err-${id}`).textContent = text;
      if (field) field.setAttribute('aria-invalid', text ? 'true' : 'false');
      return !text;
    };
    const saved = (() => { try { return JSON.parse(localStorage.getItem('neko-me') || '{}'); } catch (e) { return {}; } })();
    if (saved.name) form.name.value = saved.name;
    if (saved.phone) form.phone.value = saved.phone;
    $('#note-toggle').addEventListener('click', e => {
      const b = e.currentTarget;
      $('#note-wrap').hidden = false;
      b.remove();
      form.note.focus();
    });
    form.addEventListener('change', e => { if (e.target.name === 'how') { setHow(); if (how() === 'delivery') form.addr.focus(); } });
    form.addEventListener('input', e => {
      const id = e.target.id;
      if (id === 'name' || id === 'addr' || id === 'phone') err(id, '', e.target);
    });
    function busy(on) {
      const b = $('#submit');
      b.disabled = on;
      b.setAttribute('aria-busy', String(on));
      b.classList.toggle('is-busy', on);
      $('#submit-t').textContent = on ? 'Отправляем заказ…' : 'Оформить заказ';
    }
    function showFail(text, hint) {
      fail.innerHTML = failHtml(text, hint);
      fail.hidden = false;
    }
    function focusFirst() {
      const first = $('[aria-invalid="true"]', form) || $('#empty');
      if (first) { first.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'center' }); if (first.focus) first.focus({ preventScroll: true }); }
    }
    function payload() {
      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      const addr = form.addr.value.trim();
      const note = form.note.value.trim();
      const body = {
        kind: 'order',
        name,
        phone,
        items: Object.entries(cart).map(([id, q]) => {
          const it = byId(id);
          const x = { title: it.t, qty: q, sku: id };
          if (it.p) x.price = it.p;
          return x;
        }),
        delivery: how(),
        website: form.website.value
      };
      if (how() === 'delivery') body.address = addr;
      if (note) body.comment = note;
      return body;
    }
    function validate() {
      const name = form.name.value.trim();
      const phone = form.phone.value.trim();
      const addr = form.addr.value.trim();
      return [
        err('cart', Object.keys(cart).length ? '' : 'Корзина пустая: добавьте хотя бы один товар.'),
        err('addr', how() === 'delivery' && addr.length < 5 ? 'Укажите адрес или выберите самовывоз.' : '', form.addr),
        err('name', name.length >= 2 ? '' : 'Напишите имя, чтобы магазин знал, как к вам обращаться.', form.name),
        err('phone', digits(phone).length >= 9 ? '' : 'Нужен номер, чтобы магазин подтвердил заказ: например, 0555 123 456.', form.phone)
      ].every(Boolean);
    }
    function fieldErrors(fields) {
      const map = { name: ['name', form.name], phone: ['phone', form.phone], address: ['addr', form.addr] };
      let shown = false;
      const rest = [];
      Object.entries(fields).forEach(([k, v]) => {
        if (map[k]) { err(map[k][0], v, map[k][1]); shown = true; }
        else rest.push(v);
      });
      if (rest.length) { err('cart', rest.join('. ')); shown = true; }
      return shown;
    }
    async function send() {
      if (sending) return;
      if (!leads) { showFail(NO_CLIENT); return; }
      fail.hidden = true;
      if (!validate()) { focusFirst(); return; }
      const body = payload();
      const sig = JSON.stringify(body);
      let p = pendingStore.get();
      if (!p || p.sig !== sig || !p.rid) { p = { rid: leads.newRequestId(), sig }; pendingStore.set(p); }
      try { localStorage.setItem('neko-me', JSON.stringify({ name: body.name, phone: body.phone })); } catch (x) { }
      sending = true;
      busy(true);
      try {
        const res = await leads.submit({ ...body, client_request_id: p.rid });
        remember({ t: res.public_token, no: res.number, at: res.created_at, how: body.delivery, addr: body.address || '', name: body.name, phone: prettyPhone(body.phone), note: body.comment || '' });
        pendingStore.set(null);
        cart = {};
        cartStore.set(cart);
        location.href = `order.html?t=${encodeURIComponent(res.public_token)}`;
      } catch (e) {
        sending = false;
        busy(false);
        if (e.status === 422 && e.fields && fieldErrors(e.fields)) { focusFirst(); return; }
        if (e.status === 0) {
          showFail('Нет связи с сервером, заказ пока не отправлен', 'Корзина и данные сохранены. Отправим заказ сами, когда появится интернет, или нажмите «Повторить».');
          if (!waitOnline) { waitOnline = true; window.addEventListener('online', () => { waitOnline = false; send(); }, { once: true }); }
        } else showFail(errText(e));
        fail.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'center' });
      }
    }
    form.addEventListener('submit', e => { e.preventDefault(); send(); });
    fail.addEventListener('click', e => { if (e.target.closest('[data-retry]')) send(); });
    setHow();
    renderCart();
  }

  function track(o, opts = {}) {
    const cur = stIndex(o.status);
    const log = logOf(o.history);
    const del = o.delivery === 'delivery';
    const sub = {
      new: 'заказ у магазина',
      accepted: 'магазин проверил наличие',
      ready: del ? 'ждёт отправки' : 'можно забирать',
      done: del ? 'доставлен' : 'забран из магазина'
    };
    return `<ol class="track${opts.big ? ' track-big' : ''}" aria-label="Статус заказа">${STATUS.map((s, i) => {
      const cls = i < cur ? 'is-done' : i === cur ? 'is-now' : '';
      const time = log[s.id] && i <= cur ? `<time>${when(log[s.id])}</time>` : '';
      const inner = `<span class="track-dot">${i < cur || (i === cur && s.id === 'done') ? ICON.check : ''}</span><b>${s.t}</b><small>${sub[s.id]}</small>${time}`;
      return `<li class="${cls}"${i === cur ? ' aria-current="step"' : ''}>${inner}</li>`;
    }).join('')}</ol>`;
  }

  function customerNote(o) {
    const del = o.delivery === 'delivery';
    if (o.status === 'new') return 'Заказ у магазина. Магазин проверит наличие и цены и подтвердит его. Обычно это быстро в часы работы, 10:00–22:00.';
    if (o.status === 'accepted') return 'Магазин принял заказ и собирает его.';
    if (o.status === 'ready') return del ? 'Заказ собран и ждёт отправки по вашему адресу.' : `Заказ собран. Можно забирать: ${PICKUP}, ежедневно 10:00–22:00. Назовите номер заказа.`;
    if (o.status === 'cancelled') return 'Магазин отменил заказ. Если это ошибка или остались вопросы, напишите в магазин.';
    return del ? 'Заказ доставлен. Спасибо, что выбрали Neko!' : 'Заказ выдан. Спасибо, что выбрали Neko!';
  }

  function itemsHtml(o, cls = 'oitems') {
    return `<ul class="${cls}">${(o.items || []).map(x => {
      const it = byId(x.sku);
      const q = x.qty || 1;
      const title = it ? `<a href="item.html?id=${it.id}">${esc(x.title)}</a>` : `<span class="oi-name">${esc(x.title)}</span>`;
      return `<li><span class="oi-img" data-win>${it ? `<img src="img/${it.id}.webp" alt="" width="800" height="1000" loading="lazy">` : ''}</span><span class="oi-t">${title}<small>${it ? `<span class="no">№${it.no}</span>` : ''}${q} шт${x.price ? ` × ${money(x.price)}` : ', цена по запросу'}</small></span><span class="oi-sum${x.price ? '' : ' ask'}">${x.price ? money(x.price * q) : 'по запросу'}</span></li>`;
    }).join('')}</ul>`;
  }

  function orderSummary(o) {
    return `<dl class="sum">${sumHtml(orderTotals(o))}</dl>`;
  }

  function askShop(no) {
    return `https://wa.me/${WA}?text=${encodeURIComponent(`Здравствуйте! Вопрос по заказу №${no} с сайта Neko.`)}`;
  }

  function myOrders(root) {
    const mine = readMine();
    document.title = 'Мои заказы, Neko';
    if (!mine.length) {
      root.innerHTML = `<div class="page-head"><h1>Мои заказы</h1></div><div class="empty"><p class="empty-t">Заказов пока нет</p><p>Здесь появятся заказы, оформленные с этого устройства. Соберите корзину в каталоге.</p><a class="btn" href="catalog.html">Открыть каталог${ICON.arrow}</a></div>`;
      return;
    }
    root.innerHTML = `<div class="page-head"><h1>Мои заказы</h1></div><ul class="mylist">${mine.map(x => `<li><a href="order.html?t=${encodeURIComponent(x.t)}"><span class="ml-no">${esc(x.no)}</span><span class="ml-t"><b data-ml-sum="${esc(x.t)}">${x.how === 'delivery' ? 'Доставка' : 'Самовывоз'}</b><small>${when(x.at)}</small></span><span class="chip st-wait" data-ml-st="${esc(x.t)}">…</span></a></li>`).join('')}</ul>`;
    if (!leads) return;
    mine.forEach(x => {
      leads.status(x.t).then(o => {
        const chip = $(`[data-ml-st="${CSS.escape(x.t)}"]`);
        const sum = $(`[data-ml-sum="${CSS.escape(x.t)}"]`);
        const t = orderTotals(o);
        if (chip) { chip.className = `chip st-${o.status}`; chip.textContent = stTitle(o.status); }
        if (sum) sum.textContent = `${goods(t.count)}${t.sum ? ` · ${money(t.sum)}` : ''}`;
      }, e => {
        const chip = $(`[data-ml-st="${CSS.escape(x.t)}"]`);
        if (chip) { chip.className = 'chip st-wait'; chip.textContent = e.status === 404 ? 'Не найден' : 'Нет связи'; }
      });
    });
  }

  function orderPage() {
    const root = $('#orderpage');
    const token = new URLSearchParams(location.search).get('t');
    if (!token) { myOrders(root); return; }
    const ref = readMine().find(x => x.t === token) || {};
    let last = null;
    let stamp = '';
    let timer = null;
    let fails = 0;
    let loading = false;
    let problemShown = false;
    function draw(o, changed, problem) {
      problemShown = !!problem;
      document.title = `Заказ ${o.number}, Neko`;
      const del = o.delivery === 'delivery';
      const cancelled = o.status === 'cancelled';
      root.innerHTML = `<div class="ticket${changed ? ' is-changed' : ''}${cancelled ? ' is-cancelled' : ''}">
      <div class="ticket-head">
        <p class="ticket-k">Заказ</p>
        <h1 class="ticket-no" translate="no">${esc(o.number)}</h1>
        <p class="ticket-st"><span class="chip st-${o.status}">${stTitle(o.status)}</span><span>${when(o.created_at)}</span></p>
        <p class="ticket-note" aria-live="polite">${customerNote(o)}</p>
      </div>
      ${problem ? `<div class="fail fail-soft" role="status">${failHtml('Не получается обновить статус', `${errText(problem)}. Показываем последний известный.`)}</div>` : ''}
      ${cancelled ? '' : track(o, { big: true })}
      <div class="ticket-body">
        <section><h2>Товары</h2>${itemsHtml(o)}${orderSummary(o)}</section>
        <section><h2>Получение</h2><dl class="rows">
          <div><dt>${del ? 'Доставка' : 'Самовывоз'}</dt><dd>${del ? (ref.addr ? esc(ref.addr) : 'по адресу из заказа') : PICKUP}</dd></div>
          ${ref.name ? `<div><dt>Имя</dt><dd>${esc(ref.name)}</dd></div>` : ''}
          ${ref.phone ? `<div><dt>Телефон</dt><dd>${esc(ref.phone)}</dd></div>` : ''}
          ${ref.note ? `<div><dt>Комментарий</dt><dd>${esc(ref.note)}</dd></div>` : ''}
        </dl>
        <div class="ticket-acts"><a class="btn line sm" href="catalog.html">В каталог</a><a class="linkbtn wa-link" href="${askShop(o.number)}" target="_blank" rel="noopener">${ICON.wa}Написать в магазин</a></div>
        </section>
      </div>
      <p class="demo-note">${FINAL.includes(o.status) ? 'Заказ закрыт.' : 'Страница обновляется сама: как только магазин сменит статус, вы увидите его здесь.'}</p>
    </div>`;
    }
    function drawEmpty(title, text, retry) {
      document.title = 'Заказ, Neko';
      root.innerHTML = `<div class="ticket"><div class="page-head"><h1>${esc(title)}</h1></div>${retry ? `<div class="fail" role="alert">${failHtml(text)}</div>` : `<div class="empty"><p>${esc(text)}</p><a class="btn" href="order.html">Мои заказы${ICON.arrow}</a></div>`}</div>`;
    }
    function schedule() {
      clearTimeout(timer);
      if (last && FINAL.includes(last.status)) return;
      timer = setTimeout(load, fails ? Math.min(30000, POLL_MS * 2 ** fails) : POLL_MS);
    }
    async function load() {
      clearTimeout(timer);
      if (!leads) { drawEmpty('Заказ', NO_CLIENT, false); return; }
      if (document.hidden || loading) { schedule(); return; }
      loading = true;
      try {
        const o = await leads.status(token);
        const next = `${o.status}|${o.updated_at}`;
        const changed = !!last && last.status !== o.status;
        fails = 0;
        last = o;
        if (next !== stamp || problemShown) { stamp = next; draw(o, changed, null); }
        if (ref.t && ref.no !== o.number) remember({ ...ref, no: o.number });
      } catch (e) {
        if (e.status === 404) { loading = false; drawEmpty('Заказ не найден', 'Возможно, ссылка неполная. Проверьте её или откройте список своих заказов.', false); return; }
        fails += 1;
        if (last) draw(last, false, e);
        else drawEmpty('Заказ', errText(e), true);
      }
      loading = false;
      schedule();
    }
    root.addEventListener('click', e => { if (e.target.closest('[data-retry]')) { fails = 0; load(); } });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
    window.addEventListener('online', () => { fails = 0; load(); });
    root.innerHTML = `<div class="ticket"><p class="loading">Загружаем заказ…</p></div>`;
    load();
  }

  const owner = (() => {
    let api = null;
    let stopWatch = null;
    let list = [];
    let total = 0;
    let tab = 'all';
    let sel = null;
    let card = null;
    let sheet = false;
    let busyAct = '';
    let actFail = null;
    let lastAct = null;
    let loaded = false;
    let reconnect = null;
    const fresh = new Set();
    const drafts = {};
    const narrow = () => matchMedia('(max-width: 899px)').matches;
    const tokenStore = store(TKEY, () => '');
    const LIMIT = 200;

    function msgFor(o) {
      const hi = `Здравствуйте${o.name ? `, ${o.name}` : ''}! Это Neko.`;
      if (o.status === 'new') return `${hi} Получили ваш заказ ${o.number}, проверяем наличие.`;
      if (o.status === 'accepted') return `${hi} Заказ ${o.number} принят, собираем.`;
      if (o.status === 'ready') return o.delivery === 'delivery' ? `${hi} Заказ ${o.number} собран и скоро будет отправлен.` : `${hi} Заказ ${o.number} готов. Можно забирать: ГУМ Чынар, 3 этаж, бутик C7, ежедневно 10:00–22:00.`;
      if (o.status === 'cancelled') return `${hi} По заказу ${o.number}: `;
      return `${hi} Спасибо за покупку! Будем рады видеть вас снова.`;
    }

    function showLogin(message) {
      $('#desk').hidden = true;
      $('#login').hidden = false;
      document.title = 'Кабинет, Neko';
      $('#err-token').textContent = message || '';
      $('#token').setAttribute('aria-invalid', message ? 'true' : 'false');
      $('#token').focus();
    }

    function setLive(ok) {
      const el = $('#live');
      el.classList.toggle('is-off', !ok);
      $('span', el).textContent = ok ? 'Обновляется само' : 'Нет связи, переподключаемся…';
    }

    function logout(message) {
      if (stopWatch) stopWatch();
      stopWatch = null;
      clearTimeout(reconnect);
      tokenStore.set(null);
      api = null; list = []; sel = null; card = null; sheet = false; loaded = false;
      fresh.clear();
      document.body.classList.remove('sheet-open');
      $('#token').value = '';
      showLogin(message);
    }

    async function login(token) {
      const btn = $('#login-btn');
      const client = window.LeadsClient.owner({ api: API, token });
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      $('#err-token').textContent = '';
      try {
        await client.summary();
        tokenStore.set(token);
        start(client);
      } catch (e) {
        const text = e.status === 401 ? 'Ключ не подошёл. Проверьте, что он скопирован целиком.' : e.status === 503 ? 'Кабинет ещё не настроен на сервере.' : errText(e);
        $('#err-token').textContent = text;
        $('#token').setAttribute('aria-invalid', e.status === 401 ? 'true' : 'false');
        btn.innerHTML = `${e.status === 0 || e.status >= 500 ? 'Повторить' : 'Войти'}${ICON.arrow}`;
      }
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }

    function start(client) {
      api = client;
      $('#login').hidden = true;
      $('#desk').hidden = false;
      setLive(true);
      render();
      refresh(true);
      stopWatch = api.watch(onEvents, err => {
        if (err && err.status === 401) { logout('Ключ больше не действует. Войдите снова.'); return; }
        setLive(false);
        clearTimeout(reconnect);
        reconnect = setTimeout(() => refresh(), 4000);
      });
    }

    async function refresh(first) {
      if (!api) return;
      try {
        const r = await api.list({ limit: LIMIT });
        list = r.items || [];
        total = r.total || list.length;
        loaded = true;
        $('#oerr').hidden = true;
        setLive(true);
        if (card && sel) {
          const fromList = list.find(o => o.number === sel);
          if (fromList && fromList.updated_at !== card.updated_at) loadCard(sel);
        }
        render();
      } catch (e) {
        if (e.status === 401) { logout('Ключ больше не действует. Войдите снова.'); return; }
        if (first || !loaded) {
          const box = $('#oerr');
          box.innerHTML = failHtml('Не удалось загрузить заказы', errText(e));
          box.hidden = false;
        }
        setLive(false);
      }
    }

    async function loadCard(no) {
      try {
        const o = await api.get(no);
        if (sel === no) { card = o; renderDetail(); }
      } catch (e) {
        if (e.status === 401) logout('Ключ больше не действует. Войдите снова.');
      }
    }

    function onEvents(events) {
      setLive(true);
      events.forEach(ev => {
        if (ev.type === 'created') { fresh.add(ev.number); toast(`Новый заказ ${esc(ev.number)}`); }
      });
      refresh();
    }

    async function act(no, run, label) {
      if (busyAct) return;
      busyAct = label;
      actFail = null;
      lastAct = () => act(no, run, label);
      renderDetail();
      try {
        const o = await run();
        busyAct = '';
        if (sel === no) card = o;
        const i = list.findIndex(x => x.number === no);
        if (i >= 0) list[i] = { ...list[i], ...o };
        render();
        return o;
      } catch (e) {
        busyAct = '';
        if (e.status === 401) { logout('Ключ больше не действует. Войдите снова.'); return null; }
        actFail = e;
        if (e.status === 409) { actFail = null; toast(esc(errText(e))); loadCard(no); refresh(); }
        renderDetail();
        return null;
      }
    }

    function setStatus(no, s) {
      act(no, () => api.setStatus(no, s), s).then(o => { if (o) toast(`Заказ ${esc(o.number)}: ${stTitle(o.status).toLowerCase()}`); });
    }

    function saveNote(no) {
      const value = (drafts[no] ?? '').trim();
      act(no, () => api.setNote(no, value), 'note').then(o => { if (o) { delete drafts[no]; toast(value ? 'Заметка сохранена' : 'Заметка удалена'); } });
    }

    function row(o) {
      const first = o.items && o.items[0];
      const it = first && byId(first.sku);
      const t = orderTotals(o);
      const cls = `orow${o.number === sel ? ' is-sel' : ''}${o.status === 'new' ? ' is-new' : ''}${fresh.has(o.number) ? ' is-fresh' : ''}`;
      return `<li><button type="button" class="${cls}" data-open="${esc(o.number)}" aria-pressed="${o.number === sel}">
        <span class="orow-img" data-win>${it ? `<img src="img/${it.id}.webp" alt="" width="800" height="1000" loading="lazy">` : ''}</span>
        <span class="orow-main"><span class="orow-top"><b class="orow-no">${esc(o.number)}</b><span class="orow-time">${when(o.created_at)}</span></span>
        <span class="orow-name">${esc(o.name)}${fresh.has(o.number) ? ' <em>только что</em>' : ''}</span>
        <span class="orow-sub">${goods(t.count)} · ${o.delivery === 'delivery' ? 'доставка' : 'самовывоз'}</span></span>
        <span class="orow-end"><span class="chip st-${o.status}">${stTitle(o.status)}</span><span class="orow-sum">${t.sum ? money(t.sum) : 'по запросу'}${t.sum && t.ask ? ' +' : ''}</span></span>
      </button></li>`;
    }

    function detail(o) {
      if (!o) return `<div class="odetail-empty"><p>${list.length ? 'Выберите заказ слева, чтобы увидеть товары, контакты и сменить статус.' : 'Здесь откроется карточка заказа.'}</p></div>`;
      const next = (o.next_statuses || []).filter(s => s !== 'cancelled');
      const canCancel = (o.next_statuses || []).includes('cancelled');
      const phone = waPhone(o.phone);
      const t = orderTotals(o);
      const cur = STATUS[stIndex(o.status)];
      const note = drafts[o.number] ?? (o.note || '');
      const noteDirty = drafts[o.number] !== undefined && drafts[o.number].trim() !== (o.note || '');
      const nextBtn = next[0]
        ? `<button type="button" class="btn od-next${busyAct === next[0] ? ' is-busy' : ''}" data-set="${next[0]}"${busyAct ? ' disabled' : ''}>${busyAct === next[0] ? 'Сохраняем…' : (cur && cur.act) || stTitle(next[0])}${ICON.arrow}</button>`
        : `<p class="od-done">${o.status === 'cancelled' ? 'Заказ отменён' : `${ICON.check}Заказ выдан`}</p>`;
      return `<div class="od">
        <div class="od-bar"><button type="button" class="od-back" data-close>${ICON.back}Все заказы</button></div>
        <header class="od-head"><div><p class="od-k">Заказ</p><h2 class="od-no">${esc(o.number)}</h2><p class="od-time">${when(o.created_at)}</p></div><span class="chip big st-${o.status}">${stTitle(o.status)}</span></header>
        ${o.status === 'cancelled' ? '' : track(o)}
        ${actFail ? `<div class="fail" role="alert">${failHtml('Не сохранилось', errText(actFail))}</div>` : ''}
        <div class="od-acts">${nextBtn}
        ${phone.length >= 11 ? `<a class="btn line" href="https://wa.me/${phone}?text=${encodeURIComponent(msgFor(o))}" target="_blank" rel="noopener">${ICON.wa}Написать покупателю</a>` : ''}</div>
        ${canCancel ? `<button type="button" class="linkbtn od-cancel" data-cancel${busyAct ? ' disabled' : ''}>${busyAct === 'cancelled' ? 'Отменяем…' : 'Отменить заказ'}</button>` : ''}
        <section class="od-sec"><h3>Покупатель</h3><dl class="rows">
          <div><dt>Имя</dt><dd>${esc(o.name)}</dd></div>
          ${o.phone ? `<div><dt>Телефон</dt><dd><a href="tel:+${phone}">${esc(prettyPhone(o.phone))}</a></dd></div>` : ''}
          <div><dt>${o.delivery === 'delivery' ? 'Доставка' : 'Самовывоз'}</dt><dd>${o.delivery === 'delivery' ? esc(o.address || '—') : 'ГУМ Чынар, бутик C7'}</dd></div>
          ${o.comment ? `<div><dt>Комментарий</dt><dd>${esc(o.comment)}</dd></div>` : ''}
        </dl></section>
        <section class="od-sec"><h3>Товары</h3>${itemsHtml(o)}${orderSummary(o)}${t.ask ? '<p class="small">У части товаров нет цены на ценнике: назовите её покупателю, когда подтверждаете заказ.</p>' : ''}</section>
        <section class="od-sec od-note"><h3><label for="od-note">Заметка для себя</label></h3>
          <textarea id="od-note" rows="2" maxlength="1000" placeholder="Например: позвонить после обеда. Покупатель её не видит">${esc(note)}</textarea>
          <div class="od-note-acts"${noteDirty ? '' : ' hidden'}><button type="button" class="btn sm" data-note${busyAct ? ' disabled' : ''}>${busyAct === 'note' ? 'Сохраняем…' : 'Сохранить заметку'}</button><button type="button" class="linkbtn" data-note-reset>Отменить</button></div>
        </section>
      </div>`;
    }

    function renderDetail() {
      const d = $('#odetail');
      const o = sel && ((card && card.number === sel) ? { ...(list.find(x => x.number === sel) || {}), ...card } : list.find(x => x.number === sel));
      const active = document.activeElement;
      const keepNote = active && active.id === 'od-note';
      const caret = keepNote ? [active.selectionStart, active.selectionEnd] : null;
      d.innerHTML = detail(o || null);
      if (keepNote) { const ta = $('#od-note'); if (ta) { ta.focus({ preventScroll: true }); ta.setSelectionRange(caret[0], caret[1]); } }
      document.body.classList.toggle('sheet-open', !!(sheet && o && narrow()));
      d.classList.toggle('is-open', !!(sheet && o));
    }

    function render() {
      const counts = Object.fromEntries(ALL_STATUS.map(s => [s.id, list.filter(o => o.status === s.id).length]));
      const newCount = counts.new;
      document.title = newCount ? `(${newCount}) Кабинет, Neko` : 'Кабинет, Neko';
      $('#own-sub').textContent = !loaded ? 'Загружаем заказы…' : list.length ? (newCount ? `${newCount} ${plural(newCount, 'новый заказ ждёт', 'новых заказа ждут', 'новых заказов ждут')} подтверждения` : 'Новых заказов нет, всё разобрано') : 'Здесь появятся заказы с сайта';
      const tabs = [{ id: 'all', tab: 'Все' }, ...ALL_STATUS].filter(s => s.id !== 'cancelled' || counts.cancelled || tab === 'cancelled');
      $('#otabs').innerHTML = tabs.map(s => `<button type="button" data-tab="${s.id}" aria-pressed="${tab === s.id}">${s.tab}<span>${s.id === 'all' ? total : counts[s.id]}</span></button>`).join('');
      const shown = list.filter(o => tab === 'all' || o.status === tab);
      $('#olist').innerHTML = shown.map(row).join('');
      const empty = $('#oempty');
      empty.hidden = !loaded || shown.length > 0;
      empty.innerHTML = list.length
        ? `<p>В разделе «${esc((ALL_STATUS.find(s => s.id === tab) || {}).tab || 'Все')}» заказов нет.</p>`
        : `<p class="empty-t">Заказов пока нет</p><p>Оформите заказ на витрине: он появится здесь сам через пару секунд.</p><div class="oempty-acts"><a class="btn" href="catalog.html" target="_blank" rel="noopener">Открыть витрину${ICON.arrow}</a></div>`;
      if (sel && !list.some(o => o.number === sel)) { sel = null; card = null; }
      if (!sel && !narrow() && shown[0]) { sel = shown[0].number; card = null; loadCard(sel); }
      renderDetail();
    }

    let armed = 0;
    function init() {
      if (!window.LeadsClient || !API) { showLogin(NO_CLIENT); return; }
      $('#login-form').addEventListener('submit', e => {
        e.preventDefault();
        const token = $('#token').value.trim();
        if (!token) { showLogin('Вставьте ключ доступа.'); return; }
        login(token);
      });
      $('#token').addEventListener('input', () => { $('#err-token').textContent = ''; $('#token').setAttribute('aria-invalid', 'false'); });
      $('#own-logout').addEventListener('click', () => logout(''));
      $('#oerr').addEventListener('click', e => { if (e.target.closest('[data-retry]')) refresh(true); });
      document.addEventListener('input', e => {
        if (e.target.id !== 'od-note' || !sel) return;
        drafts[sel] = e.target.value;
        const o = card && card.number === sel ? card : list.find(x => x.number === sel);
        const box = $('.od-note-acts');
        if (box) box.hidden = drafts[sel].trim() === ((o && o.note) || '');
      });
      document.addEventListener('click', e => {
        const t = e.target;
        if (!api) return;
        const open = t.closest('[data-open]');
        const set = t.closest('[data-set]');
        const tb = t.closest('[data-tab]');
        if (open) {
          const no = open.dataset.open;
          if (no !== sel) { sel = no; card = null; actFail = null; loadCard(no); }
          fresh.delete(no);
          sheet = true;
          render();
          const d = $('#odetail');
          if (narrow()) d.scrollTop = 0;
          d.focus({ preventScroll: !narrow() });
        }
        else if (set && sel) setStatus(sel, set.dataset.set);
        else if (t.closest('[data-cancel]') && sel) {
          const b = t.closest('[data-cancel]');
          if (Date.now() - armed > 3000) { armed = Date.now(); b.textContent = 'Точно отменить? Нажмите ещё раз'; setTimeout(() => { if (b.isConnected && !busyAct) b.textContent = 'Отменить заказ'; }, 3000); return; }
          armed = 0;
          setStatus(sel, 'cancelled');
        }
        else if (t.closest('[data-note]') && sel) saveNote(sel);
        else if (t.closest('[data-note-reset]') && sel) { delete drafts[sel]; renderDetail(); }
        else if (t.closest('#odetail [data-retry]') && lastAct) lastAct();
        else if (tb) { tab = tb.dataset.tab; render(); }
        else if (t.closest('[data-close]')) { sheet = false; renderDetail(); const r = $(`[data-open="${CSS.escape(sel)}"]`); if (r) r.focus({ preventScroll: true }); }
      });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && sheet) { sheet = false; renderDetail(); } });
      const saved = tokenStore.get();
      if (saved) start(window.LeadsClient.owner({ api: API, token: saved }));
      else showLogin('');
    }
    return { init };
  })();

  if (PAGE === 'catalog') catalog();
  if (PAGE === 'item') item();
  if (PAGE === 'cart') checkout();
  if (PAGE === 'order') orderPage();
  if (PAGE === 'owner') owner.init();
  sync(null, true);
  myOrdersLink();
  moreQuotes();
  smooth();
})();
