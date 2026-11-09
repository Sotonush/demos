const KEY = 'denta-kench-order';
const OUT = 'denta-kench-outbox';
const MINE = 'denta-kench-bookings';
const TOKEN = 'denta-kench-owner';
const API = (document.querySelector('meta[name="leads-api"]') || {}).content || '';
const SERVICES = [
  ['check', 'Осмотр и консультация', 'Если не знаете, что нужно'],
  ['treat', 'Лечение зубов', ''],
  ['hyg', 'Гигиена', ''],
  ['prost', 'Протезирование', ''],
  ['brace', 'Брекет-система', '']
];
const SLOTS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];
const OPEN = 540, CLOSE = 1080, LAST_CALL = 990, LEAD_MIN = 30, DAY_MS = 864e5, POLL_MS = 15000, MINE_MAX = 10, PAGE = 200, PAGES_MAX = 5;
const STATUS = {
  new: ['Новая', 'Администратор посмотрит заявку и подтвердит время. Эта страница обновится сама.'],
  confirmed: ['Подтверждена', 'Ждём вас. Нарын, улица Ленина, 94, вход под синим щитом «Стоматология».'],
  done: ['Принят', 'Приём состоялся. Спасибо, что выбрали «Дента-Кенч».'],
  no_show: ['Не пришёл', 'Приём не состоялся. Если хотите выбрать другое время, запишитесь снова или позвоните.'],
  cancelled: ['Отменена', 'Запись отменена. Можно записаться на другое время или позвонить в клинику.']
};
const FINAL = ['done', 'no_show', 'cancelled'];
const ALL = Object.fromEntries(SERVICES.map(s => [s[0], s]));
const title = id => ALL[id][1];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const TICK = '<svg class="tick" viewBox="0 0 20 20" aria-hidden="true"><path class="h" d="M4 10h12"/><path class="v" d="M10 4v12"/><path class="c" d="M4.5 10.5l3.5 3.5 7.5-8"/></svg>';
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} }
};
let mem = [], outMem = null;
const outbox = {
  get() { return store.get(OUT, null) || outMem; },
  set(v) { outMem = v; store.set(OUT, v); },
  del() { outMem = null; store.del(OUT); }
};
const cart = {
  get() { try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(id => ALL[id]); } catch { return mem.slice(); } },
  set(v) { mem = v; try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} count(); },
  toggle(id) { const c = cart.get(); cart.set(c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
};
const leads = API && window.LeadsClient ? LeadsClient.create({ api: API }) : null;
function count() {
  const n = cart.get().length;
  $$('.cnt').forEach(b => { b.textContent = n; b.hidden = !n; });
}
const tz = { timeZone: 'Asia/Bishkek' };
const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', ...tz });
const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', ...tz });
const short = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', ...tz });
const wds = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', ...tz });
const isoFmt = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...tz });
const hm = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', ...tz });
const dhm = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', ...tz });
const isoDay = d => isoFmt.format(d);
const fromIso = s => new Date(`${s}T12:00:00+06:00`);
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const longDay = s => { const d = fromIso(s); return `${wd.format(d)}, ${fmt.format(d)}`; };
function relDay(s) {
  const today = isoDay(new Date()), tomorrow = isoDay(new Date(Date.now() + DAY_MS));
  return s === today ? `Сегодня, ${fmt.format(fromIso(s))}` : s === tomorrow ? `Завтра, ${fmt.format(fromIso(s))}` : cap(longDay(s));
}
const whenText = (date, time) => date ? `${longDay(date)}, ${time}` : '';
function minutes() {
  const p = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', ...tz }).formatToParts(new Date());
  const v = t => +p.find(x => x.type === t).value;
  return v('hour') * 60 + v('minute');
}
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const dayIndex = d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', ...tz }).format(d));
const isSunday = d => dayIndex(d) === 6;
function upcoming(n) {
  const days = [];
  for (let i = minutes() >= LAST_CALL ? 1 : 0; days.length < n; i++) {
    const d = new Date(Date.now() + i * DAY_MS);
    if (!isSunday(d)) days.push({ d, i, key: fmt.format(d), iso: isoDay(d) });
  }
  return days;
}
const dayLabel = ({ d, i }) => i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wds.format(d).replace('.', '');
function human(err) {
  if (!err || !err.status) return 'Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.';
  if (err.status >= 500) return 'Сервер записи временно не отвечает. Попробуйте через минуту.';
  return err.message || 'Что-то пошло не так. Попробуйте ещё раз.';
}
const temporary = err => !err || !err.status || err.status >= 500 || err.status === 429;
function openText() {
  const m = minutes(), now = new Date(), next = new Date(Date.now() + DAY_MS);
  if (isSunday(now)) return ['Сегодня выходной, завтра откроемся в 09:00', false];
  if (m < OPEN) return ['Сегодня откроемся в 09:00', false];
  if (m < CLOSE) return ['Сейчас открыто, до 18:00', true];
  return [isSunday(next) ? 'Сейчас закрыто, откроемся в понедельник в 09:00' : 'Сейчас закрыто, завтра откроемся в 09:00', false];
}
function now() {
  const [t, open] = openText();
  $$('[data-now]').forEach(el => { el.textContent = t; el.classList.toggle('open', open); });
  const d = dayIndex(new Date());
  $$('.hours [data-d]').forEach(el => el.classList.toggle('today', +el.dataset.d === d));
}
function reveal() {
  const els = $$('.rv');
  if (calm() || !('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}
function remember(res, p, extra = {}) {
  const list = store.get(MINE, []).filter(x => x.t !== res.public_token);
  list.unshift({ t: res.public_token, n: res.number, date: p.date, time: p.time, svc: p.items.map(i => i.title), st: res.status, at: res.created_at, ...extra });
  store.set(MINE, list.slice(0, MINE_MAX));
}
function patchMine(t, o) {
  const list = store.get(MINE, []);
  const x = list.find(v => v.t === t);
  if (!x) return;
  Object.assign(x, o);
  store.set(MINE, list);
}
let flushing = null;
function flush() {
  const box = outbox.get();
  if (!box || !leads) return Promise.reject(null);
  if (flushing) return flushing;
  flushing = leads.submit(box.p).then(res => {
    remember(res, box.p);
    outbox.del();
    cart.set([]);
    return res;
  }).finally(() => { flushing = null; });
  return flushing;
}
function mybar() {
  const bar = $('#mybar');
  if (!bar) return;
  const page = document.body.dataset.page;
  if (page === 'status' || page === 'owner') return;
  const box = outbox.get();
  const last = store.get(MINE, [])[0];
  if (box && page !== 'book') {
    bar.innerHTML = `<span class="wrap mb-in"><span><b>Заявка ещё не отправлена.</b> Нет связи, отправим сами, как только появится интернет.</span><a href="book.html">Открыть</a></span>`;
    bar.hidden = false;
  } else if (last && !box) {
    bar.innerHTML = `<span class="wrap mb-in"><span><b>Ваша запись №${esc(last.n)}</b> ${esc(whenText(last.date, last.time))}</span><a href="status.html?t=${encodeURIComponent(last.t)}">Статус</a></span>`;
    bar.hidden = false;
  } else bar.hidden = true;
}
function home() {
  $('#q-days').innerHTML = upcoming(4).map(x => `<a class="qd" href="book.html?d=${x.i}"><b>${dayLabel(x)}</b><small>${short.format(x.d).replace('.', '')}</small></a>`).join('');
  const box = $('#svc-list');
  box.innerHTML = SERVICES.map(([id, n, note]) => `<button class="row" type="button" data-id="${id}" aria-pressed="false"><span class="n">${esc(n)}</span><span class="p">${note ? esc(note) + '. ' : ''}Цена по запросу</span>${TICK}</button>`).join('');
  const sync = () => { const c = cart.get(); $$('.row', box).forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id))); };
  box.addEventListener('click', e => { const b = e.target.closest('.row'); if (b) { cart.toggle(b.dataset.id); sync(); } });
  sync();
  now();
}
function phoneDigits(v) {
  let d = String(v).replace(/\D/g, ''), cut = 0;
  if (d.startsWith('00996')) { d = d.slice(5); cut = 5; }
  else if (d.length >= 10 && d.startsWith('996')) { d = d.slice(3); cut = 3; }
  while (d.startsWith('0')) { d = d.slice(1); cut++; }
  return { d: d.slice(0, 9), cut };
}
const fmtPhone = d => [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
const prettyPhone = p => { const d = String(p || '').replace(/\D/g, '').slice(-9); return d.length === 9 ? `+996 ${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}` : String(p || ''); };
function phoneError(d) {
  if (!d) return 'Укажите телефон: по нему клиника подтвердит запись';
  if (d.length < 9) return `Номер неполный: после +996 нужно 9 цифр, а сейчас ${d.length}. Пример: 700 12 34 56`;
  if (!/^[2-9]/.test(d)) return 'Похоже, номер набран с ошибкой. Пример: 700 12 34 56';
  return '';
}
function fieldError(id, text) {
  const el = $(`#${id}`), msg = $(`#${id}-e`);
  msg.textContent = text;
  el.setAttribute('aria-invalid', text ? 'true' : 'false');
  el.closest('.fld').classList.toggle('bad', !!text);
}
function book() {
  const form = $('#bookf'), sendBtn = $('#send'), errT = $('.err-t'), retry = $('#retry');
  const st = { day: null, time: null };
  let busy = false;
  const days = upcoming(6);
  const pre = new URLSearchParams(location.search).get('d');
  const hit = days.find(x => String(x.i) === pre);
  if (hit) st.day = hit.iso;
  const pend = outbox.get();
  if (pend) {
    $('#name').value = pend.p.name;
    $('#phone').value = fmtPhone(phoneDigits(pend.p.phone).d);
    if (days.some(x => x.iso === pend.p.date)) { st.day = pend.p.date; st.time = pend.p.time; }
    if (pend.ids && pend.ids.length) cart.set(pend.ids.filter(id => ALL[id]));
  }
  const isToday = () => days[0].i === 0 && st.day === days[0].iso;
  $('#days').innerHTML = days.map(x => `<button class="chip" type="button" data-d="${x.iso}" aria-pressed="false"><b>${dayLabel(x)}</b><small>${x.key}</small></button>`).join('');
  $('#times').innerHTML = SLOTS.map(t => `<button class="chip" type="button" data-t="${t}" aria-pressed="false"><b>${t}</b></button>`).join('');
  const when = () => st.day && st.time ? whenText(st.day, st.time) : st.day ? longDay(st.day) : st.time ? `в ${st.time}` : '';
  const draw = () => {
    const c = cart.get(), m = minutes();
    $('#svc').innerHTML = SERVICES.map(([id, n]) => `<button class="chip" type="button" data-id="${id}" aria-pressed="${c.includes(id)}"><b>${esc(n)}</b></button>`).join('');
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === st.day));
    $$('#times .chip').forEach(b => {
      const late = isToday() && toMin(b.dataset.t) <= m + LEAD_MIN;
      b.disabled = late;
      if (late && st.time === b.dataset.t) st.time = null;
      b.setAttribute('aria-pressed', b.dataset.t === st.time);
    });
    const d = phoneDigits($('#phone').value).d;
    $('#o-svc').innerHTML = c.map(id => esc(title(id))).join('<br>') || 'не выбраны';
    $('#o-when').textContent = cap(when()) || 'не выбрано';
    $('#o-name').textContent = $('#name').value.trim() || 'не указано';
    $('#o-phone').textContent = d ? `+996 ${fmtPhone(d)}` : 'не указан';
    $$('.note dd').forEach(dd => dd.classList.toggle('empty', /^не /.test(dd.textContent)));
  };
  const say = (text, canRetry) => { errT.textContent = text; retry.hidden = !canRetry; $('.err').classList.toggle('on', !!text); };
  const clear = () => { if (!busy) say(''); };
  $('#svc').onclick = e => { const b = e.target.closest('.chip'); if (b) { cart.toggle(b.dataset.id); clear(); draw(); } };
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.day = b.dataset.d; clear(); draw(); } };
  $('#times').onclick = e => { const b = e.target.closest('.chip'); if (b && !b.disabled) { st.time = b.dataset.t; clear(); draw(); } };
  const phone = $('#phone');
  phone.addEventListener('input', () => {
    const pos = phone.selectionStart ?? phone.value.length;
    const { d, cut } = phoneDigits(phone.value);
    const before = Math.max(0, phone.value.slice(0, pos).replace(/\D/g, '').length - cut);
    phone.value = fmtPhone(d);
    let i = 0, n = 0;
    while (i < phone.value.length && n < before) { if (/\d/.test(phone.value[i])) n++; i++; }
    if (document.activeElement === phone) phone.setSelectionRange(i, i);
    if ($('#phone').getAttribute('aria-invalid') === 'true') fieldError('phone', d.length === 9 ? phoneError(d) : $('#phone-e').textContent);
    clear();
    draw();
  });
  phone.addEventListener('blur', () => { const d = phoneDigits(phone.value).d; if (d) fieldError('phone', phoneError(d)); });
  $('#name').addEventListener('input', () => { if ($('#name').value.trim().length >= 2) fieldError('name', ''); clear(); draw(); });
  $('#name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); phone.focus(); } });
  const jump = (sel, focus) => {
    const el = $(sel);
    el.scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'center' });
    if (focus) el.focus({ preventScroll: true });
  };
  const setBusy = on => {
    busy = on;
    sendBtn.disabled = on;
    sendBtn.setAttribute('aria-busy', on);
    $('.lb', sendBtn).textContent = on ? 'Отправляем…' : 'Записаться';
  };
  const send = () => {
    if (busy) return;
    setBusy(true);
    say('');
    flush().then(res => {
      location.href = `status.html?t=${encodeURIComponent(res.public_token)}&new=1`;
    }, err => {
      setBusy(false);
      if (!err) { say('Запись временно недоступна. Позвоните в клинику, пожалуйста.', false); return; }
      if (temporary(err)) {
        const saved = !!outbox.get();
        const kept = saved ? ' Заявка сохранена на этом устройстве и уйдёт сама, когда связь вернётся.' : '';
        say(err.status === 429 ? err.message : !err.status ? `Нет связи с сервером.${kept || ' Проверьте интернет.'}` : `${human(err)}${kept}`, true);
        return;
      }
      outbox.del();
      const f = err.fields || {};
      if (f.phone) { fieldError('phone', f.phone); jump('#phone', true); }
      if (f.name) { fieldError('name', f.name); jump('#name', true); }
      if (f.time) { st.time = null; draw(); say(f.time === 'Это время уже прошло' ? 'Это время уже прошло, выберите другое' : f.time, false); jump('#times'); return; }
      if (f.date) { st.day = null; st.time = null; draw(); say(f.date, false); jump('#days'); return; }
      say(f.phone || f.name ? 'Проверьте поля, отмеченные красным' : err.message, !f.phone && !f.name);
    });
  };
  retry.onclick = () => { if (outbox.get()) send(); else form.requestSubmit(); };
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (busy) return;
    const c = cart.get(), n = $('#name').value.trim(), d = phoneDigits(phone.value).d;
    const pErr = phoneError(d), nErr = n.length < 2 ? 'Напишите, как к вам обращаться' : '';
    fieldError('name', nErr);
    fieldError('phone', pErr);
    const miss = !c.length ? ['Выберите, что нужно', '#svc'] : !st.day ? ['Выберите день', '#days'] : !st.time ? ['Выберите время', '#times'] : nErr ? ['Напишите, как к вам обращаться', '#name'] : pErr ? ['Проверьте номер телефона', '#phone'] : null;
    if (miss) { say(miss[0], false); jump(miss[1], miss[1] === '#name' || miss[1] === '#phone'); return; }
    const old = outbox.get();
    const p = { kind: 'booking', client_request_id: '', name: n, phone: `+996${d}`, items: c.map(id => ({ title: title(id), sku: id })), date: st.day, time: st.time, website: $('#website').value };
    const same = old && JSON.stringify({ ...old.p, client_request_id: '' }) === JSON.stringify(p);
    p.client_request_id = same ? old.p.client_request_id : (leads ? leads.newRequestId() : String(Date.now()));
    outbox.set({ p, ids: c });
    send();
  });
  window.addEventListener('online', () => { if (outbox.get()) send(); });
  draw();
  if (pend) {
    say('Заявка ещё не отправлена: не было связи. Отправляем…', false);
    send();
  }
}
function track(o) {
  const at = s => { const h = (o.history || []).filter(x => x.status === s).pop(); return h ? dhm.format(new Date(h.at)) : ''; };
  const end = ['cancelled', 'no_show'].includes(o.status) ? o.status : 'done';
  const steps = o.status === 'cancelled' && !at('confirmed') ? ['new', 'cancelled'] : ['new', 'confirmed', end];
  const idx = steps.indexOf(o.status);
  return `<ol class="track">${steps.map((s, i) => `<li class="${i < idx ? 'past' : i === idx ? 'cur' : ''} s-${s}"><span class="dot" aria-hidden="true"></span><b>${STATUS[s][0]}</b><small>${i <= idx ? esc(at(s)) : ''}</small></li>`).join('')}</ol>`;
}
function status() {
  const box = $('#st');
  const q = new URLSearchParams(location.search);
  let t = q.get('t');
  const fresh = q.get('new') === '1';
  if (fresh && t) history.replaceState(null, '', `status.html?t=${encodeURIComponent(t)}`);
  const mine = store.get(MINE, []);
  const pend = outbox.get();
  if (!t && mine.length === 1 && !pend) t = mine[0].t;
  if (!t) {
    const rows = mine.map(x => `<li><a class="mine-r" href="status.html?t=${encodeURIComponent(x.t)}"><b>№${esc(x.n)}</b><span>${esc(cap(whenText(x.date, x.time)))}</span><span class="badge s-${esc(x.st)}">${esc((STATUS[x.st] || ['Новая'])[0])}</span></a></li>`).join('');
    box.innerHTML = `<div class="page"><h1>Мои записи</h1><p>${mine.length ? 'Записи, сделанные с этого устройства.' : 'Здесь появится ваша запись после отправки заявки.'}</p></div>${pend ? '<p class="warn">Одна заявка ещё не отправлена: не было связи. <a href="book.html">Открыть и отправить</a></p>' : ''}${rows ? `<ul class="mine">${rows}</ul>` : ''}<p class="st-acts"><a class="btn" href="book.html">Записаться</a></p>`;
    return;
  }
  const cached = mine.find(x => x.t === t);
  let last = cached && cached.o ? cached.o : null, timer = null, prev = last ? last.status : null, failed = null;
  const link = location.href.split('#')[0];
  const render = changed => {
    if (!last) {
      box.innerHTML = `<div class="page"><h1>Моя запись</h1>${failed ? `<p class="warn">${esc(failed)} <button class="lnk" type="button" data-retry>Повторить</button></p>` : '<p class="st-load">Загружаем статус…</p>'}</div>`;
      return;
    }
    const o = last, s = STATUS[o.status] || [o.status_title, ''];
    const svc = (o.items || []).map(i => esc(i.title)).join(', ');
    box.innerHTML = `
<div class="st-head">
<p class="kick">${fresh ? 'Заявка принята' : 'Запись в «Дента-Кенч»'}</p>
<h1><span class="no">№${esc(o.number)}</span></h1>
</div>
<div class="st-g">
<section class="stat s-${esc(o.status)}${changed ? ' changed' : ''}" aria-label="Статус заявки">
<p class="stat-k">Статус</p>
<p class="stat-v">${esc(s[0])}</p>
<p class="stat-d">${esc(s[1])}</p>
${track(o)}
<p class="upd">${failed ? `<span class="warn-in">${esc(failed)} Показан последний известный статус.</span> <button class="lnk" type="button" data-retry>Повторить</button>` : FINAL.includes(o.status) ? `Обновлено ${esc(hm.format(new Date(o.updated_at)))}` : `<span class="live on" aria-hidden="true"></span>Обновляется само, проверено в ${esc(hm.format(new Date()))}`}</p>
</section>
<aside class="st-info">
<dl class="facts2">
<div><dt>Когда</dt><dd>${esc(cap(whenText(o.date, o.time)))}</dd></div>
<div><dt>Услуги</dt><dd>${svc || 'не указаны'}</dd></div>
<div><dt>Где</dt><dd>Нарын, улица Ленина, 94</dd></div>
</dl>
<p class="saved">Ссылка на эту страницу сохранена в браузере: она будет в полоске «Ваша запись» на сайте.</p>
<div class="st-acts"><button class="btn ghost" type="button" data-copy>Скопировать ссылку</button><a class="btn ghost" href="book.html">Записаться ещё</a></div>
</aside>
</div>`;
  };
  const load = async () => {
    clearTimeout(timer);
    try {
      const o = await leads.status(t);
      const changed = prev && prev !== o.status;
      prev = o.status;
      last = o;
      failed = null;
      patchMine(t, { st: o.status, o });
      if (!cached && !store.get(MINE, []).some(x => x.t === t)) remember({ public_token: t, number: o.number, status: o.status, created_at: o.created_at }, { date: o.date, time: o.time, items: o.items || [] }, { o });
      render(changed);
    } catch (err) {
      if (err && err.status === 404) {
        store.set(MINE, store.get(MINE, []).filter(x => x.t !== t));
        box.innerHTML = '<div class="page"><h1>Заявка не найдена</h1><p>Возможно, ссылка скопирована не целиком. Проверьте её или запишитесь заново.</p></div><p class="st-acts"><a class="btn" href="book.html">Записаться</a></p>';
        return;
      }
      failed = err && err.status === 429 ? 'Слишком частые запросы, подождите минуту.' : human(err);
      render(false);
    }
    if (!last || !FINAL.includes(last.status)) timer = setTimeout(() => { if (!document.hidden) load(); }, POLL_MS);
  };
  box.addEventListener('click', e => {
    if (e.target.closest('[data-retry]')) { failed = null; render(false); load(); }
    const c = e.target.closest('[data-copy]');
    if (c) {
      const done = ok => { c.textContent = ok ? 'Ссылка скопирована' : 'Не удалось скопировать'; setTimeout(() => { c.textContent = 'Скопировать ссылку'; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(link).then(() => done(true), () => done(false)); else done(false);
    }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && (!last || !FINAL.includes(last.status))) load(); });
  window.addEventListener('online', load);
  if (!leads) { failed = 'Сервис записи недоступен.'; render(false); return; }
  render(false);
  load();
}
const ACTIONS = { confirmed: 'Подтвердить', done: 'Принят', no_show: 'Не пришёл', cancelled: 'Отменить' };
const DONE_MSG = { confirmed: 'подтверждена', done: 'отмечена: принят', no_show: 'отмечена: не пришёл', cancelled: 'отменена' };
const FILTERS = [['up', 'Предстоящие'], ['today', 'Сегодня'], ['tomorrow', 'Завтра'], ['past', 'Прошедшие'], ['all', 'Все дни']];
const SFILTERS = [['all', 'Все'], ['new', 'Новые'], ['confirmed', 'Подтверждены'], ['done', 'Приняты'], ['no_show', 'Не пришли'], ['cancelled', 'Отменены']];
function waText(o) {
  const hi = `Здравствуйте, ${o.name}! Это стоматология «Дента-Кенч».`;
  const w = whenText(o.date, o.time);
  return {
    new: `${hi} Получили вашу заявку №${o.number} на ${w}. Подскажите, пожалуйста, время вам подходит?`,
    confirmed: `${hi} Ваша запись подтверждена: ${w}. Ждём вас по адресу Нарын, улица Ленина, 94.`,
    done: `${hi} Спасибо, что пришли! Если будут вопросы после приёма, пишите.`,
    no_show: `${hi} Вы были записаны на ${w}, но не смогли прийти. Подобрать другое время?`,
    cancelled: `${hi} Запись на ${w} отменена. Если нужно, подберём другое время.`
  }[o.status] || hi;
}
function owner() {
  const form = $('#login'), desk = $('#desk'), tokIn = $('#tok');
  const baseTitle = document.title;
  let api = null, stop = null, items = [], openN = null, card = null, fresh = new Set(), filt = { day: 'up', st: 'all', q: '' }, loading = false, ping = null, toastT = null;
  const hash = new URLSearchParams(location.hash.slice(1)).get('t');
  if (hash) { store.set(TOKEN, hash); history.replaceState(null, '', location.pathname); }
  const loginErr = (text, canRetry) => {
    $('#tok-e').innerHTML = text ? `${esc(text)}${canRetry ? ' <button class="lnk" type="button" data-relog>Повторить</button>' : ''}` : '';
    $('#tok').closest('.fld').classList.toggle('bad', !!text && !canRetry);
  };
  const setBusy = on => { const b = $('button[type="submit"]', form); b.disabled = on; $('.lb', b).textContent = on ? 'Проверяем…' : 'Войти'; };
  async function enter(token) {
    if (!API || !window.LeadsClient) { loginErr('Сервис записи не подключён к этой странице.'); return; }
    setBusy(true);
    loginErr('');
    let client;
    try { client = LeadsClient.owner({ api: API, token }); await client.summary(); }
    catch (err) {
      setBusy(false);
      if (err && err.status === 401) { store.del(TOKEN); loginErr('Ключ не подошёл. Скопируйте его целиком, без пробелов.'); tokIn.focus(); }
      else if (err && err.status === 503) loginErr('Кабинет ещё не настроен на сервере. Напишите разработчику.');
      else if (err && err.status === 429) loginErr('Слишком много попыток входа. Подождите несколько минут.');
      else { if (!tokIn.value) tokIn.value = token; loginErr(human(err), true); }
      return;
    }
    setBusy(false);
    store.set(TOKEN, token);
    tokIn.value = '';
    api = client;
    form.hidden = true;
    desk.hidden = false;
    shell();
    await load();
    stop = api.watch(onEvents, onWatchErr);
  }
  function logout(reason) {
    if (stop) stop();
    stop = null;
    clearTimeout(ping);
    store.del(TOKEN);
    api = null; items = []; openN = null; card = null; fresh.clear();
    desk.hidden = true;
    desk.innerHTML = '';
    form.hidden = false;
    document.title = baseTitle;
    document.body.classList.remove('card-open');
    loginErr(reason || '');
  }
  form.addEventListener('submit', e => { e.preventDefault(); const v = tokIn.value.trim(); if (!v) { loginErr('Вставьте ключ доступа'); tokIn.focus(); return; } enter(v); });
  form.addEventListener('click', e => { if (e.target.closest('[data-relog]')) enter(tokIn.value.trim() || store.get(TOKEN, '')); });
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
<div class="d-main"><div class="d-list" id="list" aria-live="polite"></div><section class="d-card" id="card" tabindex="-1" aria-label="Карточка записи"><p class="d-empty">Выберите запись слева, чтобы увидеть детали.</p></section></div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>`;
    $('#logout').onclick = () => logout();
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
    if (!api || loading) return;
    loading = true;
    try {
      let all = [];
      for (let page = 0; page < PAGES_MAX; page++) {
        const r = await api.list({ kind: 'booking', limit: PAGE, offset: page * PAGE });
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
      if (err && err.status === 401) { logout('Ключ больше не действует. Войдите заново.'); return; }
      setLive(false, human(err).replace(/\.$/, ''));
      if (!items.length) $('#list').innerHTML = `<div class="d-err"><p>${esc(human(err))}</p><button class="btn ghost sm" type="button" data-reload>Повторить</button></div>`;
    } finally { loading = false; }
  }
  function onEvents(events) {
    const created = events.filter(e => e.type === 'created' && e.kind === 'booking');
    created.forEach(e => fresh.add(+e.number));
    if (created.length) toast(created.length === 1 ? `Новая запись №${created[0].number}` : `Новых записей: ${created.length}`, created.length === 1 ? created[0].number : null);
    load().then(() => { if (openN && card && events.some(e => +e.number === +openN && e.type !== 'note' && e.status !== card.status)) openCard(openN, false); });
  }
  function onWatchErr(err) {
    if (err && err.status === 401) { logout('Ключ больше не действует. Войдите заново.'); return; }
    setLive(false);
    clearTimeout(ping);
    ping = setTimeout(() => { if (api) api.summary().then(() => load(), () => {}); }, 3500);
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
  function draw() {
    const base = items.filter(x => inDay(x) && match(x));
    const counts = base.reduce((a, x) => { a[x.status] = (a[x.status] || 0) + 1; return a; }, {});
    $('#f-st').innerHTML = SFILTERS.map(([k, v]) => { const n = k === 'all' ? base.length : counts[k] || 0; return `<button type="button" data-k="${k}" aria-pressed="${k === filt.st}"${k === 'new' && n ? ' class="hot"' : ''}>${v}<span>${n}</span></button>`; }).join('');
    const list = base.filter(x => filt.st === 'all' || x.status === filt.st);
    const desc = filt.day === 'past' || filt.day === 'all';
    list.sort((a, b) => { const k = `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`) || a.number.localeCompare(b.number); return desc ? -k : k; });
    const nNew = items.filter(x => x.status === 'new').length;
    $('#d-new').textContent = nNew;
    $('#d-new-l').textContent = nNew % 10 === 1 && nNew % 100 !== 11 ? 'новая запись' : [2, 3, 4].includes(nNew % 10) && ![12, 13, 14].includes(nNew % 100) ? 'новые записи' : 'новых записей';
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
      html += `<li><button type="button" class="rec s-${esc(x.status)}${fresh.has(+x.number) ? ' fresh' : ''}" data-n="${esc(x.number)}" aria-current="${+x.number === +openN}"><span class="r-time">${esc(x.time)}</span><span class="r-main"><b>${esc(x.name)}</b><small>${esc((x.items || []).map(i => i.title).join(', ') || 'Услуга не выбрана')}</small></span><span class="r-side"><span class="badge s-${esc(x.status)}">${esc((STATUS[x.status] || [x.status_title])[0])}</span><small>№${esc(x.number)}</small></span></button></li>`;
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
    }
    const x = items.find(i => +i.number === +n);
    if (x && user) { card = { ...x, history: card && +card.number === +n ? card.history : null }; renderCard(); }
    try {
      card = await api.get(n);
      if (openN === n) renderCard();
    } catch (err) {
      if (err && err.status === 401) { logout('Ключ больше не действует. Войдите заново.'); return; }
      if (openN === n && !card) box.innerHTML = `<div class="d-err"><p>${esc(human(err))}</p><button class="btn ghost sm" type="button" data-again>Повторить</button></div>`;
    }
    if (user) $('#card').focus({ preventScroll: !mobile() });
  }
  function closeCard(fromPop) {
    openN = null; card = null;
    document.body.classList.remove('card-open');
    $('#card').innerHTML = '<p class="d-empty">Выберите запись слева, чтобы увидеть детали.</p>';
    $$('#list .rec').forEach(b => b.setAttribute('aria-current', 'false'));
    if (!fromPop && history.state && history.state.card) history.back();
  }
  window.addEventListener('popstate', () => { if (openN && document.body.classList.contains('card-open')) closeCard(true); });
  function renderCard(msg) {
    const o = card, box = $('#card');
    if (!o) return;
    const s = STATUS[o.status] || [o.status_title];
    const next = o.next_statuses || [];
    const order = ['confirmed', 'done', 'no_show', 'cancelled'].filter(k => next.includes(k));
    const hist = (o.history || []).map(h => `<li><b>${esc((STATUS[h.status] || [h.status])[0])}</b><span>${esc(dhm.format(new Date(h.at)))}${h.actor === 'client' ? ', с сайта' : ''}</span></li>`).join('');
    box.innerHTML = `
<button class="lnk back" type="button" data-close>← Все записи</button>
<p class="c-top"><span class="badge s-${esc(o.status)}">${esc(s[0])}</span><span class="c-no">№${esc(o.number)}</span></p>
<h3 class="c-when">${esc(cap(whenText(o.date, o.time)))}</h3>
<dl class="c-dl">
<div><dt>Пациент</dt><dd>${esc(o.name)}</dd></div>
<div><dt>Телефон</dt><dd><a href="tel:${esc(o.phone)}">${esc(prettyPhone(o.phone))}</a></dd></div>
<div><dt>Услуги</dt><dd>${esc((o.items || []).map(i => i.title).join(', ') || 'не выбраны')}</dd></div>
${o.comment ? `<div><dt>Комментарий</dt><dd>${esc(o.comment)}</dd></div>` : ''}
<div><dt>Заявка</dt><dd>${esc(dhm.format(new Date(o.created_at)))}</dd></div>
</dl>
${order.length ? `<div class="c-acts">${order.map((k, i) => `<button type="button" class="btn${i === 0 && k !== 'cancelled' ? '' : ' ghost'}${k === 'cancelled' ? ' danger' : ''}" data-st="${k}">${ACTIONS[k]}</button>`).join('')}</div>` : '<p class="c-final">Запись закрыта, статус больше не меняется.</p>'}
<p class="c-msg${msg && msg.bad ? ' bad' : ''}" role="status">${msg ? esc(msg.text) : ''}${msg && msg.retry ? ' <button class="lnk" type="button" data-again>Повторить</button>' : ''}</p>
<a class="btn ghost wa" href="${esc(LeadsClient.whatsappLink(o.phone, waText(o)))}" target="_blank" rel="noopener">Написать пациенту</a>
<div class="c-note"><label for="note">Заметка для себя</label><textarea id="note" rows="3" maxlength="2000" placeholder="Например: перенести на 15:00, просит вечер">${esc(o.note || '')}</textarea><div class="c-note-b"><button class="btn ghost sm" type="button" data-note disabled>Сохранить заметку</button><span class="c-note-s" role="status"></span></div></div>
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
          card = await api.setStatus(n, k);
          pending = null;
          const i = items.findIndex(x => x.number === card.number);
          if (i >= 0) items[i] = { ...items[i], ...card };
          draw();
          renderCard({ text: `Запись №${n} ${DONE_MSG[k]}. Пациент увидит это на своей странице.` });
          toast(`Запись №${n} ${DONE_MSG[k]}`);
        } catch (err) {
          if (err && err.status === 401) { logout('Ключ больше не действует. Войдите заново.'); return; }
          if (err && err.status === 409) { pending = null; await load(); try { card = await api.get(n); } catch {} renderCard({ text: `${err.message}. Статус уже изменили, карточка обновлена.`, bad: true }); return; }
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
        card = await api.setNote(n, v);
        const i = items.findIndex(x => x.number === card.number);
        if (i >= 0) items[i] = { ...items[i], ...card };
        s.textContent = 'Заметка сохранена';
      } catch (err) {
        if (err && err.status === 401) { logout('Ключ больше не действует. Войдите заново.'); return; }
        nb.disabled = false; s.textContent = `${human(err)} Нажмите «Сохранить» ещё раз.`;
      }
    }
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openN && document.body.classList.contains('card-open')) closeCard(false); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && api) load(); });
  window.addEventListener('online', () => { if (api) load(); });
  const saved = store.get(TOKEN, null);
  if (saved) enter(saved);
}
count();
mybar();
reveal();
if (outbox.get() && document.body.dataset.page !== 'book') {
  const retryLater = () => flush().then(mybar, () => {});
  retryLater();
  window.addEventListener('online', retryLater);
}
({ index: home, book, visit: now, status, owner }[document.body.dataset.page] || (() => {}))();
