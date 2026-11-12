const S = window.SITE || {};
const API = S.api || '';
const HEALTH_MS = 7000, DAY_MS = 864e5, PAGE = 200, PAGES_MAX = 5;
const STATUS = { new: 'Новая', confirmed: 'Подтверждена', done: 'Пришёл', no_show: 'Не пришёл', cancelled: 'Отменена' };
const ACTIONS = { confirmed: 'Подтвердить', done: 'Пациент пришёл', no_show: 'Не пришёл', cancelled: 'Отменить' };
const DONE_MSG = { confirmed: 'подтверждена', done: 'отмечена: пациент пришёл', no_show: 'отмечена: не пришёл', cancelled: 'отменена' };
const FILTERS = [['up', 'Предстоящие'], ['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['past', 'Прошедшие'], ['all', 'Все дни']];
const SFILTERS = [['all', 'Все'], ['new', 'Новые'], ['confirmed', 'Подтверждены'], ['done', 'Пришли'], ['no_show', 'Не пришли'], ['cancelled', 'Отменены']];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const tz = { timeZone: 'Asia/Bishkek' };
const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', ...tz });
const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', ...tz });
const isoFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...tz });
const dhm = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...tz });
const isoDay = d => isoFmt.format(d);
const fromIso = s => new Date(`${s}T12:00:00+06:00`);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDay = s => { const d = fromIso(s); return `${wd.format(d)}, ${fmt.format(d)}`; };
const whenText = (date, time) => date ? `${longDay(date)}, ${time}` : '';
const prettyPhone = p => { const d = String(p || '').replace(/\D/g, '').slice(-9); return d.length === 9 ? `+996 ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : String(p || ''); };
function relDay(s) {
  const today = isoDay(new Date()), tomorrow = isoDay(new Date(Date.now() + DAY_MS));
  return s === today ? `Сегодня, ${fmt.format(fromIso(s))}` : s === tomorrow ? `Завтра, ${fmt.format(fromIso(s))}` : cap(longDay(s));
}
function human(err) {
  if (!err || !err.status) return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
  if (err.status >= 500) return 'Сервер временно не отвечает. Попробуйте через минуту.';
  return err.message || 'Что-то пошло не так. Попробуйте ещё раз.';
}
const temporary = err => !err || !err.status || err.status >= 500 || err.status === 429;
function waText(o) {
  const hi = `Здравствуйте, ${o.name}! Это ${S.name}.`;
  const w = whenText(o.date, o.time);
  return {
    new: `${hi} Получили вашу заявку №${o.number} на ${w}. Подскажите, пожалуйста, время вам подходит?`,
    confirmed: `${hi} Ваша запись подтверждена: ${w}. Ждём вас: ${S.address}, ${S.city}.`,
    done: `${hi} Спасибо, что пришли! Если будут вопросы после приёма, пишите.`,
    no_show: `${hi} Вы были записаны на ${w}, но не смогли прийти. Подобрать другое время?`,
    cancelled: `${hi} Запись на ${w} отменена. Если нужно, подберём другое время.`
  }[o.status] || hi;
}
async function health() {
  if (!API) return false;
  const ctl = 'AbortController' in window ? new AbortController() : null;
  const t = setTimeout(() => ctl && ctl.abort(), HEALTH_MS);
  try {
    const r = await fetch(`${API}/health`, { cache: 'no-store', signal: ctl ? ctl.signal : undefined });
    return r.ok;
  } catch { return false; } finally { clearTimeout(t); }
}

const offline = $('#offline'), checking = $('#checking'), form = $('#login'), desk = $('#desk'), codes = $('#codes');
const baseTitle = document.title;
let owner = null, step = 'pw', challenge = null;
let stop = null, items = [], openN = null, card = null, fresh = new Set(), filt = { day: 'up', st: 'all', q: '' }, loading = false, ping = null, toastT = null;

function show(which) {
  checking.hidden = which !== 'checking';
  offline.hidden = which !== 'offline';
  form.hidden = which !== 'login';
  codes.hidden = which !== 'codes';
  desk.hidden = which !== 'desk';
  $('#how').hidden = which === 'desk';
}
async function boot() {
  show('checking');
  const ok = await health();
  if (!ok) {
    $('#off-t').textContent = !API
      ? 'Сайт готов, а сервис записей для клиники ещё не подключён. Пока заявки с сайта уходят в WhatsApp клиники, поэтому ни одна не потеряется.'
      : navigator.onLine === false
        ? 'Похоже, на этом устройстве нет интернета. Проверьте связь и нажмите «Проверить снова».'
        : 'Сервис записей пока не отвечает: его подключат после согласования с клиникой. До этого заявки с сайта уходят в WhatsApp клиники, ни одна не потеряется.';
    show('offline');
    return;
  }
  owner = LeadsClient.owner({ api: API, persist: true, onSessionExpired: () => { if (!desk.hidden) logout('Сессия закончилась. Войдите снова.'); } });
  if (owner.auth.isLoggedIn()) enter(); else toLogin();
}
$('#off-retry').addEventListener('click', boot);

function loginErr(text) { $('#login-e').textContent = text || ''; }
function setStep(s) {
  step = s;
  $('#step-pw').hidden = s !== 'pw';
  $('#step-code').hidden = s !== 'code';
  $('#back-pw').hidden = s !== 'code';
  $('.lb', form).textContent = s === 'pw' ? 'Войти' : 'Подтвердить';
}
function toLogin(msg) {
  setStep('pw');
  challenge = null;
  $('#pw').value = '';
  $('#code').value = '';
  $('#qr').hidden = true;
  show('login');
  loginErr(msg);
}
const setBusy = on => { const b = $('button[type="submit"]', form); b.disabled = on; $('.lb', b).textContent = on ? 'Проверяем…' : step === 'pw' ? 'Войти' : 'Подтвердить'; };
function authErr(err) {
  if (err && err.status === 404) return 'Вход по почте и паролю на этом сервере выключен. Напишите разработчику.';
  if (err && err.status === 429) return err.message || 'Слишком много попыток, подождите.';
  if (err && err.status === 401) return err.message || 'Неверные данные';
  return human(err);
}
form.addEventListener('submit', async e => {
  e.preventDefault();
  loginErr('');
  if (step === 'pw') {
    const email = $('#email').value.trim(), pw = $('#pw').value;
    if (!email || !pw) { loginErr('Введите почту и пароль'); (email ? $('#pw') : $('#email')).focus(); return; }
    setBusy(true);
    try {
      const r = await owner.auth.login(email, pw);
      challenge = r.challenge;
      if (r.status === 'totp_setup_required') {
        $('#qr').innerHTML = r.qr_svg || '';
        $('#qr').hidden = !r.qr_svg;
        $('#code-h').textContent = `Первый вход: отсканируйте QR-код в Google Authenticator (или введите ключ ${r.secret}) и введите 6 цифр из приложения.`;
      } else $('#code-h').textContent = 'Введите 6 цифр из приложения Google Authenticator или резервный код.';
      setStep('code');
      setBusy(false);
      $('#code').focus();
    } catch (err) { setBusy(false); loginErr(authErr(err)); }
    return;
  }
  const code = $('#code').value.trim();
  if (!code) { loginErr('Введите код из приложения'); $('#code').focus(); return; }
  setBusy(true);
  try {
    const r = await owner.auth.verify(challenge, code);
    setBusy(false);
    if (r.recovery_codes && r.recovery_codes.length) {
      $('#codes-l').innerHTML = r.recovery_codes.map(c => `<li>${esc(c)}</li>`).join('');
      show('codes');
      return;
    }
    enter();
  } catch (err) {
    setBusy(false);
    if (err && err.status === 401 && /вышло/.test(err.message || '')) { toLogin(err.message); return; }
    loginErr(authErr(err));
    $('#code').select();
  }
});
$('#back-pw').addEventListener('click', () => toLogin());
$('#codes-ok').addEventListener('click', () => { $('#codes-l').innerHTML = ''; enter(); });

async function enter() {
  show('checking');
  try { await owner.summary(); }
  catch (err) {
    if (err && err.status === 401) { toLogin('Сессия закончилась. Войдите снова.'); return; }
    if (err && err.status === 503) { toLogin('Кабинет ещё не настроен на сервере. Напишите разработчику.'); return; }
    show('login');
    loginErr(human(err));
    return;
  }
  show('desk');
  shell();
  await load();
  stop = owner.watch(onEvents, onWatchErr);
}
function logout(reason) {
  if (stop) stop();
  stop = null;
  clearTimeout(ping);
  items = []; openN = null; card = null; fresh.clear();
  desk.innerHTML = '';
  document.title = baseTitle;
  document.body.classList.remove('card-open');
  toLogin(reason || '');
}
function shell() {
  desk.innerHTML = `
<div class="d-bar">
<p class="d-sum"><span class="d-new" id="d-new">0</span><span id="d-new-l">новых записей</span></p>
<p class="d-live" id="live"><span class="live on" aria-hidden="true"></span><span id="live-t">Обновляется само</span></p>
<button class="lnk" type="button" id="logout">Выйти</button>
</div>
<div class="d-tools">
<label class="srch"><span class="vh">Поиск</span><input type="search" id="q" placeholder="Имя, телефон или номер" autocomplete="off" enterkeyhint="search"></label>
<div class="seg" id="f-day" role="group" aria-label="Дни">${FILTERS.map(([k, v]) => `<button type="button" data-k="${k}" aria-pressed="${k === filt.day}">${v}</button>`).join('')}</div>
<div class="seg" id="f-st" role="group" aria-label="Статусы"></div>
</div>
<div class="d-main"><div class="d-list" id="list" aria-live="polite"></div><section class="d-card" id="card" tabindex="-1" aria-label="Карточка записи"><p class="d-empty">Выберите запись, чтобы увидеть детали.</p></section></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
  $('#logout').onclick = () => { owner.auth.logout().catch(() => {}); logout(); };
  $('#q').addEventListener('input', e => { filt.q = e.target.value.trim().toLowerCase(); draw(); });
  $('#f-day').onclick = e => { const b = e.target.closest('button'); if (b) { filt.day = b.dataset.k; $$('#f-day button').forEach(x => x.setAttribute('aria-pressed', x === b)); draw(); } };
  $('#f-st').onclick = e => { const b = e.target.closest('button'); if (b) { filt.st = b.dataset.k; draw(); } };
  $('#list').onclick = e => { const b = e.target.closest('[data-n]'); if (b) openCard(b.dataset.n, true); if (e.target.closest('[data-reload]')) load(); };
  $('#card').addEventListener('click', onCard);
  $('#toast').onclick = e => { const b = e.target.closest('[data-n]'); if (b) openCard(b.dataset.n, true); };
}
function setLive(ok, text) {
  const l = $('#live');
  if (!l) return;
  $('.live', l).classList.toggle('on', ok);
  l.classList.toggle('off', !ok);
  $('#live-t').textContent = text || (ok ? 'Обновляется само' : 'Нет связи, переподключаемся…');
}
async function load() {
  if (!owner || loading) return;
  loading = true;
  try {
    let all = [];
    for (let page = 0; page < PAGES_MAX; page++) {
      const r = await owner.list({ kind: 'booking', limit: PAGE, offset: page * PAGE });
      all = all.concat(r.items);
      if (all.length >= r.total || r.items.length < PAGE) break;
    }
    items = all;
    setLive(true);
    draw();
    if (openN && card) {
      const x = items.find(i => +i.number === +openN);
      if (x && (x.status !== card.status || x.note !== card.note)) openCard(openN, false);
    }
  } catch (err) {
    if (err && err.status === 401) return;
    setLive(false, human(err).replace(/\.$/, ''));
    if (!items.length && $('#list')) $('#list').innerHTML = `<div class="d-err"><p>${esc(human(err))}</p><button class="btn ghost sm" type="button" data-reload>Повторить</button></div>`;
  } finally { loading = false; }
}
function onEvents(events) {
  const created = events.filter(e => e.type === 'created' && e.kind === 'booking');
  created.forEach(e => fresh.add(+e.number));
  if (created.length) toast(created.length === 1 ? `Новая запись №${created[0].number}` : `Новых записей: ${created.length}`, created.length === 1 ? created[0].number : null);
  load().then(() => { if (openN && card && events.some(e => +e.number === +openN && e.type !== 'note' && e.status !== card.status)) openCard(openN, false); });
}
function onWatchErr(err) {
  if (err && err.status === 401) return;
  setLive(false);
  clearTimeout(ping);
  ping = setTimeout(() => { if (owner) owner.summary().then(() => load(), () => {}); }, 3500);
}
function toast(text, n) {
  const t = $('#toast');
  if (!t) return;
  t.innerHTML = n ? `<button type="button" data-n="${esc(n)}">${esc(text)}<span>Открыть</span></button>` : `<p>${esc(text)}</p>`;
  t.classList.add('on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('on'), 6000);
}
function inDay(x) {
  const today = isoDay(new Date()), tomorrow = isoDay(new Date(Date.now() + DAY_MS));
  return { up: x.date >= today, today: x.date === today, tomorrow: x.date === tomorrow, past: x.date < today, all: true }[filt.day];
}
function match(x) {
  if (!filt.q) return true;
  const q = filt.q, qd = q.replace(/\D/g, '');
  const hay = `${x.name} ${(x.items || []).map(i => i.title).join(' ')} ${x.note || ''}`.toLowerCase();
  return hay.includes(q) || (qd && (String(x.phone).replace(/\D/g, '').includes(qd) || String(+x.number) === String(+qd) || x.number.includes(qd)));
}
function plural(n) {
  return n % 10 === 1 && n % 100 !== 11 ? 'новая запись' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'новые записи' : 'новых записей';
}
function draw() {
  const base = items.filter(x => inDay(x) && match(x));
  const counts = base.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});
  $('#f-st').innerHTML = SFILTERS.map(([k, v]) => { const n = k === 'all' ? base.length : counts[k] || 0; return `<button type="button" data-k="${k}" aria-pressed="${k === filt.st}"${k === 'new' && n ? ' class="hot"' : ''}>${v}<span>${n}</span></button>`; }).join('');
  const list = base.filter(x => filt.st === 'all' || x.status === filt.st);
  const desc = filt.day === 'past' || filt.day === 'all';
  list.sort((a, b) => { const k = `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.number.localeCompare(b.number); return desc ? -k : k; });
  const nNew = items.filter(x => x.status === 'new').length;
  $('#d-new').textContent = nNew;
  $('#d-new-l').textContent = plural(nNew);
  $('#d-new').closest('.d-sum').classList.toggle('hot', nNew > 0);
  document.title = nNew ? `(${nNew}) ${baseTitle}` : baseTitle;
  if (!list.length) {
    $('#list').innerHTML = `<div class="d-err"><p>${items.length ? 'Ничего не нашлось. Попробуйте другой день, статус или запрос.' : 'Записей пока нет. Как только пациент запишется на сайте, запись появится здесь.'}</p></div>`;
    return;
  }
  let html = '', cur = null;
  list.forEach(x => {
    if (x.date !== cur) {
      if (cur !== null) html += '</ul>';
      cur = x.date;
      const n = list.filter(y => y.date === cur).length;
      html += `<h3 class="d-day">${esc(relDay(cur))}<span>${n}</span></h3><ul class="recs">`;
    }
    html += `<li><button type="button" class="rec s-${esc(x.status)}${fresh.has(+x.number) ? ' fresh' : ''}" data-n="${esc(x.number)}" aria-current="${+x.number === +openN}"><span class="r-time">${esc(x.time)}</span><span class="r-main"><b>${esc(x.name)}</b><small>${esc((x.items || []).map(i => i.title).join(', ') || 'Услуга не выбрана')}</small></span><span class="r-side"><span class="badge s-${esc(x.status)}">${esc(STATUS[x.status] || x.status_title)}</span><small>№${esc(x.number)}</small></span></button></li>`;
  });
  $('#list').innerHTML = html + '</ul>';
}
const mobile = () => !matchMedia('(min-width:860px)').matches;
async function openCard(n, user) {
  n = String(n);
  const wasOpen = openN;
  openN = n;
  fresh.delete(+n);
  const tt = $('#toast');
  if (tt) tt.classList.remove('on');
  $$('#list .rec').forEach(b => { b.setAttribute('aria-current', b.dataset.n === n); if (b.dataset.n === n) b.classList.remove('fresh'); });
  const box = $('#card');
  if (user && mobile()) {
    document.body.classList.add('card-open');
    if (!wasOpen) history.pushState({ card: n }, '');
    window.scrollTo(0, 0);
  }
  const x = items.find(i => +i.number === +n);
  if (x && user) { card = { ...x, history: card && +card.number === +n ? card.history : null }; renderCard(); }
  try {
    card = await owner.get(n);
    if (openN === n) renderCard();
  } catch (err) {
    if (err && err.status === 401) return;
    if (openN === n && !card) box.innerHTML = `<div class="d-err"><p>${esc(human(err))}</p><button class="btn ghost sm" type="button" data-again>Повторить</button></div>`;
  }
  if (user) $('#card').focus({ preventScroll: !mobile() });
}
function closeCard(fromPop) {
  openN = null; card = null;
  document.body.classList.remove('card-open');
  $('#card').innerHTML = '<p class="d-empty">Выберите запись, чтобы увидеть детали.</p>';
  $$('#list .rec').forEach(b => b.setAttribute('aria-current', 'false'));
  if (!fromPop && history.state && history.state.card) history.back();
}
window.addEventListener('popstate', () => { if (openN && document.body.classList.contains('card-open')) closeCard(true); });
function renderCard(msg) {
  const o = card, box = $('#card');
  if (!o) return;
  const next = o.next_statuses || [];
  const order = ['confirmed', 'done', 'no_show', 'cancelled'].filter(k => next.includes(k));
  const hist = (o.history || []).map(h => `<li><b>${esc(STATUS[h.status] || h.status)}</b><span>${esc(dhm.format(new Date(h.at)))}${h.actor === 'client' ? ', с сайта' : ''}</span></li>`).join('');
  box.innerHTML = `
<button class="lnk back" type="button" data-close>Все записи</button>
<p class="c-top"><span class="badge s-${esc(o.status)}">${esc(STATUS[o.status] || o.status_title)}</span><span class="c-no">№${esc(o.number)}</span></p>
<h3 class="c-when">${esc(cap(whenText(o.date, o.time)))}</h3>
<dl class="c-dl">
<div><dt>Пациент</dt><dd>${esc(o.name)}</dd></div>
<div><dt>Телефон</dt><dd><a href="tel:${esc(o.phone)}">${esc(prettyPhone(o.phone))}</a></dd></div>
<div><dt>Услуги</dt><dd>${esc((o.items || []).map(i => i.title).join(', ') || 'не выбраны')}</dd></div>
${o.comment ? `<div><dt>Комментарий</dt><dd>${esc(o.comment)}</dd></div>` : ''}
<div><dt>Заявка</dt><dd>${esc(dhm.format(new Date(o.created_at)))}</dd></div>
</dl>
${order.length ? `<div class="c-acts">${order.map((k, i) => `<button type="button" class="btn sm${i === 0 && k !== 'cancelled' ? '' : ' ghost'}${k === 'cancelled' ? ' danger' : ''}" data-st="${k}">${ACTIONS[k]}</button>`).join('')}</div>` : '<p class="c-final">Запись закрыта, статус больше не меняется.</p>'}
<p class="c-msg${msg && msg.bad ? ' bad' : ''}" role="status">${msg ? esc(msg.text) : ''}${msg && msg.retry ? ' <button class="lnk" type="button" data-again>Повторить</button>' : ''}</p>
<a class="btn ghost sm wa" href="${esc(LeadsClient.whatsappLink(o.phone, waText(o)))}" target="_blank" rel="noopener">Написать пациенту</a>
<div class="c-note"><label for="note">Заметка для себя</label><textarea id="note" rows="3" maxlength="2000" placeholder="Например: просит вечернее время">${esc(o.note || '')}</textarea><div class="c-note-b"><button class="btn ghost sm" type="button" data-note disabled>Сохранить заметку</button><span class="c-note-s" role="status"></span></div></div>
${hist ? `<div class="c-hist"><p>История</p><ol>${hist}</ol></div>` : ''}`;
  const ta = $('#note');
  ta.addEventListener('input', () => { $('[data-note]', box).disabled = ta.value.trim() === (o.note || ''); $('.c-note-s', box).textContent = ''; });
}
let armed = null, armT = null, pending = null;
async function onCard(e) {
  if (e.target.closest('[data-close]')) { closeCard(false); return; }
  if (e.target.closest('[data-again]')) { if (pending) pending(); else openCard(openN, false); return; }
  const b = e.target.closest('[data-st]');
  if (b && card) {
    const k = b.dataset.st;
    if (k === 'cancelled' && armed !== b) {
      armed = b; b.textContent = 'Точно отменить?'; b.classList.add('armed');
      clearTimeout(armT);
      armT = setTimeout(() => { if (armed === b) { b.textContent = ACTIONS.cancelled; b.classList.remove('armed'); armed = null; } }, 4000);
      return;
    }
    armed = null;
    const n = card.number;
    const run = async () => {
      pending = run;
      $$('[data-st]', $('#card')).forEach(x => { x.disabled = true; });
      b.textContent = 'Сохраняем…';
      try {
        card = await owner.setStatus(n, k);
        pending = null;
        const i = items.findIndex(x => x.number === card.number);
        if (i >= 0) items[i] = { ...items[i], ...card };
        draw();
        renderCard({ text: `Запись №${n} ${DONE_MSG[k]}. Пациент увидит это на своей странице.` });
        toast(`Запись №${n} ${DONE_MSG[k]}`);
      } catch (err) {
        if (err && err.status === 401) return;
        if (err && err.status === 409) { pending = null; await load(); try { card = await owner.get(n); } catch {} renderCard({ text: `${err.message}. Статус уже изменили, карточка обновлена.`, bad: true }); return; }
        renderCard({ text: human(err), bad: true, retry: temporary(err) });
      }
    };
    run();
    return;
  }
  const nb = e.target.closest('[data-note]');
  if (nb && card) {
    const v = $('#note').value.trim(), n = card.number, s = $('.c-note-s');
    nb.disabled = true; s.textContent = 'Сохраняем…';
    try {
      card = await owner.setNote(n, v);
      const i = items.findIndex(x => x.number === card.number);
      if (i >= 0) items[i] = { ...items[i], ...card };
      s.textContent = 'Заметка сохранена';
    } catch (err) {
      if (err && err.status === 401) return;
      nb.disabled = false; s.textContent = `${human(err)} Нажмите «Сохранить» ещё раз.`;
    }
  }
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openN && document.body.classList.contains('card-open')) closeCard(false); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && !desk.hidden) load(); });
window.addEventListener('online', () => { if (!desk.hidden) load(); else if (!offline.hidden) boot(); });
document.documentElement.classList.add('ready');
boot();
