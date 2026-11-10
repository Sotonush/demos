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
async function loadOrders(fresh) {
  if (!owner) return;
  let data;
  try {
    data = await owner.list({ limit: 100 });
  } catch (err) {
    if (err.status === 401) { expired(); return; }
    toast(err.message);
    return;
  }
  const ul = $('#orders');
  const items = data.items || [];
  ul.replaceChildren(...items.map(o => orderCard(o, fresh && !knownOrders.has(o.number))));
  knownOrders = new Set(items.map(o => o.number));
  $('#orders-empty').hidden = items.length > 0;
  const nc = data.new_count || 0;
  $('#newc').hidden = !nc;
  $('#newc').textContent = nc;
  document.title = `${nc ? `(${nc}) ` : ''}Кабинет | Электрик.Kg`;
}

function orderCard(o, appeared) {
  const what = (o.items || []).map(i => i.title).join(', ');
  const acts = (o.next_statuses || []).map(s => el('button', {
    type: 'button', class: `btn ${s === 'cancelled' ? 'ghost' : 'blue'}`, text: ACTION[s] || STATUS[s] || s,
    onclick: async e => {
      e.currentTarget.disabled = true;
      try {
        await owner.setStatus(o.number, s);
        toast(`Заявка №${o.number}: ${(STATUS[s] || s).toLowerCase()}`);
        loadOrders();
      } catch (err) {
        if (err.status === 401) { expired(); return; }
    toast(err.message);
        e.currentTarget.disabled = false;
      }
    },
  }));
  const li = el('li', { class: `oc${o.status === 'new' ? ' is-new' : ''}` }, [
    el('div', { class: 'oc-h' }, [
      el('b', { text: o.name || 'Клиент' }),
      el('span', { class: `st ${o.status}`, text: o.status_title || STATUS[o.status] || o.status }),
      el('span', { class: 'oc-no', text: `№${o.number}` }),
      el('time', { datetime: o.created_at, text: when(o.created_at) }),
    ]),
    el('p', { class: 'oc-p' }, [el('a', { href: `tel:${o.phone}`, text: phoneText(o.phone) }), document.createTextNode('  '),
      el('a', { href: `https://wa.me/${String(o.phone || '').replace(/\D/g, '')}`, target: '_blank', rel: 'noopener', text: 'WhatsApp' })]),
    what ? el('p', { class: 'oc-c', text: what }) : null,
    o.comment ? el('p', { class: 'oc-c', text: o.comment }) : null,
    acts.length ? el('div', { class: 'oc-a' }, acts) : null,
  ]);
  if (appeared) li.animate([{ background: 'rgba(26,92,255,.35)' }, { background: 'transparent' }], { duration: 1600 });
  return li;
}

function thumb(v) {
  const poster = v.poster_url || (v.platform === 'youtube' && v.embed_id ? `https://img.youtube.com/vi/${v.embed_id}/hqdefault.jpg` : '');
  const box = el('span', { class: `vi-ph${v.orientation === 'horizontal' ? ' hor' : ''}` });
  if (poster) box.append(el('img', { src: poster, alt: '', loading: 'lazy' }));
  else box.append(el('span', { class: 'vph' }, [icon(v.platform === 'instagram' ? 'instagram' : v.platform === 'tiktok' ? 'tiktok' : 'film'), el('span', { text: PLATFORM[v.platform] || 'Видео' })]));
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
    el('button', { type: 'button', class: 'btn ghost up', 'aria-label': 'Выше', title: 'Выше', disabled: k === 0, onclick: () => move(k, -1) }, [icon('up')]),
    el('button', { type: 'button', class: 'btn ghost down', 'aria-label': 'Ниже', title: 'Ниже', disabled: k === videos.length - 1, onclick: () => move(k, 1) }, [icon('down')]),
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
  return el('li', { class: `vi${v.published === false ? ' off' : ''}`, 'data-id': v.id }, [
    thumb(v),
    el('div', { class: 'vi-b' }, [
      el('div', { class: 'vi-top' }, [el('span', { text: PLATFORM[v.platform] || 'Видео' }), el('a', { href: v.url, target: '_blank', rel: 'noopener', text: 'Открыть' })]),
      title,
      actions,
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
      toast('Видео добавлено и показано на сайте');
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
