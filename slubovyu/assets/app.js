const WA = '996709665556';
const IG = 'https://instagram.com/slubovyu_salon.kg';
const ASK = 'по запросу';
const GROUPS = [
  ['hair', 'Волосы', [
    ['mcut', 'Мужская стрижка', '', '500–800'],
    ['wcut', 'Женская стрижка', '', '800–1 200'],
    ['kidm', 'Детская стрижка', 'мужская', '400–600'],
    ['kidw', 'Детская стрижка', 'женская', '500–900'],
    ['fringe', 'Стрижка чёлки', '', '300–400'],
    ['style', 'Укладка', '', '800–1 500'],
    ['hairdo', 'Причёска', '', '1 000–2 500'],
    ['event', 'Свадебные и вечерние причёски', '', ASK],
    ['spa', 'SPA-уход для глубокого восстановления волос', '', '2 500–5 000'],
    ['roots', 'Окрашивание корней', 'без стоимости красителя', '1 000–1 500'],
    ['tone', 'Окрашивание в один тон', 'с красителем', '1 800–3 500'],
    ['color', 'Сложное окрашивание', 'все техники', '7 000–16 000'],
    ['perm', 'Женская химзавивка', '', ASK]
  ], 'Стоимость сложного окрашивания зависит от длины волос, густоты и сложности выполнения работы.'],
  ['nails', 'Ногти', [
    ['mani0', 'Маникюр гигиенический', '', '800'],
    ['mani', 'Маникюр с покрытием', '', '1 400'],
    ['ext', 'Наращивание ногтей', 'в зависимости от длины', '2 000–2 500'],
    ['fix1', 'Ремонт одного ногтя', '', '200'],
    ['fix2', 'Ремонт наращенных ногтей', '', '300'],
    ['off1', 'Снятие с последующим покрытием', '', 'FREE'],
    ['off2', 'Снятие без последующего покрытия', '', '300'],
    ['off3', 'Снятие наращенных ногтей', 'без последующего покрытия', '400'],
    ['pedi0', 'Педикюр гигиенический', 'SMART/КОМБИ', '1 500'],
    ['pedx', 'Педикюр EXPRESS', 'обработка пальцев, с покрытием гель-лак', 'от 1 000–1 400'],
    ['heel', 'Обработка пяток', '', '1 000'],
    ['pedi', 'Педикюр с покрытием гель-лак', '', '1 900'],
    ['pedx2', 'Педикюр EXPRESS с покрытием гель-лак', '', '1 500'],
    ['corn', 'Обработка мозолей', 'стержневые/обычные', '300']
  ], 'Френч, дизайн, стразы, вросшие ногти: доплата +200.'],
  ['sugar', 'Шугаринг', [
    ['s1', 'Ноги полностью', '', '1 000'],
    ['s2', 'Ноги до колен', '', '700'],
    ['s3', 'Руки полностью', '', '900'],
    ['s4', 'Руки до локтя', '', '700'],
    ['s5', 'Глубокое бикини', '', '1 000'],
    ['s6', 'Подмышки', '', '350'],
    ['s7', 'Живот полностью', '', '700'],
    ['s8', 'Полоска живота', '', '300'],
    ['s9', 'Спина полностью', '', '1 200'],
    ['s10', 'Поясница', '', '600'],
    ['s11', 'Ягодицы', '', '1 000'],
    ['s12', 'Затылок', '', '600'],
    ['s13', 'Грудная клетка', '', '600'],
    ['s14', 'Лицо полностью', '', '700'],
    ['s15', 'Усики', '', '300'],
    ['s16', 'Бакенбарды', '', '500'],
    ['wax', 'Восковая эпиляция', '', ASK]
  ]],
  ['brows', 'Брови и ресницы', [
    ['brow', 'Коррекция бровей', 'тридинг', '600'],
    ['brow2', 'Коррекция бровей', 'тридинг + краска', '800'],
    ['arch1', 'Архитектура бровей', 'краска + воск', '900'],
    ['arch2', 'Архитектура бровей', 'хна + воск', '1 100'],
    ['musl', 'Мусульманская коррекция', '', '1 200'],
    ['lam', 'Ламинирование бровей', '', '1 500'],
    ['lash', 'Окрашивание ресниц', '', '400'],
    ['lash2', 'Наращивание ресниц', '', ASK],
    ['lash3', 'Ламинирование ресниц', '', ASK]
  ]],
  ['face', 'Макияж', [
    ['day', 'Дневной макияж', '', '1 200–1 400'],
    ['makeup', 'Вечерний макияж', '', '1 300–1 600'],
    ['wed', 'Свадебный макияж', '', '2 500–3 000'],
    ['fast', 'Экспресс-макияж', '', '1 000–1 200']
  ], 'Вне рабочего времени прайс повышается по двойному тарифу.']
];
const QUICK = ['wcut', 'mcut', 'kidw', 'color', 'style', 'event', 'perm', 'mani', 'pedi', 'brow', 'makeup'];
const PARTS = [['Утро', '10:00–13:00', 780], ['День', '13:00–16:00', 960], ['Вечер', '16:00–20:00', 1200]];
const ALL = {};
GROUPS.forEach(g => g[2].forEach(r => { ALL[r[0]] = r; }));
const title = id => {
  const [, n, note] = ALL[id];
  if (g(id) === 'sugar') return `Шугаринг: ${n.toLowerCase()}`;
  return note && /^(Детская|Коррекция|Архитектура)/.test(n) ? `${n} (${note})` : n;
};
const g = id => GROUPS.find(x => x[2].some(r => r[0] === id))[0];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.23,1,.32,1)';
const HEART = '<svg class="heart" viewBox="0 0 24 22" aria-hidden="true"><path d="M12 21S1 14 1 6.8A5.8 5.8 0 0 1 12 4.2 5.8 5.8 0 0 1 23 6.8C23 14 12 21 12 21z"/></svg>';
let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('slubovyu-order') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('slubovyu-order', JSON.stringify(v)); } catch {} count(true); },
  toggle(id) { const c = cart.get(); cart.set(c.includes(id) ? c.filter(x => x !== id) : [...c, id]); }
};
function count(pop) {
  const n = cart.get().length;
  $$('.cnt').forEach(b => {
    b.textContent = n; b.hidden = !n;
    if (pop && motion && n) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 240, easing: EASE });
  });
}
function bishkekMinutes() {
  const p = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bishkek' }).formatToParts(new Date());
  const v = t => +p.find(x => x.type === t).value;
  return v('hour') * 60 + v('minute');
}
function openText() {
  const m = bishkekMinutes();
  return m < 600 ? 'Сегодня откроемся в 10:00.' : m < 1200 ? 'Сегодня работаем до 20:00.' : 'Завтра откроемся в 10:00.';
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => k === page ? ' aria-current="page"' : '';
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия для «С любовью». <a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">С любовью</a>
  <nav class="links" aria-label="Разделы">${[['index', 'Главная'], ['prices', 'Цены'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <a class="btn sm" href="book.html">Запись<span class="cnt" hidden>0</span></a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><div><b class="logo">С любовью</b>Салон красоты, улица Исы Ахунбаева, 137</div><div>Каждый день 10:00–20:00<br>Цены по прайс-листу салона в 2ГИС</div><div><a href="https://wa.me/${WA}">WhatsApp</a><a href="${IG}">Instagram</a></div></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${[['index', 'Главная'], ['prices', 'Цены'], ['book', 'Запись'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}${k === 'book' ? '<span class="cnt" hidden>0</span>' : ''}</a>`).join('')}</nav>`);
  count();
}
function reveal() {
  $$('.q,.lead,.gal .stamp,.blk,.card,.letter').forEach(el => {
    const i = [...el.parentElement.children].indexOf(el);
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 55}ms`;
  });
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('in'));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in'); io.unobserve(e.target);
    setTimeout(() => { e.target.style.transitionDelay = ''; }, 1000);
  }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
}
const row = ([id, n, note, p]) => `<button class="row" data-id="${id}" aria-pressed="false"><span class="n">${esc(n)}${note ? `<small>${esc(note)}</small>` : ''}</span><span class="p${p === ASK ? ' ask' : ''}">${esc(p)}</span>${HEART}</button>`;
function bind(box) {
  const sync = () => { const c = cart.get(); $$('.row', box).forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id))); };
  box.addEventListener('click', e => { const b = e.target.closest('.row'); if (b) { cart.toggle(b.dataset.id); sync(); } });
  sync();
}
function home() {
  const box = $('.rows');
  box.innerHTML = box.dataset.ids.split(',').map(id => row(ALL[id])).join('');
  bind(box);
  $('.live').textContent = openText();
}
function prices() {
  $('.jump').innerHTML = GROUPS.map(x => `<a href="#${x[0]}">${x[1]}</a>`).join('');
  const box = $('#price');
  box.innerHTML = GROUPS.map(([id, t, rows, note]) => `<section class="grp" id="${id}"><h2>${t}</h2><div class="rows">${rows.map(row).join('')}</div>${note ? `<p class="pn">${esc(note)}</p>` : ''}</section>`).join('');
  bind(box);
}
function book() {
  const st = { day: null, part: null };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const now = bishkekMinutes(), skip = now >= 1140 ? 1 : 0;
  const days = Array.from({ length: 6 }, (_, i) => new Date(Date.now() + (i + skip) * 864e5));
  const label = i => i + skip === 0 ? 'Сегодня' : i + skip === 1 ? 'Завтра' : wd.format(days[i]);
  const today = () => !skip && st.day === fmt.format(days[0]);
  const chips = () => [...new Set([...QUICK, ...cart.get()])];
  $('#days').innerHTML = days.map((d, i) => `<button class="chip" data-d="${fmt.format(d)}" aria-pressed="false">${label(i)}<small>${fmt.format(d)}</small></button>`).join('');
  $('#parts').innerHTML = PARTS.map(([t, h]) => `<button class="chip" data-p="${t}" aria-pressed="false">${t}<small>${h}</small></button>`).join('');
  const put = (el, h) => { if (el.innerHTML === h) return; el.innerHTML = h; if (motion) el.animate([{ opacity: .25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 200, easing: EASE }); };
  const when = () => { const p = PARTS.find(x => x[0] === st.part); return st.day && p ? `${st.day}, ${p[0].toLowerCase()} (${p[1]})` : st.day || (p ? `${p[0].toLowerCase()} (${p[1]})` : ''); };
  const draw = () => {
    const c = cart.get();
    $('.note').classList.remove('sent');
    $('#svc').innerHTML = chips().map(id => `<button class="chip" data-id="${id}" aria-pressed="${c.includes(id)}">${esc(title(id))}</button>`).join('');
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === st.day));
    $$('#parts .chip').forEach((b, i) => {
      const late = today() && now >= PARTS[i][2];
      b.disabled = late; if (late && st.part === b.dataset.p) st.part = null;
      b.setAttribute('aria-pressed', b.dataset.p === st.part);
    });
    put($('#o-svc'), c.map(id => esc(title(id))).join('<br>') || '—');
    put($('#o-when'), esc(when()) || '—');
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
({ index: home, prices, book, visit }[document.body.dataset.page] || (() => {}))();
reveal();
