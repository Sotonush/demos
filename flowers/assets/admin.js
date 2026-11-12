const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = (document.body.dataset.api || '').replace(/\/+$/, '');
const SHOP_NAME = document.body.dataset.name || 'Цветы';
const KEY = 'flowers-owner-session';
const NET = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
const DEMO = new URLSearchParams(location.search).has('demo');
const HEALTH_TIMEOUT = 5000;
const PHOTO_EDGE = 1600;
const PHOTO_QUALITY = 0.86;
const PHOTO_MAX = 5 * 1024 * 1024;
const SCREENS = ['s-check', 's-offline', 's-login', 's-setup', 's-totp', 's-codes'];
const STATUS = { new: 'Новый', accepted: 'Принят', ready: 'Готов', done: 'Выполнен', cancelled: 'Отменён' };
const ACTION = { accepted: 'Принять заказ', ready: 'Букет готов', done: 'Доставлен', cancelled: 'Отменить' };
const FILTERS = [
  ['work', 'В работе', o => ['new', 'accepted', 'ready'].includes(o.status)],
  ['new', 'Новые', o => o.status === 'new'],
  ['done', 'Выполнены', o => o.status === 'done'],
  ['off', 'Отменены', o => o.status === 'cancelled'],
  ['all', 'Все', () => true],
];
const narrow = matchMedia('(max-width: 900px)');

let owner = null;
let stopWatch = null;
let session = '';
let challenge = '';
let recoveryMode = false;
let pendingCodes = null;
let orders = [];
let knownOrders = new Set();
let filter = 'work';
let picked = '';
let loadedOnce = false;
let products = [];
let productsOff = false;
let editing = null;
let pendingPhoto = null;
let removePhoto = false;
let dragFrom = null;
let toastTimer = null;

function store(key, value) {
  try {
    if (value === undefined) return localStorage.getItem(key) || '';
    if (value) localStorage.setItem(key, value); else localStorage.removeItem(key);
  } catch (e) {
    return '';
  }
  return '';
}

function el(tag, attrs = {}, kids = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (v === null || v === undefined || v === false) return;
    if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  });
  kids.forEach(k => k && n.append(k));
  return n;
}

function icon(name) {
  const t = $(`#ico-${name}`);
  return t ? t.content.firstElementChild.cloneNode(true) : null;
}

function toast(text) {
  const s = $('#astatus');
  s.textContent = text;
  s.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => s.classList.remove('on'), 2600);
}

const money = n => `${Number(n).toLocaleString('ru-RU')} с`;
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);

function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' }).format(d);
}

function ago(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) { const m = Math.floor(s / 60); return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`; }
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`; }
  return when(iso);
}

function phoneText(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 12 ? `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 9)} ${d.slice(9)}` : p;
}

function minutes(sec) {
  const m = Math.max(1, Math.ceil(sec / 60));
  return `${m} ${plural(m, 'минуту', 'минуты', 'минут')}`;
}

async function auth(method, path, body) {
  let r;
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (session) headers.Authorization = `Bearer ${session}`;
  try {
    r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'omit', cache: 'no-store' });
  } catch (e) {
    throw { status: 0, message: NET };
  }
  let data = null;
  try { data = await r.json(); } catch (e) { data = null; }
  if (r.ok) return data || {};
  const err = { status: r.status, message: (data && data.error) || (r.status >= 500 ? 'Сервер временно недоступен, попробуйте чуть позже.' : 'Ошибка запроса'), fields: data && data.fields };
  if (r.status === 429) {
    const ra = Number(r.headers.get('Retry-After')) || 0;
    err.message = ra ? `Слишком много попыток. Попробуйте через ${minutes(ra)}.` : 'Слишком много попыток. Подождите немного и попробуйте снова.';
  }
  throw err;
}

function show(id) {
  SCREENS.forEach(s => { $(`#${s}`).hidden = s !== id; });
  $('#auth').hidden = id === 'app';
  $('#app').hidden = id !== 'app';
  if (id !== 'app') {
    const sec = $(`#${id}`);
    const f = $('input:not([type=checkbox])', sec);
    (f && !f.value ? f : sec).focus();
  }
}

async function reachable() {
  if (!API) return false;
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const t = setTimeout(() => ctrl && ctrl.abort(), HEALTH_TIMEOUT);
  try {
    const r = await fetch(`${API}/api/videos`, { credentials: 'omit', signal: ctrl && ctrl.signal });
    return r.status > 0;
  } catch (e) {
    return false;
  } finally {
    clearTimeout(t);
  }
}

async function start() {
  show('s-check');
  if (!(await reachable()) || !window.LeadsClient) { show('s-offline'); return; }
  session = store(KEY);
  if (session) enterPanel(); else showLogin('');
}

function stopPanel() {
  if (stopWatch) { stopWatch(); stopWatch = null; }
  owner = null;
}

function showLogin(message) {
  stopPanel();
  session = '';
  store(KEY, '');
  $('#login-note').textContent = message || 'Почта и пароль владельца сайта.';
  $('#login-note').classList.toggle('warn', Boolean(message));
  $('#pass').value = '';
  show('s-login');
}

function expired() {
  showLogin('Сессия закончилась. Войдите снова.');
}

