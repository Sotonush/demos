const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = (document.body.dataset.api || '').replace(/\/+$/, '');
const KEY = 'elektrik-owner-session';
const DRAFT = 'elektrik-owner-draft';
const NET = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
const PLATFORM = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', file: 'Файл .mp4' };
const STATUS = { new: 'Новая', accepted: 'Принята', ready: 'Готова', done: 'Выполнена', cancelled: 'Отменена', confirmed: 'Подтверждена', no_show: 'Не пришёл' };
const ACTION = { accepted: 'Принять', ready: 'Готово', done: 'Выполнено', cancelled: 'Отменить', confirmed: 'Подтвердить', no_show: 'Не пришёл' };
const SCREENS = ['s-login', 's-setup', 's-totp', 's-codes', 'app'];

let owner = null;
let stopWatch = null;
let videos = [];
let session = '';
let challenge = '';
let recoveryMode = false;
let pendingCodes = null;
let pollTimer = null;
const FILE_MAX = 100 * 1024 * 1024;

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

let toastTimer = null;
function toast(text) {
  const s = $('#astatus');
  s.textContent = text;
  s.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => s.classList.remove('on'), 2600);
}

function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' }).format(d);
}

function phoneText(p) {
  const d = String(p || '').replace(/\D/g, '');
  return d.length === 12 ? `+${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}` : p;
}

function minutes(sec) {
  const m = Math.max(1, Math.ceil(sec / 60));
  const w = m % 10 === 1 && m % 100 !== 11 ? 'минуту' : m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 12 || m % 100 > 14) ? 'минуты' : 'минут';
  return `${m} ${w}`;
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
  document.body.classList.toggle('in-app', id === 'app');
  $('#logout').hidden = id !== 'app';
  const sec = $(`#${id}`);
  const f = $('input:not([type=checkbox]):not([hidden])', sec);
  if (id !== 'app') (f && !f.value ? f : sec).focus();
}

function saveDraft() {
  const d = { vurl: ($('#vurl') || {}).value || '', titles: {} };
  $$('#vlist .vi').forEach(li => {
    const inp = $('.vt-in', li);
    const v = videos.find(x => String(x.id) === li.dataset.id);
    if (inp && v && inp.value.trim() !== (v.title || '')) d.titles[li.dataset.id] = inp.value;
  });
  try { sessionStorage.setItem(DRAFT, JSON.stringify(d)); } catch (e) { return; }
}

function takeDraft() {
  try {
    const d = JSON.parse(sessionStorage.getItem(DRAFT) || 'null');
    sessionStorage.removeItem(DRAFT);
    return d;
  } catch (e) {
    return null;
  }
}

function stopPanel() {
  if (stopWatch) { stopWatch(); stopWatch = null; }
  owner = null;
}

function showLogin(message) {
  if (owner) saveDraft();
  stopPanel();
  session = '';
  store(KEY, '');
  $('#login-note').textContent = message || 'Почта и пароль владельца сайта.';
  $('#login-note').classList.toggle('warn', Boolean(message));
  $('#pass').value = '';
  show('s-login');
}

function setRecovery(on) {
  recoveryMode = on;
  const c = $('#code');
  c.value = '';
  c.maxLength = on ? 9 : 6;
  c.inputMode = on ? 'text' : 'numeric';
  c.autocomplete = on ? 'off' : 'one-time-code';
  c.placeholder = on ? 'xxxx-xxxx' : '000000';
  c.classList.toggle('rc', on);
  $('#code-l').textContent = on ? 'Резервный код' : 'Код из приложения';
  $('#totp-h').textContent = on ? 'Резервный код' : 'Код из приложения';
  $('#totp-note').textContent = on ? 'Введите один из резервных кодов, которые вы сохранили при подключении. Каждый срабатывает один раз.' : 'Откройте Google Authenticator и введите 6 цифр для Электрик.Kg.';
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
  if (!window.LeadsClient || !API) { showLogin('Сервис заявок недоступен.'); return; }
  try {
    const me = await auth('GET', '/api/owner/auth/me');
    $('#who').textContent = me.email ? `Вы вошли как ${me.email}` : '';
    $('#who-side').textContent = me.email || '';
  } catch (err) {
    if (err.status === 401) { showLogin(''); return; }
  }
  owner = window.LeadsClient.owner({ api: API, token: session });
  show('app');
  const draft = takeDraft();
  if (draft && draft.vurl) $('#vurl').value = draft.vurl;
  loadOrders();
  loadVideos(draft && draft.titles);
  stopWatch = owner.watch(() => loadOrders(true), err => { if (err.status === 401) expired(); });
}

