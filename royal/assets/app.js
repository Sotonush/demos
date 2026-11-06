const WA = '996703300080';
const SERVICES = [
  ['cut', 'Мужская стрижка', 'от 600 сом'],
  ['kid', 'Детская стрижка', 'от 400 сом'],
  ['beard', 'Оформление бороды', 'от 400 сом'],
  ['shave', 'Королевское бритьё', 'от 600 сом'],
  ['face', 'Чистка лица', 'от 600 сом']
];
const ALL = Object.fromEntries(SERVICES.map(s => [s[0], s[1]]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.23,1,.32,1)';
let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('royal-order') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('royal-order', JSON.stringify(v)); } catch {} count(true); },
  toggle(id) { const c = cart.get(); cart.set(c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
};
function count(pop) {
  const b = $('.cnt'); if (!b) return;
  b.textContent = cart.get().length;
  if (pop && motion) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 240, easing: EASE });
}
function bishkekMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bishkek' }).formatToParts(new Date());
  const v = t => +p.find(x => x.type === t).value;
  return v('hour') * 60 + v('minute');
}
function openText() {
  const m = bishkekMinutes();
  if (m < 600) return { pct: 0, text: 'Откроемся в 10:00' };
  const left = 1440 - m, h = Math.floor(left / 60), mm = left % 60;
  return { pct: (m - 600) / 840 * 100, text: `Сейчас открыто. До закрытия ${h ? h + ' ч ' : ''}${mm} мин` };
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => k === page ? ' aria-current="page"' : '';
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия сайта для барбершопа Роял</div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">Роял</a>
  <nav class="links" aria-label="Разделы">${[['index', 'Главная'], ['prices', 'Услуги'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <a class="btn" href="book.html">Запись<span class="cnt">0</span></a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><div class="g"><div><b>Роял</b>Барбершоп, проспект Чуй 330</div><div>Каждый день 10:00–24:00<br>Цены на сайте примерные</div><div><a href="https://wa.me/${WA}">WhatsApp</a><a href="https://instagram.com/barbershop_royal312">Instagram</a></div></div></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${[['index', 'Главная'], ['prices', 'Услуги'], ['book', 'Запись'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>`);
  count();
}
function reveal() {
  $$('.card,.gal figure,.q,.blk,.map').forEach(el => {
    const i = [...el.parentElement.children].indexOf(el);
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min(i % 5, 4) * 55}ms`;
  });
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('in'));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    setTimeout(() => { e.target.style.transitionDelay = ''; }, 1000);
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}
function cards(box) {
  box.innerHTML = SERVICES.map(([id, n, p]) => `<button class="card" data-id="${id}" aria-pressed="false"><h3>${n}</h3><b>${p}</b></button>`).join('');
  const sync = () => { const c = cart.get(); $$('.card', box).forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id))); };
  box.onclick = e => { const b = e.target.closest('.card'); if (b) { cart.toggle(b.dataset.id); sync(); } };
  sync();
}
function home() {
  cards($('.svc'));
  const o = openText();
  $('.night small').textContent = o.text;
  const run = () => { $('.bar i').style.width = `${o.pct}%`; $('.bar b').style.left = `${o.pct}%`; };
  const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { run(); io.disconnect(); } }, { threshold: .4 });
  io.observe($('.night'));
}
function prices() { cards($('.svc')); }
function book() {
  const st = { day: null, time: null };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const days = Array.from({ length: 8 }, (_, i) => new Date(Date.now() + i * 864e5));
  const times = Array.from({ length: 14 }, (_, i) => `${10 + i}:00`);
  $('#svc').innerHTML = SERVICES.map(([id, n]) => `<button class="chip" data-id="${id}" aria-pressed="false">${n}</button>`).join('');
  $('#days').innerHTML = days.map((d, i) => `<button class="chip" data-d="${fmt.format(d)}" aria-pressed="false">${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wd.format(d)}<small>${fmt.format(d)}</small></button>`).join('');
  $('#times').innerHTML = times.map(t => `<button class="chip" data-t="${t}" aria-pressed="false">${t}</button>`).join('');
  const put = (el, h) => { if (el.innerHTML === h) return; el.innerHTML = h; if (motion) el.animate([{ opacity: .25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE }); };
  const draw = () => {
    const c = cart.get();
    $('.order').classList.remove('sent');
    $$('#svc .chip').forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id)));
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === st.day));
    $$('#times .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === st.time));
    put($('#o-svc'), c.map(id => esc(ALL[id])).join('<br>') || '—');
    put($('#o-when'), esc([st.day, st.time].filter(Boolean).join(', ')) || '—');
    $('#o-name').textContent = $('#name').value.trim() || '—';
  };
  $('#svc').onclick = e => { const b = e.target.closest('.chip'); if (b) { cart.toggle(b.dataset.id); draw(); } };
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.day = b.dataset.d; draw(); } };
  $('#times').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.time = b.dataset.t; draw(); } };
  $('#name').oninput = draw;
  $('#send').onclick = () => {
    const c = cart.get(), n = $('#name').value.trim();
    const miss = !c.length ? 'Выберите услугу' : !st.day ? 'Выберите день' : !st.time ? 'Выберите время' : !n ? 'Напишите имя' : '';
    $('.err').textContent = miss; if (miss) return;
    const m = ['Здравствуйте! Хочу записаться.', `Услуги: ${c.map(id => ALL[id]).join(', ')}`, `Когда: ${st.day}, ${st.time}`, `Имя: ${n}`].join('\n');
    $('.order').classList.add('sent');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(m)}`, '_blank', 'noopener');
  };
  draw();
}
function visit() { $('.live').textContent = openText().text; }
shell();
({ index: home, prices, book, visit }[document.body.dataset.page] || (() => {}))();
reveal();