function setRecovery(on) {
  recoveryMode = on;
  const c = $('#code');
  c.value = '';
  c.maxLength = on ? 9 : 6;
  c.inputMode = on ? 'text' : 'numeric';
  c.autocomplete = on ? 'off' : 'one-time-code';
  c.placeholder = on ? 'xxxx-xxxx' : '000000';
  $('#code-l').textContent = on ? 'Резервный код' : 'Код из приложения';
  $('#totp-h').textContent = on ? 'Резервный код' : 'Код из приложения';
  $('#totp-note').textContent = on ? 'Введите один из резервных кодов, которые вы сохранили при подключении.' : 'Откройте Google Authenticator и введите 6 цифр.';
  $('#use-recovery').textContent = on ? 'Ввести код из приложения' : 'Нет телефона? Введите резервный код';
  $('#use-recovery').setAttribute('aria-pressed', String(on));
  $('#totp-e').textContent = '';
  c.focus();
}

function showCodes(list, done) {
  pendingCodes = done;
  $('#rcodes').replaceChildren(...list.map(c => el('li', { text: c })));
  $('#saved').checked = false;
  $('#codes-ok').setAttribute('aria-disabled', 'true');
  show('s-codes');
}

async function copy(text, okMsg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch (e) {
    toast('Не получилось скопировать, выделите и скопируйте вручную');
  }
}

async function enterPanel() {
  if (!DEMO) {
    try {
      await auth('GET', '/api/owner/auth/me');
    } catch (err) {
      if (err.status === 401) { showLogin(''); return; }
    }
    owner = window.LeadsClient.owner({ api: API, token: session, onSessionExpired: expired });
  } else {
    owner = mockOwner();
    $('#demo-bar').hidden = false;
  }
  show('app');
  loadOrders();
  loadProducts();
  stopWatch = owner.watch(() => loadOrders(true), err => { if (err.status === 401) expired(); });
}

async function verify(code, errBox) {
  try {
    const res = await auth('POST', '/api/owner/auth/verify', { challenge, code });
    session = res.token;
    store(KEY, session);
    challenge = '';
    if (res.recovery_codes && res.recovery_codes.length) showCodes(res.recovery_codes, enterPanel);
    else enterPanel();
  } catch (err) {
    errBox.textContent = err.status === 401 || err.status === 422 ? (err.fields && Object.values(err.fields)[0]) || err.message || 'Код не подошёл' : err.message;
    if (err.status === 410 || /истек|заново/i.test(err.message || '')) { challenge = ''; showLogin(err.message); }
  }
}

function otpInput(input, onFull) {
  input.addEventListener('input', () => {
    if (input.id === 'code' && recoveryMode) {
      const v = input.value.replace(/[^0-9a-z]/gi, '').toLowerCase().slice(0, 8);
      input.value = v.length > 4 ? `${v.slice(0, 4)}-${v.slice(4)}` : v;
      return;
    }
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    if (input.value.length === 6 && onFull) onFull();
  });
}

function authUi() {
  $('#retry').addEventListener('click', start);
  $('.pw-t').addEventListener('click', e => {
    const on = $('#pass').type === 'password';
    $('#pass').type = on ? 'text' : 'password';
    e.currentTarget.textContent = on ? 'Скрыть' : 'Показать';
    e.currentTarget.setAttribute('aria-pressed', String(on));
  });
  $('#login-f').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#email').value.trim();
    const password = $('#pass').value;
    const er = $('#login-e');
    er.textContent = '';
    if (!/.+@.+\..+/.test(email)) { er.textContent = 'Введите почту, например owner@mail.kg'; $('#email').focus(); return; }
    if (!password) { er.textContent = 'Введите пароль'; $('#pass').focus(); return; }
    const btn = $('button[type=submit]', e.currentTarget);
    btn.setAttribute('aria-busy', 'true');
    btn.disabled = true;
    try {
      const res = await auth('POST', '/api/owner/auth/login', { email, password });
      challenge = res.challenge;
      if (res.status === 'totp_setup_required') {
        const src = res.qr_svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(res.qr_svg)}` : '';
        $('#qr').replaceChildren(src ? el('img', { src, alt: 'QR-код для приложения с кодами', width: '200', height: '200' }) : '');
        $('#secret').textContent = (res.secret || '').replace(/(.{4})/g, '$1 ').trim();
        $('#setup-code').value = '';
        $('#setup-e').textContent = '';
        show('s-setup');
      } else if (res.status === 'totp_required') {
        setRecovery(false);
        show('s-totp');
      } else if (res.status === 'ok' && res.token) {
        session = res.token;
        store(KEY, session);
        enterPanel();
      }
    } catch (err) {
      er.textContent = err.status === 401 ? 'Неверная почта или пароль' : err.message;
    } finally {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
    }
  });
  const totpSubmit = () => {
    const v = $('#code').value.trim();
    if (!recoveryMode && v.length !== 6) { $('#totp-e').textContent = 'Нужно 6 цифр из приложения'; return; }
    if (recoveryMode && v.replace(/\W/g, '').length < 8) { $('#totp-e').textContent = 'Резервный код выглядит так: abcd-1234'; return; }
    verify(v, $('#totp-e'));
  };
  otpInput($('#code'), totpSubmit);
  $('#totp-f').addEventListener('submit', e => { e.preventDefault(); totpSubmit(); });
  const setupSubmit = () => {
    const v = $('#setup-code').value.trim();
    if (v.length !== 6) { $('#setup-e').textContent = 'Нужно 6 цифр из приложения'; return; }
    verify(v, $('#setup-e'));
  };
  otpInput($('#setup-code'), setupSubmit);
  $('#setup-f').addEventListener('submit', e => { e.preventDefault(); setupSubmit(); });
  $('#use-recovery').addEventListener('click', () => setRecovery(!recoveryMode));
  $$('.to-login').forEach(b => b.addEventListener('click', () => { challenge = ''; showLogin(''); }));
  $('#copy-secret').addEventListener('click', () => copy($('#secret').textContent.replace(/\s/g, ''), 'Ключ скопирован'));
  $('#copy-codes').addEventListener('click', () => copy($$('#rcodes li').map(l => l.textContent).join('\n'), 'Коды скопированы'));
  $('#saved').addEventListener('change', e => $('#codes-ok').setAttribute('aria-disabled', String(!e.target.checked)));
  $('#codes-ok').addEventListener('click', () => {
    if (!$('#saved').checked) { toast('Сначала сохраните коды и отметьте галочку'); $('#saved').focus(); return; }
    const next = pendingCodes;
    pendingCodes = null;
    if (next) next();
  });
  $('#logout').addEventListener('click', async () => {
    if (DEMO) { location.href = location.pathname; return; }
    try { await auth('POST', '/api/owner/auth/logout'); } catch (e) { session = ''; }
    $('#email').value = '';
    showLogin('Вы вышли из кабинета.');
  });
}

function tabs() {
  const list = $$('[role=tab]');
  const pick = t => {
    list.forEach(x => {
      const on = x === t;
      x.setAttribute('aria-selected', String(on));
      x.tabIndex = on ? 0 : -1;
      $(`#${x.getAttribute('aria-controls')}`).hidden = !on;
    });
    try { sessionStorage.setItem('flowers-tab', t.id); } catch (e) { return; }
  };
  list.forEach((t, k) => {
    t.addEventListener('click', () => pick(t));
    t.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const n = list[(k + (e.key === 'ArrowRight' ? 1 : -1) + list.length) % list.length];
      pick(n);
      n.focus();
    });
  });
  let saved = '';
  try { saved = sessionStorage.getItem('flowers-tab') || ''; } catch (e) { saved = ''; }
  const hash = location.hash === '#products' ? 't-products' : '';
  const id = hash || saved;
  const t = id ? document.getElementById(id) : null;
  if (t) pick(t);
}