function expired() {
  showLogin('Сессия закончилась. Войдите снова, введённое не потеряется.');
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
    if (input === $('#code') && recoveryMode) {
      const v = input.value.replace(/[^0-9a-z]/gi, '').toLowerCase().slice(0, 8);
      input.value = v.length > 4 ? `${v.slice(0, 4)}-${v.slice(4)}` : v;
      return;
    }
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    if (input.value.length === 6 && onFull) onFull();
  });
}

function authUi() {
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
    if (!email || !/.+@.+\..+/.test(email)) { er.textContent = 'Введите почту, например owner@mail.kg'; $('#email').focus(); return; }
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
  const out = async () => {
    try { await auth('POST', '/api/owner/auth/logout'); } catch (e) { session = ''; }
    stopPanel();
    session = '';
    store(KEY, '');
    $('#email').value = '';
    showLogin('Вы вышли из кабинета.');
  };
  $('#logout').addEventListener('click', out);
  $('#logout2').addEventListener('click', out);
  $('#logout-all').addEventListener('click', async () => {
    try {
      await auth('POST', '/api/owner/auth/logout-all');
    } catch (err) {
      if (err.status !== 401) { toast(err.message); return; }
    }
    stopPanel();
    session = '';
    store(KEY, '');
    showLogin('Кабинет закрыт на всех устройствах.');
  });
  $('#pw-f').addEventListener('submit', async e => {
    e.preventDefault();
    const cur = $('#pw-cur').value;
    const nw = $('#pw-new').value;
    const er = $('#pw-e');
    er.textContent = '';
    if (!cur) { er.textContent = 'Введите текущий пароль'; $('#pw-cur').focus(); return; }
    if (nw.length < 10) { er.textContent = 'Новый пароль не короче 10 символов'; $('#pw-new').focus(); return; }
    try {
      const res = await auth('POST', '/api/owner/auth/password', { current: cur, new: nw });
      if (res && res.token) { session = res.token; store(KEY, session); owner = window.LeadsClient.owner({ api: API, token: session }); }
      $('#pw-cur').value = '';
      $('#pw-new').value = '';
      toast('Пароль изменён');
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      er.textContent = (err.fields && Object.values(err.fields)[0]) || err.message;
    }
  });
  otpInput($('#rc-code'));
  $('#rc-f').addEventListener('submit', async e => {
    e.preventDefault();
    const er = $('#rc-e');
    er.textContent = '';
    const password = $('#rc-pass').value;
    const code = $('#rc-code').value.trim();
    if (!password) { er.textContent = 'Введите пароль'; $('#rc-pass').focus(); return; }
    if (code.length !== 6) { er.textContent = 'Нужно 6 цифр из приложения'; $('#rc-code').focus(); return; }
    try {
      const res = await auth('POST', '/api/owner/auth/2fa/regenerate-recovery', { password, code });
      $('#rc-list').replaceChildren(...(res.recovery_codes || []).map(c => el('li', { text: c })));
      $('#rc-out').hidden = false;
      $('#rc-pass').value = '';
      $('#rc-code').value = '';
      toast('Новые коды готовы, старые больше не работают');
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      er.textContent = (err.fields && Object.values(err.fields)[0]) || err.message;
    }
  });
  $('#rc-copy').addEventListener('click', () => copy($$('#rc-list li').map(l => l.textContent).join('\n'), 'Коды скопированы'));
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
}

let knownOrders = new Set();
let orders = [];
let filter = 'all';
let picked = '';
let lastNew = -1;
let soundOn = store('elektrik-owner-sound') === '1';
let loadedOnce = false;
const FILTERS = [
  ['all', 'Все', () => true],
  ['new', 'Новые', o => o.status === 'new'],
  ['work', 'В работе', o => ['accepted', 'ready', 'confirmed'].includes(o.status)],
  ['done', 'Выполнены', o => o.status === 'done'],
  ['off', 'Отменены', o => ['cancelled', 'no_show'].includes(o.status)],
];
const ORDER_T = { new: 'Новый', accepted: 'Принят', ready: 'Готов', done: 'Выполнен', cancelled: 'Отменён' };
const NEXT_HINT = { accepted: 'Мастер взял заявку', ready: 'Машина готова', done: 'Работа закрыта', cancelled: 'Заявка снята', confirmed: 'Запись подтверждена', no_show: 'Клиент не приехал' };
const narrow = matchMedia('(max-width: 900px)');

