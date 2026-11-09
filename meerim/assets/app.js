const WA = '996770818168';
const IG = 'https://instagram.com/dr_anarbekov';
const GROUPS = [
  ['exam', 'Осмотр', [
    ['consult', 'Консультация и осмотр', 'С чего начать, если не знаете, что нужно']
  ]],
  ['care', 'Лечение', [
    ['treat', 'Лечение зубов', 'Кариес, пломбы'],
    ['clean', 'Профессиональная чистка', '']
  ]],
  ['surg', 'Удаление', [
    ['extract', 'Удаление зуба', '']
  ]],
  ['prost', 'Протезирование', [
    ['prosth', 'Коронки и протезы', '']
  ]]
];
const PARTS = [['Утро', 'до 12:00', 720], ['День', '12:00–15:00', 900], ['Вечер', 'после 15:00', 1080]];
const ALL = {};
GROUPS.forEach(g => g[2].forEach(r => { ALL[r[0]] = r; }));
const QUICK = Object.keys(ALL);
const title = id => ALL[id][1];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PLUS = '<svg class="plus" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h14M10 3v14"/></svg>';
let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('meerim-order') || '[]').filter(id => ALL[id]); } catch { return mem.filter(id => ALL[id]); } },
  set(v) { mem = v; try { localStorage.setItem('meerim-order', JSON.stringify(v)); } catch {} count(); },
  toggle(id) { const c = cart.get(); cart.set(c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
};
function count() {
  const n = cart.get().length;
  $$('.cnt').forEach(b => { b.textContent = n; b.hidden = !n; });
}
function localMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bishkek' }).formatToParts(new Date());
  const v = t => +p.find(x => x.type === t).value;
  return v('hour') * 60 + v('minute');
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => k === page ? ' aria-current="page"' : '';
  const items = [['index', 'Главная'], ['prices', 'Услуги'], ['book', 'Запись'], ['visit', 'Контакты']];
  const link = ([k, t]) => `<a href="${k}.html"${cur(k)}>${t}${k === 'book' ? '<span class="cnt" hidden>0</span>' : ''}</a>`;
  const top = items.filter(i => i[0] !== 'book').map(link).join('') + `<a class="btn" href="book.html"${cur('book')}>Записаться<span class="cnt" hidden>0</span></a>`;
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия сайта для стоматологии «Мээрим». <a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html"><i></i>Мээрим<small>стоматология</small></a>
  <nav class="links" aria-label="Разделы">${top}</nav></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><p>Стоматология «Мээрим», Бишкек</p><p><a href="https://wa.me/${WA}">WhatsApp</a><a href="${IG}">Instagram</a></p></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${items.map(link).join('')}</nav>`);
  const t = $('.top');
  addEventListener('scroll', () => t.classList.toggle('sc', scrollY > 8), { passive: true });
  count();
}
const row = ([id, n, note]) => `<button class="row" type="button" data-id="${id}" aria-pressed="false"><span class="n">${esc(n)}${note ? `<small>${esc(note)}</small>` : ''}</span>${PLUS}</button>`;
function smooth() {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const s = document.createElement('script');
  s.src = 'assets/lenis.min.js';
  s.onload = () => {
    const lenis = new Lenis({ lerp: .085, wheelMultiplier: .9 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  };
  document.head.append(s);
}
function reveal() {
  if (!('IntersectionObserver' in window)) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.documentElement.classList.add('anim');
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
  $$('.head,.list a,.ease div,.steps h2,.step,.faqs h2,.faq,.end .box').forEach((el, i) => {
    el.classList.add('rv');
    el.style.transitionDelay = `${(i % 3) * 70}ms`;
    io.observe(el);
  });
}
function home() {
  $$('.list a[data-id]').forEach(a => a.addEventListener('click', () => { const c = cart.get(); if (!c.includes(a.dataset.id)) cart.set([...c, a.dataset.id]); }));
  reveal();
}
function prices() {
  const box = $('#price');
  box.innerHTML = GROUPS.map(([id, t, rows]) => `<section class="grp" id="${id}"><h2>${t}</h2><div class="rows">${rows.map(row).join('')}</div></section>`).join('');
  const sync = () => { const c = cart.get(); $$('.row', box).forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id))); };
  box.addEventListener('click', e => { const b = e.target.closest('.row'); if (b) { cart.toggle(b.dataset.id); sync(); } });
  sync();
}
function book() {
  const st = { day: null, part: null };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const now = localMinutes();
  const days = [];
  for (let i = now >= 1080 ? 1 : 0; days.length < 6; i++) days.push({ d: new Date(Date.now() + i * 864e5), i });
  const label = ({ d, i }) => i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wd.format(d);
  const today = () => days[0].i === 0 && st.day === fmt.format(days[0].d);
  const dayText = () => { const x = days.find(x => fmt.format(x.d) === st.day); return x && x.i < 2 ? `${label(x).toLowerCase()}, ${st.day}` : st.day; };
  $('#days').innerHTML = days.map(x => `<button class="chip" type="button" data-d="${fmt.format(x.d)}" aria-pressed="false">${label(x)}<small>${fmt.format(x.d)}</small></button>`).join('');
  $('#parts').innerHTML = PARTS.map(([t, h]) => `<button class="chip" type="button" data-p="${t}" aria-pressed="false">${t}<small>${h}</small></button>`).join('');
  const when = () => { const p = PARTS.find(x => x[0] === st.part); return st.day && p ? `${dayText()}, ${p[0].toLowerCase()} (${p[1]})` : ''; };
  const draw = () => {
    const c = cart.get();
    $('.note').classList.remove('sent');
    $('#svc').innerHTML = QUICK.map(id => `<button class="chip" type="button" data-id="${id}" aria-pressed="${c.includes(id)}">${esc(title(id))}</button>`).join('');
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === st.day));
    $$('#parts .chip').forEach((b, i) => {
      const late = today() && now >= PARTS[i][2];
      b.disabled = late; if (late && st.part === b.dataset.p) st.part = null;
      b.setAttribute('aria-pressed', b.dataset.p === st.part);
    });
    $('#o-svc').innerHTML = c.map(id => esc(title(id))).join('<br>') || '—';
    $('#o-when').textContent = when() || st.day || '—';
    $('#o-name').textContent = $('#name').value.trim() || '—';
  };
  $('#svc').onclick = e => { const b = e.target.closest('.chip'); if (b) { cart.toggle(b.dataset.id); draw(); } };
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (b) { st.day = b.dataset.d; draw(); } };
  $('#parts').onclick = e => { const b = e.target.closest('.chip'); if (b && !b.disabled) { st.part = b.dataset.p; draw(); } };
  $('#name').oninput = draw;
  $('#send').onclick = () => {
    const c = cart.get(), n = $('#name').value.trim();
    const miss = !c.length ? 'Выберите услугу' : !st.day ? 'Выберите день' : !st.part ? 'Выберите время дня' : !n ? 'Напишите имя' : '';
    $('.err').textContent = miss; if (miss) return;
    const m = ['Здравствуйте! Хочу записаться в стоматологию «Мээрим».', `Услуга: ${c.map(title).join(', ')}`, `Когда удобно: ${when()}`, `Имя: ${n}`].join('\n');
    $('.note').classList.add('sent');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(m)}`, '_blank', 'noopener');
  };
  draw();
}
shell();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) smooth();
({ index: home, prices, book }[document.body.dataset.page] || (() => {}))();