function parseComment(text) {
  const rows = [];
  const rest = [];
  String(text || '').split('\n').forEach(line => {
    const m = /^([^:]{2,30}):\s*(.+)$/.exec(line.trim());
    if (m) rows.push([m[1], m[2]]); else if (line.trim()) rest.push(line.trim());
  });
  return { rows, rest: rest.join('\n') };
}

function orderWhen(o) {
  const c = parseComment(o.comment);
  const day = c.rows.find(r => /^(Доставка|Самовывоз)$/i.test(r[0]));
  const time = c.rows.find(r => /^Время$/i.test(r[0]));
  return {
    kind: day ? day[0] : (o.delivery === 'delivery' ? 'Доставка' : 'Самовывоз'),
    day: day ? day[1] : '',
    time: time ? time[1] : '',
    card: (c.rows.find(r => /^Открытка$/i.test(r[0])) || [])[1] || '',
    comment: [(c.rows.find(r => /^Комментарий$/i.test(r[0])) || [])[1], c.rest].filter(Boolean).join('\n'),
  };
}

function bouquets(o) {
  return (o.items || []).filter(i => i.sku !== 'delivery');
}

function waLink(phone, o) {
  const d = String(phone || '').replace(/\D/g, '');
  const text = `Здравствуйте${o && o.name ? `, ${o.name}` : ''}! Это ${SHOP_NAME}, по вашему заказу №${o ? o.number : ''}.`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

function setFilter(k) {
  filter = k;
  drawFilters();
  drawOrders();
}

function drawFilters() {
  $('#ofilter').replaceChildren(...FILTERS.map(([k, t, f]) => el('button', {
    type: 'button', class: 'chip', 'aria-pressed': String(filter === k), onclick: () => setFilter(k),
  }, [el('span', { text: t }), el('small', { text: String(orders.filter(f).length) })])));
}

function skeleton() {
  $('#orders').replaceChildren(...[0, 1, 2, 3].map(() => el('li', { class: 'orow sk', 'aria-hidden': 'true' }, [
    el('div', { class: 'orow-b' }, [el('span', { class: 'sk-l' }), el('span', { class: 'sk-l s' })]),
  ])));
}

async function loadOrders(fresh) {
  if (!owner) return;
  if (!loadedOnce) skeleton();
  let data;
  try {
    data = await owner.list({ limit: 100 });
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
    if (!loadedOnce) $('#orders').replaceChildren();
    return;
  }
  loadedOnce = true;
  const items = (data.items || []).filter(o => o.kind !== 'booking');
  const appeared = fresh ? items.filter(o => !knownOrders.has(o.number)).map(o => o.number) : [];
  orders = items;
  knownOrders = new Set(items.map(o => o.number));
  const nc = items.filter(o => o.status === 'new').length;
  $('#newc').hidden = !nc;
  $('#newc').textContent = nc;
  document.title = `${nc ? `(${nc}) ` : ''}Кабинет | ${SHOP_NAME}`;
  drawFilters();
  drawOrders(appeared);
  if (picked && orders.some(o => o.number === picked)) openOrder(picked, false);
  else if (!narrow.matches) {
    const first = orders.find((FILTERS.find(x => x[0] === filter) || FILTERS[0])[2]);
    if (first) openOrder(first.number, false); else $('#odet').replaceChildren(el('div', { class: 'odet-empty', text: 'Выберите заказ слева' }));
  }
}

function drawOrders(appeared = []) {
  const f = (FILTERS.find(x => x[0] === filter) || FILTERS[0])[2];
  const list = orders.filter(f);
  $('#orders').replaceChildren(...list.map(o => orderRow(o, appeared.includes(o.number))));
  const empty = $('#orders-empty');
  empty.hidden = list.length > 0;
  $('b', empty).textContent = orders.length ? 'Здесь пусто' : 'Заказов пока нет';
  $('span', empty).textContent = orders.length ? 'Выберите другой фильтр сверху.' : 'Как только покупатель оформит заказ на сайте, он появится здесь, а вкладка покажет счётчик.';
}

function orderRow(o, appeared) {
  const w = orderWhen(o);
  const names = bouquets(o).map(i => (i.qty > 1 ? `${i.title} × ${i.qty}` : i.title)).join(', ');
  return el('li', { class: `orow${o.status === 'new' ? ' is-new' : ''}${o.number === picked ? ' on' : ''}${appeared ? ' fresh' : ''}`, 'data-no': o.number }, [
    el('button', { type: 'button', class: 'orow-b', 'aria-current': o.number === picked ? 'true' : null, onclick: () => openOrder(o.number, true) }, [
      el('span', { class: 'orow-h' }, [el('b', { text: o.name || 'Покупатель' }), el('span', { class: 'no', text: `№${o.number}` })]),
      el('span', { class: 'orow-when', text: [w.day.split(',')[0], w.time].filter(Boolean).join(', ') || w.kind }),
      el('span', { class: 'orow-w', text: names || 'Без состава' }),
      el('span', { class: 'orow-r' }, [
        el('span', { class: `st ${o.status}`, text: STATUS[o.status] || o.status_title || o.status }),
        o.total ? el('span', { class: 'sum', text: money(o.total) }) : null,
        el('time', { datetime: o.created_at, text: ago(o.created_at) }),
      ]),
    ]),
  ]);
}

async function openOrder(number, user) {
  picked = number;
  $$('#orders .orow').forEach(li => {
    const on = li.dataset.no === String(number);
    li.classList.toggle('on', on);
    $('.orow-b', li).setAttribute('aria-current', on ? 'true' : 'false');
  });
  const box = $('#odet');
  const base = orders.find(o => o.number === number);
  if (user) {
    box.replaceChildren(detail(base || { number }, true));
    if (narrow.matches) { box.classList.add('open'); box.focus({ preventScroll: true }); }
  }
  let full;
  try { full = await owner.get(number); } catch (err) { if (err.status === 401) { expired(); return; } if (user) toast(err.message); return; }
  if (picked !== number) return;
  const note = $('.note-in', box);
  const draft = note && document.activeElement === note ? note.value : null;
  box.replaceChildren(detail(full, false));
  if (draft !== null) { const n = $('.note-in', box); n.value = draft; n.focus(); }
}

function closeDetail() {
  $('#odet').classList.remove('open');
  const li = $('#orders .orow.on .orow-b');
  if (li) li.focus({ preventScroll: true });
}

function detail(o, loading) {
  const w = orderWhen(o);
  const acts = (o.next_statuses || []).map(s => el('button', {
    type: 'button', class: `btn ${s === 'cancelled' ? 'btn-ghost' : 'btn-accent'}`,
    onclick: async e => {
      const b = e.currentTarget;
      b.disabled = true;
      try {
        const nv = await owner.setStatus(o.number, s);
        const k = orders.findIndex(x => x.number === o.number);
        if (k >= 0) orders[k] = Object.assign(orders[k], nv);
        toast(`Заказ №${o.number}: ${(STATUS[s] || s).toLowerCase()}`);
        drawFilters();
        drawOrders();
        $('#odet').replaceChildren(detail(nv, false));
        $('#newc').textContent = orders.filter(x => x.status === 'new').length;
        $('#newc').hidden = !orders.some(x => x.status === 'new');
      } catch (err) {
        if (err.status === 401) { expired(); return; }
        toast(err.message);
        b.disabled = false;
      }
    },
  }, [el('span', { text: ACTION[s] || STATUS[s] || s })]));
  const note = el('textarea', { class: 'in note-in', rows: '3', maxlength: '2000', placeholder: 'Например: оплатили переводом, курьер Азамат. Покупатель заметку не видит.', 'aria-label': 'Заметка к заказу' });
  note.value = o.note || '';
  const noteSt = el('span', { 'aria-live': 'polite' });
  let saved = o.note || '';
  note.addEventListener('blur', async () => {
    const v = note.value.trim();
    if (v === saved) return;
    noteSt.textContent = 'Сохраняем…';
    try {
      const nv = await owner.setNote(o.number, v);
      saved = nv.note || '';
      noteSt.textContent = 'Сохранено';
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      noteSt.textContent = err.message;
    }
  });
  const tel = o.phone ? `tel:${String(o.phone).replace(/[^\d+]/g, '')}` : null;
  const lines = (o.items || []).map(i => el('li', {}, [el('span', { text: i.qty > 1 ? `${i.title} × ${i.qty}` : i.title }), el('span', { text: i.price != null ? money(i.price * i.qty) : '' })]));
  if (o.total) lines.push(el('li', {}, [el('span', { text: 'Итого' }), el('span', { text: money(o.total) })]));
  const hist = (o.history || []).map(h => el('li', {}, [el('b', { text: STATUS[h.status] || h.status }), el('span', { text: `${h.actor === 'client' ? 'с сайта' : 'вы'}, ${when(h.at)}` })]));
  return el('div', { class: `od${loading ? ' loading' : ''}` }, [
    el('div', { class: 'od-top' }, [
      el('button', { type: 'button', class: 'od-back', 'aria-label': 'К списку заказов', onclick: closeDetail }, [icon('left'), el('span', { text: 'Заказы' })]),
      el('span', { text: `№${o.number}` }),
      o.status ? el('span', { class: `st ${o.status}`, text: STATUS[o.status] || o.status_title }) : null,
      o.created_at ? el('time', { datetime: o.created_at, title: when(o.created_at), text: ago(o.created_at) }) : null,
    ]),
    el('h2', { class: 'od-name', text: o.name || 'Покупатель' }),
    o.phone ? el('a', { class: 'od-tel', href: tel, translate: 'no', text: phoneText(o.phone) }) : null,
    o.phone ? el('div', { class: 'od-call' }, [
      el('a', { class: 'btn btn-line', href: tel }, [icon('phone'), el('span', { text: 'Позвонить' })]),
      el('a', { class: 'btn btn-line', href: waLink(o.phone, o), target: '_blank', rel: 'noopener' }, [icon('wa'), el('span', { text: 'WhatsApp' })]),
    ]) : null,
    w.day || w.time ? el('div', { class: 'od-when' }, [
      el('b', { text: [w.day, w.time].filter(Boolean).join(', ') }),
      el('span', { text: o.address ? `${w.kind}: ${o.address}` : w.kind }),
    ]) : null,
    lines.length ? el('ul', { class: 'od-items' }, lines) : null,
    w.card || w.comment ? el('dl', { class: 'od-facts' }, [
      w.card ? el('div', {}, [el('dt', { text: 'Текст открытки' }), el('dd', { class: 'od-card', text: w.card.replace(/ \/ /g, '\n') })]) : null,
      w.comment ? el('div', {}, [el('dt', { text: 'Комментарий' }), el('dd', { text: w.comment })]) : null,
    ]) : null,
    acts.length ? el('div', {}, [el('p', { class: 'od-k', text: 'Дальше' }), el('div', { class: 'od-act-row' }, acts)]) : null,
    loading ? null : el('div', {}, [el('p', { class: 'od-k' }, [el('span', { text: 'Заметка для себя' }), noteSt]), note]),
    hist.length ? el('div', {}, [el('p', { class: 'od-k', text: 'История' }), el('ol', { class: 'htl' }, hist)]) : null,
  ]);
}

function absUrl(u) {
  if (!u) return '';
  return /^(https?:|img\/|blob:|data:)/i.test(u) ? u : API + (u.startsWith('/') ? '' : '/') + u;
}

async function loadProducts() {
  if (!owner) return;
  try {
    products = await owner.products.list();
    productsOff = false;
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    if (err.status === 404) {
      productsOff = true;
      products = [];
    } else {
      toast(err.message);
      return;
    }
  }
  drawProducts();
}

function drawProducts() {
  const note = $('#pnote');
  note.hidden = !productsOff;
  note.textContent = productsOff ? 'Каталог на сервере ещё не включён. Пока на сайте показываются примерные букеты; после включения здесь можно будет добавлять свои.' : '';
  $('#padd').disabled = productsOff;
  const shown = products.filter(p => p.published).length;
  $('#pcount').textContent = products.length ? `${products.length} ${plural(products.length, 'букет', 'букета', 'букетов')}, на сайте ${shown}. Порядок здесь такой же, как на сайте.` : '';
  $('#pgrid').replaceChildren(...products.map((p, k) => productCard(p, k)));
  $('#p-empty').hidden = productsOff || products.length > 0;
}

async function patchProduct(p, data, okText) {
  try {
    const nv = await owner.products.update(p.id, data);
    Object.assign(p, nv);
    toast(okText);
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
  }
  drawProducts();
}

function switchEl(label, checked, onChange) {
  const input = el('input', { type: 'checkbox', checked });
  input.addEventListener('change', () => onChange(input.checked));
  return el('label', { class: 'sw' }, [input, el('span', { class: 'sw-t', 'aria-hidden': 'true' }), el('span', { text: label })]);
}

function productCard(p, k) {
  const ph = el('div', { class: 'pc-ph' }, [
    p.photo_url ? el('img', { src: absUrl(p.photo_url), alt: '', loading: 'lazy' }) : el('span', { class: 'noph', text: 'Без фото' }),
    el('span', { class: 'pc-no', text: String(k + 1) }),
    !p.published || !p.in_stock ? el('span', { class: 'pc-flag' }, [!p.published ? el('span', { text: 'Скрыт' }) : null, !p.in_stock ? el('span', { text: 'Нет в наличии' }) : null]) : null,
  ]);
  const li = el('li', { class: `pc${p.published ? '' : ' unpub'}`, 'data-id': p.id, draggable: 'true' }, [
    el('button', { type: 'button', class: 'pc-open', 'aria-label': `Изменить ${p.title}`, onclick: () => openEditor(p) }, [
      ph,
      el('div', { class: 'pc-b' }, [
        el('p', { class: 'pc-t', text: p.title }),
        el('p', { class: 'pc-m' }, [el('b', { text: money(p.price) }), p.old_price ? el('s', { text: money(p.old_price) }) : null, p.category ? el('span', { text: p.category }) : null]),
      ]),
    ]),
    el('div', { class: 'pc-sw' }, [
      switchEl('На сайте', p.published, v => patchProduct(p, { published: v }, v ? 'Букет показан на сайте' : 'Букет скрыт с сайта')),
      switchEl('В наличии', p.in_stock, v => patchProduct(p, { in_stock: v }, v ? 'Букет снова в наличии' : 'Отмечен «нет в наличии»')),
    ]),
    el('div', { class: 'pc-a' }, [
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Показывать раньше', title: 'Раньше', disabled: k === 0, onclick: () => moveTo(k, k - 1, true) }, [icon('left')]),
      el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Показывать позже', title: 'Позже', disabled: k === products.length - 1, onclick: () => moveTo(k, k + 1, true) }, [icon('right')]),
      el('span', { class: 'grip', title: 'Перетащите, чтобы поменять порядок', 'aria-hidden': 'true' }, [icon('grip')]),
    ]),
  ]);
  li.addEventListener('dragstart', e => { dragFrom = k; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(p.id)); } catch (err) { return; } });
  li.addEventListener('dragend', () => { li.classList.remove('drag'); $$('#pgrid .pc').forEach(x => x.classList.remove('over')); });
  li.addEventListener('dragover', e => { if (dragFrom === null) return; e.preventDefault(); li.classList.add('over'); });
  li.addEventListener('dragleave', () => li.classList.remove('over'));
  li.addEventListener('drop', e => { e.preventDefault(); const from = dragFrom; dragFrom = null; if (from !== null && from !== k) moveTo(from, k); });
  return li;
}