function ago(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'только что';
  const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c);
  if (s < 3600) { const m = Math.floor(s / 60); return `${m} ${plural(m, 'минуту', 'минуты', 'минут')} назад`; }
  if (s < 86400) { const h = Math.floor(s / 3600); return `${h} ${plural(h, 'час', 'часа', 'часов')} назад`; }
  return when(iso);
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

function initials(name) {
  const w = String(name || 'К').trim().split(/\s+/).filter(Boolean);
  return ((w[0] || 'К')[0] + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}

function waLink(phone, o) {
  const d = String(phone || '').replace(/\D/g, '');
  const text = `Здравствуйте${o && o.name && o.name !== 'Клиент' ? `, ${o.name}` : ''}! Это Электрик.Kg по вашей заявке №${o ? o.number : ''}.`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

function beep() {
  if (!soundOn) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1320].forEach((f, k) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.type = 'sine';
      g.gain.setValueAtTime(0.0001, ctx.currentTime + k * 0.16);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + k * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + k * 0.16 + 0.22);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + k * 0.16);
      o.stop(ctx.currentTime + k * 0.16 + 0.25);
    });
  } catch (e) { return; }
}

function soundUi() {
  const b = $('#snd');
  const draw = () => { b.setAttribute('aria-pressed', String(soundOn)); b.title = soundOn ? 'Звук новых заявок включён' : 'Звук новых заявок выключен'; };
  b.addEventListener('click', () => { soundOn = !soundOn; store('elektrik-owner-sound', soundOn ? '1' : ''); draw(); if (soundOn) beep(); });
  draw();
}

async function loadSummary() {
  if (!owner) return;
  let s;
  try { s = await owner.summary(); } catch (err) { if (err.status === 401) expired(); return; }
  const b = s.by_status || {};
  const tiles = [
    ['new', 'Новые', b.new || 0],
    ['work', 'В работе', (b.accepted || 0) + (b.ready || 0) + (b.confirmed || 0)],
    ['done', 'Выполнены', b.done || 0],
    ['off', 'Отменены', (b.cancelled || 0) + (b.no_show || 0)],
  ];
  $('#sum').replaceChildren(...tiles.map(([k, t, n]) => el('button', { type: 'button', class: `tile t-${k}`, 'aria-pressed': String(filter === k), onclick: () => setFilter(filter === k ? 'all' : k) }, [
    el('b', { text: String(n) }), el('span', { text: t }),
  ])));
}

function setFilter(k) {
  filter = k;
  drawFilters();
  drawOrders();
  $$('#sum .tile').forEach(t => t.setAttribute('aria-pressed', String(t.classList.contains(`t-${k}`))));
}

function drawFilters() {
  $('#ofilter').replaceChildren(...FILTERS.map(([k, t, f]) => {
    const n = orders.filter(f).length;
    return el('button', { type: 'button', class: 'chip', 'aria-pressed': String(filter === k), onclick: () => setFilter(k) }, [
      el('span', { text: t }), el('small', { text: String(n) }),
    ]);
  }));
}

function skeleton() {
  $('#orders').replaceChildren(...[0, 1, 2, 3].map(() => el('li', { class: 'orow sk', 'aria-hidden': 'true' }, [el('span', { class: 'sk-a' }), el('span', { class: 'sk-l' }), el('span', { class: 'sk-l s' })])));
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
  const items = data.items || [];
  const appeared = fresh ? items.filter(o => !knownOrders.has(o.number)).map(o => o.number) : [];
  orders = items;
  knownOrders = new Set(items.map(o => o.number));
  const nc = data.new_count || 0;
  $('#newc').hidden = !nc;
  $('#newc').textContent = nc;
  document.title = `${nc ? `(${nc}) ` : ''}Заявки | Электрик.Kg`;
  if (lastNew >= 0 && nc > lastNew) beep();
  lastNew = nc;
  drawFilters();
  drawOrders(appeared);
  loadSummary();
  if (picked && orders.some(o => o.number === picked)) openOrder(picked, false);
  else if (!picked && orders.length && !narrow.matches) openOrder(orders[0].number, false);
}

