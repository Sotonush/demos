(() => {
  const D = window.OTAKU;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NB = ' ';
  const CART = 'otaku-cart-v1';
  const FORM = 'otaku-form-v2';
  const MAX = 99;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const page = document.body.dataset.page;
  const params = new URLSearchParams(location.search);
  document.documentElement.classList.add('js');

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch (e) { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    has(k) { try { return localStorage.getItem(k) !== null; } catch (e) { return false; } }
  };
  const session = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v === null ? sessionStorage.removeItem(k) : sessionStorage.setItem(k, v); } catch (e) { } }
  };

  if (params.has('data')) session.set('otaku-data', params.get('data') === 'worst' ? 'worst' : null);
  const worst = session.get('otaku-data') === 'worst';
  if (worst) {
    D.items = [
      { id: 'w1', c: 'fig', t: 'Фигурка Сатору Годзё из «Магической битвы», серия Maximatic, вторая волна, ограниченный выпуск с подставкой', p: 1249900, img: 0 },
      { id: 'w2', c: 'mini', t: 'Кот', p: null, img: 0 },
      { id: 'w3', c: 'card', t: 'Фотокарточки Stray Kids, ATEEZ, ENHYPEN, TXT и SEVENTEEN, альбомные и лимитированные', p: 170, img: 0 },
      { id: 'w4', c: 'acr', t: 'Акриловыйстендсперсонажемибезединогопробела', p: 99999, img: 0 },
      ...D.items
    ];
  }

  const byId = Object.fromEntries(D.items.map(i => [i.id, i]));
  const catName = Object.fromEntries(D.cats.map(c => [c.id, c.t]));
  const branch = Object.fromEntries(D.branches.map(b => [b.id, b]));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const som = n => `${fmt(n)}${NB}сом`;
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c; };
  const pcs = n => `${n}${NB}шт.`;
  const goods = n => `${n}${NB}${plural(n, 'товар', 'товара', 'товаров')}`;

  const I = {
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>',
    cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" aria-hidden="true" class="arr"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
    wa: '<svg viewBox="0 0 24 24" aria-hidden="true" class="wa-i"><path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.9L2.3 21.8l4.8-1.3A9.8 9.8 0 1 0 12 2.2Zm5.7 13.9c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.7-3.1-1.3-5.1-4.5-5.3-4.7-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.3Z"/></svg>'
  };

  const thumb = (it, size) => it.img
    ? `<img src="img/${it.id}-s.webp" alt="" width="${size}" height="${size}" loading="lazy" decoding="async">`
    : size < 60 ? '<span class="noimg"></span>' : `<span class="noimg"><span>${esc(catName[it.c] || 'Без фото')}</span></span>`;

  let cart = clean(store.get(CART, {}));
  function clean(c) {
    const out = {};
    if (c && typeof c === 'object') for (const [id, q] of Object.entries(c)) {
      const n = Math.min(MAX, Math.floor(Number(q)));
      if (byId[id] && n > 0) out[id] = n;
    }
    return out;
  }
  const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const listeners = [];
  function setQty(id, q) {
    q = Math.max(0, Math.min(MAX, q));
    if (q) cart[id] = q; else delete cart[id];
    store.set(CART, cart);
    listeners.forEach(f => f(id));
  }
  function totals(lines) {
    let sum = 0, ask = 0, n = 0;
    lines.forEach(l => { n += l.q; if (l.p) sum += l.p * l.q; else ask += l.q; });
    return { sum, ask, n };
  }
  const cartLines = () => Object.keys(cart).map(id => ({ ...byId[id], q: cart[id] }));

  function syncCount(bump) {
    const n = count();
    $$('[data-count]').forEach(el => {
      el.textContent = n > MAX ? `${MAX}+` : n;
      el.classList.toggle('zero', n === 0);
      if (bump && !reduce) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
    const cb = $('.cartbtn');
    if (cb) cb.setAttribute('aria-label', n ? `Корзина, ${pcs(n)}` : 'Корзина');
  }

  function stepper(id, light) {
    const it = byId[id];
    return `<span class="step${light ? ' light' : ''}" role="group" aria-label="Количество: ${esc(it.t)}"><button type="button" data-dec="${id}" aria-label="Убрать одну штуку">${I.minus}</button><output aria-live="polite">${cart[id]} <small>шт.</small></output><button type="button" data-inc="${id}" aria-label="Добавить ещё одну">${I.plus}</button></span>`;
  }
  function renderBuy(el, animate) {
    const id = el.dataset.buy;
    const it = byId[id];
    if (!it) return;
    if (cart[id]) {
      const had = el.querySelector('.step');
      el.innerHTML = stepper(id, el.dataset.light === '1');
      if (!had && animate && !reduce) el.firstChild.classList.add('step-in');
    } else if (el.dataset.light !== '1') {
      el.innerHTML = `<button class="add" type="button" data-add="${id}" aria-label="Добавить «${esc(it.t)}» в корзину">${I.plus}В корзину</button>`;
    }
  }
  function renderBuys(id, animate) {
    $$('[data-buy]').forEach(el => { if (!id || el.dataset.buy === id) renderBuy(el, animate); });
  }

  function card(it) {
    return `<article class="pc" data-id="${it.id}" data-c="${it.c}"><a class="pc-ph" href="item.html?id=${it.id}" tabindex="-1" aria-hidden="true">${it.img ? `<img src="img/${it.id}-s.webp" srcset="img/${it.id}-s.webp 360w, img/${it.id}.webp 720w" sizes="(min-width: 1100px) 24vw, (min-width: 700px) 31vw, 46vw" alt="" width="360" height="360" loading="lazy" decoding="async">` : `<span class="noimg"><span>Фото скоро будет</span></span>`}</a>
<div class="pc-b"><a class="pc-t" href="item.html?id=${it.id}">${esc(it.t)}</a>${it.p ? `<span class="pc-p">${som(it.p)}</span>` : '<span class="pc-p ask">Цена по запросу</span>'}<span class="buy" data-buy="${it.id}"></span></div></article>`;
  }

  const toastEl = $('.toast');
  let toastTimer;
  if (toastEl) { toastEl.hidden = false; toastEl.classList.add('off'); }
  function toast(text, action) {
    if (!toastEl) return;
    toastEl.innerHTML = `<span></span>${action || ''}`;
    $('span', toastEl).textContent = text;
    requestAnimationFrame(() => toastEl.classList.remove('off'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('off'), action && action.includes('button') ? 5000 : 2800);
  }

  function add(id, qty = 1) {
    const it = byId[id];
    const first = !cart[id];
    setQty(id, (cart[id] || 0) + qty);
    renderBuys(id, true);
    syncCount(true);
    toast(first ? `В корзине: ${it.t}` : `${it.t}: ${pcs(cart[id])}`, page === 'cart' ? '' : '<a href="cart.html">Корзина</a>');
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-add]');
    if (a) { e.preventDefault(); add(a.dataset.add); return; }
    const inc = e.target.closest('[data-inc]');
    if (inc) { e.preventDefault(); const id = inc.dataset.inc; setQty(id, (cart[id] || 0) + 1); renderBuys(id); syncCount(false); return; }
    const dec = e.target.closest('[data-dec]');
    if (dec) {
      e.preventDefault();
      const id = dec.dataset.dec;
      if (page === 'cart' && cart[id] === 1) { removeLine(id); return; }
      setQty(id, (cart[id] || 0) - 1);
      renderBuys(id);
      syncCount(false);
      if (!cart[id]) { const b = $(`[data-buy="${id}"] .add`); if (b) b.focus(); }
    }
  });
  let removeLine = () => { };

  addEventListener('storage', e => {
    if (e.key === CART) { cart = clean(store.get(CART, {})); renderBuys(); syncCount(false); listeners.forEach(f => f(null)); }
  });

  function bishkekHour() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bishkek', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      return +parts.find(p => p.type === 'hour').value + +parts.find(p => p.type === 'minute').value / 60;
    } catch (e) { return null; }
  }
  function live() {
    const h = bishkekHour();
    if (h === null) return;
    const open = h >= 10 && h < 22;
    $$('[data-live]').forEach(el => {
      el.textContent = open ? 'Открыто до 22:00' : 'Откроется в 10:00';
      el.classList.toggle('open', open);
    });
  }

  function reveal() {
    const els = $$('[data-reveal]');
    if (!('IntersectionObserver' in window)) { els.forEach(el => el.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { rootMargin: '0px 0px -6% 0px', threshold: .05 });
    els.forEach(el => io.observe(el));
  }

  function worstToggle() {
    if (!worst && !params.has('data')) return;
    const bar = document.createElement('nav');
    bar.className = 'worst';
    bar.setAttribute('aria-label', 'Данные для проверки');
    const base = location.pathname + location.search.replace(/[?&]data=[^&]*/, '').replace(/^&/, '?');
    const sep = base.includes('?') ? '&' : '?';
    bar.innerHTML = `<a href="${base}${sep}data=demo"${worst ? '' : ' aria-current="true"'}>Демо-данные</a><a href="${base}${sep}data=worst"${worst ? ' aria-current="true"' : ''}>Худший случай</a>`;
    document.body.appendChild(bar);
  }

  const IN = { tsum: 'в ЦУМе', tommi: 'в Tommi mall', djal: 'в ТРК DJAl' };
  const ST = ['new', 'accepted', 'ready', 'done'];
  const ST_T = { new: 'Новый', accepted: 'Принят', ready: 'Готов', done: 'Выдан', cancelled: 'Отменён' };
  const ST_TABS = { new: 'Новые', accepted: 'Принятые', ready: 'Готовые', done: 'Выданные', cancelled: 'Отменённые' };
  const FINAL = ['done', 'cancelled'];
  const MY = 'otaku-my-orders-v2';
  const PENDING = 'otaku-pending-v1';
  const OWNER = 'otaku-owner-token';
  const POLL_MS = 5000;
  const BRANCH_P = 'Филиал: ';
  const api = () => window.LeadsClient && D.api ? window.LeadsClient : null;

  function human(err) {
    const s = err && err.status;
    if (!s) return { t: 'Нет связи с сервером', p: 'Проверьте интернет и нажмите «Повторить».' };
    if (s === 429) return { t: 'Слишком много попыток', p: 'Подождите минуту и попробуйте ещё раз.' };
    if (s >= 500) return { t: 'Сервер заказов временно недоступен', p: 'Попробуйте ещё раз через минуту.' };
    return { t: 'Не получилось', p: (err && err.message) || 'Попробуйте ещё раз.' };
  }
  const failBox = (err, extra = '', retry = 'Повторить') => { const h = human(err); return `<div class="fail" role="alert"><p class="fail-t">${esc(h.t)}</p><p>${esc(h.p)}${extra ? ' ' + esc(extra) : ''}</p><button class="btn line sm" type="button" data-retry>${retry}</button></div>`; };

  function statusText(o) {
    const b = branch[o.branch];
    if (o.status === 'cancelled') return 'Заказ отменён. Если это ошибка, напишите в магазин.';
    if (o.status === 'new') return 'Заказ получен. Менеджер проверит наличие и позвонит вам.';
    if (o.status === 'accepted') return 'Менеджер подтвердил заказ и собирает его.';
    if (o.status === 'ready') return o.how === 'delivery' ? 'Заказ собран и ждёт доставки.' : b ? `Заказ ждёт вас ${IN[b.id] || 'в ' + b.name}: ${b.spot}.` : 'Заказ собран и ждёт вас в магазине.';
    return o.how === 'delivery' ? 'Заказ доставлен. Спасибо, что выбрали Отаку!' : 'Заказ выдан. Спасибо, что выбрали Отаку!';
  }
  function nextLabel(o) {
    if (o.status === 'new') return 'Принять заказ';
    if (o.status === 'accepted') return 'Заказ собран';
    if (o.status === 'ready') return o.how === 'delivery' ? 'Отметить доставленным' : 'Выдать заказ';
    return '';
  }
  const when = ts => {
    const d = new Date(ts), now = new Date();
    const t = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    if (ts >= day) return `сегодня, ${t}`;
    if (ts >= day - 864e5) return `вчера, ${t}`;
    return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}, ${t}`;
  };
  const hm = ts => new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const whereText = o => {
    if (o.how === 'delivery') return o.addr ? `Доставка: ${o.addr}` : 'Доставка по Бишкеку';
    const b = branch[o.branch];
    return b ? `Самовывоз: ${b.name}, ${b.addr}, ${b.spot}` : 'Самовывоз';
  };
  const phoneText = p => { const d = String(p || '').replace(/\D/g, ''); return d.length === 12 ? `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : String(p || ''); };
  const phoneOk = p => { const d = p.replace(/\D/g, ''); return (d.length === 12 && d.startsWith('996')) || (d.length === 10 && d.startsWith('0')) || d.length === 9; };
  const no = n => `№${NB}${esc(n)}`;

  function splitComment(c) {
    const lines = String(c || '').split('\n');
    let br = null;
    if (lines[0] && lines[0].startsWith(BRANCH_P)) {
      const name = lines.shift().slice(BRANCH_P.length).split(' (')[0].trim();
      br = (D.branches.find(b => b.name === name) || {}).id || null;
    }
    return { branch: br, note: lines.join('\n').trim() };
  }
  const fromItems = list => (list || []).map(x => {
    const it = byId[x.sku] || {};
    return { id: x.sku || '', t: x.title, q: x.qty || 1, p: x.price === null || x.price === undefined ? null : Number(x.price), c: it.c, img: it.img || 0 };
  });
  function fromServer(x) {
    const c = splitComment(x.comment);
    return { n: x.number, status: x.status, items: fromItems(x.items), how: x.delivery, addr: x.address, branch: c.branch, note: c.note, ownerNote: x.note || '', name: x.name, phone: x.phone, created: Date.parse(x.created_at), next: x.next_statuses || [], history: x.history || null };
  }

  const myOrders = () => { const l = store.get(MY, []); return Array.isArray(l) ? l.filter(o => o && o.t && o.n) : []; };
  const saveMy = o => store.set(MY, [o, ...myOrders().filter(x => x.t !== o.t)].slice(0, 20));
  const patchMy = (t, patch) => { const l = myOrders(); const o = l.find(x => x.t === t); if (o) { Object.assign(o, patch); store.set(MY, l); } };

  function ticket(o, opts = {}) {
    const t = totals(o.items);
    const lines = o.items.slice(0, opts.max || 99).map(it => `<div class="tk-line"><span>${esc(it.t)} × ${it.q}</span>${it.p ? `<b>${som(it.p * it.q)}</b>` : '<b class="ask">по запросу</b>'}</div>`).join('');
    const more = opts.max && o.items.length > opts.max ? `<div class="tk-line"><span>и ещё ${goods(o.items.length - opts.max)}</span><b></b></div>` : '';
    return `<div class="ticket"><div class="tk-top"><div><p class="tk-k">${opts.label || 'Заказ'}</p><p class="tk-n">${no(o.n)}</p></div><span class="stamp s-${o.status}" data-stamp>${ST_T[o.status] || ''}</span></div>
<div class="tk-lines">${lines}${more}</div>
<div class="tk-sum"><span>Итого</span><span>${t.sum ? som(t.sum) : 'по запросу'}</span></div>
${t.sum && t.ask ? `<p class="tk-where">и ещё ${pcs(t.ask)} с ценой по запросу</p>` : ''}<p class="tk-where">${esc(whereText(o))}</p></div>`;
  }

  function home() {
    $$('[data-cards]').forEach(g => { g.innerHTML = g.dataset.cards.split(',').map(id => byId[id]).filter(Boolean).map(card).join(''); });
    renderBuys();
    const prev = $('#ixprev');
    if (prev) {
      let cur = '';
      const show = src => {
        if (src === cur) return;
        cur = src;
        const img = new Image();
        img.src = `img/${src}.webp`;
        prev.classList.add('swap');
        const go = () => { prev.src = img.src; prev.classList.remove('swap'); };
        img.decode ? img.decode().then(go, go) : (img.onload = go);
      };
      $$('.ix-row').forEach(r => { r.addEventListener('mouseenter', () => show(r.dataset.prev)); r.addEventListener('focus', () => show(r.dataset.prev)); });
    }
    const st = $('#sample-ticket');
    if (st) {
      const snap = (id, q) => ({ ...byId[id], q });
      st.innerHTML = ticket({ n: 1001, status: 'ready', how: 'pickup', branch: 'tsum', items: [snap('bananafish', 2), snap('onepiece', 3), snap('plushkeys', 1)] }, { label: 'Пример заказа' });
    }
  }

  function catalog() {
    const grid = $('#grid');
    const norm = s => s.toLowerCase().replace(/ё/g, 'е');
    grid.innerHTML = D.items.map(card).join('');
    renderBuys();
    const cards = $$('.pc', grid);
    const priced = D.items.filter(i => i.p).length;
    $('#chips').innerHTML = `<button class="chip" type="button" data-f="all">Всё <span>${D.items.length}</span></button><button class="chip tag" type="button" data-f="priced">С ценой <span>${priced}</span></button>` +
      D.cats.map(c => `<button class="chip" type="button" data-f="${c.id}">${esc(c.t)} <span>${D.items.filter(i => i.c === c.id).length}</span></button>`).join('');
    const q = $('#q');
    let f = 'all';
    const apply = () => {
      const words = norm(q.value.trim()).split(/\s+/).filter(Boolean);
      let shown = 0;
      cards.forEach(el => {
        const it = byId[el.dataset.id];
        const hay = norm(`${it.t} ${catName[it.c]}`);
        const ok = (f === 'all' || (f === 'priced' ? it.p : it.c === f)) && words.every(w => hay.includes(w));
        el.hidden = !ok;
        if (ok) shown++;
      });
      $$('#chips .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
      $('#nores').hidden = shown > 0;
      $('#cat-sub').textContent = f === 'all' && !words.length ? `${goods(D.items.length)} с полок трёх магазинов` : `Найдено: ${goods(shown)}`;
    };
    const set = (v, push) => {
      f = v === 'priced' || catName[v] ? v : 'all';
      if (push) history.replaceState(null, '', f === 'all' ? location.pathname + location.search : `#${f}`);
      apply();
      const on = $(`#chips [data-f="${f}"]`);
      if (on && push) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    };
    $('#chips').addEventListener('click', e => {
      const b = e.target.closest('.chip');
      if (!b) return;
      set(b.dataset.f === f && f !== 'all' ? 'all' : b.dataset.f, true);
      const y = grid.getBoundingClientRect().top + scrollY - $('.filters').offsetHeight - $('.top').offsetHeight - 12;
      if (scrollY > y) scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
    q.addEventListener('input', apply);
    $('#reset').addEventListener('click', () => { q.value = ''; set('all', true); });
    set(location.hash.slice(1) || 'all', false);
    addEventListener('hashchange', () => set(location.hash.slice(1) || 'all', false));
  }

  function item() {
    const id = params.get('id');
    const it = byId[id];
    if (!it) { location.replace('catalog.html'); return; }
    document.title = `${it.t}, Отаку`;
    const facts = D.branches.map(b => `<span>${esc(b.name)}, ${esc(b.spot)}</span>`).join('') + '<span class="live sm" data-live></span>';
    $('#item').innerHTML = `<figure class="item-ph">${it.img ? `<img src="img/${it.id}.webp" alt="${esc(it.t)}" width="720" height="720">` : '<span class="noimg"><span>Фото скоро будет</span></span>'}</figure>
<div class="item-b"><a class="crumb" href="catalog.html#${it.c}">${I.arrow}${esc(catName[it.c])}</a>
<h1>${esc(it.t)}</h1>
${it.p ? `<p class="cost">${som(it.p)}</p><p class="cost-note">Цена с ценника в магазине</p>` : '<p class="cost ask">Цена по запросу</p><p class="cost-note">Менеджер назовёт цену, когда позвонит подтвердить заказ.</p>'}
<div class="buyrow" id="buyrow"></div>
<dl class="facts"><div><dt>Самовывоз</dt><dd>${facts}</dd></div><div><dt>Доставка</dt><dd>По Бишкеку, стоимость подтвердит менеджер</dd></div><div><dt>Наличие</dt><dd>Менеджер проверит наличие в филиале и позвонит</dd></div></dl></div>`;
    let want = 1;
    const row = $('#buyrow');
    const draw = () => {
      if (cart[id]) row.innerHTML = `<span data-buy="${id}"></span><a class="btn line" href="cart.html">Оформить заказ${I.arrow}</a>`;
      else row.innerHTML = `<span class="step light" role="group" aria-label="Количество"><button type="button" data-want="-1" aria-label="Меньше">${I.minus}</button><output aria-live="polite">${want} <small>шт.</small></output><button type="button" data-want="1" aria-label="Больше">${I.plus}</button></span><button class="btn" type="button" id="addbtn">В корзину${it.p ? `${NB}·${NB}${som(it.p * want)}` : ''}</button>`;
      renderBuys(id);
    };
    row.addEventListener('click', e => {
      const w = e.target.closest('[data-want]');
      if (w) { want = Math.max(1, Math.min(MAX, want + Number(w.dataset.want))); draw(); return; }
      if (e.target.closest('#addbtn')) { add(id, want); want = 1; draw(); }
    });
    listeners.push(ch => { if (!ch || ch === id) draw(); });
    draw();
    live();
    const pool = D.items.filter(i => i.c === it.c && i.id !== it.id);
    const start = pool.length ? D.items.indexOf(it) % pool.length : 0;
    const next = pool.length ? [0, 1, 2, 3].slice(0, Math.min(4, pool.length)).map(n => pool[(start + n) % pool.length]) : [];
    $('#more-h').textContent = catName[it.c];
    $('#more-a').href = `catalog.html#${it.c}`;
    $('#more').innerHTML = next.map(card).join('');
    renderBuys();
  }

  function cartPage() {
    const form = $('#checkout');
    const saved = store.get(FORM, {}) || {};
    const how = () => $('input[name="how"]:checked', form).value;
    if (saved.how === 'delivery') $('input[name="how"][value="delivery"]', form).checked = true;
    if (branch[saved.branch]) $(`input[name="branch"][value="${saved.branch}"]`, form).checked = true;
    $('#addr').value = saved.addr || '';
    $('#name').value = saved.name || '';
    $('#phone').value = saved.phone || '';
    const pend0 = store.get(PENDING, null);
    if (pend0 && pend0.note) { $('#note').value = pend0.note; $('#note-box').open = true; }
    const read = () => ({
      how: how(),
      branch: ($('input[name="branch"]:checked', form) || {}).value || D.branches[0].id,
      addr: $('#addr').value.trim(),
      name: $('#name').value.trim(),
      phone: $('#phone').value.trim(),
      note: $('#note').value.trim()
    });
    const persist = () => { const f = read(); store.set(FORM, { how: f.how, branch: f.branch, addr: f.addr, name: f.name, phone: f.phone }); };
    const toggleHow = () => { $('#pickup-box').hidden = how() !== 'pickup'; $('#delivery-box').hidden = how() !== 'delivery'; };

    const lines = () => {
      $('#lines').innerHTML = Object.keys(cart).map(id => {
        const it = byId[id];
        return `<li class="cline" data-line="${id}"><a class="line-ph" href="item.html?id=${id}" tabindex="-1" aria-hidden="true">${thumb(it, 76)}</a>
<div class="line-t"><div><a href="item.html?id=${id}">${esc(it.t)}</a><p class="line-u">${it.p ? `${som(it.p)} за шт.` : 'Цена по запросу'}</p></div><button type="button" class="rm" data-rm="${id}" aria-label="Убрать «${esc(it.t)}» из корзины">${I.cross}</button></div>
<div class="line-b"><span class="buy" data-buy="${id}" data-light="1"></span><span class="line-s${it.p ? '' : ' ask'}" data-ls="${id}"></span></div></li>`;
      }).join('');
      renderBuys();
      sums();
    };
    const sums = () => {
      const t = totals(cartLines());
      Object.keys(cart).forEach(id => { const el = $(`[data-ls="${id}"]`); const it = byId[id]; if (el) el.textContent = it.p ? som(it.p * cart[id]) : 'уточнит менеджер'; });
      const pricedN = t.n - t.ask;
      $('#sum').innerHTML = `${pricedN ? `<p class="cs-row"><span>С ценой, ${pcs(pricedN)}</span><b>${som(t.sum)}</b></p>` : ''}${t.ask ? `<p class="cs-row"><span>По запросу, ${pcs(t.ask)}</span><b>назовёт менеджер</b></p>` : ''}
<p class="cs-total"><span>Итого, ${pcs(t.n)}</span><b>${t.sum ? som(t.sum) : 'По запросу'}</b>${t.sum && t.ask ? `<small>и ${pcs(t.ask)} по запросу</small>` : ''}</p>`;
      $('#cart-sub').textContent = `${goods(Object.keys(cart).length)}, ${pcs(t.n)}`;
    };
    const myList = () => {
      const list = myOrders().slice(0, 5);
      $('#my-orders').innerHTML = list.length ? `<div class="myo"><h2>Ваши заказы</h2>${list.map(o => `<a href="order.html?t=${encodeURIComponent(o.t)}${o.b ? `&b=${o.b}` : ''}"><span><b>Заказ ${no(o.n)}</b><br><small>${when(o.created)}, ${goods(o.k || 1)}</small></span><span class="pill s-${o.s || 'new'}">${ST_T[o.s] || ST_T.new}</span></a>`).join('')}</div>` : '';
      const leads = api();
      if (!leads || !list.length || myList.done) return;
      myList.done = true;
      const client = leads.create({ api: D.api });
      list.filter(o => !FINAL.includes(o.s)).forEach(o => client.status(o.t).then(s => { if (s.status !== o.s) { patchMy(o.t, { s: s.status }); myList(); } }, () => { }));
    };
    const all = () => {
      const has = count() > 0;
      $('#cart-empty').hidden = has;
      form.hidden = !has;
      $('#cart-sub').hidden = !has;
      if (!has) { myList(); return; }
      sums();
    };
    removeLine = id => {
      const li = $(`[data-line="${id}"]`);
      const q = cart[id];
      const go = () => {
        setQty(id, 0); syncCount(false);
        if (li) li.remove();
        all();
        toast(`Убрано: ${byId[id].t}`, '<button type="button" class="undo">Вернуть</button>');
        const u = $('.undo', toastEl);
        if (u) u.onclick = () => { setQty(id, q); syncCount(false); lines(); all(); toastEl.classList.add('off'); };
      };
      if (reduce || !li) go(); else { li.classList.add('gone'); setTimeout(go, 200); }
    };
    lines();
    toggleHow();
    all();
    listeners.push(id => { if (id) { if (cart[id]) sums(); } else { lines(); all(); } });
    form.addEventListener('click', e => { const rm = e.target.closest('[data-rm]'); if (rm) removeLine(rm.dataset.rm); });
    form.addEventListener('change', () => { toggleHow(); persist(); clearErr(); });
    form.addEventListener('input', () => { persist(); clearErr(); });
    const setErr = (k, t) => { $(`[data-e="${k}"]`, form).textContent = t; if (t) $(`#${k}`).setAttribute('aria-invalid', 'true'); else $(`#${k}`).removeAttribute('aria-invalid'); };
    const clearErr = () => {
      if ($('#name').value.trim()) setErr('name', '');
      if (phoneOk($('#phone').value)) setErr('phone', '');
      if ($('#addr').value.trim() || how() !== 'delivery') setErr('addr', '');
    };

    const failEl = $('#send-fail');
    const btn = $('#send');
    const btnText = btn.textContent;
    let busy = false;
    const showFail = (err, pending) => {
      failEl.innerHTML = pending
        ? `<div class="fail" role="alert"><p class="fail-t">Заказ ещё не отправлен</p><p>Прошлая попытка не дошла до магазина. Корзина и данные сохранены, отправьте заказ ещё раз.</p><button class="btn line sm" type="button" data-retry>Отправить заказ</button></div>`
        : failBox(err, err && err.status === 422 ? '' : 'Корзина и данные формы сохранены на этом устройстве.');
      failEl.hidden = false;
    };
    failEl.addEventListener('click', e => { if (e.target.closest('[data-retry]')) form.requestSubmit ? form.requestSubmit() : send(); });

    const payloadOf = f => {
      const comment = [f.how === 'pickup' && branch[f.branch] ? `${BRANCH_P}${branch[f.branch].name} (${branch[f.branch].spot})` : '', f.note].filter(Boolean).join('\n');
      const p = {
        kind: 'order',
        name: f.name,
        phone: f.phone,
        items: cartLines().map(it => { const x = { title: it.t.slice(0, 120), qty: it.q, sku: it.id }; if (it.p) x.price = it.p; return x; }),
        delivery: f.how,
        website: form.website.value
      };
      if (f.how === 'delivery') p.address = f.addr;
      if (comment) p.comment = comment;
      return p;
    };

    const send = () => {
      if (busy) return;
      const f = read();
      let bad = null;
      if (f.how === 'delivery' && f.addr.length < 5) { setErr('addr', 'Укажите улицу и дом, чтобы курьер нашёл вас.'); bad = $('#addr'); }
      if (!phoneOk(f.phone)) { setErr('phone', f.phone ? 'Проверьте номер: например, 0555 12 34 56.' : 'Оставьте номер, менеджер позвонит подтвердить заказ.'); bad = $('#phone'); }
      if (f.name.length < 2) { setErr('name', 'Напишите имя, чтобы менеджер знал, как к вам обращаться.'); bad = $('#name'); }
      if (bad) { bad.focus(); bad.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return; }
      const leads = api();
      if (!leads) { showFail({ status: 0 }); return; }
      const client = leads.create({ api: D.api });
      const body = payloadOf(f);
      const sig = JSON.stringify(body);
      const old = store.get(PENDING, null);
      const id = old && old.sig === sig && old.id ? old.id : client.newRequestId();
      store.set(PENDING, { id, sig, note: f.note });
      busy = true;
      btn.disabled = true;
      btn.textContent = 'Отправляем…';
      failEl.hidden = true;
      client.submit({ ...body, client_request_id: id }).then(res => {
        const b = f.how === 'pickup' ? f.branch : '';
        saveMy({ t: res.public_token, n: res.number, b, how: f.how, addr: f.how === 'delivery' ? f.addr : '', created: Date.parse(res.created_at) || Date.now(), k: body.items.length, s: res.status });
        try { localStorage.removeItem(PENDING); } catch (e) { }
        cart = {};
        store.set(CART, cart);
        location.href = `order.html?t=${encodeURIComponent(res.public_token)}${b ? `&b=${b}` : ''}&new=1`;
      }, err => {
        busy = false;
        btn.disabled = false;
        btn.textContent = btnText;
        if (err && err.status === 422 && err.fields) {
          const map = { name: 'name', phone: 'phone', address: 'addr' };
          let first = null;
          Object.entries(err.fields).forEach(([k, v]) => { if (map[k]) { setErr(map[k], v); first = first || $(`#${map[k]}`); } });
          if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); return; }
        }
        showFail(err);
        failEl.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
      });
    };
    form.addEventListener('submit', e => { e.preventDefault(); send(); });
    if (pend0 && count()) showFail(null, true);
    addEventListener('online', () => { if (!busy && store.get(PENDING, null) && count() && !failEl.hidden) send(); });
  }

  function orderPage() {
    const box = $('#order');
    const t = params.get('t');
    const fresh = params.get('new');
    const mine = myOrders().find(o => o.t === t) || {};
    const br = branch[params.get('b')] ? params.get('b') : mine.b || '';
    const leads = api();
    if (!t || !leads) {
      box.innerHTML = `<div class="page-head"><h1>Заказ не найден</h1><p>Откройте ссылку на заказ целиком или найдите его в корзине, в разделе «Ваши заказы».</p></div><a class="btn" href="catalog.html">Открыть каталог${I.arrow}</a>`;
      return;
    }
    const client = leads.create({ api: D.api });
    let o = null, last = null, timer = null, failed = null, loading = false;
    const wa = n => `https://wa.me/${D.wa}?text=${encodeURIComponent(`Здравствуйте! Вопрос по заказу № ${n} с сайта Отаку.`)}`;
    const draw = () => {
      if (!o) {
        box.innerHTML = failed
          ? `<div class="ord-wait">${failBox(failed)}</div>`
          : `<div class="ord-wait" aria-busy="true"><p class="ord-k">Загружаем заказ…</p><div class="sk"></div><div class="sk sk-2"></div></div>`;
        return;
      }
      document.title = `Заказ № ${o.n}, Отаку`;
      const cancelled = o.status === 'cancelled';
      const idx = ST.indexOf(o.status);
      const at = {};
      (o.history || []).forEach(h => { at[h.status] = Date.parse(h.at); });
      const b = branch[o.branch];
      const track = cancelled
        ? `<p class="track-x"><span class="pill s-cancelled">Отменён</span>${at.cancelled ? `<time>${hm(at.cancelled)}</time>` : ''}</p>`
        : `<ol class="track" aria-label="Статус заказа">${ST.map((s, k) => `<li class="${k <= idx ? 'on' : ''}${k === idx ? ' cur' : ''}"${k === idx ? ' aria-current="step"' : ''}><b>${ST_T[s]}</b>${at[s] && k <= idx ? `<time>${hm(at[s])}</time>` : '<time>&nbsp;</time>'}</li>`).join('')}</ol>`;
      const where = o.how === 'delivery'
        ? `<div class="ord-box"><h2>Доставка</h2><p class="big">${o.addr ? esc(o.addr) : 'По адресу из заказа'}</p><p>Стоимость и время доставки менеджер подтвердит по телефону.</p></div>`
        : b ? `<div class="ord-box"><h2>Самовывоз</h2><p class="big">${esc(b.name)}, ${esc(b.spot)}</p><p>${esc(b.addr)}, ежедневно с 10:00 до 22:00</p><a class="more" href="${b.gis}">Маршрут в 2ГИС${I.arrow}</a></div>`
          : `<div class="ord-box"><h2>Самовывоз</h2><p class="big">В выбранном филиале</p><p>Ежедневно с 10:00 до 22:00</p><a class="more" href="branches.html">Адреса филиалов${I.arrow}</a></div>`;
      const sync = failed
        ? `<p class="ord-sync off" role="status">Нет связи, статус может быть устаревшим. <button type="button" data-retry>Повторить</button></p>`
        : FINAL.includes(o.status) ? '' : '<p class="ord-sync" role="status">Статус обновляется сам</p>';
      box.innerHTML = `<div class="ord">
<div class="ord-main">
<p class="ord-k">${fresh ? 'Спасибо! Заказ оформлен' : `Оформлен ${when(o.created)}`}</p>
<p class="ord-msg" aria-live="polite">${esc(statusText(o))}</p>
${track}
${sync}
${ticket(o)}
</div>
<div class="ord-side">
${where}
<div class="ord-acts"><a class="btn line" href="catalog.html">В каталог</a><a class="btn line" href="${wa(o.n)}" target="_blank" rel="noopener">${I.wa}Написать в магазин</a></div>
<p class="ord-demo">Сохраните эту страницу: по ссылке статус виден с любого телефона. В демо его меняет владелец в <a href="owner.html">панели заказов</a>, здесь обновление появится через несколько секунд.</p>
</div></div>`;
      const stamp = $('[data-stamp]', box);
      if (stamp && !reduce && (last === null ? fresh : last !== o.status)) stamp.classList.add('stamp-in');
      last = o.status;
    };
    const schedule = () => {
      clearTimeout(timer);
      if (o && FINAL.includes(o.status) && !failed) return;
      if (document.hidden) return;
      timer = setTimeout(load, failed ? POLL_MS * 2 : POLL_MS);
    };
    const load = () => {
      if (loading) return;
      loading = true;
      client.status(t).then(s => {
        loading = false;
        failed = null;
        const changed = !o || o.status !== s.status;
        o = { n: s.number, status: s.status, items: fromItems(s.items), how: s.delivery, addr: mine.addr || '', branch: br, created: Date.parse(s.created_at), history: s.history };
        patchMy(t, { s: s.status });
        if (changed || !box.querySelector('.ord')) draw(); else { const sy = $('.ord-sync', box); if (sy && sy.classList.contains('off')) draw(); }
        schedule();
      }, err => {
        loading = false;
        if (err && err.status === 404) {
          box.innerHTML = `<div class="page-head"><h1>Заказ не найден</h1><p>Проверьте ссылку: возможно, она скопирована не полностью.</p></div><a class="btn" href="catalog.html">Открыть каталог${I.arrow}</a>`;
          return;
        }
        const was = failed;
        failed = err;
        if (!was || !o) draw();
        else { const rb = $('.ord-sync [data-retry]', box); if (rb) { rb.disabled = false; rb.textContent = 'Повторить'; } }
        schedule();
      });
    };
    box.addEventListener('click', e => {
      const rb = e.target.closest('[data-retry]');
      if (!rb) return;
      clearTimeout(timer);
      if (!o) { failed = null; draw(); } else { rb.disabled = true; rb.textContent = 'Проверяем…'; }
      load();
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { clearTimeout(timer); load(); } });
    addEventListener('online', () => { clearTimeout(timer); load(); });
    if (fresh) history.replaceState(null, '', location.pathname + location.search.replace(/&new=1/, ''));
    draw();
    load();
  }

  function ownerPage() {
    const loginEl = $('#login'), ownEl = $('#own'), tools = $('#own-tools'), conn = $('#conn');
    const list = $('#olist'), det = $('#odet'), err = $('#own-err');
    const mobile = () => matchMedia('(max-width: 899px)').matches;
    const getToken = () => { try { return localStorage.getItem(OWNER) || ''; } catch (e) { return ''; } };
    const setToken = v => { try { v ? localStorage.setItem(OWNER, v) : localStorage.removeItem(OWNER); } catch (e) { } };
    let owner = null, stop = null, orders = [], loaded = false;
    let filter = 'all', sel = params.get('o') || null, armed = null, busy = false, noteOpen = false;
    const details = {};
    let known = new Set();
    const leads = api();
    const find = n => orders.find(o => String(o.n) === String(n) || Number(o.n) === Number(n));

    const setConn = on => { conn.textContent = on ? 'На связи' : 'Нет связи, переподключаемся'; conn.classList.toggle('off', !on); };
    const showLogin = msg => {
      if (stop) { stop(); stop = null; }
      owner = null; orders = []; loaded = false;
      loginEl.hidden = false; ownEl.hidden = true; tools.hidden = true; err.hidden = true;
      det.classList.remove('open');
      $('#own-sub').textContent = 'Войдите, чтобы видеть заказы с сайта.';
      const e = $('[data-e="tok"]', loginEl);
      e.textContent = msg || '';
      $('#tok').toggleAttribute('aria-invalid', !!msg);
      if (msg) $('#tok').setAttribute('aria-invalid', 'true');
    };
    const logout = msg => { setToken(''); $('#tok').value = ''; showLogin(msg); };
    const authFail = e => { if (e && e.status === 401) { logout('Токен больше не действует. Вставьте новый.'); return true; } return false; };

    const tabs = () => {
      const c = s => orders.filter(o => o.status === s).length;
      const keys = [...ST, ...(c('cancelled') ? ['cancelled'] : [])];
      $('#stabs').innerHTML = `<button class="chip" type="button" data-s="all" aria-pressed="${filter === 'all'}">Все <span>${orders.length}</span></button>` +
        keys.map(s => `<button class="chip${s === 'new' ? ' tag' : ''}" type="button" data-s="${s}" aria-pressed="${filter === s}">${ST_TABS[s]} <span>${c(s)}</span></button>`).join('');
    };
    const row = o => {
      const t = totals(o.items);
      const th = o.items.slice(0, 4).map(it => `<i>${thumb(it, 36)}</i>`).join('') + (o.items.length > 4 ? `<em>+${o.items.length - 4}</em>` : '');
      const b = branch[o.branch];
      return `<li><button class="orow" type="button" data-n="${esc(o.n)}" aria-current="${String(o.n) === String(sel)}">
<span class="or-n">${no(o.n)}</span><span class="pill s-${o.status}">${ST_T[o.status] || o.status}</span>
<span class="or-who"><span>${esc(o.name)}, ${o.how === 'delivery' ? 'доставка' : b ? esc(b.name) : 'самовывоз'}</span><b>${t.sum ? som(t.sum) : 'по запросу'}</b></span>
<span class="or-th">${th}<time>${when(o.created)}</time></span></button></li>`;
    };
    const detail = o => {
      const a = document.activeElement;
      const keep = a && a.id === 'onote' && o && noteOpen === o.n ? [a.selectionStart, a.selectionEnd] : null;
      paint(o);
      if (keep) { const ta = $('#onote', det); ta.focus({ preventScroll: true }); ta.setSelectionRange(keep[0], keep[1]); }
    };
    const paint = o => {
      if (!o) { det.innerHTML = `<div class="odet-ph"><p>${orders.length ? 'Выберите заказ слева' : 'Здесь откроется карточка заказа'}</p></div>`; return; }
      const t = totals(o.items);
      const b = branch[o.branch];
      const fwd = o.next.find(s => s !== 'cancelled');
      const canCancel = o.next.includes('cancelled');
      const nxt = fwd ? nextLabel(o) || ST_T[fwd] : '';
      const full = details[o.n];
      const hist = full && full.history ? full.history : null;
      const log = hist ? hist.map(h => `<li><span>${ST_T[h.status] || h.status}${h.actor === 'client' ? ', покупатель' : ''}</span><time>${when(Date.parse(h.at))}</time></li>`).join('') : '<li><span>Загружаем…</span></li>';
      const waText = `Здравствуйте, ${o.name}! Это магазин Отаку, по вашему заказу № ${o.n}.`;
      const noteVal = noteOpen === o.n ? ($('#onote', det) || {}).value ?? o.ownerNote : o.ownerNote;
      det.innerHTML = `<div class="odet-in">
<div class="od-top"><div><p class="od-n">${no(o.n)}<span class="pill s-${o.status}">${ST_T[o.status] || o.status}</span></p><p class="od-when">${when(o.created)}</p></div><button class="od-close" type="button" data-close aria-label="Закрыть">${I.cross}</button></div>
<div class="od-act">${nxt ? `<button class="btn${o.status === 'new' ? ' red' : ''} wide" type="button" data-next="${fwd}"${busy ? ' disabled' : ''}>${busy === 'next' ? 'Сохраняем…' : nxt}</button>` : `<p class="big">${o.status === 'cancelled' ? 'Заказ отменён' : 'Заказ закрыт'}</p>`}${canCancel ? `<button class="od-back" type="button" data-cancel${busy ? ' disabled' : ''}>${armed === o.n ? 'Нажмите ещё раз, чтобы отменить' : 'Отменить заказ'}</button>` : ''}</div>
<div class="od-sec"><h3>Покупатель</h3><p class="big">${esc(o.name)}</p><p><a class="od-tel" href="tel:${esc(String(o.phone).replace(/[^\d+]/g, ''))}">${esc(phoneText(o.phone))}</a></p>${o.note ? `<p>«${esc(o.note)}»</p>` : ''}
<a class="btn line sm od-wa" href="${leads.whatsappLink(o.phone, waText)}" target="_blank" rel="noopener">${I.wa}Написать покупателю</a></div>
<div class="od-sec"><h3>${o.how === 'delivery' ? 'Доставка' : 'Самовывоз'}</h3><p class="big">${o.how === 'delivery' ? esc(o.addr || '') : b ? `${esc(b.name)}, ${esc(b.spot)}` : 'Филиал не указан'}</p></div>
<div class="od-sec"><h3>${goods(o.items.length)}, ${pcs(t.n)}</h3><div class="od-items">${o.items.map(it => `<div class="od-it"><i>${thumb(it, 48)}</i><span>${esc(it.t)}<small>${it.q} × ${it.p ? som(it.p) : 'цена по запросу'}</small></span>${it.p ? `<b>${som(it.p * it.q)}</b>` : '<b class="ask">по запросу</b>'}</div>`).join('')}</div>
<div class="od-total"><span>Итого</span><span>${t.sum ? som(t.sum) : 'По запросу'}${t.sum && t.ask ? `<small>и ${pcs(t.ask)} по запросу</small>` : ''}</span></div></div>
<div class="od-sec"><h3><label for="onote">Заметка для себя</label></h3><textarea class="od-note" id="onote" rows="2" maxlength="1000" placeholder="Например, отложили в ЦУМе, позвонить после 18:00">${esc(noteVal || '')}</textarea><div class="od-note-a" ${noteOpen === o.n ? '' : 'hidden'}><button class="btn sm" type="button" data-note${busy ? ' disabled' : ''}>${busy === 'note' ? 'Сохраняем…' : 'Сохранить заметку'}</button><button class="od-back" type="button" data-note-cancel>Отменить</button></div><p class="hint">Покупатель заметку не видит.</p></div>
<div class="od-sec"><h3>История</h3><ul class="od-log">${log}</ul></div>
</div>`;
    };
    const draw = () => {
      tabs();
      const shown = orders.filter(o => filter === 'all' || o.status === filter);
      list.innerHTML = shown.map(row).join('');
      $('#oempty').hidden = shown.length > 0;
      if (!shown.length) $('#oempty .empty-t').textContent = orders.length ? `Нет заказов со статусом «${ST_T[filter]}»` : 'Заказов пока нет';
      $('#oempty .btn').hidden = orders.length > 0;
      $('#own-sub').textContent = orders.length ? `${orders.filter(o => o.status === 'new').length ? `Новых: ${orders.filter(o => o.status === 'new').length}. ` : ''}Заказы с сайта появляются здесь сразу, без перезагрузки.` : 'Заказы с сайта появятся здесь сразу, без перезагрузки.';
      if (!mobile() && !find(sel) && shown[0]) sel = shown[0].n;
      if (sel && find(sel)) sel = find(sel).n;
      $$('.orow', list).forEach(r => r.setAttribute('aria-current', String(r.dataset.n === String(sel))));
      if (noteOpen !== sel) noteOpen = false;
      detail(find(sel));
    };
    const loadDetail = n => {
      if (!owner || !n) return;
      owner.get(n).then(x => {
        details[x.number] = { history: x.history };
        const i = orders.findIndex(o => o.n === x.number);
        if (i >= 0) { const keepNote = noteOpen === x.number; orders[i] = fromServer(x); if (keepNote) noteOpen = x.number; }
        if (String(sel) === String(x.number)) detail(find(sel));
      }, e => { authFail(e); });
    };
    const refresh = () => {
      if (!owner) return Promise.resolve();
      return owner.list({ limit: 200 }).then(res => {
        orders = res.items.map(fromServer);
        setConn(true);
        err.hidden = true;
        ownEl.hidden = false;
        const added = loaded ? orders.filter(o => !known.has(o.n)) : [];
        known = new Set(orders.map(o => o.n));
        loaded = true;
        draw();
        added.forEach(o => { const r = $(`.orow[data-n="${o.n}"]`); if (r && !reduce) r.classList.add('fresh'); });
        if (added.length) {
          const o = added[0];
          toast(added.length > 1 ? `Новых заказов: ${added.length}` : `Новый заказ № ${o.n}`, `<button type="button" class="undo" data-open="${esc(o.n)}">Открыть</button>`);
          const u = $('[data-open]', toastEl);
          if (u) u.onclick = () => { open(u.dataset.open); toastEl.classList.add('off'); };
        }
        if (sel && find(sel)) loadDetail(sel);
      }, e => {
        if (authFail(e)) return;
        setConn(false);
        if (!loaded) { ownEl.hidden = true; err.innerHTML = failBox(e); err.hidden = false; }
        else setTimeout(() => refresh(), 4000);
      });
    };
    const start = token => {
      owner = leads.owner({ api: D.api, token });
      loginEl.hidden = true; tools.hidden = false;
      setConn(true);
      refresh().then(() => {
        if (!owner || stop) return;
        stop = owner.watch(() => { setConn(true); refresh(); }, e => { if (authFail(e)) return; setConn(false); setTimeout(() => refresh(), 3500); });
        if (mobile() && sel && find(sel)) { history.replaceState(null, '', location.pathname); history.pushState({ o: sel }, '', `?o=${sel}`); det.classList.add('open'); }
      });
    };
    const open = n => {
      sel = (find(n) || {}).n || n; armed = null;
      draw();
      loadDetail(sel);
      if (mobile()) {
        det.classList.add('open');
        if (!history.state || !history.state.o) history.pushState({ o: sel }, '', `?o=${sel}`);
        const c = $('[data-close]', det);
        if (c) c.focus({ preventScroll: true });
      }
    };
    const close = () => { det.classList.remove('open'); const r = $(`.orow[data-n="${sel}"]`); if (r) r.focus({ preventScroll: true }); };
    const patch = (kind, fn) => {
      const n = sel;
      busy = kind; detail(find(n));
      return fn(n).then(x => {
        busy = false;
        const i = orders.findIndex(o => o.n === x.number);
        if (i >= 0) orders[i] = fromServer(x);
        details[x.number] = { history: x.history };
        return x;
      }, e => {
        busy = false;
        if (authFail(e)) return null;
        detail(find(n));
        toast(e && e.status === 409 ? e.message : human(e).t, '');
        if (e && e.status === 409) refresh();
        return null;
      });
    };

    loginEl.addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#tok').value.trim();
      const msg = $('[data-e="tok"]', loginEl);
      if (!v) { msg.textContent = 'Вставьте токен владельца.'; $('#tok').setAttribute('aria-invalid', 'true'); $('#tok').focus(); return; }
      const b = $('button[type="submit"]', loginEl);
      b.disabled = true; b.textContent = 'Проверяем…';
      leads.owner({ api: D.api, token: v }).summary().then(() => {
        b.disabled = false; b.textContent = 'Войти';
        setToken(v);
        msg.textContent = '';
        start(v);
      }, x => {
        b.disabled = false; b.textContent = 'Войти';
        msg.textContent = x && x.status === 401 ? 'Токен не подошёл. Скопируйте его целиком, без пробелов.' : x && x.status === 503 ? 'Панель на сервере ещё не настроена.' : `${human(x).t}. ${human(x).p}`;
        $('#tok').setAttribute('aria-invalid', 'true');
      });
    });
    $('#logout').addEventListener('click', () => logout(''));
    err.addEventListener('click', e => { if (e.target.closest('[data-retry]')) { err.innerHTML = '<p class="ord-k">Подключаемся…</p>'; refresh(); } });
    list.addEventListener('click', e => { const r = e.target.closest('.orow'); if (r) open(r.dataset.n); });
    $('#stabs').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; filter = b.dataset.s; if (mobile()) sel = null; draw(); });
    det.addEventListener('input', e => {
      if (e.target.id !== 'onote') return;
      const o = find(sel);
      const changed = o && e.target.value !== o.ownerNote;
      noteOpen = changed ? o.n : false;
      $('.od-note-a', det).hidden = !changed;
    });
    det.addEventListener('click', e => {
      if (e.target.closest('[data-close]')) { history.state && history.state.o ? history.back() : close(); return; }
      const nx = e.target.closest('[data-next]');
      if (nx && !busy) {
        const st = nx.dataset.next;
        patch('next', n => owner.setStatus(n, st)).then(x => { if (x) { draw(); toast(`№ ${x.number}: ${ST_T[x.status] || x.status_title}`); } });
        return;
      }
      if (e.target.closest('[data-cancel]') && !busy) {
        if (armed !== sel) { armed = sel; detail(find(sel)); setTimeout(() => { if (armed === sel) { armed = null; detail(find(sel)); } }, 3500); return; }
        armed = null;
        patch('cancel', n => owner.setStatus(n, 'cancelled')).then(x => { if (x) { draw(); toast(`Заказ № ${x.number} отменён`); } });
        return;
      }
      if (e.target.closest('[data-note-cancel]')) { noteOpen = false; detail(find(sel)); return; }
      if (e.target.closest('[data-note]') && !busy) {
        const v = $('#onote', det).value.trim();
        patch('note', n => owner.setNote(n, v)).then(x => { if (x) { noteOpen = false; detail(find(sel)); toast(v ? 'Заметка сохранена' : 'Заметка удалена'); } });
      }
    });
    addEventListener('popstate', () => { if (!history.state || !history.state.o) close(); else open(history.state.o); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && det.classList.contains('open')) history.state && history.state.o ? history.back() : close(); });
    addEventListener('online', () => { if (owner) refresh(); });

    if (!leads) { showLogin('Не удалось загрузить модуль заказов. Обновите страницу.'); return; }
    const tok = getToken();
    if (tok) start(tok); else showLogin('');
  }

  function branchesPage() {
    const frame = $('#mapframe');
    const show = (id, scroll) => {
      const b = branch[id];
      if (!b) return;
      if (frame.dataset.cur !== id) { frame.src = b.map; frame.title = `Отаку, ${b.name}, на карте`; frame.dataset.cur = id; }
      $$('.map-tabs button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.map === id)));
      if (scroll) scrollTo({ top: $('#map').getBoundingClientRect().top + scrollY - $('.top').offsetHeight - 16, behavior: reduce ? 'auto' : 'smooth' });
    };
    frame.dataset.cur = D.branches[0].id;
    document.addEventListener('click', e => { const b = e.target.closest('[data-map]'); if (b) show(b.dataset.map, !b.closest('.map-tabs')); });
    if (branch[location.hash.slice(1)]) show(location.hash.slice(1), false);
  }

  syncCount(false);
  if (page === 'index') home();
  if (page === 'catalog') catalog();
  if (page === 'item') item();
  if (page === 'cart') cartPage();
  if (page === 'order') orderPage();
  if (page === 'branches') branchesPage();
  if (page === 'owner') ownerPage();
  renderBuys();
  live();
  reveal();
  worstToggle();
})();
