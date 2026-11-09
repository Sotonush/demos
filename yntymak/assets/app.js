const WA = '996501466926';
const GROUPS = [
  ['Ремонт', [
    ['scoot', 'Ремонт скутера или мопеда'],
    ['moto', 'Ремонт мотоцикла'],
    ['start', 'Не заводится'],
    ['motor', 'Ремонт и капиталка мотора'],
    ['cvt', 'Вариатор']
  ]],
  ['Обслуживание', [
    ['diag', 'Диагностика'],
    ['oil', 'Замена масла'],
    ['plug', 'Замена свечи'],
    ['pads', 'Тормоза и колодки'],
    ['batt', 'Электрика и аккумулятор']
  ]],
  ['Свет, тюнинг, магазин', [
    ['light', 'Свет, лампы, поворотники'],
    ['tune', 'Тюнинг'],
    ['parts', 'Подбор запчастей'],
    ['helmet', 'Шлемы'],
    ['gear', 'Экипировка и защита']
  ]]
];
const NAME = Object.fromEntries(GROUPS.flatMap(g => g[1]));
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const NAV = [['prices', 'Услуги'], ['visit', 'Адрес']];
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

function hour() {
  return +new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bishkek' }).format(new Date());
}
function openNow() {
  const h = hour();
  return h >= 9 || h < 3;
}
function status() {
  const o = openNow();
  $$('.now').forEach(e => { e.textContent = o ? 'Сейчас открыто.' : 'Сейчас закрыто, откроемся в 09:00.'; });
  $$('.st').forEach(e => { e.textContent = o ? 'Открыто до 03:00' : 'Откроемся в 09:00'; });
  $$('.dot').forEach(e => e.classList.toggle('off', !o));
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => (k === page ? ' aria-current="page"' : '');
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия сайта для Ынтымак мото<a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html"><span class="mark" aria-hidden="true">Ы</span>Ынтымак мото</a>
  <nav class="links" aria-label="Разделы">${NAV.map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}</a>`).join('')}</nav>
  <a class="btn sm" href="book.html"><span>Заявка</span></a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><p class="fbig">Ынтымак мото</p><div class="fcols"><div>Ремонт мотоциклов и скутеров, запчасти и экипировка</div><div>Улица Гагарина, 83/1а, Бишкек<br>Каждый день с 09:00 до 03:00</div><div class="fl"><a href="https://wa.me/${WA}">WhatsApp</a><a href="https://instagram.com/yntymak_moto">Instagram</a><a href="https://2gis.kg/bishkek/firm/70000001103531945">2ГИС</a></div></div></div></footer>`);
  const top = $('.top');
  const onScroll = () => top.classList.toggle('solid', scrollY > 24);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