function drawOrders(appeared = []) {
  const f = (FILTERS.find(x => x[0] === filter) || FILTERS[0])[2];
  const list = orders.filter(f);
  const ul = $('#orders');
  ul.replaceChildren(...list.map(o => orderRow(o, appeared.includes(o.number))));
  const empty = $('#orders-empty');
  empty.hidden = list.length > 0;
  $('b', empty).textContent = orders.length ? 'В этом списке пусто' : 'Заявок пока нет';
  $('span', empty).textContent = orders.length ? 'Выберите другой фильтр сверху.' : 'Как только клиент отправит заявку с сайта, она появится здесь, а вкладка покажет счётчик.';
}

function orderRow(o, appeared) {
  const c = parseComment(o.comment);
  const what = (c.rows.find(r => /случил/i.test(r[0])) || [])[1] || (o.items || []).map(i => i.title).join(', ');
  const car = (c.rows.find(r => /авто|машин/i.test(r[0]) && !/стоит/i.test(r[0])) || [])[1] || '';
  const li = el('li', { class: `orow${o.status === 'new' ? ' is-new' : ''}${o.number === picked ? ' on' : ''}` }, [
    el('button', { type: 'button', class: 'orow-b', 'aria-current': o.number === picked ? 'true' : null, onclick: () => openOrder(o.number, true) }, [
      el('span', { class: 'av', 'aria-hidden': 'true', text: initials(o.name) }),
      el('span', { class: 'orow-t' }, [
        el('span', { class: 'orow-h' }, [el('b', { text: o.name || 'Клиент' }), el('span', { class: 'no', text: `№${o.number}` })]),
        el('span', { class: 'orow-w', text: [what, car].filter(Boolean).join(' · ') || 'Без описания' }),
      ]),
      el('span', { class: 'orow-r' }, [
        el('span', { class: `st ${o.status}`, text: o.status_title || STATUS[o.status] || o.status }),
        el('time', { datetime: o.created_at, text: ago(o.created_at) }),
      ]),
    ]),
  ]);
  if (appeared) li.classList.add('fresh');
  return li;
}

