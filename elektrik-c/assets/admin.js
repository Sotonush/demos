const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const API = (document.body.dataset.api || '').replace(/\/+$/, '');
const KEY = 'elektrik-owner-session';
const DRAFT = 'elektrik-owner-draft';
const NET = 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
const PLATFORM = { youtube: 'YouTube', instagram: 'Instagram', tiktok: 'TikTok', file: 'Файл .mp4' };
const STATUS = { new: 'Новый', accepted: 'Принят', ready: 'Готов', done: 'Выполнен', cancelled: 'Отменён', confirmed: 'Подтверждена', no_show: 'Не пришёл' };
const ACTION = { accepted: 'Принять', ready: 'Готово', done: 'Выполнено', cancelled: 'Отменить', confirmed: 'Подтвердить', no_show: 'Не пришёл' };
const SCREENS = ['s-login', 's-setup', 's-totp', 's-codes', 'app'];

let owner = null;
let stopWatch = null;
let videos = [];
let session = '';
let challenge = '';
let recoveryMode = false;
let pendingCodes = null;

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
  $('#logout').hidden = id !== 'app';
  document.body.classList.toggle('in-app', id === 'app');
  const sec = $(`#${id}`);
  const f = $('input:not([type=checkbox]):not([hidden])', sec);
  if (id !== 'app') (f && !f.value ? f : sec).focus();
  else $('#main-app').focus({ preventScroll: true });
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
  if (window.crmStop) crmStop();
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
    $('#who').textContent = me.email || '';
    $('#who2').textContent = me.email ? `Вы вошли как ${me.email}` : '';
  } catch (err) {
    if (err.status === 401) { showLogin(''); return; }
  }
  owner = window.LeadsClient.owner({ api: API, token: session });
  show('app');
  if (window.crmEnter) crmEnter();
  const draft = takeDraft();
  if (draft && draft.vurl) $('#vurl').value = draft.vurl;
  loadOrders();
  loadVideos(draft && draft.titles);
  const live = $('#live');
  stopWatch = owner.watch(() => { live.classList.remove('off'); loadOrders(true); }, err => { if (err.status === 401) expired(); else live.classList.add('off'); });
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
    closeDetail(false);
    window.scrollTo(0, 0);
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

const FILTERS = [['', 'Все'], ['new', 'Новые'], ['accepted', 'Приняты'], ['ready', 'Готовы'], ['done', 'Выполнены'], ['cancelled', 'Отменены']];
const mobileQ = matchMedia('(max-width: 900px)');
let knownOrders = null;
let orders = [];
let filter = '';
let selected = null;
let detailCache = new Map();
let summary = null;
let firstLoad = true;

function ago(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'только что';
  if (s < 3600) { const m = Math.floor(s / 60); return `${m} ${m % 10 === 1 && m % 100 !== 11 ? 'минуту' : m % 10 >= 2 && m % 10 <= 4 && (m % 100 < 12 || m % 100 > 14) ? 'минуты' : 'минут'} назад`; }
  const tm = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' }).format(d);
  const day = k => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'Asia/Bishkek' }).format(k);
  const now = new Date();
  if (day(d) === day(now)) return `сегодня в ${tm}`;
  if (day(d) === day(new Date(now.getTime() - 864e5))) return `вчера в ${tm}`;
  return when(iso);
}

function num(n) {
  return `№${Number(n)}`;
}

function statusChip(code, title) {
  return el('span', { class: `st st-${code}`, text: title || STATUS[code] || code });
}

