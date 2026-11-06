const WA = '996507507222';
const GROUPS = [
  ['Двигатель', [['eng', 'Ремонт дизельного двигателя'], ['shl', 'Шлифовка'], ['ras', 'Расточка'], ['gil', 'Гильзовка'], ['opr', 'Опрессовка']]],
  ['Топливная система', [['fuel', 'Ремонт топливной системы'], ['cr', 'Ремонт форсунок Common Rail'], ['injr', 'Ремонт инжекторов']]],
  ['Диагностика и прошивка', [['diag', 'Компьютерная диагностика'], ['chip', 'Прошивка и чип-тюнинг']]],
  ['Воздух и выхлоп', [['turbo', 'Ремонт турбины'], ['exh', 'Ремонт выхлопной системы'], ['eco', 'AdBlue и сажевый фильтр'], ['man', 'Чистка впускного коллектора']]],
  ['Обслуживание и тюнинг', [['to', 'Обслуживание дизельного авто'], ['ac', 'Обслуживание климатической системы'], ['t4', 'Тюнинг внедорожника'], ['tex', 'Тюнинг выхлопной системы'], ['ten', 'Тюнинг двигателя']]]
];
const SYMPTOMS = [['urea', 'Горит чек на мочевину'], ['dpf', 'Забит сажевый фильтр'], ['smoke', 'Дымит и не заводится'], ['petrol', 'Залили бензин вместо дизеля'], ['leak', 'Утечка топлива'], ['inj', 'Проблема с форсунками']];
const HOME = ['cr', 'diag', 'turbo', 'eco', 'chip', 'to'];
const OPS = [
  ['opr', 'Опрессовка', 'Проверка на герметичность: головка блока под давлением, чтобы найти трещину.'],
  ['gil', 'Гильзовка', 'Установка новой гильзы в блок цилиндров.'],
  ['ras', 'Расточка', 'Обработка цилиндра под ремонтный размер.'],
  ['shl', 'Шлифовка', 'Восстановление рабочих поверхностей, например шеек коленвала.']
];
const ALL = Object.fromEntries([...GROUPS.flatMap(g => g[1]), ...SYMPTOMS]);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.23,1,.32,1)';
let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('diesel-order') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('diesel-order', JSON.stringify(v)); } catch {} count(true); },
  toggle(id) { const c = cart.get(); cart.set(c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
};
function count(pop) {
  const b = $('.cnt'); if (!b) return;
  const n = cart.get().length;
  b.textContent = n; b.hidden = !n;
  if (pop && motion && n) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 220, easing: EASE });
}
function bishkek() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bishkek', weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { d: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday), h: +p.hour };
}
function status() {
  const { d, h } = bishkek();
  if (d !== 0 && h >= 9 && h < 18) return { open: true, t: 'Сейчас открыто, до 18:00' };
  if (d !== 0 && h < 9) return { open: false, t: 'Сейчас закрыто, откроемся в 09:00' };
  if (d === 6) return { open: false, t: 'Сейчас закрыто, откроемся в понедельник' };
  if (d === 0) return { open: false, t: 'Сегодня выходной, откроемся завтра в 09:00' };
  return { open: false, t: 'Сейчас закрыто, откроемся завтра в 09:00' };
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => k === page ? ' aria-current="page"' : '';
  const names = [['index', 'Главная'], ['prices', 'Услуги'], ['book', 'Заявка'], ['visit', 'Контакты']];
  const sheet = Math.max(1, ['index', 'prices', 'book', 'visit', 'owner'].indexOf(page) + 1);
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия <a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html"><i>DG</i>${page === 'index' ? '<span class="now"></span>' : '<span>Дизель Групп Сервис</span>'}</a>
  <nav class="links" aria-label="Разделы">${names.filter(n => n[0] !== 'book').map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <a class="btn sm" href="book.html">Заявка<span class="cnt" hidden>0</span></a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><div class="stamp">
  <div class="c name"><small>Сервис</small><b>Дизель Групп Сервис</b></div>
  <div class="c"><small>Адрес</small>Бишкек, Чокана Валиханова, 1/7Б</div>
  <div class="c"><small>Часы</small>Пн–Сб 09:00–18:00</div>
  <div class="c"><small>Телефон</small><a href="tel:+996507507222">+996 507 50 72 22</a></div>
  <div class="c links2"><a href="https://wa.me/${WA}">WhatsApp</a><a href="https://instagram.com/diesel_group_service">Instagram</a><a href="https://youtube.com/@DieselGroupService/shorts">YouTube</a><a href="https://2gis.kg/bishkek/firm/70000001103047899">2ГИС</a></div>
  <div class="c sheetno"><small>Лист</small>${sheet} из 5</div>
  </div></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${names.map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>`);
  count();
  const s = status();
  $$('.now').forEach(el => { el.textContent = s.t; el.classList.toggle('on', s.open); });
}
function reveal() {
  const vh = innerHeight;
  const els = $$('.row,.gal figure,.q,.map,.box,.grp,.coffee figure').filter(e => e.getBoundingClientRect().top > vh);
  if (!motion || !('IntersectionObserver' in window)) return;
  els.forEach(e => e.classList.add('reveal'));
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
}
function card(id, n) { return `<button class="card" data-id="${id}" aria-pressed="false"><span>${n}</span><i aria-hidden="true"></i></button>`; }
function bind(box) {
  const sync = () => { const c = cart.get(); $$('[data-id]', box).forEach(b => { if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', c.includes(b.dataset.id)); }); };
  box.addEventListener('click', e => { const b = e.target.closest('button[data-id]'); if (b) { cart.toggle(b.dataset.id); sync(); } });
  sync();
}
function engine() {
  const svg = $('#eng'), box = $('#ops');
  box.innerHTML = OPS.map(([k, t, d], i) => `<button class="op" data-k="${k}" aria-pressed="false"><i>${i + 1}</i><b>${t}</b><span>${d}</span></button>`).join('');
  const pick = k => { svg.dataset.k = k; $$('.op', box).forEach(b => b.setAttribute('aria-pressed', b.dataset.k === k)); };
  box.onclick = e => { const b = e.target.closest('.op'); if (b) pick(b.dataset.k); };
  svg.onclick = e => { const b = e.target.closest('[data-b]'); if (b) pick(b.dataset.b); };
  pick('opr');
  if (!motion || !('IntersectionObserver' in window)) return;
  svg.classList.add('todraw');
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { svg.classList.add('drawn'); io.disconnect(); } }, { threshold: .25 });
  io.observe(svg);
}
function home() {
  const s = $('.svc');
  const flat = Object.fromEntries(GROUPS.flatMap(g => g[1]));
  s.innerHTML = HOME.map(id => card(id, flat[id])).join('');
  bind(s); bind($('.rows')); engine();
}
function prices() {
  const b = $('#groups');
  b.innerHTML = GROUPS.map(([t, l]) => `<section class="grp"><h2>${t}</h2><div class="svc">${l.map(x => card(...x)).join('')}</div></section>`).join('');
  bind(b);
}
function book() {
  const st = { day: null, time: null };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const now = bishkek();
  const days = [];
  for (let i = 0; days.length < 6 && i < 9; i++) {
    const dow = (now.d + i) % 7;
    if (dow === 0 || (i === 0 && now.h >= 17)) continue;
    days.push({ d: new Date(Date.now() + i * 864e5), i });
  }
  const times = ['Утром', 'Днём', 'Ближе к вечеру'];
  const opts = [...SYMPTOMS, ...GROUPS[0][1].slice(0, 1), ['cr', ALL.cr], ['diag', ALL.diag], ['to', ALL.to]];
  const extra = cart.get().filter(id => !opts.some(o => o[0] === id)).map(id => [id, ALL[id]]);
  $('#svc').innerHTML = [...extra, ...opts].map(([id, n]) => `<button class="chip" type="button" data-id="${id}" aria-pressed="false">${n}</button>`).join('');
  $('#days').innerHTML = days.map(({ d, i }) => `<button class="chip" type="button" data-d="${fmt.format(d)}" aria-pressed="false">${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wd.format(d)}<small>${fmt.format(d)}</small></button>`).join('');
  $('#times').innerHTML = times.map(t => `<button class="chip" type="button" data-t="${t}" aria-pressed="false">${t}</button>`).join('');
  const put = (el, h) => { if (el.innerHTML === h) return; el.innerHTML = h; };
  const what = () => [cart.get().map(id => ALL[id]).join(', '), $('#note').value.trim()].filter(Boolean).join('. ');
  const draw = () => {
    const c = cart.get();
    $('.order').classList.remove('sent');
    $$('#svc .chip').forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id)));
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === st.day));
    $$('#times .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === st.time));
    put($('#o-car'), esc($('#car').value.trim()) || '—');
    put($('#o-svc'), esc(what()) || '—');
    put($('#o-when'), esc([st.day, st.time && st.time.toLowerCase()].filter(Boolean).join(', ')) || '—');
    put($('#o-name'), esc($('#name').value.trim()) || '—');
  };
  $('#svc').onclick = e => { const b = e.target.closest('.chip'); if (b) { cart.toggle(b.dataset.id); draw(); } };
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.day = b.dataset.d; draw(); } };
  $('#times').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.time = b.dataset.t; draw(); } };
  ['#car', '#note', '#name'].forEach(s => { $(s).oninput = draw; });
  $('#send').onclick = () => {
    const car = $('#car').value.trim(), n = $('#name').value.trim(), w = what();
    const miss = !car ? 'Напишите марку и модель' : !w ? 'Напишите, что случилось' : !st.day ? 'Выберите день' : !st.time ? 'Выберите время' : !n ? 'Напишите имя' : '';
    $('.err').textContent = miss; if (miss) return;
    const m = ['Здравствуйте! Хочу записаться в сервис.', `Машина: ${car}`, `Что случилось: ${w}`, `Когда удобно: ${st.day}, ${st.time.toLowerCase()}`, `Имя: ${n}`].join('\n');
    $('.order').classList.add('sent');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(m)}`, '_blank', 'noopener');
  };
  draw();
}
function visit() {
  const { d } = bishkek();
  $$('.hours tr').forEach(r => r.classList.toggle('today', r.dataset.d === '0' ? d === 0 : d !== 0));
}
shell();
({ index: home, prices, book, visit }[document.body.dataset.page] || (() => {}))();
reveal();
