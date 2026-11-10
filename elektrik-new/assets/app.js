const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WA = document.body.dataset.wa;
const PAGE = document.body.dataset.page;
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;

window.dataLayer = window.dataLayer || [];
function goal(name, label) {
  window.dataLayer.push({ event: name, page: PAGE, label: label || '' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-goal]');
  if (a) goal(a.dataset.goal, a.dataset.label || a.textContent.trim().slice(0, 60));
});

function header() {
  const top = $('#top');
  const hero = $('.hero');
  if (!top || !hero || !('IntersectionObserver' in window)) { top && top.classList.add('solid'); return; }
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:80px;pointer-events:none';
  hero.prepend(sentinel);
  new IntersectionObserver(([e]) => top.classList.toggle('solid', !e.isIntersecting)).observe(sentinel);
}

function dock() {
  const d = $('.dock');
  if (!d) return;
  const anchor = $('#hero-acts') || $('.lhero .acts') || $('.page');
  if (!anchor || !('IntersectionObserver' in window)) { d.classList.add('on'); return; }
  const final = $('.final .acts');
  const seen = new Map();
  const io = new IntersectionObserver(es => {
    es.forEach(e => seen.set(e.target, e.isIntersecting || e.boundingClientRect.top > 0 && e.target === anchor));
    const hide = [...seen.values()].some(Boolean);
    d.classList.toggle('on', !hide);
  });
  io.observe(anchor);
  if (final) io.observe(final);
}

function menu() {
  const m = $('.menu');
  if (!m) return;
  document.addEventListener('click', e => { if (m.open && !m.contains(e.target)) m.open = false; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && m.open) { m.open = false; $('summary', m).focus(); } });
}

function finder() {
  const grid = $('#grid');
  const q = $('#q');
  const box = $('#fsym');
  if (!grid || !q || !box) return;
  const cards = $$('.svc', grid);
  const empty = $('#empty');
  let sym = '';
  const norm = s => s.toLowerCase().replace(/ё/g, 'е').trim();
  const apply = () => {
    const words = norm(q.value).split(/\s+/).filter(w => w.length > 1);
    let shown = 0;
    cards.forEach(c => {
      const k = norm(c.dataset.k);
      const okSym = !sym || c.dataset.sym.split(' ').includes(sym);
      const okText = !words.length || words.some(w => k.includes(w.slice(0, Math.max(4, w.length - 2))));
      const ok = okSym && okText;
      c.hidden = !ok;
      if (ok) shown++;
    });
    grid.classList.toggle('filtering', Boolean(sym || words.length));
    empty.hidden = shown > 0;
    const found = $('#found');
    if (found) found.textContent = sym || words.length ? `Найдено услуг: ${shown}` : '';
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    sym = sym === b.dataset.id ? '' : b.dataset.id;
    $$('.chip', box).forEach(c => c.setAttribute('aria-pressed', String(c.dataset.id === sym)));
    apply();
    if (sym) goal('symptom_filter', b.textContent);
  });
  q.addEventListener('input', apply);
  $('#reset').addEventListener('click', () => {
    sym = '';
    q.value = '';
    $$('.chip', box).forEach(c => c.setAttribute('aria-pressed', 'false'));
    apply();
    q.focus();
  });
}

function carousel() {
  const track = $('.gal .track');
  if (!track) return;
  const prev = $('.gal .prev');
  const next = $('.gal .next');
  const step = () => Math.max(260, track.clientWidth * .7);
  const sync = () => {
    prev.disabled = track.scrollLeft < 8;
    next.disabled = track.scrollLeft + track.clientWidth > track.scrollWidth - 8;
  };
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: motion ? 'smooth' : 'auto' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: motion ? 'smooth' : 'auto' }));
  track.addEventListener('scroll', sync, { passive: true });
  sync();
}

function openWa(text) {
  const url = `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  const w = window.open(url, '_blank');
  if (w) w.opener = null; else location.href = url;
}

function book() {
  const form = $('#book');
  if (!form) return;
  const q = new URLSearchParams(location.search);
  const box = $('#sym');
  const set = new Set();
  const st = { mode: null, soon: '' };
  const val = id => $(id).value.trim();
  if ($(`.chip[data-id="${q.get('s')}"]`, box)) set.add(q.get('s'));
  if (['call', 'come'].includes(q.get('m'))) st.mode = q.get('m');
  const soon = ['Сейчас', 'Через час', 'Вечером', 'Ночью', 'Завтра утром'];
  $('#soon').innerHTML = soon.map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="false">${t}</button>`).join('');
  const names = () => $$('.chip', box).filter(b => set.has(b.dataset.id)).map(b => b.textContent);
  const problem = () => [...names(), val('#note')].filter(Boolean).join('; ');
  const place = () => (st.mode === 'come' ? st.soon : val('#place'));
  const text = () => {
    const l = ['Здравствуйте! Нужна помощь.', `Авто: ${val('#car') || '…'}`, `Что случилось: ${problem() || '…'}`];
    if (st.mode === 'call') l.push(`Где машина: ${place() || '…'}`);
    if (st.mode === 'come') l.push(`Приеду сам: ${place() || '…'}`);
    return l.join('\n');
  };
  const draw = () => {
    $$('.chip', box).forEach(b => b.setAttribute('aria-pressed', String(set.has(b.dataset.id))));
    $$('#soon .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === st.soon)));
    $$('#mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === st.mode)));
    $('#where').hidden = st.mode !== 'call';
    $('#when').hidden = st.mode !== 'come';
    $('#preview').textContent = text();
    $('#berr').textContent = '';
    $$('.f.bad', form).forEach(s => s.classList.remove('bad'));
    $$('.ferr', form).forEach(el => el.parentNode.removeChild(el));
    $$('[aria-invalid]', form).forEach(i => i.removeAttribute('aria-invalid'));
  };
  box.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    draw();
  });
  $('#soon').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; st.soon = st.soon === b.dataset.t ? '' : b.dataset.t; draw(); });
  $('#mode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { st.mode = b.dataset.m; draw(); } });
  $$('input', form).forEach(i => i.addEventListener('input', draw));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const checks = [
      [!val('#car'), 'car', '#car', 'Напишите марку и модель'],
      [!problem(), 'sym', '#sym .chip', 'Отметьте, что случилось, или напишите своими словами'],
      [!st.mode, 'mode', '#mode button', 'Выберите: машина стоит или приедете сами'],
      [!place(), 'mode', st.mode === 'call' ? '#place' : '#soon .chip', st.mode === 'call' ? 'Напишите, где машина' : 'Выберите, когда приедете'],
    ];
    const miss = checks.find(c => c[0]);
    if (miss) {
      $('#berr').textContent = miss[3];
      const step = $(`[data-step="${miss[1]}"]`, form);
      step.classList.add('bad');
      const fe = document.createElement('p');
      fe.className = 'ferr';
      fe.textContent = miss[3];
      step.append(fe);
      const el = $(miss[2]);
      if (el.tagName === 'INPUT') el.setAttribute('aria-invalid', 'true');
      el.focus({ preventScroll: true });
      step.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' });
      return;
    }
    goal('form_submit', `запись: ${problem()}`);
    openWa(text());
  });
  draw();
}

header();
dock();
menu();
finder();
carousel();
book();
