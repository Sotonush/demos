const WA = '996706351553';
const IG = 'https://instagram.com/stomik_halil';
const GIS = 'https://2gis.kg/kara-balta/firm/70000001063899496';
const TOOTH = '<svg viewBox="0 0 200 240" aria-hidden="true"><path d="M100 30C84 18 62 10 44 14 20 19 8 42 10 70c2 26 14 46 20 76 5 26 8 66 26 80 18 12 24-20 28-40 3-16 8-28 16-28s13 12 16 28c4 20 10 52 28 40 18-14 21-54 26-80 6-30 18-50 20-76 2-28-10-51-34-56-18-4-40 4-56 16Z"/></svg>';
const GROUPS = [
  ['free', 'Консультация', [
    ['consult', 'Бесплатная консультация', '', '']
  ]],
  ['adult', 'Взрослым', [
    ['surgeon', 'Стоматолог-хирург', '', ''],
    ['ortho', 'Ортодонт', '', ''],
    ['prosth', 'Стоматолог-ортопед', '', '']
  ]],
  ['kids', 'Детям', [
    ['ktherapy', 'Детский стоматолог-терапевт', '', ''],
    ['kortho', 'Детский ортодонт', '', '']
  ]],
  ['scan', 'Диагностика', [
    ['xray', 'Прицельный снимок зуба', '', '']
  ]]
];
const PARTS = [['Утро', '09:00–12:00', 720], ['День', '12:00–15:00', 900], ['Конец дня', '15:00–17:00', 1020]];
const OPEN = 540, CLOSE = 1020, LAST_CALL = 960;
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
  get() { try { return JSON.parse(localStorage.getItem('halil-order') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('halil-order', JSON.stringify(v)); } catch {} count(); },
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
const isSunday = d => new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bishkek' }).format(d) === 'Sun';
function openText() {
  const m = localMinutes(), now = new Date(), next = new Date(Date.now() + 864e5);
  if (isSunday(now)) return 'Сегодня выходной. Завтра откроемся в 09:00.';
  if (m < OPEN) return 'Сегодня откроемся в 09:00.';
  if (m < CLOSE) return 'Сегодня работаем до 17:00.';
  return isSunday(next) ? 'Завтра выходной. Откроемся в понедельник в 09:00.' : 'Завтра откроемся в 09:00.';
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => k === page ? ' aria-current="page"' : '';
  const nav = [['index', 'Главная'], ['prices', 'Услуги'], ['book', 'Запись'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}${k === 'book' ? '<span class="cnt" hidden>0</span>' : ''}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия для стоматологии «Халил». <a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">${TOOTH}Халил</a>
  <nav class="links" aria-label="Разделы">${nav}</nav></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><p>Улица Кожомбердиева, 126Б, Кара-Балта</p><p><a href="https://wa.me/${WA}">WhatsApp</a><a href="${IG}">Instagram</a><a href="${GIS}">2ГИС</a></p></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${nav}</nav>`);
  count();
}
const row = ([id, n, note, p]) => `<button class="row" type="button" data-id="${id}" aria-pressed="false"><span class="n">${esc(n)}${note ? `<small>${esc(note)}</small>` : ''}</span>${p ? `<span class="p">${esc(p)}</span>` : ''}${PLUS}</button>`;
function smooth() {
  if (!matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const s = document.createElement('script');
  s.src = 'assets/lenis.min.js';
  s.onload = () => {
    const lenis = new Lenis({ lerp: .09, wheelMultiplier: .9 });
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
  $$('.head,.big a,.steps h2,.step,.q,.pay p,.faqs h2,.faq,.mapbox,.addr,.end h2,.end .btn').forEach((el, i) => {
    el.classList.add('rv');
    el.style.transitionDelay = `${(i % 3) * 70}ms`;
    io.observe(el);
  });
}
function home() {
  const b = $('.morebtn');
  b.onclick = () => { $('.quotes').classList.add('all'); b.hidden = true; };
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
  for (let i = now >= LAST_CALL ? 1 : 0; days.length < 6; i++) {
    const d = new Date(Date.now() + i * 864e5);
    if (!isSunday(d)) days.push({ d, i });
  }
  const label = ({ d, i }) => i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wd.format(d);
  const today = () => days[0].i === 0 && st.day === fmt.format(days[0].d);
  $('#days').innerHTML = days.map(x => `<button class="chip" type="button" data-d="${fmt.format(x.d)}" aria-pressed="false">${label(x)}<small>${fmt.format(x.d)}</small></button>`).join('');
  $('#parts').innerHTML = PARTS.map(([t, h]) => `<button class="chip" type="button" data-p="${t}" aria-pressed="false">${t}<small>${h}</small></button>`).join('');
  const when = () => { const p = PARTS.find(x => x[0] === st.part); return st.day && p ? `${st.day}, ${p[0].toLowerCase()} (${p[1]})` : st.day || (p ? `${p[0].toLowerCase()} (${p[1]})` : ''); };
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
    $('#o-when').textContent = when() || '—';
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
    const m = ['Здравствуйте! Хочу записаться.', `Услуги: ${c.map(title).join(', ')}`, `Когда: ${when()}`, `Имя: ${n}`].join('\n');
    $('.note').classList.add('sent');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(m)}`, '_blank', 'noopener');
  };
  draw();
}
function visit() { $('.live').textContent = openText(); }
shell();
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) smooth();
({ index: home, prices, book, visit }[document.body.dataset.page] || (() => {}))();
