const WA = '996555346212';
const HALLS = [
  { id: 'hair', n: '01', title: 'Стрижки и укладки', img: 'p6', text: 'Женские, мужские и детские стрижки, укладка, косы.', items: [
    ['cut-w', 'Женская стрижка', 'от 850 сом'], ['cut-m', 'Мужская стрижка', 'от 650 сом'], ['cut-style', 'Стрижка + укладка', 'от 950 сом'], ['kid', 'Детская стрижка', 'от 500 сом'], ['braid', 'Плетение кос', 'от 600 сом'], ['root', 'Прикорневой объём', 'от 1 500 сом']] },
  { id: 'color', n: '02', title: 'Окрашивание и уход', img: 'p2', text: 'Окрашивание любой сложности, ботокс и полировка волос.', items: [
    ['color', 'Окрашивание', 'от 2 500 сом'], ['color-hard', 'Сложное окрашивание', 'от 5 000 сом'], ['botox', 'Ботокс волос', 'от 3 000 сом'], ['polish', 'Полировка волос', 'от 800 сом'], ['perm', 'Женская химзавивка', 'от 2 500 сом']] },
  { id: 'event', n: '03', title: 'Причёски и макияж', img: 'p1', text: 'На свадьбу, выпускной и любой праздник.', items: [
    ['updo', 'Вечерняя причёска', 'от 1 800 сом'], ['wedding', 'Свадебная причёска', 'от 3 500 сом'], ['makeup', 'Make up', 'от 1 500 сом']] },
  { id: 'look', n: '04', title: 'Брови и ресницы', img: 'p3', text: 'Наращивание, коррекция и ламинация.', items: [
    ['lash', 'Наращивание ресниц', 'от 1 500 сом'], ['brow', 'Коррекция бровей', 'от 400 сом'], ['lami', 'Ламинация ресниц и бровей', 'от 1 200 сом']] },
  { id: 'nails', n: '05', title: 'Ногти', img: 'p15', text: 'Маникюр и педикюр.', items: [
    ['mani', 'Маникюр', 'от 800 сом'], ['pedi', 'Педикюр', 'от 1 200 сом']] },
  { id: 'barber', n: '06', title: 'Барбершоп', img: 'p17', text: 'Мужские стрижки и борода.', items: [
    ['barber-cut', 'Мужская стрижка', 'от 650 сом'], ['beard', 'Стрижка бороды', 'от 300 сом']] }
];
const ALL = Object.fromEntries(HALLS.flatMap(h => h.items.map(i => [i[0], { name: i[1], price: i[2] || '' }])));
const WORKS = [
  ['p1', 'event', 'Вечерний хвост', 'updo'], ['p2', 'color', 'Розовое золото', 'color-hard'], ['p5', 'event', 'Объёмный пучок', 'updo'],
  ['p4', 'color', 'Лавандовый пикси', 'color-hard'], ['p7', 'nails', 'Маникюр с принтом', 'mani'], ['p3', 'color', 'Мягкое мелирование', 'color-hard'],
  ['p10', 'event', 'Причёска на событие', 'wedding'], ['p6', 'hair', 'Каре с окрашиванием', 'cut-w'], ['p15', 'nails', 'Золотой блеск', 'mani'],
  ['p8', 'event', 'Французская ракушка', 'updo'], ['p9', 'hair', 'Лёгкие волны', 'cut-style'], ['p13', 'event', 'Низкий пучок', 'wedding'],
  ['p17', 'hair', 'Мужская стрижка', 'barber-cut'], ['p11', 'color', 'Каскад и цвет', 'color'], ['p19', 'nails', 'Перламутр', 'mani']
];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.23,1,.32,1)';

let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('ba-ticket') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('ba-ticket', JSON.stringify(v)); } catch {} count(true); },
  toggle(id) { const c = cart.get(); cart.set(c.includes(id) ? c.filter(x => x !== id) : [...c, id]); },
  add(id) { const c = cart.get(); if (!c.includes(id)) cart.set([...c, id]); }
};
function count(pop) {
  const b = $('.tk b'); if (!b) return;
  b.textContent = cart.get().length;
  if (pop && motion) b.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 260, easing: EASE });
}

