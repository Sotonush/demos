const S = window.SITE || {};
const KEY = 'yunusov-order';
const OUT = 'yunusov-outbox';
const MINE = 'yunusov-bookings';
const API = S.api || '';
const SERVICES = S.services || [];
const SLOTS = S.slots || [];
const WORK = S.workDays || [0, 1, 2, 3, 4, 5, 6];
const LEAD_MIN = S.leadMin || 60;
const DAY_MS = 864e5, POLL_MS = 15000, MINE_MAX = 10, DAYS_SHOWN = 7;
const LAST_CALL = SLOTS.length ? +SLOTS[SLOTS.length - 1].slice(0, 2) * 60 + +SLOTS[SLOTS.length - 1].slice(3, 5) - LEAD_MIN : 0;
const STATUS = {
  new: ['Новая', 'Администратор посмотрит заявку и подтвердит время. Эта страница обновится сама.'],
  confirmed: ['Подтверждена', `Ждём вас: ${S.address}, ${S.city}.`],
  done: ['Приём состоялся', 'Спасибо, что пришли. Если появятся вопросы после приёма, напишите нам в WhatsApp.'],
  no_show: ['Приём не состоялся', 'Если хотите выбрать другое время, запишитесь снова или позвоните.'],
  cancelled: ['Отменена', 'Запись отменена. Можно выбрать другое время или позвонить в клинику.']
};
const FINAL = ['done', 'no_show', 'cancelled'];
const ALL = Object.fromEntries(SERVICES.map(s => [s[0], s]));
const title = id => ALL[id][1];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
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
const whenText = (date, time) => date ? `${longDay(date)}, ${time}` : '';
function minutes() {
  const p = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', ...tz }).formatToParts(new Date());
  const v = t => +p.find(x => x.type === t).value;
  return v('hour') * 60 + v('minute');
}
const toMin = t => +t.slice(0, 2) * 60 + +t.slice(3, 5);
const dayIndex = d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(new Intl.DateTimeFormat('en-US', { weekday: 'short', ...tz }).format(d));
function upcoming(n) {
  const days = [];
  for (let i = minutes() >= LAST_CALL ? 1 : 0; days.length < n && i < 60; i++) {
    const d = new Date(Date.now() + i * DAY_MS);
    if (WORK.includes(dayIndex(d))) days.push({ d, i, key: short.format(d).replace('.', ''), iso: isoDay(d) });
  }
  return days;
}
const dayLabel = ({ d, i }) => i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : cap(wds.format(d).replace('.', ''));
function human(err) {
  if (!err || !err.status) return 'Нет связи с сервером записи.';
  if (err.status >= 500) return 'Сервер записи временно не отвечает.';
  return err.message || 'Что-то пошло не так. Попробуйте ещё раз.';
}
const temporary = err => !err || !err.status || err.status >= 500 || err.status === 429;
const waUrl = text => `https://wa.me/${S.wa}?text=${encodeURIComponent(text)}`;
function waBooking(p) {
  const lines = ['Здравствуйте! Хочу записаться.'];
  if (p.items && p.items.length) lines.push(`Услуга: ${p.items.map(i => i.title).join(', ')}`);
  if (p.date) lines.push(`Когда: ${whenText(p.date, p.time)}`);
  if (p.name) lines.push(`Имя: ${p.name}`);
  if (p.phone) lines.push(`Телефон: ${p.phone}`);
  return waUrl(lines.join('\n'));
}
function header() {
  const top = $('.top'), demo = $('.demo');
  if (!top || !demo || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([e]) => top.classList.toggle('scrolled', !e.isIntersecting)).observe(demo);
}
function intro() {
  const go = () => requestAnimationFrame(() => document.documentElement.classList.add('ready'));
  if (calm() || !document.fonts) { go(); return; }
  Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 500))]).then(go);
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
  if (page === 'status') return;
  const box = outbox.get();
  const last = store.get(MINE, [])[0];
  if (box && page !== 'book') {
    bar.innerHTML = `<span class="wrap mb-in"><span><b>Заявка ещё не отправлена.</b> Не было связи с сервером.</span><a href="book.html">Открыть</a></span>`;
    bar.hidden = false;
  } else if (last && !box) {
    bar.innerHTML = `<span class="wrap mb-in"><span><b>Ваша запись №${esc(last.n)}</b> ${esc(whenText(last.date, last.time))}</span><a href="status.html?t=${encodeURIComponent(last.t)}">Статус</a></span>`;
    bar.hidden = false;
  } else bar.hidden = true;
}
function home() {
  const box = $('#svc-list');
  if (!box) return;
  const sync = () => { const c = cart.get(); $$('.row', box).forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id))); };
  box.addEventListener('click', e => { const b = e.target.closest('.row'); if (b) { cart.toggle(b.dataset.id); sync(); } });
  sync();
}
function phoneDigits(v) {
  let d = String(v).replace(/\D/g, ''), cut = 0;
  if (d.startsWith('00996')) { d = d.slice(5); cut = 5; }
  else if (d.length >= 10 && d.startsWith('996')) { d = d.slice(3); cut = 3; }
  while (d.startsWith('0')) { d = d.slice(1); cut++; }
  return { d: d.slice(0, 9), cut };
}
const fmtPhone = d => [d.slice(0, 3), d.slice(3, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean).join(' ');
function phoneError(d) {
  if (!d) return 'Укажите телефон: по нему клиника подтвердит запись';
  if (d.length < 9) return `Номер неполный: после +996 нужно 9 цифр, а сейчас ${d.length}. Пример: 555 12 34 56`;
  if (!/^[2-9]/.test(d)) return 'Похоже, номер набран с ошибкой. Пример: 555 12 34 56';
  return '';
}
function fieldError(id, text) {
  const el = $(`#${id}`), msg = $(`#${id}-e`);
  msg.textContent = text;
  el.setAttribute('aria-invalid', text ? 'true' : 'false');
  el.closest('.fld').classList.toggle('bad', !!text);
}
function book() {
  const form = $('#bookf'), sendBtn = $('#send'), errT = $('.err-t'), retry = $('#retry'), waFb = $('#wa-fb');
  const st = { day: null, time: null };
  let busy = false;
  const days = upcoming(DAYS_SHOWN);
  const pre = new URLSearchParams(location.search).get('s');
  if (pre && ALL[pre] && !cart.get().includes(pre)) cart.set([...cart.get(), pre]);
  const pend = outbox.get();
  if (pend) {
    $('#name').value = pend.p.name;
    $('#phone').value = fmtPhone(phoneDigits(pend.p.phone).d);
    if (days.some(x => x.iso === pend.p.date)) { st.day = pend.p.date; st.time = pend.p.time; }
    if (pend.ids && pend.ids.length) cart.set(pend.ids.filter(id => ALL[id]));
  }
  const isToday = () => days.length && days[0].i === 0 && st.day === days[0].iso;
  $('#days').innerHTML = days.map(x => `<button class="chip" type="button" data-d="${x.iso}" aria-pressed="false"><b>${dayLabel(x)}</b><small>${x.key}</small></button>`).join('');
  $('#times').innerHTML = SLOTS.map(t => `<button class="chip" type="button" data-t="${t}" aria-pressed="false"><b>${t}</b></button>`).join('');
  const when = () => st.day && st.time ? whenText(st.day, st.time) : st.day ? longDay(st.day) : st.time ? `в ${st.time}` : '';
  const payload = () => {
    const d = phoneDigits($('#phone').value).d;
    return { name: $('#name').value.trim(), phone: d ? `+996 ${fmtPhone(d)}` : '', items: cart.get().map(id => ({ title: title(id) })), date: st.day, time: st.time };
  };
  const draw = () => {
    const c = cart.get(), m = minutes();
    $('#svc').innerHTML = SERVICES.map(([id, n, , p]) => `<button class="chip" type="button" data-id="${id}" aria-pressed="${c.includes(id)}"><b>${esc(n)}</b>${p === 'Бесплатно' ? '<small>бесплатно</small>' : ''}</button>`).join('');
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
    waFb.href = waBooking(payload());
  };
  const say = (text, canRetry, wa) => {
    errT.textContent = text;
    retry.hidden = !canRetry;
    waFb.hidden = !wa;
    $('.err').classList.toggle('on', !!text);
  };
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
    if (phone.getAttribute('aria-invalid') === 'true') fieldError('phone', d.length === 9 ? phoneError(d) : $('#phone-e').textContent);
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
    if (!leads) { say('Онлайн-запись сейчас недоступна. Отправьте ту же заявку в WhatsApp клиники, мы ответим там.', false, true); return; }
    setBusy(true);
    say('');
    flush().then(res => {
      location.href = `status.html?t=${encodeURIComponent(res.public_token)}&new=1`;
    }, err => {
      setBusy(false);
      if (!err) { say('Онлайн-запись сейчас недоступна. Отправьте заявку в WhatsApp.', false, true); return; }
      if (temporary(err)) {
        const kept = outbox.get() ? ' Заявка сохранена на этом телефоне и уйдёт сама, когда связь вернётся. Или отправьте её в WhatsApp прямо сейчас.' : '';
        say(err.status === 429 ? err.message : `${human(err)}${kept}`, true, true);
        return;
      }
      outbox.del();
      const f = err.fields || {};
      if (f.phone) { fieldError('phone', f.phone); jump('#phone', true); }
      if (f.name) { fieldError('name', f.name); jump('#name', true); }
      if (f.time) { st.time = null; draw(); say(f.time === 'Это время уже прошло' ? 'Это время уже прошло, выберите другое' : f.time, false); jump('#times'); return; }
      if (f.date) { st.day = null; st.time = null; draw(); say(f.date, false); jump('#days'); return; }
      say(f.phone || f.name ? 'Проверьте поля, отмеченные красным' : err.message, !f.phone && !f.name, true);
    });
  };
  retry.onclick = () => { if (outbox.get()) send(); else form.requestSubmit(); };
  waFb.addEventListener('click', () => { outbox.del(); mybar(); });
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (busy) return;
    const c = cart.get(), n = $('#name').value.trim(), d = phoneDigits(phone.value).d;
    const pErr = phoneError(d), nErr = n.length < 2 ? 'Напишите, как к вам обращаться' : '';
    fieldError('name', nErr);
    fieldError('phone', pErr);
    const miss = !c.length ? ['Выберите, что нужно. Не знаете: отметьте консультацию', '#svc'] : !st.day ? ['Выберите день', '#days'] : !st.time ? ['Выберите время', '#times'] : nErr ? ['Напишите, как к вам обращаться', '#name'] : pErr ? ['Проверьте номер телефона', '#phone'] : null;
    if (miss) { say(miss[0], false); jump(miss[1], miss[1] === '#name' || miss[1] === '#phone'); return; }
    const old = outbox.get();
    const p = { kind: 'booking', client_request_id: '', name: n, phone: `+996${d}`, items: c.map(id => ({ title: title(id), sku: id })), date: st.day, time: st.time, website: $('#website').value };
    const same = old && JSON.stringify({ ...old.p, client_request_id: '' }) === JSON.stringify(p);
    p.client_request_id = same ? old.p.client_request_id : (leads ? leads.newRequestId() : String(Date.now()));
    if (leads) outbox.set({ p, ids: c });
    send();
  });
  window.addEventListener('online', () => { if (outbox.get()) send(); });
  draw();
  if (pend && leads) {
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
    box.innerHTML = `<div class="page"><h1>Мои записи</h1><p>${mine.length ? 'Записи, сделанные с этого телефона.' : 'Здесь появится ваша запись после отправки заявки.'}</p></div>${pend ? '<p class="warn">Одна заявка ещё не отправлена: не было связи. <a href="book.html">Открыть и отправить</a></p>' : ''}${rows ? `<ul class="mine">${rows}</ul>` : ''}<p class="st-acts"><a class="btn" href="book.html">Записаться</a></p>`;
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
<h1>${fresh ? `Заявка №${esc(o.number)} принята` : `Запись №${esc(o.number)}`}</h1>
<p>${esc(S.name)}, ${esc(S.address)}</p>
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
<div><dt>Где</dt><dd>${esc(S.address)}, ${esc(S.city)}</dd></div>
</dl>
<p class="saved">Ссылка на эту страницу сохранена в браузере и будет в полоске «Ваша запись» на сайте.</p>
<div class="st-acts"><button class="btn ghost sm" type="button" data-copy>Скопировать ссылку</button><a class="btn ghost sm" href="book.html">Записаться ещё</a></div>
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
count();
mybar();
header();
intro();
if (outbox.get() && document.body.dataset.page !== 'book') {
  const retryLater = () => flush().then(mybar, () => {});
  retryLater();
  window.addEventListener('online', retryLater);
}
({ index: home, book, status }[document.body.dataset.page] || (() => {}))();