function skeleton() {
  $('#orders').replaceChildren(...[0, 1, 2, 3].map(() => el('li', { class: 'oc sk', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')])));
  $('#sum').replaceChildren(...[0, 1, 2, 3].map(() => el('li', { class: 'sk' }, [el('i'), el('i')])));
}

function drawSummary() {
  const by = (summary && summary.by_status) || {};
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const tiles = [
    ['new', 'Новые', by.new || 0, 'y'],
    ['accepted', 'В работе', (by.accepted || 0) + (by.ready || 0), 'b'],
    ['done', 'Выполнено', by.done || 0, 'w'],
    ['', 'Всего', total, 'w'],
  ];
  $('#sum').replaceChildren(...tiles.map(([k, t, n, c]) => el('li', { class: `sum-${c}` }, [el('b', { text: String(n) }), el('span', { text: t })])));
  $('#filt').replaceChildren(...FILTERS.map(([k, t]) => {
    const c = k ? by[k] || 0 : total;
    const b = el('button', { type: 'button', class: 'fc', 'aria-pressed': String(k === filter) }, [el('span', { text: t }), el('small', { text: String(c) })]);
    b.addEventListener('click', () => { if (filter === k) return; filter = k; drawSummary(); loadOrders(); });
    return b;
  }));
}

async function loadOrders(fresh) {
  if (!owner) return;
  if (firstLoad) skeleton();
  let data;
  try {
    const [list, sm] = await Promise.all([owner.list({ limit: 100, status: filter || undefined }), owner.summary().catch(() => null)]);
    data = list;
    if (sm) summary = sm;
    if (sm && window.crmSummary) crmSummary(sm);
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
    if (firstLoad) { $('#orders').replaceChildren(); $('#orders-empty').hidden = false; $('#oe-t').textContent = 'Не удалось загрузить заявки'; $('#oe-p').textContent = err.message; }
    return;
  }
  firstLoad = false;
  orders = data.items || [];
  const appeared = knownOrders ? orders.filter(o => !knownOrders.has(o.number)) : [];
  knownOrders = new Set([...(knownOrders || []), ...orders.map(o => o.number)]);
  if (fresh && appeared.length) toast(appeared.length === 1 ? `Новая заявка ${num(appeared[0].number)}` : `Новых заявок: ${appeared.length}`);
  drawSummary();
  const ul = $('#orders');
  ul.replaceChildren(...orders.map(o => orderRow(o, fresh && appeared.includes(o))));
  const empty = !orders.length;
  $('#orders-empty').hidden = !empty;
  if (empty) {
    $('#oe-t').textContent = filter ? `${(FILTERS.find(f => f[0] === filter) || [])[1] || ''}: пусто` : 'Заявок пока нет';
    $('#oe-p').textContent = filter ? 'В этом статусе заявок нет. Выберите «Все», чтобы увидеть остальные.' : 'Новые заявки с сайта появятся здесь сами, без обновления страницы.';
  }
  const nc = (summary && summary.new_count) ?? data.new_count ?? 0;
  $('#newc').hidden = !nc;
  $('#newc').textContent = nc;
  document.title = `${nc ? `(${nc}) ` : ''}Кабинет | Электрик.Kg`;
  if (selected !== null) {
    detailCache.delete(selected);
    if (orders.some(o => o.number === selected) || $('#detail').classList.contains('open')) openOrder(selected, false);
  } else if (!mobileQ.matches && orders.length) openOrder(orders[0].number, false);
}

function orderRow(o, appeared) {
  const what = (o.items || []).map(i => i.title).filter(Boolean).join(', ');
  const b = el('button', { type: 'button', class: 'oc-b', 'aria-current': o.number === selected ? 'true' : 'false' }, [
    el('span', { class: 'oc-top' }, [el('b', { class: 'oc-n', text: o.name || 'Клиент' }), el('span', { class: 'oc-no', text: num(o.number) })]),
    el('span', { class: 'oc-w', text: what || o.comment || 'Без описания' }),
    window.crmRowTags ? crmRowTags(o) : null,
    el('span', { class: 'oc-f' }, [statusChip(o.status, o.status_title), el('time', { datetime: o.created_at, text: ago(o.created_at) })]),
  ]);
  b.addEventListener('click', () => openOrder(o.number, true));
  const li = el('li', { class: `oc st-l-${o.status}${appeared ? ' fresh' : ''}`, 'data-n': o.number }, [b]);
  return li;
}

async function openOrder(n, user) {
  selected = n;
  $$('#orders .oc-b').forEach(b => b.setAttribute('aria-current', String(b.closest('.oc').dataset.n === String(n))));
  const box = $('#detail');
  const base = orders.find(o => o.number === n);
  if (base && !detailCache.has(n)) drawDetail(Object.assign({ history: null }, base));
  if (mobileQ.matches && user) {
    box.classList.add('open');
    document.body.classList.add('od-on');
    history.pushState({ od: n }, '');
    box.focus({ preventScroll: true });
  }
  try {
    const full = detailCache.get(n) || await owner.get(n);
    detailCache.set(n, full);
    if (selected === n) drawDetail(full);
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    if (!base) toast(err.message);
  }
}

function crmChanged(nv) {
  const k = orders.findIndex(x => x.number === nv.number);
  if (k >= 0) orders[k] = Object.assign(orders[k], nv);
  detailCache.set(nv.number, nv);
  $('#orders').replaceChildren(...orders.map(o => orderRow(o, false)));
  if (selected === nv.number) drawDetail(nv);
}

function closeDetail(fromPop) {
  const box = $('#detail');
  if (!box.classList.contains('open')) return;
  box.classList.remove('open');
  document.body.classList.remove('od-on');
  if (!fromPop && history.state && history.state.od) history.back();
  const row = $(`#orders .oc[data-n="${selected}"] .oc-b`);
  if (row) row.focus({ preventScroll: true });
}

function drawDetail(o) {
  const box = $('#detail');
  const digits = String(o.phone || '').replace(/\D/g, '');
  const items = (o.items || []).map(i => i.title).filter(Boolean);
  const back = el('button', { type: 'button', class: 'od-back', 'aria-label': 'К списку заявок' }, [icon('back'), el('span', { text: 'Заявки' })]);
  back.addEventListener('click', () => closeDetail(false));
  const acts = (o.next_statuses || []).map(s => {
    const btn = el('button', { type: 'button', class: `b ${s === 'cancelled' ? 'b-g' : 'b-y'} b-act`, text: ACTION[s] || STATUS[s] || s });
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      try {
        const res = await owner.setStatus(o.number, s);
        detailCache.delete(o.number);
        toast(`${num(o.number)}: ${(res && res.status_title || STATUS[s] || s).toLowerCase()}`);
        await loadOrders();
      } catch (err) {
        if (err.status === 401) { expired(); return; }
        toast(err.message);
        btn.disabled = false;
        btn.removeAttribute('aria-busy');
      }
    });
    return btn;
  });
  const hist = o.history;
  let timeline;
  if (hist === null) timeline = el('ol', { class: 'tl sk' }, [el('li'), el('li')]);
  else if (hist && hist.length) {
    timeline = el('ol', { class: 'tl' }, hist.map((h, k) => el('li', { class: `${k === hist.length - 1 ? 'cur ' : ''}st-l-${h.status}` }, [
      el('b', { text: STATUS[h.status] || h.status }),
      el('span', { text: `${h.actor === 'client' ? 'Клиент, ' : h.actor === 'owner' ? 'Вы, ' : ''}${when(h.at)}` }),
    ])));
  } else timeline = el('p', { class: 'hint', text: 'Истории пока нет.' });
  const note = el('textarea', { id: 'od-note', rows: '3', maxlength: '500', placeholder: 'Например: постоянный клиент, Camry 50, перезвонить вечером' });
  note.value = o.note || '';
  const saveNote = el('button', { type: 'button', class: 'b b-g b-sm', text: 'Сохранить заметку', hidden: true });
  note.addEventListener('input', () => { saveNote.hidden = note.value.trim() === (o.note || ''); });
  saveNote.addEventListener('click', async () => {
    saveNote.disabled = true;
    try {
      const res = await owner.setNote(o.number, note.value.trim());
      o.note = (res && res.note) ?? note.value.trim();
      detailCache.set(o.number, Object.assign({}, o, res || {}, { history: o.history }));
      saveNote.hidden = true;
      toast('Заметка сохранена');
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      toast(err.message);
    } finally {
      saveNote.disabled = false;
    }
  });
  box.replaceChildren(
    el('div', { class: 'od-in' }, [
      back,
      el('div', { class: 'od-h' }, [el('span', { class: 'od-no', text: num(o.number) }), statusChip(o.status, o.status_title), el('time', { datetime: o.created_at, title: when(o.created_at), text: ago(o.created_at) })]),
      el('h2', { class: 'od-name', text: o.name || 'Клиент' }),
      el('a', { class: 'od-tel', href: `tel:+${digits}`, text: phoneText(o.phone) }),
      el('div', { class: 'od-c' }, [
        el('a', { class: 'b b-y', href: `tel:+${digits}` }, [icon('phone'), el('span', { text: 'Позвонить' })]),
        el('a', { class: 'b b-blue', href: `https://wa.me/${digits}`, target: '_blank', rel: 'noopener' }, [icon('wa'), el('span', { text: 'WhatsApp' })]),
      ]),
      window.crmDetail ? crmDetail(o, crmChanged) : null,
      items.length ? el('div', { class: 'od-s' }, [el('h3', { text: 'Что случилось' }), el('ul', { class: 'od-tags' }, items.map(t => el('li', { text: t })))]) : null,
      o.comment ? el('div', { class: 'od-s' }, [el('h3', { text: 'Подробности' }), el('p', { class: 'od-cm', text: o.comment })]) : null,
      el('div', { class: 'od-s' }, [el('h3', {}, [el('label', { for: 'od-note', text: 'Заметка для себя' })]), note, saveNote]),
      el('div', { class: 'od-s' }, [el('h3', { text: 'История' }), timeline]),
    ]),
    acts.length ? el('div', { class: 'od-a' }, acts) : el('div', { class: 'od-a done' }, [icon('check'), el('span', { text: o.status === 'cancelled' ? 'Заявка отменена' : 'Заявка закрыта' })]),
  );
}

window.addEventListener('popstate', () => closeDetail(true));
mobileQ.addEventListener('change', () => { if (!mobileQ.matches) closeDetail(true); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(false); });
setInterval(() => { $$('#orders time').forEach(t => { t.textContent = ago(t.getAttribute('datetime')); }); }, 60000);

function thumb(v) {
  const poster = v.poster_url || (v.platform === 'youtube' && v.embed_id ? `https://img.youtube.com/vi/${v.embed_id}/hqdefault.jpg` : '');
  const box = el('span', { class: 'vi-ph' });
  if (poster) box.append(el('img', { src: poster, alt: '', loading: 'lazy' }));
  else if (v.video_file_url && /^https?:|^\//.test(v.video_file_url)) {
    const vd = el('video', { src: `${v.video_file_url}#t=0.5`, muted: true, playsinline: true, preload: 'metadata', 'aria-hidden': 'true', tabindex: '-1' });
    vd.muted = true;
    box.append(vd);
  } else box.append(el('span', { class: 'vph' }, [icon(v.platform === 'instagram' ? 'instagram' : v.platform === 'tiktok' ? 'tiktok' : 'film'), el('span', { text: PLATFORM[v.platform] || 'Видео' })]));
  const st = v.fetch_status || (v.video_file_url ? 'ok' : 'none');
  const chip = { ok: ['ok', 'Загружен'], pending: ['pend', 'Скачиваем…'], failed: ['bad', 'Ошибка'] }[st];
  if (chip) box.append(el('span', { class: `vchip ${chip[0]}`, text: chip[1] }));
  if (v.published === false) box.append(el('span', { class: 'vchip off', text: 'Скрыто' }));
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
}

const FILE_MAX = 100 * 1024 * 1024;
const FILE_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
let pollTimer = null;

function drawVideos() {
  const ul = $('#vlist');
  const act = document.activeElement;
  const focused = act && ul.contains(act) && act.classList.contains('vt-in');
  if (focused) {
    const id = act.closest('.vi').dataset.id;
    $$('.vi', ul).forEach(li => {
      if (li.dataset.id === id) return;
      const v = videos.find(x => String(x.id) === li.dataset.id);
      if (v) li.replaceWith(videoRow(v, videos.indexOf(v)));
    });
  } else {
    ul.replaceChildren(...videos.map((v, k) => videoRow(v, k)));
  }
  $('#v-empty').hidden = videos.length > 0;
  schedulePoll();
}

function schedulePoll() {
  clearTimeout(pollTimer);
  if (!videos.some(v => v.fetch_status === 'pending')) return;
  pollTimer = setTimeout(async () => {
    if (!owner) return;
    try {
      const fresh = await owner.videos.list();
      const changed = fresh.length !== videos.length || fresh.some(f => {
        const o = videos.find(v => v.id === f.id);
        return !o || o.fetch_status !== f.fetch_status || o.video_file_url !== f.video_file_url;
      });
      fresh.forEach(f => {
        const o = videos.find(v => v.id === f.id);
        if (o && o.fetch_status === 'pending' && f.fetch_status === 'ok') toast('Ролик загружен');
      });
      if (changed) {
        const titles = new Map(videos.map(v => [v.id, v.title]));
        videos = fresh.map(f => ({ ...f, title: titles.has(f.id) ? titles.get(f.id) : f.title }));
        drawVideos();
      } else schedulePoll();
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      schedulePoll();
    }
  }, 3000);
}

function ownerCall(method, path) {
  return fetch(`${API}${path}`, { method, headers: { Accept: 'application/json', Authorization: `Bearer ${owner.token()}` }, credentials: 'omit', cache: 'no-store' })
    .then(async r => {
      let data = null;
      try { data = await r.json(); } catch (e) { data = null; }
      if (r.ok) return data;
      const err = new Error((data && data.error) || 'Ошибка запроса');
      err.status = r.status;
      throw err;
    }, () => { const err = new Error(NET); err.status = 0; throw err; });
}

function uploadFile(v, f, onProgress) {
  return new Promise((resolve, reject) => {
    const fail = (msg, status) => { const e = new Error(msg); e.status = status || 0; reject(e); };
    if (f.type && !FILE_TYPES.includes(f.type)) { fail('Нужен видео-файл: mp4, webm или mov'); return; }
    if (f.size > FILE_MAX) { fail('Файл больше 100 МБ. Сожмите или обрежьте ролик'); return; }
    const x = new XMLHttpRequest();
    x.open('POST', `${API}/api/owner/videos/${encodeURIComponent(Number(v.id))}/file`);
    x.setRequestHeader('Authorization', `Bearer ${owner.token()}`);
    x.setRequestHeader('Accept', 'application/json');
    x.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => {
      let data = null;
      try { data = JSON.parse(x.responseText); } catch (e) { data = null; }
      if (x.status >= 200 && x.status < 300) resolve(data);
      else fail((data && data.error) || (x.status === 413 ? 'Файл слишком большой' : 'Не удалось загрузить файл'), x.status);
    };
    x.onerror = () => fail(NET);
    const form = new FormData();
    form.append('file', f, f.name || 'video.mp4');
    x.send(form);
  });
}

function fileBlock(v) {
  const box = el('div', { class: 'vf' });
  const input = el('input', { type: 'file', accept: 'video/mp4,video/webm,video/quicktime', 'aria-label': 'Прикрепить видео-файл' });
  const pick = el('label', { class: 'btn ghost sm filebtn' }, [input, el('span', { text: 'Прикрепить файл' })]);
  input.addEventListener('change', async () => {
    const f = input.files[0];
    if (!f) return;
    const txt = el('span', { class: 'vf-st', text: 'Загружаем 0%' });
    const fill = el('i');
    box.replaceChildren(txt, el('span', { class: 'vf-bar' }, [fill]));
    try {
      const nv = await uploadFile(v, f, k => {
        const pc = Math.round(k * 100);
        fill.style.width = `${pc}%`;
        txt.textContent = `Загружаем ${pc}%`;
      });
      Object.assign(v, nv || {}, { fetch_status: (nv && nv.fetch_status) || 'ok', video_file_url: (nv && nv.video_file_url) || v.video_file_url || 'ok' });
      toast('Ролик загружен');
    } catch (err) {
      if (err.status === 401) { expired(); return; }
      toast(err.message);
    }
    drawVideos();
  });
  const st = v.fetch_status || (v.video_file_url ? 'ok' : 'none');
  if (st === 'pending') {
    box.append(el('span', { class: 'vf-st pend', text: 'Скачиваем ролик…' }), el('span', { class: 'vf-bar pend' }, [el('i')]));
  } else if (st === 'ok' || v.video_file_url) {
    const drop = el('button', { type: 'button', class: 'linkbtn', text: 'Убрать файл' });
    drop.addEventListener('click', async () => {
      try {
        await ownerCall('DELETE', `/api/owner/videos/${encodeURIComponent(Number(v.id))}/file`);
        v.video_file_url = null;
        v.fetch_status = 'none';
        drawVideos();
        toast('Файл убран, на сайте будет пост');
      } catch (err) {
        if (err.status === 401) { expired(); return; }
        toast(err.message);
      }
    });
    box.append(el('span', { class: 'vf-st ok', text: 'Ролик загружен' }), drop);
  } else if (st === 'failed') {
    const again = el('button', { type: 'button', class: 'btn ghost sm', text: 'Скачать снова' });
    again.addEventListener('click', async () => {
      again.disabled = true;
      try {
        const nv = await ownerCall('POST', `/api/owner/videos/${encodeURIComponent(Number(v.id))}/fetch`);
        Object.assign(v, nv || {}, { fetch_status: (nv && nv.fetch_status) || 'pending', fetch_error: null });
        drawVideos();
      } catch (err) {
        if (err.status === 401) { expired(); return; }
        toast(err.message);
        again.disabled = false;
      }
    });
    box.append(el('p', { class: 'vf-err', text: v.fetch_error || 'Не получилось скачать ролик.' }), el('div', { class: 'vf-a' }, [again, pick]), el('p', { class: 'hint', text: 'Файл: mp4, до 100 МБ' }));
  } else {
    box.append(pick, el('span', { class: 'hint', text: 'mp4, до 100 МБ' }));
  }
  return box;
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
    el('label', { class: 'sw' }, [show, el('span', { class: 'sw-t', 'aria-hidden': 'true' }), el('span', { text: 'На сайте' })]),
    el('span', { class: 'vi-mv' }, [
      el('button', { type: 'button', class: 'ib up', 'aria-label': 'Показывать раньше', title: 'Раньше', disabled: k === 0, onclick: () => move(k, -1) }, [icon('up')]),
      el('button', { type: 'button', class: 'ib down', 'aria-label': 'Показывать позже', title: 'Позже', disabled: k === videos.length - 1, onclick: () => move(k, 1) }, [icon('down')]),
    ]),
  ]);
  const more = el('div', { class: 'vi-x' }, [el('label', { class: 'b b-g b-sm filebtn' }, [file, el('span', { text: 'Обложка' })])]);
  const del = el('button', { type: 'button', class: 'b b-g b-sm', text: 'Удалить' });
  del.addEventListener('click', () => {
    const yes = el('button', { type: 'button', class: 'b b-danger b-sm', text: 'Удалить' });
    const no = el('button', { type: 'button', class: 'b b-g b-sm', text: 'Нет' });
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
  more.append(del);
  return el('li', { class: `vi${v.published === false ? ' off' : ''}`, 'data-id': v.id }, [
    el('span', { class: 'vi-pos', text: String(k + 1) }),
    thumb(v),
    el('div', { class: 'vi-b' }, [
      el('div', { class: 'vi-top' }, [el('span', { text: PLATFORM[v.platform] || 'Видео' }), el('a', { href: v.url, target: '_blank', rel: 'noopener', text: 'Пост' }, [icon('out')])]),
      title,
      fileBlock(v),
      actions,
      more,
    ]),
  ]);
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
      input.value = '';
      toast(v.fetch_status === 'pending' ? 'Видео добавлено. Скачиваем ролик…' : 'Видео добавлено и показано на сайте');
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
session = store(KEY);
if (session) enterPanel(); else show('s-login');