async function moveTo(from, to, focus) {
  if (to < 0 || to >= products.length) return;
  const before = products.slice();
  const [x] = products.splice(from, 1);
  products.splice(to, 0, x);
  drawProducts();
  const moved = $$('#pgrid .pc')[to];
  if (moved) moved.classList.add('moved');
  try {
    products = await owner.products.reorder(products.map(p => p.id));
    drawProducts();
    if (focus) {
      const card = $$('#pgrid .pc')[to];
      const btn = card && $$('.pc-a .icon-btn', card)[to < from ? 0 : 1];
      if (btn && !btn.disabled) btn.focus();
    }
    toast('Порядок сохранён');
  } catch (err) {
    products = before;
    drawProducts();
    if (err.status === 401) { expired(); return; }
    toast(err.message);
  }
}

function openSheet(d) {
  d.classList.remove('closing');
  d.showModal();
  document.documentElement.classList.add('locked');
}

function closeSheet(d) {
  if (!d.open || d.classList.contains('closing')) return;
  d.classList.add('closing');
  setTimeout(() => {
    d.classList.remove('closing');
    d.close();
    document.documentElement.classList.remove('locked');
  }, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 240);
}

function categoriesList() {
  const seen = [];
  products.forEach(p => { if (p.category && !seen.includes(p.category)) seen.push(p.category); });
  return seen;
}

