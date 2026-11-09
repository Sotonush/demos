(() => {
  const { wa: WA, base: BASE, items: ITEMS, cats: CATS } = window.NEKO;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const byId = id => ITEMS.find(i => i.id === id);
  const catName = c => (CATS.find(x => x.id === c) || {}).t || '';
  const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = n => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} сом`;
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; };
  const goods = n => `${n} ${plural(n, 'товар', 'товара', 'товаров')}`;
  const MAX = 20;
  const KEY = 'neko-cart-v1';
  const PAGE = document.body.dataset.page;
  const ICON = {
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12h12"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12"/></svg>',
    trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true" class="fill"><path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.9L2.3 21.8l4.8-1.3A9.8 9.8 0 1 0 12 2.2Zm5.7 13.9c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.7-3.1-1.3-5.1-4.5-5.3-4.7-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.3Z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };

  let memory = {};
  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      const clean = {};
      for (const [id, q] of Object.entries(raw || {})) {
        const n = Math.min(MAX, Math.floor(Number(q)));
        if (byId(id) && n > 0) clean[id] = n;
      }
      memory = clean;
    } catch (e) { }
    return { ...memory };
  }
  function write(cart) {
    memory = { ...cart };
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { }
  }
  let cart = read();
  const qty = id => cart[id] || 0;
  function setQty(id, n) {
    const next = Math.max(0, Math.min(MAX, n));
    if (next) cart[id] = next; else delete cart[id];
    write(cart);
    sync(id);
  }
  function totals() {
    let count = 0, sum = 0, ask = 0, lines = 0;
    for (const [id, q] of Object.entries(cart)) {
      const it = byId(id);
      count += q; lines++;
      if (it.p) sum += it.p * q; else ask += q;
    }
    return { count, sum, ask, lines };
  }

  function stepper(id, label) {
    const q = qty(id);
    return `<div class="step"><button type="button" data-dec="${id}" aria-label="Убрать одну штуку: ${esc(label)}">${ICON.minus}</button><output aria-live="polite">${q}<small>в заказе</small></output><button type="button" data-inc="${id}" aria-label="Добавить ещё одну: ${esc(label)}"${q >= MAX ? ' disabled' : ''}>${ICON.plus}</button></div>`;
  }
  function renderAct(el, pop) {
    const id = el.dataset.add;
    const it = byId(id);
    const q = qty(id);
    el.innerHTML = q ? stepper(id, it.t) : `<button class="add" type="button" data-inc="${id}">В заказ</button>`;
    const card = el.closest('.card');
    if (card) card.classList.toggle('in-cart', q > 0);
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
    setTimeout(() => { if (old.parentNode) old.remove(); next.className = ''; }, 280);
  }

  function packet() {
    const p = $('[data-packet]');
    if (!p) return;
    const t = totals();
    const show = t.count > 0 && PAGE !== 'cart';
    $('[data-packet-n]').textContent = goods(t.count);
    $('[data-packet-sum]').textContent = t.sum ? money(t.sum) : '';
    if (show && p.hidden) {
      p.hidden = false;
      if (motion) { p.classList.add('off'); requestAnimationFrame(() => requestAnimationFrame(() => p.classList.remove('off'))); }
    } else if (!show) p.hidden = true;
    document.body.classList.toggle('has-packet', show);
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
    if (el && document.activeElement === document.body) el.focus({ preventScroll: true });
  }

  window.addEventListener('storage', e => { if (e.key === KEY) { cart = read(); sync(); } });

  function reveal() {
    const els = $$('[data-reveal], [data-stagger]');
    if (!motion || !('IntersectionObserver' in window)) return;
    const vh = innerHeight;
    els.forEach(el => {
      if (el.getBoundingClientRect().top < vh * 0.92) return;
      el.classList.add('pre');
      if (el.hasAttribute('data-stagger')) [...el.children].forEach((c, i) => { c.style.transitionDelay = `${Math.min(i, 8) * 60}ms`; });
    });
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.classList.add('in');
        io.unobserve(el);
        setTimeout(() => { el.classList.remove('pre', 'in'); [...el.children].forEach(c => { c.style.transitionDelay = ''; }); }, 1400);
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.filter(el => el.classList.contains('pre')).forEach(el => io.observe(el));
  }

  function smooth() {
    if (!motion || !window.Lenis || matchMedia('(pointer: coarse)').matches) return;
    const lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.95 });
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
      });
    });
  }

  function catalog() {
    const chips = $$('.chips button');
    const only = $('#only-price');
    const cards = $$('#grid .card');
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
    }
    $('.chips').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { cat = b.dataset.f; apply(); } });
    only.addEventListener('change', apply);
    $('#reset').addEventListener('click', () => { cat = 'all'; only.checked = false; apply(); });
    apply();
  }

  function cardHtml(it) {
    return `<article class="card" data-item="${it.id}" data-cat="${it.c}"><div class="band"><span class="no">№${it.no}</span><span class="tag">${esc(catName(it.c))}</span></div>`
      + `<a class="win" href="item.html?id=${it.id}"><img src="img/${it.id}.webp" alt="${esc(it.t)}" width="800" height="1000" loading="lazy"></a>`
      + `<div class="meta"><h3><a href="item.html?id=${it.id}">${esc(it.t)}</a></h3><p class="price">${it.p ? money(it.p) : ''}</p></div>`
      + `<div class="act" data-add="${it.id}"></div></article>`;
  }

  function item() {
    const it = byId(new URLSearchParams(location.search).get('id'));
    if (!it) { location.replace('catalog.html'); return; }
    document.title = `${it.t}, Neko`;
    const ask = `Здравствуйте! Интересует товар с сайта: ${it.t} (№${it.no}).\nФото: ${BASE}/img/${it.id}.webp`;
    const w = it.id === 'kakashi' ? 1000 : 800;
    $('#item').innerHTML = `<figure class="item-win"><img src="img/${it.id}.webp" alt="${esc(it.t)}" width="${w}" height="${w * 1.25}" fetchpriority="high"></figure>
      <div class="item-info card-like"><div class="item-band"><span class="no">№${it.no}</span><a href="catalog.html?cat=${it.c}">${esc(catName(it.c))}</a></div>
      <h1>${esc(it.t)}</h1>
      <p class="big${it.p ? '' : ' ask'}">${it.p ? money(it.p) : 'Цена по запросу, магазин ответит в WhatsApp'}</p>
      <div class="act" data-add="${it.id}"></div>
      <a class="ask-link" href="https://wa.me/${WA}?text=${encodeURIComponent(ask)}">${ICON.wa}Спросить о товаре в WhatsApp</a>
      <dl class="rows"><div><dt>Самовывоз</dt><dd>ГУМ Чынар, 3 этаж, бутик C7</dd></div><div><dt>Доставка</dt><dd>По Кыргызстану, стоимость подтвердит магазин</dd></div><div><dt>Часы</dt><dd>Ежедневно 10:00⁠–⁠22:00</dd></div></dl></div>`;
    const pool = ITEMS.filter(i => i.c === it.c && i.id !== it.id);
    const rest = ITEMS.filter(i => i.c !== it.c);
    const from = ITEMS.indexOf(it);
    const pick = [...pool, ...rest.slice(from % rest.length), ...rest].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);
    $('#related').innerHTML = pick.map(cardHtml).join('');
    $('#more-cat').href = `catalog.html?cat=${it.c}`;
  }

  const SAMPLE = { igris: 1, chiikawa: 2 };
  function compose(entries, o) {
    const lines = ['Здравствуйте! Заказ с сайта Neko.', ''];
    let sum = 0, ask = 0;
    entries.forEach(([id, q], k) => {
      const it = byId(id);
      if (it.p) sum += it.p * q; else ask += q;
      lines.push(`${k + 1}. ${it.t} (№${it.no})`);
      lines.push(it.p ? `   ${q} шт × ${money(it.p)} = ${money(it.p * q)}` : `   ${q} шт, цена по запросу`);
      if (o.photos) lines.push(`   Фото: ${BASE}/img/${id}.webp`);
    });
    lines.push('');
    if (sum) lines.push(`Итого по ценникам: ${money(sum)}`);
    if (ask) lines.push(sum ? 'Подскажите, пожалуйста, цену остальных товаров.' : 'Подскажите, пожалуйста, цены и наличие.');
    lines.push('');
    if (o.how === 'delivery') { lines.push('Получение: доставка'); lines.push(`Адрес: ${o.addr || '—'}`); }
    else lines.push('Получение: самовывоз, ГУМ Чынар, 3 этаж, бутик C7');
    if (o.name !== undefined) lines.push(`Имя: ${o.name || '—'}`);
    if (o.note) lines.push(`Комментарий: ${o.note}`);
    return lines.join('\n');
  }
  function live() {
    const el = $('#live-msg');
    if (!el) return;
    const own = Object.keys(cart).length > 0;
    $('#live-h').textContent = own ? 'Так магазин увидит ваш заказ' : 'Пример сообщения из корзины';
    el.textContent = compose(Object.entries(own ? cart : SAMPLE), { how: 'pickup' });
  }

  function message(form) {
    return compose(Object.entries(cart), {
      photos: true,
      how: form.how.value,
      addr: form.addr.value.trim(),
      name: $('#name').value.trim(),
      note: form.note.value.trim()
    });
  }

  function lineHtml(id) {
    const it = byId(id);
    const q = qty(id);
    return `<li class="line" data-line="${id}"><a class="line-img" href="item.html?id=${id}" tabindex="-1" aria-hidden="true"><img src="img/${id}.webp" alt="" width="800" height="1000"></a>
      <div class="line-info"><a href="item.html?id=${id}">${esc(it.t)}</a><p>№${it.no} · ${it.p ? `${money(it.p)} за шт.` : 'цена по запросу'}</p></div>
      <button class="rm" type="button" data-rm="${id}" aria-label="Убрать из заказа: ${esc(it.t)}">${ICON.trash}</button>
      ${stepper(id, it.t)}
      <p class="line-total${it.p ? '' : ' ask'}">${it.p ? money(it.p * q) : 'по запросу'}</p></li>`;
  }

  function removeLine(id) {
    const li = $(`[data-line="${id}"]`);
    if (li && motion) { li.classList.add('gone'); setTimeout(() => setQty(id, 0), 180); }
    else setQty(id, 0);
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
    const t = totals();
    const sum = $('#sum');
    sum.hidden = !ids.length;
    sum.innerHTML = ids.length ? `<div><dt>В заказе</dt><dd>${goods(t.count)}</dd></div>`
      + (t.ask ? `<div><dt>Цена по запросу</dt><dd>${goods(t.ask)}</dd></div>` : '')
      + `<div class="total"><dt>${t.ask ? 'Итого по ценникам' : 'Итого'}</dt><dd>${t.sum ? money(t.sum) : '—'}</dd></div>` : '';
    $('#msg').textContent = message($('#form'));
    if (ids.length) $('#err-cart').textContent = '';
  }

  function order() {
    const form = $('#form');
    const how = () => form.how.value;
    function setHow() {
      const d = how() === 'delivery';
      $('#addr-wrap').hidden = !d;
      $('#pickup-hint').hidden = d;
      $('#msg').textContent = message(form);
    }
    const err = (id, text, field) => {
      $(`#err-${id}`).textContent = text;
      if (field) field.setAttribute('aria-invalid', text ? 'true' : 'false');
      return !text;
    };
    form.addEventListener('change', e => { if (e.target.name === 'how') setHow(); });
    form.addEventListener('input', e => {
      if (e.target.id === 'name') err('name', '', $('#name'));
      if (e.target.id === 'addr') err('addr', '', form.addr);
      $('#msg').textContent = message(form);
    });
    form.addEventListener('submit', e => {
      e.preventDefault();
      const ok = [
        err('cart', Object.keys(cart).length ? '' : 'Добавьте в заказ хотя бы один товар.'),
        err('name', $('#name').value.trim() ? '' : 'Напишите имя, чтобы магазин знал, как к вам обращаться.', $('#name')),
        err('addr', how() === 'delivery' && !form.addr.value.trim() ? 'Укажите адрес доставки или выберите самовывоз.' : '', form.addr)
      ].every(Boolean);
      if (!ok) {
        const first = $('[aria-invalid="true"]', form) || $('#empty');
        if (first) { first.scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'center' }); if (first.focus) first.focus({ preventScroll: true }); }
        return;
      }
      location.href = `https://wa.me/${WA}?text=${encodeURIComponent(message(form))}`;
    });
    setHow();
    renderCart();
  }

  if (PAGE === 'catalog') catalog();
  if (PAGE === 'item') item();
  if (PAGE === 'cart') order();
  sync(null, true);
  moreQuotes();
  reveal();
  smooth();
})();
