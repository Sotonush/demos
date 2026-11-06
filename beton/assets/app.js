const WA = '996501626222';
const SERVICES = [
  ['cut', 'Мужская стрижка', 'от 600 сом'],
  ['kid', 'Детская стрижка', 'от 400 сом'],
  ['beard', 'Стрижка бороды', 'от 300 сом'],
  ['art', 'Рисунок на стрижке', 'от 200 сом'],
  ['style', 'Укладка', 'от 300 сом'],
  ['ps', 'PlayStation после стрижки', 'от 120 сом']
];
const MASTERS = ['Любой мастер', 'Даниел', 'Сыргак', 'Айлин'];
const BR = [
  ['Курманжан датка, 268', '4,8', '70000001093441776'],
  ['Исы Ахунбаева, 180', '4,7', '70000001069233718'],
  ['Чынгыза Айтматова, 120', '4,9', '70000001083294284'],
  ['Анкара, 139', '4,9', '70000001113478655'],
  ['Саякбая Каралаева, 13/1а', '4,9', '70000001092995860']
];
const ALL = Object.fromEntries(SERVICES.map(s => [s[0], s[1]]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.23,1,.32,1)';
let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('beton-order') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('beton-order', JSON.stringify(v)); } catch {} count(true); },
  toggle(id) { const c = cart.get(); cart.set(c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
};
function count(pop) {
  const b = $('.cnt'); if (!b) return;
  b.textContent = cart.get().length;
  if (pop && motion) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 240, easing: EASE });
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => k === page ? ' aria-current="page"' : '';
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия <a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">BETON</a>
  <nav class="links" aria-label="Разделы">${[['index', 'Главная'], ['prices', 'Услуги'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <a class="btn" href="book.html">Запись<span class="cnt">0</span></a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><div class="g"><div><b>BETON</b>5 барбершопов в Бишкеке</div><div>Цены на сайте примерные</div><div><a href="https://wa.me/${WA}">WhatsApp</a><a href="https://instagram.com/beton_barbershop_kokzhar">Instagram</a></div></div></div></footer>
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
function branches(box, st, cb) {
  box.innerHTML = BR.map(([a, r], i) => `<button class="br" data-i="${i}" aria-pressed="false"><b>${a}</b><span>${r} в 2ГИС</span></button>`).join('');
  const sync = () => $$('.br', box).forEach(b => b.setAttribute('aria-pressed', +b.dataset.i === st.i));
  box.onclick = e => { const b = e.target.closest('.br'); if (b) { st.i = +b.dataset.i; try { localStorage.setItem('beton-branch', st.i); } catch {} sync(); if (cb) cb(); } };
  sync();
}
function savedBranch() { try { const v = localStorage.getItem('beton-branch'); return v === null ? null : +v; } catch { return null; } }
function home() {
  $$('.bulbs g').forEach((t, i) => { t.style.animationDelay = `${120 + i * 90}ms`; });
  $$('.bulbs circle').forEach((c, i) => { c.style.animationDelay = `${-(i % 9) * .28}s`; });
  cards($('.svc'));
  branches($('.bran'), { i: savedBranch() });
}
function prices() { cards($('.svc')); }
function book() {
  const st = { day: null, time: null, i: savedBranch(), m: MASTERS[0] };
  branches($('#br'), st, () => draw());
  $('#ms').innerHTML = MASTERS.map(m => `<button class="chip" data-m="${m}" aria-pressed="false">${m}</button>`).join('');
  $('#ms').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.m = b.dataset.m; draw(); } };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const days = Array.from({ length: 8 }, (_, i) => new Date(Date.now() + i * 864e5));
  const times = ['Утром', 'Днём', 'Вечером'];
  $('#svc').innerHTML = SERVICES.map(([id, n]) => `<button class="chip" data-id="${id}" aria-pressed="false">${n}</button>`).join('');
  $('#days').innerHTML = days.map((d, i) => `<button class="chip" data-d="${fmt.format(d)}" aria-pressed="false">${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wd.format(d)}<small>${fmt.format(d)}</small></button>`).join('');
  $('#times').innerHTML = times.map(t => `<button class="chip" data-t="${t}" aria-pressed="false">${t}</button>`).join('');
  const put = (el, h) => { if (el.innerHTML === h) return; el.innerHTML = h; if (motion) el.animate([{ opacity: .25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE }); };
  const draw = () => {
    const c = cart.get();
    $('.order').classList.remove('sent');
    $$('#svc .chip').forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id)));
    $$('#ms .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === st.m));
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === st.day));
    $$('#times .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === st.time));
    put($('#o-svc'), c.map(id => esc(ALL[id])).join('<br>') || '—');
    put($('#o-br'), st.i === null ? '—' : esc(BR[st.i][0]));
    put($('#o-when'), esc([st.day, st.time].filter(Boolean).join(', ')) || '—');
    $('#o-name').textContent = $('#name').value.trim() || '—';
  };
  $('#svc').onclick = e => { const b = e.target.closest('.chip'); if (b) { cart.toggle(b.dataset.id); draw(); } };
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.day = b.dataset.d; draw(); } };
  $('#times').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.time = b.dataset.t; draw(); } };
  $('#name').oninput = draw;
  $('#send').onclick = () => {
    const c = cart.get(), n = $('#name').value.trim();
    const miss = st.i === null ? 'Выберите филиал' : !c.length ? 'Выберите услугу' : !st.day ? 'Выберите день' : !st.time ? 'Выберите время' : !n ? 'Напишите имя' : '';
    $('.err').textContent = miss; if (miss) return;
    const m = ['Здравствуйте! Хочу записаться.', `Филиал: ${BR[st.i][0]}`, `Мастер: ${st.m}`, `Услуги: ${c.map(id => ALL[id]).join(', ')}`, `Когда: ${st.day}, ${st.time}`, `Имя: ${n}`].join('\n');
    $('.order').classList.add('sent');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(m)}`, '_blank', 'noopener');
  };
  draw();
}
function visit() { $('#list').innerHTML = BR.map(([a, r, id]) => `<div class="card static"><h3>${a}</h3>${r} в 2ГИС<a href="https://2gis.kg/bishkek/firm/${id}">Маршрут в 2ГИС</a></div>`).join(''); }
shell();
({ index: home, prices, book, visit }[document.body.dataset.page] || (() => {}))();
reveal();
