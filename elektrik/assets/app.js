const WA = '996559955566';
const TEL = '+996755392498';
const TG = '+996559955566';
const ICON = {
  start: '<circle cx="8" cy="12" r="4.5"/><path d="M12.500 12H22M18 12v3.500M21 12v2.500"/>',
  batt: '<rect x="3" y="7" width="18" height="12" rx="1.500"/><path d="M6.500 7V4.500h3V7M14.500 7V4.500h3V7M6.500 13h4M14 13h4M16 11v4"/>',
  check: '<path d="M6 8h3V6h6v2h2l2 3h2v6h-2l-2 2H9l-3-3H4v-2H2v-3h2V9z"/>',
  airbag: '<circle cx="8" cy="5" r="2"/><path d="M7 9l-1 7h6l3 4M8 12h4"/><circle cx="17.500" cy="10" r="4"/>',
  ac: '<path d="M12 2.500v19M3.800 7.200l16.400 9.600M20.200 7.200 3.800 16.800M9.500 4.500 12 7l2.500-2.500M9.500 19.500 12 17l2.500 2.500"/>',
  light: '<path d="M13 5.500c5 0 8 3 8 6.500s-3 6.500-8 6.500c-1.500-4-1.500-9 0-13zM9 7H3M9 12H3M9 17H3"/>',
  brake: '<circle cx="12" cy="12" r="6.500"/><path d="M12 8.500v4.500M12 15.300v.2M4 6a11 11 0 0 0 0 12M20 6a11 11 0 0 1 0 12"/>',
  steer: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.500"/><path d="M3.500 10.500 9.700 11M20.500 10.500 14.300 11M12 14.500V21"/>',
  susp: '<path d="M12 2v3M12 19v3M7 5h10M7 19h10M8 8l8 2-8 2 8 2-8 2"/>'
};
const SYM = [
  ['start', 'Не заводится', 'start'],
  ['batt', 'Аккумулятор, генератор', 'batt'],
  ['check', 'Горит чек', 'check'],
  ['airbag', 'Ошибка Airbag', 'airbag'],
  ['ac', 'Кондиционер', 'ac'],
  ['light', 'Фары, свет', 'light'],
  ['brake', 'Тормоза', 'brake'],
  ['steer', 'Руль', 'steer'],
  ['susp', 'Ходовая', 'susp']
];
const NAME = Object.fromEntries(SYM.map(s => [s[0], s[1]]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[k]}</svg>`;
const now = () => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bishkek' }).format(new Date());

function shell() {
  const page = document.body.dataset.page;
  const cur = k => (k === page ? ' aria-current="page"' : '');
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия сайта для Электрик.Kg<a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 1 4 14h6l-2 9 12-14h-7z"/></svg>Электрик.Kg</a>
  <nav class="links" aria-label="Разделы">${[['prices', 'Цены'], ['book', 'Заявка'], ['visit', 'Адрес']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <span class="open"><i></i>24/7</span></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><div><b>Электрик.Kg</b>Электроавтосервис и экстренная выездная служба</div><div>Проспект Аалы Токомбаева, 11/1а, Бишкек<br>Круглосуточно</div><div class="fl"><a href="https://wa.me/${WA}">WhatsApp</a><a href="https://t.me/${TG}">Telegram</a><a href="https://2gis.kg/bishkek/firm/70000001094784877">2ГИС</a></div></div></footer>
  <nav class="dock" aria-label="Быстрые разделы">${[['index', 'Главная'], ['prices', 'Цены'], ['book', 'Заявка'], ['visit', 'Адрес']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}<a class="call" href="tel:${TEL}">Звонок</a></nav>`);
}
function clock() {
  const tick = () => $$('#clock,.live').forEach(e => { e.textContent = now(); });
  tick(); setInterval(tick, 15000);
}
function reveal() {
  const els = $$('.lamp,.door,.nq,.pr,.q,.step,.pg,.facts>div');
  if (!motion || !('IntersectionObserver' in window)) return;
  els.forEach(e => e.classList.add('rv'));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -6% 0px' });
  els.forEach(e => io.observe(e));
}
function home() {
  const c = $('.cluster');
  c.innerHTML = ['batt', 'check', 'airbag', 'brake', 'light', 'start'].map((k, i) => `<span class="tt ${k === 'start' ? 'stay' : ''}" style="--i:${i}">${icon(k)}</span>`).join('');
  $('.lamps').innerHTML = SYM.map(([id, n, k]) => `<a class="lamp" href="book.html?s=${id}">${icon(k)}<span>${n}</span></a>`).join('');
  const sos = $('.hero .sos');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(es => document.body.classList.toggle('past', !es[0].isIntersecting)).observe(sos);
  }
}
function book() {
  const q = new URLSearchParams(location.search);
  const st = { sym: new Set(), mode: null, soon: '' };
  if (q.get('s') === 'other') $('#note').value = 'Tesla или Starlink';
  if (NAME[q.get('s')]) st.sym.add(q.get('s'));
  if (['call', 'come'].includes(q.get('m'))) st.mode = q.get('m');
  $('#sym').innerHTML = SYM.map(([id, n]) => `<button type="button" class="chip" data-id="${id}" aria-pressed="false">${n}</button>`).join('');
  $('#soon').innerHTML = ['Сейчас', 'Через час', 'Вечером', 'Завтра утром'].map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="false">${t}</button>`).join('');
  const val = id => $(id).value.trim();
  const problem = () => [...[...st.sym].map(id => NAME[id]), val('#note')].filter(Boolean).join('; ');
  const place = () => (st.mode === 'come' ? [st.soon, val('#time')].filter(Boolean).join(', ') : val('#place'));
  const text = () => {
    const l = ['Здравствуйте! Нужна помощь.', `Авто: ${val('#car') || '...'}`, `Что случилось: ${problem() || '...'}`];
    if (st.mode === 'call') l.push(`Где машина: ${place() || '...'}`);
    if (st.mode === 'come') l.push(`Приеду сам: ${place() || '...'}`);
    return l.join('\n');
  };
  const draw = () => {
    $$('#sym .chip').forEach(b => b.setAttribute('aria-pressed', st.sym.has(b.dataset.id)));
    $$('#soon .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.t === st.soon));
    $$('#mode button').forEach(b => b.setAttribute('aria-pressed', b.dataset.m === st.mode));
    $('#where').hidden = st.mode !== 'call';
    $('#when').hidden = st.mode !== 'come';
    $('#preview').textContent = text();
    $('.err').textContent = '';
  };
  $('#sym').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; const id = b.dataset.id; st.sym.has(id) ? st.sym.delete(id) : st.sym.add(id); draw(); };
  $('#soon').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; st.soon = st.soon === b.dataset.t ? '' : b.dataset.t; draw(); };
  $('#mode').onclick = e => { const b = e.target.closest('button'); if (b) { st.mode = b.dataset.m; draw(); } };
  $$('.form input').forEach(i => { i.oninput = draw; });
  $('#geo').onclick = () => {
    const b = $('#geo');
    if (!navigator.geolocation) { b.textContent = 'Напишите адрес вручную'; return; }
    b.textContent = 'Определяем...';
    navigator.geolocation.getCurrentPosition(p => {
      $('#place').value = `https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      b.textContent = 'Точка добавлена';
      draw();
    }, () => { b.textContent = 'Не вышло, напишите адрес'; }, { timeout: 10000 });
  };
  $('#send').onclick = () => {
    const miss = !val('#car') ? 'Напишите марку и модель' : !problem() ? 'Выберите, что случилось' : !st.mode ? 'Машина на ходу или нужен мастер?' : !place() ? (st.mode === 'call' ? 'Напишите, где машина' : 'Выберите, когда приедете') : '';
    if (miss) { $('.err').textContent = miss; return; }
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text())}`, '_blank', 'noopener');
  };
  draw();
}
shell();
clock();
({ index: home, book }[document.body.dataset.page] || (() => {}))();
reveal();