function shell() {
  const page = document.body.dataset.page;
  const nav = [['index', 'Главная'], ['halls', 'Услуги'], ['works', 'Работы'], ['match', 'Подбор образа'], ['visit', 'Контакты']];
  const cur = k => k === page ? ' aria-current="page"' : '';
  document.body.insertAdjacentHTML('afterbegin', `
  <div class="draft">Демо-версия сайта. <a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">Beauty <em>&amp;</em> Art</a>
  <nav class="links" aria-label="Разделы">${nav.slice(1).map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <a class="tk" href="book.html">Запись <b>0</b></a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `
  <footer class="foot"><div class="wrap"><div class="g">
  <div><b>Beauty &amp; Art</b></div>
  <div><span class="eyebrow">Адрес и время</span>ул. Гоголя, 127, 1 этаж<br>Ежедневно с 08:00 до 21:30<br>По предварительной записи</div>
  <div><span class="eyebrow">Связаться</span><a href="https://wa.me/${WA}">WhatsApp: 0555 346 212</a><a href="https://instagram.com/beauty_art_b">Instagram</a><a href="https://www.tiktok.com/@beauty_art61">TikTok</a></div>
  </div><p class="note">Демо-версия. Цены на сайте примерные.</p></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${[['index', 'Главная'], ['halls', 'Услуги'], ['works', 'Работы'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>`);
  count();
}

function reveal() {
  $$('.facts>div,.q,.zal figure,.zal>div,.ex,.frame,.blk,.vac,.phone,.own li,.rooms,.visit>div,.map').forEach(el => {
    const i = [...el.parentElement.children].indexOf(el);
    el.classList.add('reveal');
    el.style.transitionDelay = `${Math.min(i % 6, 5) * 60}ms`;
  });
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window)) return els.forEach(e => e.classList.add('in'));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
    setTimeout(() => { e.target.style.transitionDelay = ''; }, 1100);
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach(e => io.observe(e));
}

function home() {
  const shots = ['p2', 'p1', 'p4', 'p5', 'p3', 'p8'];
  const amp = $('.amp');
  amp.innerHTML = '<i class="base">&amp;</i>' + shots.map((s, i) => `<i style="background-image:url(img/${s}.webp)"${i ? '' : ' class="on"'}>&amp;</i>`).join('');
  const layers = $$('i:not(.base)', amp);
  let k = 0;
  if (motion) setInterval(() => { layers[k].classList.remove('on'); k = (k + 1) % layers.length; layers[k].classList.add('on'); }, 3200);
  const pos = { hair: '50% 35%', color: '50% 30%', event: '50% 18%', look: '50% 25%', nails: '50% 45%', barber: '60% 25%' };
  $('.rooms').innerHTML = HALLS.map((h, i) => `<a class="room${i === 1 ? ' on' : ''}" href="halls.html#${h.id}" style="--p:${pos[h.id]}"><img src="img/${h.img}.webp" alt="" loading="lazy"><span class="rn">${h.n}</span><span class="vt" aria-hidden="true">${h.title}</span><span class="info"><b>${h.title}</b><i>${h.text}</i><u>Смотреть услуги</u></span></a>`).join('');
  const rooms = $$('.room');
  const pick = r => rooms.forEach(x => x.classList.toggle('on', x === r));
  rooms.forEach(r => {
    r.addEventListener('mouseenter', () => { if (matchMedia('(hover: hover)').matches) pick(r); });
    r.addEventListener('focus', () => pick(r));
    r.addEventListener('click', e => { if (!r.classList.contains('on')) { e.preventDefault(); pick(r); } });
  });
}

function halls() {
  $('#halls').innerHTML = HALLS.map(h => `<article class="zal" id="${h.id}"><figure><img src="img/${h.img}.webp" alt="${esc(h.title)}" loading="lazy"></figure><div>
  <small>${h.n}</small><h2>${h.title}</h2><p>${h.text}</p>
  ${h.items.map(([id, name, price]) => `<div class="svc"><div>${name}</div><span>${price}</span><button class="add" data-id="${id}" aria-label="Добавить: ${esc(name)}" aria-pressed="false">+</button></div>`).join('')}
  </div></article>`).join('');
  const sync = () => { const c = cart.get(); $$('.add').forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id))); };
  $('#halls').addEventListener('click', e => { const b = e.target.closest('.add'); if (b) { cart.toggle(b.dataset.id); sync(); } });
  sync();
}

function works() {
  const tags = [['all', 'Все работы'], ['color', 'Цвет'], ['event', 'Образы'], ['hair', 'Стрижки'], ['nails', 'Ногти']];
  $('.filters').innerHTML = tags.map(([k, t], i) => `<button data-k="${k}" aria-pressed="${!i}">${t}</button>`).join('');
  $('.wall').innerHTML = WORKS.map(([img, tag, name], i) => `<button class="ex" data-i="${i}" data-tag="${tag}"><img src="img/${img}.webp" alt="${esc(name)}" loading="lazy"><span>№ ${String(i + 1).padStart(2, '0')}</span></button>`).join('');
  $('.filters').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $$('.filters button').forEach(x => x.setAttribute('aria-pressed', x === b));
    $$('.ex').forEach(x => { x.hidden = b.dataset.k !== 'all' && x.dataset.tag !== b.dataset.k; });
    if (motion) $$('.ex:not([hidden])').forEach((x, i) => { x.classList.add('in'); x.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 240, delay: Math.min(i, 8) * 30, easing: EASE, fill: 'backwards' }); });
  });
  const d = $('dialog');
  $('.wall').addEventListener('click', e => {
    const b = e.target.closest('.ex'); if (!b) return;
    const [img, , name, svc] = WORKS[+b.dataset.i];
    d.innerHTML = `<div class="lb"><figure><img src="img/${img}.webp" alt="${esc(name)}"></figure><div><button class="x" aria-label="Закрыть">Закрыть ✕</button><h3>${name}</h3><p>Понравилось? Покажите это фото мастеру.</p><a class="btn" href="book.html" data-svc="${svc}">Записаться</a></div></div>`;
    d.showModal();
  });
  d.addEventListener('click', e => {
    if (e.target === d || e.target.closest('.x')) d.close();
    const a = e.target.closest('[data-svc]'); if (a) cart.add(a.dataset.svc);
  });
}

function match() {
  const Q = [
    ['Что сейчас важнее всего?', [['Хочу перемен', 'change'], ['Скоро событие', 'event'], ['Просто привести себя в порядок', 'care'], ['Хочу красивые детали', 'detail']]],
    ['Сколько времени готовы уделять волосам утром?', [['Пять минут, не больше', 'easy'], ['Могу уложить', 'style'], ['Ради красоты встану раньше', 'bold'], ['Это про ногти и взгляд', 'skip']]],
    ['Какой результат вам ближе?', [['Спокойно и дорого', 'calm'], ['Заметно и смело', 'loud'], ['Романтично', 'soft'], ['Аккуратно и чётко', 'sharp']]]
  ];
  const R = {
    change: ['Новый цвет', 'p4', 'color-hard', 'Подберём оттенок под ваши волосы на консультации у мастера.'],
    loudchange: ['Смелый цвет', 'p4', 'color-hard', 'Яркий оттенок и короткая стрижка. Мастер подскажет, что подойдёт именно вам.'],
    softchange: ['Розовое золото', 'p2', 'color-hard', 'Мягкий тёплый оттенок, если хочется перемен без резкого контраста.'],
    event: ['Причёска на событие', 'p5', 'updo', 'На праздник лучше записаться заранее, особенно в выходные.'],
    care: ['Стрижка и укладка', 'p6', 'cut-style', 'Стрижка и укладка за один визит, от 950 сом.'],
    detail: ['Идеальные руки', 'p15', 'mani', 'Можно выбрать спокойный нюд или что-то поярче.']
  };
  const box = $('.quiz'); const ans = [];
  const ask = i => {
    if (i === Q.length) return result();
    box.innerHTML = `<span class="step">Вопрос ${i + 1} из ${Q.length}</span><h2>${Q[i][0]}</h2><div class="opts">${Q[i][1].map(([t, v]) => `<button data-v="${v}">${t}</button>`).join('')}</div>`;
    $$('button', box).forEach(b => b.onclick = () => { ans.push(b.dataset.v); ask(i + 1); });
  };
  const result = () => {
    const [a, , c] = ans;
    const r = a === 'change' ? (R[c + 'change'] || R.change) : R[a];
    box.innerHTML = `<div class="res"><figure><img src="img/${r[1]}.webp" alt="${esc(r[0])}"></figure><div><span class="eyebrow">Вам подойдёт</span><h2>${r[0]}</h2><p>${r[3]}</p><div class="acts"><a class="btn" href="book.html" id="take">Записаться</a><button class="btn ghost" id="again">Заново</button></div></div></div>`;
    $('#take').onclick = () => cart.add(r[2]);
    $('#again').onclick = () => { ans.length = 0; ask(0); };
  };
  ask(0);
}

function book() {
  const state = { day: null, time: null };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const days = Array.from({ length: 10 }, (_, i) => new Date(Date.now() + i * 864e5));
  const times = ['Утро, 08:00–12:00', 'День, 12:00–16:00', 'Вечер, 16:00–19:00', 'Поздно, 19:00–21:30'];
  $('#svc').innerHTML = HALLS.flatMap(h => h.items).map(([id, name]) => `<button class="chip" data-id="${id}" aria-pressed="false">${name}</button>`).join('');
  $('#days').innerHTML = days.map((d, i) => `<button class="chip" data-d="${fmt.format(d)}" aria-pressed="false">${i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wd.format(d)}<small>${fmt.format(d)}</small></button>`).join('');
  $('#times').innerHTML = times.map(t => `<button class="chip" data-t="${t}" aria-pressed="false">${t}</button>`).join('');
  const put = (el, html) => {
    if (el.innerHTML === html) return;
    el.innerHTML = html;
    if (motion) el.animate([{ opacity: .25, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
  };
  const draw = () => {
    const c = cart.get();
    $('.ticket').classList.remove('sent');
    $$('#svc .chip').forEach(b => b.setAttribute('aria-pressed', c.includes(b.dataset.id)));
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.d === state.day));
    $$('#times .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === state.time));
    put($('#t-svc'), c.map(id => esc(ALL[id].name)).join('<br>') || '—');
    put($('#t-when'), esc([state.day, state.time].filter(Boolean).join(', ')) || '—');
    $('#t-name').textContent = $('#name').value.trim() || '—';
  };
  $('#svc').onclick = e => { const b = e.target.closest('.chip'); if (b) { cart.toggle(b.dataset.id); draw(); } };
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (b) { state.day = b.dataset.d; draw(); } };
  $('#times').onclick = e => { const b = e.target.closest('.chip'); if (b) { state.time = b.dataset.t; draw(); } };
  $('#name').oninput = draw;
  $('#send').onclick = () => {
    const c = cart.get(); const name = $('#name').value.trim();
    const miss = !c.length ? 'Выберите услугу' : !state.day ? 'Выберите день' : !state.time ? 'Выберите время' : !name ? 'Напишите имя' : '';
    $('.err').textContent = miss;
    if (miss) return;
    const lines = ['Здравствуйте! Хочу записаться.', `Услуги: ${c.map(id => ALL[id].name).join(', ')}`, `Когда: ${state.day}, ${state.time}`, `Имя: ${name}`];
    const tel = $('#tel').value.trim(); if (tel) lines.push(`Телефон: ${tel}`);
    $('.ticket').classList.add('sent');
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(lines.join('\n'))}`, '_blank', 'noopener');
  };
  draw();
}

function visit() {
  const h = +new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bishkek' }).format(new Date()).replace(':', '.');
  const open = h >= 8 && h < 21.3;
  const el = $('.live');
  el.classList.toggle('off', !open);
  el.lastElementChild.textContent = open ? 'Сейчас открыто, до 21:30' : 'Сейчас закрыто, откроемся в 08:00';
}

shell();
({ index: home, halls, works, match, book, visit }[document.body.dataset.page] || (() => {}))();
reveal();
