const WA = '996506655666';
const GROUPS = [
  { id: 'cut', t: 'Стрижки', k: 'Чач кызматтар', items: [['mcut', 'Мужская стрижка', '700–800 сом'], ['scis', 'Стрижка ножницами', '700–900 сом'], ['clip', 'Стрижка машинкой, 1–2 насадки', '400–600 сом'], ['kid', 'Детская стрижка', '500–699 сом'], ['headshave', 'Бритьё головы опасной бритвой', '600–800 сом']] },
  { id: 'shave', t: 'Борода и бритьё', k: 'Кыруу', items: [['royal', 'Королевское бритьё опасной бритвой', '700–800 сом'], ['beard', 'Стрижка бороды', '600–800 сом'], ['beard6', 'Стрижка бороды и усов до 6 мм', '600–800 сом'], ['model', 'Моделирование бороды шейвером', '500–700 сом'], ['clean', 'Бритьё начисто шейвером', '400–600 сом']] },
  { id: 'extra', t: 'Дополнительно', k: 'Кошумча кызматтар', items: [['style', 'Укладка без стрижки', '400–500 сом'], ['edge', 'Окантовка головы', '400–500 сом'], ['wax', 'Воск: уши и нос', '300–500 сом'], ['tonehead', 'Тонирование головы', '600–800 сом'], ['tonebeard', 'Тонирование бороды', '500–800 сом'], ['perm', 'Химическая (био) завивка', '3 000 сом'], ['nishman', 'Уход за лицом Nishman', '700–1 000 сом']] }
];
const COMBOS = [
  ['friends', 'Друг + друг', 'Приходите вдвоём', '1 300 сом'],
  ['dadson', 'Папа + сын', 'Стрижка для двоих', '1 200 сом'],
  ['spa', 'Стрижка + SPA + воск', 'Мужская стрижка и уход', '1 300 сом'],
  ['beardspa', 'Борода + SPA + воск', 'Моделирование бороды и уход', '1 200 сом'],
  ['full', 'Полный комплекс', 'Стрижка, борода, SPA и воск', '1 700 сом']
];
const ALL = Object.fromEntries([...GROUPS.flatMap(g => g.items.map(i => [i[0], i[1]])), ...COMBOS.map(c => [c[0], c[1]])]);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.23,1,.32,1)';
let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('swat-order') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('swat-order', JSON.stringify(v)); } catch {} count(true); },
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
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия сайта для S.W.A.T</div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">S<em>.</em>W<em>.</em>A<em>.</em>T</a>
  <nav class="links" aria-label="Разделы">${[['index', 'Главная'], ['prices', 'Цены'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <a class="btn" href="book.html">Запись<span class="cnt">0</span></a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap g"><div class="g" style="width:100%"><div><b>S.W.A.T</b>Барбершоп, Киевская 155</div><div>Каждый день 10:00–21:00</div><div><a href="https://wa.me/${WA}">WhatsApp</a><a href="https://instagram.com/s.w.a.t_barbershop">Instagram</a></div></div></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${[['index', 'Главная'], ['prices', 'Цены'], ['book', 'Запись'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>`);
  count();
}
function reveal() {
  $$('.stats>div,.combo,.shot,.rep,.card,.grp,.blk,.map').forEach(el => {
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
function home() {
  const hero = $('.hero'), scope = $('.scope');
  if (motion && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      hero.classList.add('aim');
      scope.style.transform = `translate(${e.clientX - r.left}px,${e.clientY - r.top}px)`;
    });
    hero.addEventListener('pointerleave', () => hero.classList.remove('aim'));
  }
  $('.combos').innerHTML = COMBOS.map(([id, t, s, p]) => `<button class="combo" data-id="${id}" aria-pressed="false"><h3>${t}</h3><small>${s}</small><b>${p}</b></button>`).join('');
  const sync = () => { const c = cart.get(); $$('.combo').forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id))); };
  $('.combos').onclick = e => { const b = e.target.closest('.combo'); if (b) { cart.toggle(b.dataset.id); sync(); } };
  sync();
}
function prices() {
  $('#list').innerHTML = GROUPS.map(g => `<article class="grp"><div><h2>${g.t}</h2><small>${g.k}</small></div><div>${g.items.map(([id, n, p]) => `<div class="row"><div>${n}</div><span>${p}</span><button class="add" data-id="${id}" aria-label="Добавить: ${esc(n)}" aria-pressed="false">+</button></div>`).join('')}</div></article>`).join('');
  const sync = () => { const c = cart.get(); $$('.add').forEach(b => { const on = c.includes(b.dataset.id); b.setAttribute('aria-pressed', on); b.textContent = on ? '✓' : '+'; }); };
  $('#list').onclick = e => { const b = e.target.closest('.add'); if (b) { cart.toggle(b.dataset.id); sync(); } };
  sync();
}
function book() {
  const st = { day: null, time: null };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const days = Array.from({ length: 8 }, (_, i) => new Date(Date.now() + i * 864e5));
  const times = Array.from({ length: 11 }, (_, i) => `${String(10 + i).padStart(2, '0')}:00`);
  $('#svc').innerHTML = [...COMBOS.map(c => [c[0], c[1]]), ...GROUPS.flatMap(g => g.items)].map(([id, n]) => `<button class="chip" data-id="${id}" aria-pressed="false">${n}</button>`).join('');
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
    const m = ['Салам! Хочу записаться.', `Услуги: ${c.map(id => ALL[id]).join(', ')}`, `Когда: ${st.day}, ${st.time}`, `Имя: ${n}`].join('\n');
    $('.order').classList.add('sent');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(m)}`, '_blank', 'noopener');
  };
  draw();
}
function visit() {
  const h = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bishkek' }).format(new Date());
  const open = h >= 10 && h < 21, el = $('.live');
  el.classList.toggle('off', !open);
  el.textContent = open ? 'Сейчас открыто, до 21:00' : 'Сейчас закрыто, откроемся в 10:00';
}
shell();
({ index: home, prices, book, visit }[document.body.dataset.page] || (() => {}))();
reveal();