function drawCatPills() {
  const input = $('#ed-cat');
  $('#ed-cats').replaceChildren(...categoriesList().map(c => el('button', {
    type: 'button', class: 'pill', role: 'radio', 'aria-checked': String(input.value.trim() === c),
    onclick: () => { input.value = c; drawCatPills(); },
  }, [el('span', { text: c })])));
}

function setPreview(src) {
  const img = $('#ed-prev');
  const drop = $('#drop');
  if (src) { img.src = src; img.hidden = false; } else { img.removeAttribute('src'); img.hidden = true; }
  drop.classList.toggle('has', Boolean(src));
  $('#drop-a').hidden = !src;
}

function openEditor(p) {
  editing = p || null;
  pendingPhoto = null;
  removePhoto = false;
  const f = $('#ed-f');
  f.reset();
  $$('[data-e]', f).forEach(x => { x.textContent = ''; });
  $$('.in', f).forEach(x => x.removeAttribute('aria-invalid'));
  $('#ed-e').textContent = '';
  $('#ed-h').textContent = p ? 'Букет' : 'Новый букет';
  f.elements.title.value = p ? p.title : '';
  f.elements.price.value = p ? p.price : '';
  f.elements.old_price.value = p && p.old_price ? p.old_price : '';
  f.elements.category.value = p ? p.category || '' : '';
  f.elements.description.value = p ? p.description || '' : '';
  f.elements.published.checked = p ? p.published : true;
  f.elements.in_stock.checked = p ? p.in_stock : true;
  setPreview(p && p.photo_url ? absUrl(p.photo_url) : '');
  $('#ed-del-w').replaceChildren($('#ed-del') || el('button', { type: 'button', class: 'btn btn-ghost', id: 'ed-del', text: 'Удалить' }));
  $('#ed-del').hidden = !p;
  drawCatPills();
  openSheet($('#editor'));
  $('#editor .sheet-in').scrollTop = 0;
  if (!p) setTimeout(() => f.elements.title.focus({ preventScroll: true }), 60);
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad')); };
    img.src = url;
  });
}