async function openOrder(number, user) {
  picked = number;
  $$('#orders .orow').forEach(li => {
    const on = $('.no', li) && $('.no', li).textContent === `№${number}`;
    li.classList.toggle('on', on);
    $('.orow-b', li).setAttribute('aria-current', on ? 'true' : 'false');
  });
  const box = $('#odet');
  const base = orders.find(o => o.number === number);
  if (user) {
    box.replaceChildren(detail(base || { number }, true));
    if (narrow.matches) { box.classList.add('open'); document.body.classList.add('det-open'); box.focus({ preventScroll: true }); }
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
  const box = $('#odet');
  box.classList.remove('open');
  document.body.classList.remove('det-open');
  const li = $('#orders .orow.on .orow-b');
  if (li) li.focus({ preventScroll: true });
}

function detail(o, loading) {
  const c = parseComment(o.comment);
  const acts = (o.next_statuses || []).map(s => el('button', {
    type: 'button', class: `btn ${s === 'cancelled' || s === 'no_show' ? 'ghost' : 'send'} act`,
    onclick: async e => {
      const b = e.currentTarget;
      b.disabled = true;
      b.setAttribute('aria-busy', 'true');
      try {
        const nv = await owner.setStatus(o.number, s);
        Object.assign(o, nv);
        const k = orders.findIndex(x => x.number === o.number);
        if (k >= 0) orders[k] = Object.assign(orders[k], nv);
        toast(`Заявка №${o.number}: ${(nv.status_title || STATUS[s] || s).toLowerCase()}`);
        drawFilters();
        drawOrders();
        loadSummary();
        $('#odet').replaceChildren(detail(nv, false));
        if (!narrow.matches) $$('#orders .orow').forEach(li => li.classList.toggle('on', $('.no', li).textContent === `№${o.number}`));
      } catch (err) {
        if (err.status === 401) { expired(); return; }
        toast(err.message);
        b.disabled = false;
        b.removeAttribute('aria-busy');
      }
    },
  }, [el('span', { text: ACTION[s] || STATUS[s] || s })]));
  const hist = (o.history || []).map(h => el('li', { class: `htl-i ${h.status}` }, [
    el('b', { text: (o.kind === 'booking' ? STATUS[h.status] : ORDER_T[h.status]) || STATUS[h.status] || h.status }),
    el('span', { text: `${h.actor === 'client' ? 'клиент с сайта' : 'вы'}, ${when(h.at)}` }),
  ]));
  const note = el('textarea', { class: 'note-in', rows: '3', maxlength: '2000', placeholder: 'Например: перезвонил, едет к 18:00. Клиент заметку не видит.', 'aria-label': 'Заметка к заявке' });
  note.value = o.note || '';
  const noteSt = el('span', { class: 'note-st', 'aria-live': 'polite' });
  let saved = o.note || '';
  const saveNote = async () => {
    const v = note.value.trim();
    if (v === saved) return;
    noteSt.textContent = 'Сохраняем…';
    try {
      const nv = await owner.setNote(o.number, v);
      saved = nv.note || '';
      o.note = saved;
      noteSt.textContent = 'Сохранено';
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      noteSt.textContent = err.message;
    }
  };
  note.addEventListener('blur', saveNote);
  note.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); note.blur(); } });
  const tel = o.phone ? `tel:${String(o.phone).replace(/[^\d+]/g, '')}` : null;
  const facts = [...c.rows];
  const items = (o.items || []).map(i => i.title).filter(Boolean);
  if (items.length && !facts.some(r => /случил/i.test(r[0]))) facts.unshift(['Услуги', items.join(', ')]);
  if (o.address) facts.push(['Адрес', o.address]);
  return el('div', { class: `od${loading ? ' loading' : ''}` }, [
    el('div', { class: 'od-top' }, [
      el('button', { type: 'button', class: 'od-back', 'aria-label': 'К списку заявок', onclick: closeDetail }, [icon('left'), el('span', { text: 'Заявки' })]),
      el('span', { class: 'no', text: `№${o.number}` }),
      o.status ? el('span', { class: `st ${o.status}`, text: o.status_title || STATUS[o.status] }) : null,
      o.created_at ? el('time', { datetime: o.created_at, title: when(o.created_at), text: ago(o.created_at) }) : null,
    ]),
    el('h2', { class: 'od-name', text: o.name || 'Клиент' }),
    o.phone ? el('a', { class: 'od-tel', href: tel, translate: 'no', text: phoneText(o.phone) }) : el('span', { class: 'sk-l' }),
    el('div', { class: 'od-call' }, [
      el('a', { class: 'btn call', href: tel || '#' }, [icon('phone'), el('span', { text: 'Позвонить' })]),
      el('a', { class: 'btn wa', href: waLink(o.phone, o), target: '_blank', rel: 'noopener' }, [icon('wa'), el('span', { text: 'WhatsApp' })]),
    ]),
    facts.length || c.rest ? el('dl', { class: 'od-facts' }, [
      ...facts.map(([k, v]) => el('div', {}, [el('dt', { text: k }), el('dd', { text: v })])),
      c.rest ? el('div', {}, [el('dt', { text: 'Комментарий' }), el('dd', { text: c.rest })]) : null,
    ]) : null,
    acts.length ? el('div', { class: 'od-acts' }, [el('p', { class: 'od-k', text: 'Дальше' }), el('div', { class: 'od-act-row' }, acts)]) : null,
    el('div', { class: 'od-note' }, [el('p', { class: 'od-k' }, [el('span', { text: 'Заметка для себя' }), noteSt]), note]),
    hist.length ? el('div', { class: 'od-hist' }, [el('p', { class: 'od-k', text: 'История' }), el('ol', { class: 'htl' }, hist)]) : null,
    el('div', { class: 'od-dock' }, [
      el('a', { class: 'btn call', href: tel || '#', 'aria-label': 'Позвонить' }, [icon('phone')]),
      el('a', { class: 'btn wa', href: waLink(o.phone, o), target: '_blank', rel: 'noopener', 'aria-label': 'WhatsApp' }, [icon('wa')]),
      acts[0] ? (() => { const b = acts[0].cloneNode(true); b.addEventListener('click', () => acts[0].click()); return b; })() : null,
    ]),
  ]);
}

setInterval(() => { $$('#orders time, #odet .od-top time').forEach(t => { const v = ago(t.getAttribute('datetime')); if (v && t.textContent !== v) t.textContent = v; }); }, 30000);

function absUrl(u) {
  if (!u) return '';
  return /^https?:/i.test(u) ? u : API + (u.startsWith('/') ? '' : '/') + u;
}