function smooth() {
  if (still || !matchMedia('(hover:hover) and (pointer:fine)').matches) return;
  const s = document.createElement('script');
  s.src = 'assets/lenis.min.js';
  s.onload = () => {
    const lenis = new Lenis({ lerp: .085, wheelMultiplier: .95 });
    const raf = t => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
  };
  document.head.append(s);
}
function reveal() {
  if (still || !('IntersectionObserver' in window)) return;
  document.documentElement.classList.add('anim');
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -10% 0px' });
  $$('.head,.st-c,.step,.it,.trio figure,.q,.revs .acts,.cta h2,.cta p,.cta .btn,.night .wrap>*,.grp,.box,.page .wrap>*,.own li,.phone,.map').forEach((el, i) => {
    el.classList.add('rv');
    el.style.transitionDelay = `${(i % 4) * 80}ms`;
    io.observe(el);
  });
}
function parallax() {
  if (still) return;
  const moto = $('.moto img');
  const word = $('.word');
  const night = $('.night .bg img');
  const nightSec = $('.night');
  let tick = false;
  const run = () => {
    tick = false;
    const y = scrollY;
    const vh = innerHeight;
    if (y < vh * 1.2) {
      const p = Math.min(y / vh, 1.2);
      moto.style.transform = `translate3d(${p * -30}px,${p * 90}px,0) rotate(${p * -4}deg) scale(${1 + p * .06})`;
      word.style.transform = `translate3d(${p * -160}px,0,0)`;
    }
    if (night) {
      const r = nightSec.getBoundingClientRect();
      if (r.bottom > 0 && r.top < vh) {
        const k = (r.top + r.height / 2 - vh / 2) / vh;
        night.style.transform = `translate3d(0,${k * -12}%,0) scale(1.18)`;
      }
    }
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(run); } }, { passive: true });
  run();
}
function fix() {
  const svg = $('.bike');
  const steps = $$('.step');
  const set = k => {
    $$('.part,.mk', svg).forEach(p => p.classList.toggle('on', p.dataset.k === k));
    steps.forEach(s => s.classList.toggle('on', s.dataset.k === k));
  };
  set(steps[0].dataset.k);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) set(e.target.dataset.k); }), { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(s => io.observe(s));
  }
  $$('.mk', svg).forEach(m => {
    m.addEventListener('mouseenter', () => set(m.dataset.k));
    m.addEventListener('focus', () => set(m.dataset.k));
  });
}
function home() {
  const b = $('#show');
  b.onclick = () => {
    const m = $('#more');
    m.hidden = !m.hidden;
    b.setAttribute('aria-expanded', String(!m.hidden));
    $('span', b).textContent = m.hidden ? 'Ещё отзывы' : 'Скрыть';
    if (!m.hidden && !still) $$('.q', m).forEach((q, i) => { q.classList.remove('in'); q.style.transitionDelay = `${(i % 3) * 80}ms`; requestAnimationFrame(() => requestAnimationFrame(() => q.classList.add('in'))); });
  };
  fix();
  parallax();
}
function prices() {
  $('#groups').innerHTML = GROUPS.map(([g, items]) => `<section class="grp"><h2>${g}</h2><div class="list">${items.map(([id, n]) => `<a href="book.html?s=${id}">${n}<span aria-hidden="true">${ARROW}</span></a>`).join('')}</div></section>`).join('');
}
function days() {
  const fmt = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', timeZone: 'Asia/Bishkek' });
  const out = ['Сегодня', 'Завтра'];
  for (let i = 2; i < 5; i++) out.push(fmt.format(new Date(Date.now() + i * 864e5)));
  return out.map(d => d[0].toUpperCase() + d.slice(1));
}
function book() {
  const q = new URLSearchParams(location.search);
  const st = { svc: new Set(), day: '', time: '' };
  if (NAME[q.get('s')]) st.svc.add(q.get('s'));
  const all = GROUPS.flatMap(g => g[1]);
  $('#svc').innerHTML = all.map(([id, n]) => `<button type="button" class="chip" data-id="${id}" aria-pressed="false">${n}</button>`).join('');
  $('#days').innerHTML = days().map(d => `<button type="button" class="chip" data-v="${d}" aria-pressed="false">${d}</button>`).join('');
  $('#times').innerHTML = ['Утром', 'Днём', 'Вечером', 'Ночью (до 03:00)'].map(d => `<button type="button" class="chip" data-v="${d}" aria-pressed="false">${d}</button>`).join('');
  const val = id => $(id).value.trim();
  const need = () => [...[...st.svc].map(id => NAME[id]), val('#note')].filter(Boolean).join('; ');
  const when = () => [st.day.toLowerCase(), st.time.toLowerCase()].filter(Boolean).join(', ');
  const text = () => ['Здравствуйте! Хочу записаться в мотосервис.', `Мотоцикл: ${val('#bike')}`, `Что нужно: ${need()}`, `Когда удобно: ${when()}`, `Имя: ${val('#name')}`].join('\n');
  const draw = () => {
    $$('#svc .chip').forEach(b => b.setAttribute('aria-pressed', st.svc.has(b.dataset.id)));
    $$('#days .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === st.day));
    $$('#times .chip').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === st.time));
    $('#o-bike').textContent = val('#bike') || '—';
    $('#o-svc').textContent = need() || '—';
    $('#o-when').textContent = when() || '—';
    $('#o-name').textContent = val('#name') || '—';
    $('.order').classList.toggle('ready', !!(val('#bike') && need() && when() && val('#name')));
    $('.err').textContent = '';
  };
  $('#svc').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; const id = b.dataset.id; st.svc.has(id) ? st.svc.delete(id) : st.svc.add(id); draw(); };
  $('#days').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; st.day = st.day === b.dataset.v ? '' : b.dataset.v; draw(); };
  $('#times').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; st.time = st.time === b.dataset.v ? '' : b.dataset.v; draw(); };
  $$('.form input,.form textarea').forEach(i => { i.oninput = draw; });
  $('.form').onsubmit = e => e.preventDefault();
  $('#send').onclick = () => {
    const miss = !val('#bike') ? 'Напишите марку и модель мотоцикла' : !need() ? 'Выберите, что случилось, или опишите своими словами' : !when() ? 'Выберите, когда удобно' : !val('#name') ? 'Напишите, как к вам обращаться' : '';
    if (miss) { $('.err').textContent = miss; return; }
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(text())}`, '_blank', 'noopener');
  };
  draw();
}
shell();
status();
({ index: home, prices, book }[document.body.dataset.page] || (() => {}))();
reveal();
smooth();
