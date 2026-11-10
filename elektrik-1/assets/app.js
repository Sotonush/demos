window.dataLayer = window.dataLayer || [];
const PAGE = document.body.dataset.page;
const WA = document.body.dataset.wa;
const goal = (name, label) => window.dataLayer.push({ event: 'goal', goal: name, label: label || '', page: PAGE });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-goal]');
  if (!el || el.dataset.goal === 'form_submit') return;
  goal(el.dataset.goal, el.dataset.label || el.textContent.trim().slice(0, 60));
});

const SYM = [
  ['start', 'Не заводится'],
  ['batt', 'Аккумулятор, генератор'],
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

function dock() {
  const d = $('.dock');
  const marks = $$('.hero .plates, .end-sign');
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
    es.forEach(e => state.set(e.target, e.isIntersecting));
    set();
  });
  marks.forEach(m => io.observe(m));
}

function book() {
  const q = new URLSearchParams(location.search);
  const st = { sym: new Set(), mode: null, soon: '' };
  if (q.get('s') === 'other') $('#note').value = 'Tesla или Starlink';
  if (NAME[q.get('s')]) st.sym.add(q.get('s'));
  if (q.get('s') === 'start') st.mode = 'call';
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
      step.dataset.err = miss;
      step.classList.add('bad');
      to.focus({ preventScroll: true });
      step.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' });
      return;
    }
    goal('form_submit', [...st.sym].join(',') || 'note');
    const url = `https://wa.me/${WA}?text=${encodeURIComponent(text())}`;
    const w = window.open(url, '_blank');
    if (w) w.opener = null; else location.href = url;
  };
  draw();
}

dock();
if (PAGE === 'book') book();