async function prepareImage(file) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw { message: 'Фото должно быть в формате JPG, PNG или WebP' };
  let loaded;
  try { loaded = await loadImage(file); } catch (e) { throw { message: 'Не получилось открыть фото, попробуйте другое' }; }
  const { img, url } = loaded;
  const scale = Math.min(1, PHOTO_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
  if (scale === 1 && file.size <= PHOTO_MAX && file.type !== 'image/png') return { file, url };
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', PHOTO_QUALITY));
  if (!blob) return { file, url };
  return { file: new File([blob], 'photo.jpg', { type: 'image/jpeg' }), url };
}

async function pickPhoto(file) {
  if (!file) return;
  $('#ed-e').textContent = '';
  try {
    const prepared = await prepareImage(file);
    if (prepared.file.size > PHOTO_MAX) throw { message: 'Фото больше 5 МБ даже после сжатия, выберите другое' };
    pendingPhoto = prepared.file;
    removePhoto = false;
    setPreview(prepared.url);
  } catch (err) {
    $('#ed-e').textContent = err.message;
  }
}

function fieldErrors(fields) {
  const f = $('#ed-f');
  Object.entries(fields || {}).forEach(([k, v]) => {
    const box = $(`[data-e="${k}"]`, f);
    if (box) box.textContent = v; else $('#ed-e').textContent = v;
    if (f.elements[k]) f.elements[k].setAttribute('aria-invalid', 'true');
  });
  const first = Object.keys(fields || {})[0];
  if (first && f.elements[first]) f.elements[first].focus();
}