function thumb(v) {
  const poster = absUrl(v.poster_url) || (v.platform === 'youtube' && v.embed_id ? `https://img.youtube.com/vi/${v.embed_id}/hqdefault.jpg` : '');
  const box = el('span', { class: `vi-ph${v.orientation === 'horizontal' ? ' hor' : ''}` });
  if (v.video_file_url) {
    const vid = el('video', { src: absUrl(v.video_file_url), poster: poster || null, preload: 'metadata', playsinline: true, 'aria-hidden': 'true' });
    vid.muted = true;
    box.append(vid);
  } else if (poster) box.append(el('img', { src: poster, alt: '', loading: 'lazy' }));
  else box.append(el('span', { class: 'vph' }, [el('span', { class: 'vph-top' }, [icon(v.platform === 'instagram' ? 'instagram' : v.platform === 'tiktok' ? 'tiktok' : 'film'), el('span', { text: PLATFORM[v.platform] || 'Видео' })]), icon('mark'), el('b', { text: v.title || 'Без подписи' })]));
  return box;
}

async function loadVideos(drafts) {
  if (!owner) return;
  try {
    videos = await owner.videos.list();
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
    return;
  }
  drawVideos();
  if (drafts) Object.entries(drafts).forEach(([id, t]) => { const li = $(`#vlist .vi[data-id="${id}"]`); if (li) $('.vt-in', li).value = t; });
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!videos.some(v => v.fetch_status === 'pending')) return;
  pollTimer = setTimeout(() => {
    const drafts = {};
    $$('#vlist .vi').forEach(li => { const inp = $('.vt-in', li); if (inp && document.activeElement === inp) drafts[li.dataset.id] = inp.value; });
    if (Object.keys(drafts).length) { schedulePoll(); return; }
    loadVideos();
  }, 3000);
}

