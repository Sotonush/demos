const WA = document.body.dataset.wa;
const PAGE = document.body.dataset.page;
const SYM = [
  ['start', 'Не заводится'],
  ['batt', 'Сел аккумулятор'],
  ['check', 'Горит чек'],
  ['airbag', 'Ошибка Airbag'],
  ['ac', 'Кондиционер'],
  ['light', 'Фары, свет'],
  ['brake', 'Тормоза'],
  ['steer', 'Руль'],
  ['susp', 'Ходовая']
];
const NAME = Object.fromEntries(SYM);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

window.dataLayer = window.dataLayer || [];
function track(event, place) {
  window.dataLayer.push({ event, place: place || '', page: PAGE });
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-goal]');
  if (el) track(el.dataset.goal, el.dataset.place);
});

function dock() {
  const d = $('.dock');
  const marks = $$('.hero .cta, .end');
  if (!d || !marks.length || !('IntersectionObserver' in window)) return;
  const links = $$('a', d);
  const state = new Map();
  const set = () => {
    const away = [...state.values()].some(Boolean);
    d.classList.toggle('away', away);
    links.forEach(a => { a.tabIndex = away ? -1 : 0; });
    d.toggleAttribute('aria-hidden', away);
  };
  const io = new IntersectionObserver(es => {
    es.forEach(e => state.set(e.target, e.isIntersecting || (e.target.matches('.cta') && e.boundingClientRect.top > innerHeight)));
    set();
  });
  marks.forEach(m => io.observe(m));
}

function record() {
  const r = $('.rec');
  if (!r) return;
  if (!motion || !('IntersectionObserver' in window)) { r.classList.add('in'); return; }
  const io = new IntersectionObserver(es => {
    if (!es[0].isIntersecting) return;
    r.classList.add('in');
    io.disconnect();
  }, { threshold: 0.35 });
  io.observe(r);
}

function tracks() {
  $$('.track').forEach(t => {
    const prev = t.previousElementSibling;
    const nav = prev && prev.querySelector('.cnav');
    if (!nav) return;
    const items = [...t.children];
    const step = () => (items[0] ? items[0].getBoundingClientRect().width + (parseFloat(getComputedStyle(t).columnGap) || 0) : t.clientWidth);
    let raf = 0;
    const sync = () => {
      raf = 0;
      const max = t.scrollWidth - t.clientWidth;
      nav.hidden = max < 4;
      $('.prev', nav).disabled = t.scrollLeft < 4;
      $('.next', nav).disabled = t.scrollLeft > max - 4;
    };
    t.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(sync); }, { passive: true });
    addEventListener('resize', sync);
    $('.prev', nav).onclick = () => t.scrollBy({ left: -step(), behavior: motion ? 'smooth' : 'auto' });
    $('.next', nav).onclick = () => t.scrollBy({ left: step(), behavior: motion ? 'smooth' : 'auto' });
    sync();
  });
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
    $$('.step.bad').forEach(s => s.classList.remove('bad'));
  };
  $('#sym').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; const id = b.dataset.id; st.sym.has(id) ? st.sym.delete(id) : st.sym.add(id); draw(); };
  $('#soon').onclick = e => { const b = e.target.closest('.chip'); if (!b) return; st.soon = st.soon === b.dataset.t ? '' : b.dataset.t; draw(); };
  $('#mode').onclick = e => { const b = e.target.closest('button'); if (b) { st.mode = b.dataset.m; draw(); } };
  $$('.form input').forEach(i => { i.oninput = draw; });
  $('#geo').onclick = () => {
    const b = $('#geo span');
    if (!navigator.geolocation) { b.textContent = 'Напишите адрес вручную'; return; }
    b.textContent = 'Определяем…';
    navigator.geolocation.getCurrentPosition(p => {
      $('#place').value = `https://maps.google.com/?q=${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`;
      b.textContent = 'Точка добавлена';
      draw();
    }, () => { b.textContent = 'Не вышло, напишите адрес'; }, { timeout: 10000 });
  };
  $('#book').onsubmit = e => {
    e.preventDefault();
    const miss = !val('#car') ? 'Напишите марку и модель' : !problem() ? 'Выберите, что случилось' : !st.mode ? 'Машина на ходу или нужен мастер?' : !place() ? (st.mode === 'call' ? 'Напишите, где машина' : 'Выберите, когда приедете') : '';
    if (miss) {
      $('.err').textContent = miss;
      const to = $(!val('#car') ? '#car' : !problem() ? '#sym .chip' : !st.mode ? '#mode button' : st.mode === 'call' ? '#place' : '#soon .chip');
      const step = to.closest('.step');
      step.classList.add('bad');
      to.focus({ preventScroll: true });
      step.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' });
      return;
    }
    track('form_submit', st.mode);
    const url = `https://wa.me/${WA}?text=${encodeURIComponent(text())}`;
    const w = window.open(url, '_blank');
    if (w) w.opener = null; else location.href = url;
  };
  draw();
}

dock();
record();
tracks();
if (PAGE === 'book') book();
