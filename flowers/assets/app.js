(function () {
  const S = window.SHOP;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const CART_KEY = 'flowers-cart';
  const FORM_KEY = 'flowers-checkout';
  const LOAD_TIMEOUT = 6000;
  const LEAD_HOURS = 2;
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const DAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
  const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const desk = matchMedia('(min-width: 901px)');
  const wide = matchMedia('(min-width: 1181px)');

  let items = [];
  let source = 'demo';
  let filter = 'all';
  let cart = read(CART_KEY, {});
  let current = null;
  let toastTimer = null;
  let requestId = '';
  const leads = window.LeadsClient && S.api ? window.LeadsClient.create({ api: S.api }) : null;

  function read(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { return; }
  }
  function el(tag, attrs = {}, kids = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (v === null || v === undefined || v === false) return;
      if (k === 'text') n.textContent = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    });
    kids.forEach(k => k && n.append(k));
    return n;
  }
  const money = n => `${Number(n).toLocaleString('ru-RU')}\u00a0с`;
  const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);

  function toast(text) {
    const t = $('[data-toast]');
    t.textContent = text;
    t.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  }

  function photo(p, size) {
    if (p.photo_url) return { src: p.photo_url, srcset: null };
    if (p.photo) return { src: `img/${p.photo}-${size || 640}.webp`, srcset: `img/${p.photo}-640.webp 640w, img/${p.photo}-1100.webp 1100w` };
    return { src: '', srcset: null };
  }

  function img(p, sizes, eager) {
    const ph = photo(p);
    if (!ph.src) return el('span', { class: 'noph', 'aria-hidden': 'true' });
    const i = el('img', { src: ph.src, srcset: ph.srcset, sizes, alt: p.title, loading: eager ? 'eager' : 'lazy', decoding: 'async', width: '1100', height: '1375', class: 'lz' });
    const done = () => i.classList.remove('lz');
    if (i.complete) done(); else { i.addEventListener('load', done); i.addEventListener('error', done); }
    return i;
  }

  function withTimeout(promise, ms) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
  }

  async function load() {
    skeleton();
    let fromApi = null;
    if (leads) {
      try { fromApi = await withTimeout(leads.products(), LOAD_TIMEOUT); } catch (e) { fromApi = null; }
    }
    if (fromApi && fromApi.length) {
      items = fromApi.slice().sort((a, b) => a.position - b.position);
      source = 'api';
    } else {
      items = S.items.slice();
      source = 'demo';
    }
    $('[data-demo-note]').hidden = source !== 'demo';
    pruneCart();
    drawChips();
    drawGrid(true);
    drawCart();
  }

  function pruneCart() {
    Object.keys(cart).forEach(id => {
      const p = items.find(x => String(x.id) === id);
      if (!p || !p.in_stock) delete cart[id];
      else cart[id] = { qty: cart[id].qty, price: p.price };
    });
    write(CART_KEY, cart);
  }

  function skeleton() {
    const g = $('[data-grid]');
    g.replaceChildren(...Array.from({ length: 8 }, () => el('li', { class: 'sk', 'aria-hidden': 'true' }, [el('div', { class: 'card-ph' }), el('span', { class: 'sk-l' })])));
  }

  function categories() {
    const seen = [];
    items.forEach(p => { if (p.category && !seen.includes(p.category)) seen.push(p.category); });
    if (source === 'demo') seen.sort((a, b) => S.categories.indexOf(a) - S.categories.indexOf(b));
    return seen;
  }

  function drawChips() {
    const cats = categories();
    if (filter !== 'all' && !cats.includes(filter)) filter = 'all';
    const chip = (key, label, n) => el('button', {
      type: 'button', class: 'chip', 'aria-pressed': String(filter === key),
      onclick: e => {
        if (filter === key) return;
        filter = key;
        $$('.chip').forEach(c => c.setAttribute('aria-pressed', String(c === e.currentTarget)));
        drawGrid(true);
        const top = $('#catalog').getBoundingClientRect().top;
        if (top < 0) $('.chips-wrap').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      },
    }, [el('span', { text: label }), el('small', { text: String(n) })]);
    $('[data-chips]').replaceChildren(
      chip('all', 'Все', items.length),
      ...cats.map(c => chip(c, c, items.filter(p => p.category === c).length)),
    );
    $('[data-chips]').hidden = cats.length < 2;
  }

  function visible() {
    return filter === 'all' ? items : items.filter(p => p.category === filter);
  }

  function featured(n) {
    if (n < 5) return false;
    const cols = wide.matches ? 4 : desk.matches ? 3 : 2;
    const cells = cols === 2 ? 2 : 4;
    return (n - 1 + cells) % cols === 0;
  }

  function drawGrid(animate) {
    const list = visible();
    const g = $('[data-grid]');
    g.removeAttribute('aria-busy');
    const feat = featured(list.length);
    g.replaceChildren(...list.map((p, k) => card(p, k, feat && k === 0)));
    if (!list.length) g.append(el('li', { class: 'grid-empty', text: 'В этой категории пока нет букетов.' }));
    $('[data-count]').textContent = `${list.length} ${plural(list.length, 'букет', 'букета', 'букетов')}`;
    g.classList.remove('enter');
    if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      void g.offsetWidth;
      g.classList.add('enter');
      clearTimeout(drawGrid.t);
      drawGrid.t = setTimeout(() => g.classList.remove('enter'), 1400);
    }
  }

  function addButton(p) {
    const id = String(p.id);
    if (!p.in_stock) return el('span', { class: 'tag-off', text: 'Нет в наличии' });
    const q = cart[id] ? cart[id].qty : 0;
    const b = el('button', {
      type: 'button', class: `add${q ? ' is-in' : ''}`, 'data-add': id,
      'aria-label': q ? `${p.title}: в корзине ${q}, добавить ещё` : `Добавить ${p.title} в корзину`,
    });
    if (q) b.textContent = String(q); else b.innerHTML = PLUS;
    b.addEventListener('click', e => { e.stopPropagation(); add(p, 1, b); });
    return b;
  }

  function card(p, k, feat) {
    const sizes = feat ? '(min-width: 1181px) 48vw, (min-width: 901px) 64vw, 100vw' : '(min-width: 1181px) 24vw, (min-width: 901px) 32vw, 50vw';
    const open = el('button', { type: 'button', class: 'card-open', 'aria-label': `${p.title}, ${money(p.price)}. Подробнее`, onclick: () => openProduct(p) }, [
      el('div', { class: 'card-ph' }, [img(p, sizes, k < 4)]),
    ]);
    const priceEl = el('span', { class: 'price' }, [el('b', { text: money(p.price) }), p.old_price ? el('s', { text: money(p.old_price) }) : null]);
    return el('li', { class: feat ? 'feat' : null, style: `--i:${Math.min(k, 12)}` }, [
      el('article', { class: `card${p.in_stock ? '' : ' off'}` }, [
        open,
        el('div', { class: 'card-b' }, [
          el('h3', { class: 'card-t', text: p.title }),
          p.description ? el('p', { class: 'card-d', text: p.description }) : null,
          el('div', { class: 'card-row' }, [priceEl, addButton(p)]),
        ]),
      ]),
    ]);
  }

  function count() {
    return Object.values(cart).reduce((s, l) => s + l.qty, 0);
  }
  function subtotal() {
    return Object.values(cart).reduce((s, l) => s + l.qty * l.price, 0);
  }
  function deliveryFee(kind) {
    const sub = subtotal();
    return kind === 'delivery' && sub < S.free_from ? S.delivery : 0;
  }

  function add(p, qty, btn) {
    if (!p.in_stock) return;
    const id = String(p.id);
    const line = cart[id] || { qty: 0, price: p.price };
    line.qty = Math.min(99, line.qty + qty);
    line.price = p.price;
    cart[id] = line;
    write(CART_KEY, cart);
    drawCart(true);
    refreshCard(id);
    toast(`${p.title} в корзине`);
    if (btn && btn.animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      btn.animate([{ transform: 'scale(.86)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 320, easing: 'cubic-bezier(.23,1,.32,1)' });
    }
  }

  function setQty(id, qty) {
    if (qty <= 0) delete cart[id]; else cart[id].qty = Math.min(99, qty);
    write(CART_KEY, cart);
    drawCart();
    refreshCard(id);
  }

  function refreshCard(id) {
    const old = $(`[data-add="${CSS.escape(id)}"]`);
    const p = items.find(x => String(x.id) === id);
    if (old && p) old.replaceWith(addButton(p));
  }

  function drawCart(bump) {
    const n = count();
    const btn = $('.cart-btn');
    $('[data-cart-count]').textContent = String(n);
    btn.classList.toggle('has', n > 0);
    btn.setAttribute('aria-label', n ? `Корзина, ${n} ${plural(n, 'букет', 'букета', 'букетов')}` : 'Корзина, пусто');
    if (bump) {
      const c = $('[data-cart-count]');
      c.classList.remove('bump');
      void c.offsetWidth;
      c.classList.add('bump');
    }
    const dock = $('[data-dock]');
    dock.hidden = n === 0;
    $('[data-dock-n]').textContent = `${n} ${plural(n, 'букет', 'букета', 'букетов')}`;
    $('[data-dock-sum]').textContent = money(subtotal());
    const lines = Object.entries(cart).map(([id, l]) => {
      const p = items.find(x => String(x.id) === id);
      if (!p) return null;
      const ph = photo(p);
      return el('li', { class: 'line' }, [
        ph.src ? el('img', { src: ph.src, alt: '', width: '76', height: '95', loading: 'lazy' }) : el('span'),
        el('div', {}, [el('p', { class: 'line-t', text: p.title }), el('p', { class: 'line-p', text: l.qty > 1 ? `${l.qty} × ${money(l.price)}` : money(l.price) })]),
        stepper(l.qty, v => setQty(id, v), p.title),
      ]);
    }).filter(Boolean);
    $('[data-lines]').replaceChildren(...lines);
    $('[data-cart-empty]').hidden = n > 0;
    $('[data-cart-foot]').hidden = n === 0;
    $('[data-subtotal]').textContent = money(subtotal());
    const left = S.free_from - subtotal();
    $('[data-free-hint]').textContent = left > 0 ? `Доставка ${money(S.delivery)}. Добавьте букетов ещё на ${money(left)}, и привезём бесплатно.` : 'Доставка по Бишкеку бесплатно.';
    updateTotals();
  }

  function stepper(value, onChange, title) {
    const out = el('output', { text: String(value), 'aria-live': 'polite' });
    return el('div', { class: 'qty' }, [
      el('button', { type: 'button', 'aria-label': value === 1 && title ? `Убрать ${title}` : 'Меньше', text: '−', onclick: () => onChange(value - 1) }),
      out,
      el('button', { type: 'button', 'aria-label': 'Больше', text: '+', onclick: () => onChange(value + 1) }),
    ]);
  }

  function lockScroll(on) {
    document.documentElement.classList.toggle('locked', on);
  }

  function openSheet(d) {
    if (d.open) return;
    d.classList.remove('closing');
    d.showModal();
    lockScroll(true);
    $('[data-dock]').classList.add('hide');
  }

  function closeSheet(d) {
    if (!d.open || d.classList.contains('closing')) return;
    d.classList.add('closing');
    const fast = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
      d.classList.remove('closing');
      d.close();
      if (!$$('dialog[open]').length) {
        lockScroll(false);
        $('[data-dock]').classList.remove('hide');
      }
    }, fast ? 0 : 240);
  }

  function bindSheet(d) {
    d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(d); });
    d.addEventListener('click', e => { if (e.target === d) closeSheet(d); });
    d.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(d); });
  }

  function openProduct(p) {
    current = p;
    let qty = 1;
    const d = $('[data-psheet]');
    const body = $('[data-ps-body]');
    const act = el('div', { class: 'ps-act' });
    const drawAct = () => {
      if (!p.in_stock) {
        act.replaceChildren(el('a', { class: 'btn btn-line', href: `https://wa.me/${S.wa}?text=${encodeURIComponent(`Здравствуйте! Будет ли букет «${p.title}»?`)}`, target: '_blank', rel: 'noopener', text: 'Спросить в WhatsApp' }));
        return;
      }
      act.replaceChildren(
        stepper(qty, v => { qty = Math.max(1, Math.min(99, v)); drawAct(); }),
        el('button', { type: 'button', class: 'btn btn-accent', text: `В корзину · ${money(p.price * qty)}`, onclick: () => { add(p, qty); closeSheet(d); } }),
      );
    };
    drawAct();
    body.replaceChildren(
      el('figure', { class: 'ps-ph' }, [img(p, '(min-width: 901px) 520px, 100vw', true)]),
      el('div', { class: 'ps-b' }, [
        el('button', { type: 'button', class: 'icon-btn ps-x', 'data-close': true, 'aria-label': 'Закрыть', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>' }),
        p.category ? el('p', { class: 'ps-cat', text: p.category }) : null,
        el('h2', { id: 'ps-h', text: p.title }),
        el('p', { class: 'price' }, [el('b', { text: money(p.price) }), p.old_price ? el('s', { text: money(p.old_price) }) : null]),
        p.description ? el('p', { class: 'ps-d', text: p.description }) : null,
        el('p', { class: 'ps-note', text: p.in_stock ? 'Соберём в день заказа. Открытка бесплатно.' : 'Сейчас нет в наличии. Напишите, подберём похожий.' }),
        act,
      ]),
    );
    openSheet(d);
    body.scrollTop = 0;
  }

  function bishkekNow() {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bishkek', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const g = t => parts.find(x => x.type === t).value;
    return { date: `${g('year')}-${g('month')}-${g('day')}`, hour: Number(g('hour')) + Number(g('minute')) / 60 };
  }
  function addDays(iso, n) {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  }
  function dayLabel(iso) {
    const d = new Date(`${iso}T12:00:00Z`);
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${DAYS[d.getUTCDay()]}`;
  }
  function slotEnd(slot) {
    const m = /(\d{1,2}):\d{2}\D+(\d{1,2}):\d{2}/.exec(slot);
    return m ? Number(m[2]) : 24;
  }

  const co = { day: '', slot: '' };

  function openSlots(day) {
    const now = bishkekNow();
    return S.slots.filter(s => day !== now.date || slotEnd(s) - now.hour >= LEAD_HOURS + 1);
  }

  function drawDays() {
    const now = bishkekNow();
    const today = now.date;
    const opts = [];
    if (openSlots(today).length) opts.push([today, 'Сегодня']);
    opts.push([addDays(today, 1), 'Завтра']);
    opts.push([addDays(today, 2), 'Послезавтра']);
    const dateIn = $('[data-date-in]');
    dateIn.min = today;
    dateIn.max = addDays(today, 60);
    if (!co.day || co.day < today) co.day = opts[0][0];
    const other = !opts.some(o => o[0] === co.day);
    const pill = (value, label, sub) => el('button', {
      type: 'button', class: 'pill', role: 'radio', 'aria-checked': String(value === co.day || (value === 'other' && other)),
      onclick: () => {
        if (value === 'other') {
          dateIn.hidden = false;
          if (!dateIn.value) dateIn.value = addDays(today, 3);
          co.day = dateIn.value;
          dateIn.focus();
        } else {
          co.day = value;
          dateIn.hidden = true;
        }
        drawDays();
        drawSlots();
      },
    }, [el('span', { text: label }), sub ? el('small', { text: sub }) : null]);
    $('[data-days]').replaceChildren(
      ...opts.map(([v, l]) => pill(v, l, String(new Date(`${v}T12:00:00Z`).getUTCDate()))),
      pill('other', other ? dayLabel(co.day).split(',')[0] : 'Другой день'),
    );
    dateIn.hidden = !other;
  }

  function drawSlots() {
    const list = openSlots(co.day);
    if (!list.includes(co.slot)) co.slot = '';
    const pickup = $('input[name=delivery]:checked').value === 'pickup';
    $('[data-slot-l]').textContent = pickup ? 'Когда заберёте' : 'Время доставки';
    $('[data-slots]').replaceChildren(...list.map(s => el('button', {
      type: 'button', class: 'pill', role: 'radio', 'aria-checked': String(s === co.slot),
      onclick: () => { co.slot = s; $('[data-err=slot]').textContent = ''; drawSlots(); },
    }, [el('span', { text: s })])));
    if (!list.length) $('[data-slots]').append(el('p', { class: 'hint', text: 'На этот день свободных интервалов нет, выберите другой.' }));
  }

  function updateTotals() {
    const form = $('[data-step=checkout]');
    if (!form) return;
    const kind = ($('input[name=delivery]:checked') || {}).value || 'delivery';
    const fee = deliveryFee(kind);
    $('[data-co-sub]').textContent = money(subtotal());
    $('[data-co-del-row]').hidden = kind !== 'delivery';
    $('[data-co-del]').textContent = fee ? money(fee) : 'бесплатно';
    $('[data-co-total]').textContent = money(subtotal() + fee);
    $('[data-addr]').hidden = kind !== 'delivery';
  }

  function step(name) {
    $$('.cs-step').forEach(s => { s.hidden = s.dataset.step !== name; });
    $('[data-cs-back]').hidden = name !== 'checkout';
    $('[data-cs-title]').textContent = name === 'checkout' ? 'Оформление' : name === 'done' ? 'Спасибо' : 'Корзина';
    $('.csheet .sheet-in').scrollTop = 0;
  }

  function openCart() {
    drawCart();
    step('cart');
    openSheet($('[data-csheet]'));
  }

  function toCheckout() {
    if (!count()) return;
    const saved = read(FORM_KEY, {});
    const f = $('[data-step=checkout]');
    ['name', 'phone', 'address'].forEach(k => { if (saved[k] && !f.elements[k].value) f.elements[k].value = saved[k]; });
    drawDays();
    drawSlots();
    updateTotals();
    step('checkout');
  }

  function phoneDigits(v) {
    let d = String(v || '').replace(/\D/g, '');
    if (d.startsWith('996')) d = d.slice(3);
    if (d.startsWith('0')) d = d.slice(1);
    return d;
  }

  function setErr(name, text) {
    const box = $(`[data-err=${name}]`);
    if (box) box.textContent = text || '';
    const f = $('[data-step=checkout]');
    const input = f.elements[name];
    if (input && input.setAttribute) {
      if (text) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
  }

  function validate(f) {
    const errs = {};
    const kind = f.elements.delivery.value;
    if (f.elements.name.value.trim().length < 2) errs.name = 'Как к вам обращаться?';
    if (phoneDigits(f.elements.phone.value).length !== 9) errs.phone = 'Номер в формате 0555 123 456';
    if (kind === 'delivery' && f.elements.address.value.trim().length < 5) errs.address = 'Куда привезти букет?';
    if (!co.slot) errs.slot = 'Выберите время';
    ['name', 'phone', 'address', 'slot'].forEach(k => setErr(k, errs[k]));
    const first = Object.keys(errs)[0];
    if (first) {
      const target = first === 'slot' ? $('[data-slots]') : f.elements[first];
      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (target.focus && first !== 'slot') target.focus({ preventScroll: true });
    }
    return !first;
  }

  function orderPayload(f) {
    const kind = f.elements.delivery.value;
    const fee = deliveryFee(kind);
    const lines = Object.entries(cart).map(([id, l]) => {
      const p = items.find(x => String(x.id) === id);
      return { title: p.title, qty: l.qty, price: l.price, sku: String(p.id).slice(0, 64) };
    });
    if (fee) lines.push({ title: 'Доставка по Бишкеку', qty: 1, price: fee, sku: 'delivery' });
    const card = f.elements.card.value.trim().replace(/\s*\n+\s*/g, ' / ');
    const comment = [
      `${kind === 'delivery' ? 'Доставка' : 'Самовывоз'}: ${dayLabel(co.day)}`,
      `Время: ${co.slot}`,
      card ? `Открытка: ${card}` : '',
      f.elements.comment.value.trim() ? `Комментарий: ${f.elements.comment.value.trim()}` : '',
    ].filter(Boolean).join('\n');
    return {
      kind: 'order',
      name: f.elements.name.value.trim(),
      phone: f.elements.phone.value.trim(),
      items: lines,
      delivery: kind,
      address: kind === 'delivery' ? f.elements.address.value.trim() : undefined,
      comment,
      website: f.elements.website.value,
    };
  }

  function waText(payload, number) {
    const rows = payload.items.map(i => `• ${i.title}${i.qty > 1 ? ` × ${i.qty}` : ''}: ${money(i.price * i.qty)}`);
    const total = payload.items.reduce((s, i) => s + i.price * i.qty, 0);
    return [
      number ? `Здравствуйте! Мой заказ №${number}.` : 'Здравствуйте! Хочу заказать:',
      ...rows,
      `Итого: ${money(total)}`,
      payload.comment,
      payload.address ? `Адрес: ${payload.address}` : '',
      `${payload.name}, ${payload.phone}`,
    ].filter(Boolean).join('\n');
  }

  async function submit(e) {
    e.preventDefault();
    const f = e.currentTarget;
    const errBox = $('[data-form-err]');
    errBox.replaceChildren();
    if (!validate(f)) return;
    const payload = orderPayload(f);
    write(FORM_KEY, { name: payload.name, phone: payload.phone, address: f.elements.address.value.trim() });
    const btn = $('[data-submit]');
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Отправляем…';
    if (!requestId) requestId = leads ? leads.newRequestId() : String(Date.now());
    try {
      if (!leads) throw { status: 0 };
      const res = await leads.submit(Object.assign({ client_request_id: requestId }, payload));
      requestId = '';
      done(payload, res.number);
    } catch (err) {
      const status = err && err.status;
      if (status === 422 && err.fields) {
        Object.entries(err.fields).forEach(([k, v]) => setErr(k === 'items' ? 'slot' : k, v));
        errBox.textContent = err.message || 'Проверьте поля';
      } else if (status === 429) {
        errBox.textContent = err.message;
      } else {
        errBox.append(
          el('span', { text: 'Не получилось отправить заказ на сервер. Отправьте его в WhatsApp, мы увидим сразу.' }),
          el('a', { class: 'btn btn-line btn-wide', style: 'margin-top:12px', href: `https://wa.me/${S.wa}?text=${encodeURIComponent(waText(payload))}`, target: '_blank', rel: 'noopener', text: 'Отправить в WhatsApp' }),
        );
      }
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = 'Отправить заказ';
    }
  }

  function done(payload, number) {
    $('[data-done-no]').textContent = number ? `Заказ №${number}` : '';
    $('[data-done-txt]').textContent = `${payload.delivery === 'delivery' ? 'Доставка' : 'Самовывоз'}: ${dayLabel(co.day)}, ${co.slot}. Перезвоним в течение 15 минут, чтобы подтвердить заказ и оплату.`;
    $('[data-done-wa]').href = `https://wa.me/${S.wa}?text=${encodeURIComponent(`Здравствуйте! Мой заказ №${number}.`)}`;
    cart = {};
    write(CART_KEY, cart);
    const f = $('[data-step=checkout]');
    f.elements.card.value = '';
    f.elements.comment.value = '';
    co.slot = '';
    drawCart();
    drawGrid(false);
    step('done');
  }

  function bind() {
    bindSheet($('[data-psheet]'));
    bindSheet($('[data-csheet]'));
    $$('[data-open-cart]').forEach(b => b.addEventListener('click', openCart));
    $('[data-to-checkout]').addEventListener('click', toCheckout);
    $('[data-cs-back]').addEventListener('click', () => step('cart'));
    const f = $('[data-step=checkout]');
    f.addEventListener('submit', submit);
    $$('input[name=delivery]', f).forEach(r => r.addEventListener('change', () => { updateTotals(); drawSlots(); }));
    $('[data-date-in]').addEventListener('change', e => { if (e.target.value) { co.day = e.target.value; drawDays(); drawSlots(); } });
    ['name', 'phone', 'address'].forEach(k => f.elements[k].addEventListener('input', () => setErr(k, '')));
    let lastCols = wide.matches ? 4 : desk.matches ? 3 : 2;
    const regrid = () => { const c = wide.matches ? 4 : desk.matches ? 3 : 2; if (c !== lastCols && items.length) { lastCols = c; drawGrid(false); } };
    wide.addEventListener('change', regrid);
    desk.addEventListener('change', regrid);
    const top = $('.top');
    const sentinel = el('div', { style: 'position:absolute;top:8px;height:1px;width:1px', 'aria-hidden': 'true' });
    document.body.prepend(sentinel);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => top.classList.toggle('scrolled', !e.isIntersecting)).observe(sentinel);
      const io = new IntersectionObserver(es => es.forEach(x => { if (x.isIntersecting) { x.target.classList.add('shown'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -12% 0px' });
      $$('.deliv-ph, .deliv-txt, .own').forEach(n => { n.classList.add('rv'); io.observe(n); });
    }
  }

  bind();
  drawCart();
  load();
})();