function uploadFile(v, f, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API}/api/owner/videos/${encodeURIComponent(v.id)}/file`);
    if (session) xhr.setRequestHeader('Authorization', `Bearer ${session}`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch (e) { data = null; }
      if (xhr.status >= 200 && xhr.status < 300) resolve(data || {});
      else reject({ status: xhr.status, message: (data && data.error) || (xhr.status === 413 ? 'Файл слишком большой, нужно до 100 МБ' : 'Не удалось загрузить файл') });
    };
    xhr.onerror = () => reject({ status: 0, message: NET });
    const form = new FormData();
    form.append('file', f, f.name || 'video.mp4');
    xhr.send(form);
  });
}

function fileBlock(v) {
  const wrap = el('div', { class: 'vf' });
  const bar = el('span', { class: 'vf-bar' }, [el('i')]);
  const input = el('input', { type: 'file', accept: 'video/mp4,video/webm,video/quicktime', 'aria-label': 'Прикрепить видео-файл' });
  const pick = el('span', { class: 'btn ghost filebtn' }, [input, el('span', { text: v.video_file_url ? 'Заменить файл' : 'Прикрепить файл' })]);
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    if (f.size > FILE_MAX) { toast('Файл больше 100 МБ. Сожмите ролик или обрежьте его.'); input.value = ''; return; }
    wrap.classList.add('up');
    const fill = $('i', bar);
    try {
      const nv = await uploadFile(v, f, k => { fill.style.width = `${Math.round(k * 100)}%`; });
      Object.assign(v, nv);
      toast('Ролик загружен');
      drawVideos();
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      toast(err.message);
      wrap.classList.remove('up');
    }
  });
  const status = v.fetch_status || 'none';
  const parts = [];
  if (status === 'pending') {
    parts.push(el('p', { class: 'vf-st pending', role: 'status' }, [el('span', { text: 'Скачиваем ролик…' }), el('span', { class: 'vf-sh', 'aria-hidden': 'true' })]));
  } else if (status === 'failed') {
    const again = el('button', { type: 'button', class: 'btn ghost', text: 'Скачать снова' });
    again.addEventListener('click', async () => {
      again.disabled = true;
      try {
        const nv = await auth('POST', `/api/owner/videos/${encodeURIComponent(v.id)}/fetch`);
        Object.assign(v, nv && nv.id ? nv : { fetch_status: 'pending', fetch_error: '' });
        if (v.fetch_status !== 'ok') v.fetch_status = v.fetch_status === 'failed' ? 'failed' : 'pending';
        drawVideos();
        schedulePoll();
      } catch (err) {
        if (err.status === 401) { expired(); return; }
        toast(err.message);
        again.disabled = false;
      }
    });
    parts.push(el('p', { class: 'vf-st failed', role: 'alert', text: v.fetch_error || 'Не получилось скачать ролик по ссылке.' }));
    parts.push(el('div', { class: 'vf-a' }, [again, pick]));
  } else if (v.video_file_url || status === 'ok') {
    parts.push(el('p', { class: 'vf-st ok', text: 'Ролик загружен и играет на сайте сразу' }));
  }
  if (status !== 'failed') {
    const row = [pick];
    if (v.video_file_url) {
      const rm = el('button', { type: 'button', class: 'btn ghost', text: 'Убрать файл' });
      rm.addEventListener('click', async () => {
        rm.disabled = true;
        try {
          const nv = await auth('DELETE', `/api/owner/videos/${encodeURIComponent(v.id)}/file`);
          Object.assign(v, nv && nv.id ? nv : { video_file_url: '' });
          if (!nv || !nv.id) v.video_file_url = '';
          toast('Файл убран, будет показан пост по ссылке');
          drawVideos();
        } catch (err) {
          if (err.status === 401) { expired(); return; }
          toast(err.message);
          rm.disabled = false;
        }
      });
      row.push(rm);
    }
    parts.push(el('div', { class: 'vf-a' }, [...row, el('span', { class: 'hint', text: 'mp4 до 100 МБ' })]));
  }
  parts.push(bar);
  wrap.append(...parts);
  return wrap;
}

function drawVideos() {
  const ul = $('#vlist');
  ul.replaceChildren(...videos.map((v, k) => videoRow(v, k)));
  $('#v-empty').hidden = videos.length > 0;
}

async function move(k, d) {
  const ids = videos.map(v => v.id);
  const j = k + d;
  if (j < 0 || j >= ids.length) return;
  [ids[k], ids[j]] = [ids[j], ids[k]];
  try {
    videos = await owner.videos.reorder(ids);
    drawVideos();
    const btn = $$('#vlist .vi')[j] && $(d < 0 ? '.up' : '.down', $$('#vlist .vi')[j]);
    if (btn && !btn.disabled) btn.focus();
    toast('Порядок сохранён');
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
  }
}

async function patch(v, data, okText, redraw = true) {
  try {
    const nv = await owner.videos.update(v.id, data);
    Object.assign(v, nv);
    if (redraw) drawVideos();
    toast(okText);
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
    drawVideos();
  }
}

function videoRow(v, k) {
  const title = el('input', { class: 'vt-in', value: v.title || '', maxlength: '80', placeholder: 'Подпись к видео…', 'aria-label': 'Подпись к видео' });
  const saveTitle = () => { const t = title.value.trim(); if (t !== (v.title || '')) patch(v, { title: t }, 'Подпись сохранена', false); };
  title.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('blur', saveTitle);
  const show = el('input', { type: 'checkbox', checked: v.published !== false });
  show.addEventListener('change', () => patch(v, { published: show.checked }, show.checked ? 'Видео показано на сайте' : 'Видео скрыто с сайта'));
  const file = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Загрузить обложку' });
  file.addEventListener('change', async () => {
    const f = file.files[0];
    if (!f) return;
    try {
      const nv = await owner.videos.uploadPoster(v.id, f);
      Object.assign(v, nv);
      drawVideos();
      toast('Обложка загружена');
    } catch (err) {
      if (err.status === 401) { expired(); return; }
    toast(err.message);
    }
  });
  const actions = el('div', { class: 'vi-a' }, [
    el('label', { class: 'sw' }, [show, el('span', { text: 'Показывать' })]),
    el('span', { class: 'vi-mv' }, [
      el('button', { type: 'button', class: 'btn ghost up', 'aria-label': 'Раньше', title: 'Показывать раньше', disabled: k === 0, onclick: () => move(k, -1) }, [icon('left')]),
      el('button', { type: 'button', class: 'btn ghost down', 'aria-label': 'Позже', title: 'Показывать позже', disabled: k === videos.length - 1, onclick: () => move(k, 1) }, [icon('right')]),
    ]),
    el('span', { class: 'btn ghost filebtn' }, [file, el('span', { text: 'Обложка' })]),
  ]);
  const del = el('button', { type: 'button', class: 'btn ghost', text: 'Удалить' });
  del.addEventListener('click', () => {
    const yes = el('button', { type: 'button', class: 'btn danger', text: 'Да, удалить' });
    const no = el('button', { type: 'button', class: 'btn ghost', text: 'Нет' });
    const box = el('span', { class: 'confirm', role: 'group', 'aria-label': 'Подтвердите удаление' }, [el('span', { text: 'Удалить видео?' }), yes, no]);
    del.replaceWith(box);
    no.focus();
    no.addEventListener('click', () => { box.replaceWith(del); del.focus(); });
    yes.addEventListener('click', async () => {
      try {
        await owner.videos.remove(v.id);
        videos = videos.filter(x => x.id !== v.id);
        drawVideos();
        toast('Видео удалено');
      } catch (err) {
        if (err.status === 401) { expired(); return; }
    toast(err.message);
      }
    });
  });
  actions.append(del);
  const st = v.fetch_status === 'pending' ? ['pending', 'Скачиваем…'] : v.fetch_status === 'failed' ? ['failed', 'Ошибка'] : v.video_file_url || v.fetch_status === 'ok' ? ['ok', 'Загружен'] : ['none', 'Только ссылка'];
  const media = thumb(v);
  media.append(el('span', { class: `vchip ${st[0]}`, text: st[1] }), el('span', { class: 'vno', text: String(k + 1) }), v.published === false ? el('span', { class: 'vhid', text: 'Скрыто' }) : null);
  const li = el('li', { class: `vi${v.published === false ? ' off' : ''}`, 'data-id': v.id, draggable: 'true' }, [
    el('span', { class: 'vi-grip', title: 'Перетащите, чтобы поменять порядок', 'aria-hidden': 'true' }, [icon('grip')]),
    media,
    el('div', { class: 'vi-b' }, [
      el('div', { class: 'vi-top' }, [el('span', { text: PLATFORM[v.platform] || 'Видео' }), el('a', { href: v.url, target: '_blank', rel: 'noopener', text: 'Открыть пост' })]),
      title,
      fileBlock(v),
      actions,
    ]),
  ]);
  li.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('input,button,a,textarea') && e.target !== li) { e.preventDefault(); return; } dragFrom = k; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(v.id)); } catch (err) { return; } });
  li.addEventListener('dragend', () => { li.classList.remove('drag'); $$('#vlist .vi').forEach(x => x.classList.remove('over')); });
  li.addEventListener('dragover', e => { if (dragFrom === null) return; e.preventDefault(); li.classList.add('over'); });
  li.addEventListener('dragleave', () => li.classList.remove('over'));
  li.addEventListener('drop', e => { e.preventDefault(); const from = dragFrom; dragFrom = null; if (from !== null && from !== k) moveTo(from, k); });
  return li;
}

let dragFrom = null;
async function moveTo(from, to) {
  const ids = videos.map(v => v.id);
  const [x] = ids.splice(from, 1);
  ids.splice(to, 0, x);
  try {
    videos = await owner.videos.reorder(ids);
    drawVideos();
    toast('Порядок сохранён');
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
  }
}

function addForm() {
  const f = $('#add-f');
  const input = $('#vurl');
  f.addEventListener('submit', async e => {
    e.preventDefault();
    const url = input.value.trim();
    $('#add-e').textContent = '';
    if (!url) { $('#add-e').textContent = 'Вставьте ссылку на видео'; input.focus(); return; }
    const btn = $('button', f);
    btn.disabled = true;
    try {
      const v = await owner.videos.create({ url });
      videos.push(v);
      drawVideos();
      schedulePoll();
      input.value = '';
      toast(v.fetch_status === 'pending' ? 'Видео добавлено, скачиваем ролик' : 'Видео добавлено и показано на сайте');
      const last = $$('#vlist .vt-in').pop();
      if (last) last.focus();
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      $('#add-e').textContent = (err.fields && (err.fields.url || Object.values(err.fields)[0])) || err.message;
      input.focus();
    } finally {
      btn.disabled = false;
    }
  });
}

authUi();
tabs();
addForm();
soundUi();
$('#odet').addEventListener('keydown', e => { if (e.key === 'Escape' && $('#odet').classList.contains('open')) closeDetail(); });
narrow.addEventListener('change', () => { if (!narrow.matches) closeDetail(); });
session = store(KEY);
if (session) enterPanel(); else show('s-login');