function readPrice(v) {
  const d = String(v || '').replace(/[\s ]/g, '');
  return d === '' ? null : /^\d+$/.test(d) ? Number(d) : NaN;
}

async function saveEditor(e) {
  e.preventDefault();
  const f = e.currentTarget;
  $$('[data-e]', f).forEach(x => { x.textContent = ''; });
  $$('.in', f).forEach(x => x.removeAttribute('aria-invalid'));
  $('#ed-e').textContent = '';
  const errs = {};
  const title = f.elements.title.value.trim();
  const price = readPrice(f.elements.price.value);
  const old = readPrice(f.elements.old_price.value);
  if (!title) errs.title = 'Как называется букет?';
  if (!price || Number.isNaN(price)) errs.price = 'Цена целым числом, например 3500';
  if (Number.isNaN(old)) errs.old_price = 'Только цифры';
  else if (old !== null && price && old <= price) errs.old_price = 'Старая цена должна быть больше новой';
  if (Object.keys(errs).length) { fieldErrors(errs); return; }
  const data = {
    title, price, old_price: old, category: f.elements.category.value.trim(),
    description: f.elements.description.value.trim(), published: f.elements.published.checked, in_stock: f.elements.in_stock.checked,
  };
  const btn = $('#ed-save');
  btn.disabled = true;
  btn.textContent = 'Сохраняем…';
  try {
    let saved = editing ? await owner.products.update(editing.id, data) : await owner.products.create(data);
    if (removePhoto && !pendingPhoto && saved.photo_url) saved = await owner.products.removePhoto(saved.id);
    if (pendingPhoto) {
      $('#drop').classList.add('busy');
      try {
        saved = await owner.products.uploadPhoto(saved.id, pendingPhoto);
      } catch (err) {
        if (err.status === 401) { expired(); return; }
        $('#drop').classList.remove('busy');
        upsert(saved);
        editing = saved;
        $('#ed-del').hidden = false;
        $('#ed-e').textContent = `Букет сохранён, но фото не загрузилось: ${err.message}`;
        return;
      }
    }
    upsert(saved);
    closeSheet($('#editor'));
    toast(editing ? 'Букет сохранён' : 'Букет добавлен на сайт');
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    if (err.fields) fieldErrors(err.fields); else $('#ed-e').textContent = err.message;
  } finally {
    $('#drop').classList.remove('busy');
    btn.disabled = false;
    btn.textContent = 'Сохранить';
  }
}

function upsert(p) {
  const k = products.findIndex(x => x.id === p.id);
  if (k >= 0) products[k] = p; else products.push(p);
  drawProducts();
}

function confirmDelete() {
  const wrap = $('#ed-del-w');
  const yes = el('button', { type: 'button', class: 'btn btn-danger', text: 'Да, удалить' });
  const no = el('button', { type: 'button', class: 'btn btn-ghost', text: 'Нет' });
  const box = el('span', { class: 'confirm', role: 'group', 'aria-label': 'Подтвердите удаление' }, [el('span', { text: 'Удалить?' }), yes, no]);
  const del = $('#ed-del');
  wrap.replaceChildren(box);
  no.focus();
  no.addEventListener('click', () => { wrap.replaceChildren(del); del.focus(); });
  yes.addEventListener('click', async () => {
    yes.disabled = true;
    try {
      await owner.products.remove(editing.id);
      products = products.filter(x => x.id !== editing.id);
      drawProducts();
      closeSheet($('#editor'));
      toast('Букет удалён');
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      toast(err.message);
      yes.disabled = false;
    }
  });
}

function editorUi() {
  const d = $('#editor');
  d.addEventListener('cancel', e => { e.preventDefault(); closeSheet(d); });
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) closeSheet(d); });
  $('#padd').addEventListener('click', () => openEditor(null));
  $('#ed-f').addEventListener('submit', saveEditor);
  $('#ed-file').addEventListener('change', e => { pickPhoto(e.target.files[0]); e.target.value = ''; });
  $('#ed-file2').addEventListener('change', e => { pickPhoto(e.target.files[0]); e.target.value = ''; });
  $('#ed-rmph').addEventListener('click', () => { pendingPhoto = null; removePhoto = true; setPreview(''); });
  $('#ed-del-w').addEventListener('click', e => { if (e.target.id === 'ed-del') confirmDelete(); });
  $('#ed-cat').addEventListener('input', drawCatPills);
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); pickPhoto(e.dataTransfer.files[0]); });
  ['price', 'old_price'].forEach(k => $('#ed-f').elements[k].addEventListener('input', e => { e.target.value = e.target.value.replace(/[^\d\s]/g, ''); }));
}

function mockOwner() {
  const S = window.SHOP || { items: [] };
  const now = Date.now();
  const iso = m => new Date(now - m * 60000).toISOString().replace(/\.\d+Z$/, 'Z');
  const local = d => new Date(now + d * 86400000).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long', timeZone: 'Asia/Bishkek' }).replace(/^(\S+), (.+)$/, '$2, $1');
  const byTitle = t => S.items.find(i => i.title === t) || { price: 3500 };
  const order = (number, status, name, phone, lines, delivery, address, day, time, card, comment, minutesAgo) => {
    const items = lines.map(([t, q]) => ({ title: t, qty: q, price: byTitle(t).price, sku: String(byTitle(t).id || '') }));
    if (delivery === 'delivery' && items.reduce((s, i) => s + i.price * i.qty, 0) < S.free_from) items.push({ title: 'Доставка по Бишкеку', qty: 1, price: S.delivery, sku: 'delivery' });
    const total = items.reduce((s, i) => s + i.price * i.qty, 0);
    const history = [{ status: 'new', actor: 'client', at: iso(minutesAgo) }];
    if (status !== 'new') history.push({ status: status === 'done' ? 'accepted' : status, actor: 'owner', at: iso(minutesAgo - 8) });
    if (status === 'done') history.push({ status: 'done', actor: 'owner', at: iso(minutesAgo - 140) });
    return {
      number: String(number).padStart(4, '0'), kind: 'order', status, name, phone, items, total, delivery, address,
      comment: [`${delivery === 'delivery' ? 'Доставка' : 'Самовывоз'}: ${local(day)}`, `Время: ${time}`, card ? `Открытка: ${card}` : '', comment ? `Комментарий: ${comment}` : ''].filter(Boolean).join('\n'),
      note: '', created_at: iso(minutesAgo), updated_at: iso(minutesAgo), history,
    };
  };
  const orderList = [
    order(18, 'new', 'Айпери', '+996555123456', [['Облако', 1]], 'delivery', 'Бишкек, Токтогула 112, кв. 14', 0, '15:00-18:00', 'С днём рождения, мама! Ты самая лучшая', 'Позвонить получателю: 0700 11 22 33', 4),
    order(17, 'new', 'Тимур', '+996700556677', [['51 красная роза', 1]], 'delivery', 'Бишкек, Ахунбаева 98, офис 302', 0, '18:00-21:00', 'Выйдешь за меня?', '', 26),
    order(16, 'accepted', 'Мээрим', '+996777889900', [['Персиковый сад', 1], ['Лимонный', 1]], 'pickup', null, 0, '12:00-15:00', '', 'Оплачу переводом', 95),
    order(15, 'ready', 'Нурлан', '+996550443322', [['Первое свидание', 1]], 'delivery', 'Бишкек, Исанова 79', 0, '12:00-15:00', 'Спасибо за всё', '', 180),
    order(14, 'done', 'Алина', '+996705334455', [['Тюльпаны в крафте', 2]], 'pickup', null, -1, '09:00-12:00', '', '', 1500),
    order(13, 'cancelled', 'Эрлан', '+996555667788', [['Жемчуг', 1]], 'delivery', 'Бишкек, мкр. Джал 23', -1, '15:00-18:00', '', 'Передумали', 1700),
  ];
  const next = { new: ['accepted', 'cancelled'], accepted: ['ready', 'cancelled'], ready: ['done', 'cancelled'] };
  const view = o => Object.assign({}, o, { next_statuses: next[o.status] || [], status_title: STATUS[o.status] });
  let seq = 100;
  let list = S.items.map((i, k) => ({
    id: k + 1, title: i.title, price: i.price, old_price: i.old_price, category: i.category, description: i.description,
    photo_url: i.photo ? `img/${i.photo}-640.webp` : null, in_stock: i.in_stock, published: true, position: k + 1,
    created_at: iso(5000), updated_at: iso(5000),
  }));
  const ok = v => new Promise(r => setTimeout(() => r(JSON.parse(JSON.stringify(v))), 120));
  const find = id => { const p = list.find(x => x.id === Number(id)); if (!p) throw { status: 404, message: 'Букет не найден' }; return p; };
  const check = data => {
    const fields = {};
    if ('title' in data && !String(data.title || '').trim()) fields.title = 'Заполните название';
    if ('price' in data && !(Number.isInteger(data.price) && data.price > 0)) fields.price = 'Цена: целое число сом больше 0';
    if (Object.keys(fields).length) throw { status: 422, message: 'Проверьте поля товара', fields };
  };
  return {
    list: () => ok({ items: orderList.map(view), total: orderList.length }),
    get: n => ok(view(orderList.find(o => o.number === n))),
    setStatus: (n, s) => { const o = orderList.find(x => x.number === n); o.status = s; o.history.push({ status: s, actor: 'owner', at: new Date().toISOString() }); return ok(view(o)); },
    setNote: (n, note) => { const o = orderList.find(x => x.number === n); o.note = note; return ok(view(o)); },
    watch: () => () => {},
    products: {
      list: () => ok(list),
      create: data => { check(data); const p = Object.assign({ id: ++seq, photo_url: null, position: list.length + 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, data); list.push(p); return ok(p); },
      update: (id, data) => { check(data); const p = find(id); Object.assign(p, data); return ok(p); },
      remove: id => { list = list.filter(x => x.id !== Number(id)); return ok({}); },
      reorder: ids => { list = ids.map(id => find(id)); list.forEach((p, k) => { p.position = k + 1; }); return ok(list); },
      uploadPhoto: (id, file) => { const p = find(id); p.photo_url = URL.createObjectURL(file); return ok(p); },
      removePhoto: id => { const p = find(id); p.photo_url = null; return ok(p); },
    },
  };
}

authUi();
tabs();
editorUi();
$('#odet').addEventListener('keydown', e => { if (e.key === 'Escape' && $('#odet').classList.contains('open')) closeDetail(); });
narrow.addEventListener('change', () => { if (!narrow.matches) closeDetail(); });
setInterval(() => { $$('#orders time, #odet .od-top time').forEach(t => { const v = ago(t.getAttribute('datetime')); if (v && t.textContent !== v) t.textContent = v; }); }, 30000);
if (DEMO) enterPanel(); else start();
