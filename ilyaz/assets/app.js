const WA = '996558517030';
const KINDS = [
  ['full', 'Классический массаж всего тела'],
  ['back', 'Массаж спины и шеи'],
  ['other', 'Другое — напишу']
];
const PARTS = ['Утро', 'День', 'Вечер'];
const LATE = [12, 16, 20];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

function bishkekHour() {
  const p = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Bishkek' }).formatToParts(new Date());
  return +p.find(x => x.type === 'hour').value;
}

function chrome() {
  const top = $('.top');
  if (top) addEventListener('scroll', () => top.classList.toggle('sc', scrollY > 8), { passive: true });
  if (!calm) document.documentElement.classList.add('anim');
  if (calm || !('IntersectionObserver' in window)) { $$('.rv').forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  $$('.rv').forEach(el => {
    const sib = [...el.parentElement.children].filter(x => x.classList.contains('rv'));
    el.style.transitionDelay = `${Math.min(sib.indexOf(el), 3) * 90}ms`;
    io.observe(el);
  });
}

function floater() {
  const f = $('.float'), hero = $('.hero'), book = $('#book');
  if (!f || !hero || !book || !('IntersectionObserver' in window)) return;
  f.hidden = false;
  const seen = { hero: true, book: false };
  const sync = () => f.classList.toggle('off', seen.hero || seen.book);
  const io = new IntersectionObserver(es => es.forEach(e => {
    seen[e.target === hero ? 'hero' : 'book'] = e.isIntersecting;
    sync();
  }));
  io.observe(hero); io.observe(book);
  sync();
}

function form() {
  const el = $('#form');
  if (!el) return;
  const st = { kind: null, day: null, part: null };
  const fmt = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'Asia/Bishkek' });
  const wd = new Intl.DateTimeFormat('ru-RU', { weekday: 'short', timeZone: 'Asia/Bishkek' });
  const hour = bishkekHour();
  const start = hour >= 20 ? 1 : 0;
  const days = [];
  for (let i = start; days.length < 6; i++) {
    const d = new Date(Date.now() + i * 864e5);
    const name = i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : wd.format(d).replace('.', '');
    days.push({ id: fmt.format(d), name: name[0].toUpperCase() + name.slice(1) });
  }
  const chip = (attr, val, text, sub) => `<button class="chip" type="button" data-${attr}="${val}" aria-pressed="false">${text}${sub ? `<small>${sub}</small>` : ''}</button>`;
  $('#kind').innerHTML = KINDS.map(([k, t]) => chip('k', k, t)).join('');
  $('#days').innerHTML = days.map(d => chip('d', d.id, d.name, d.id)).join('');
  $('#parts').innerHTML = PARTS.map(p => chip('p', p, p)).join('');
  const err = $('.err', el);
  const draw = () => {
    $$('[data-k]', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.k === st.kind));
    $$('[data-d]', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.d === st.day));
    const today = start === 0 && st.day === days[0].id;
    $$('[data-p]', el).forEach((b, i) => {
      b.disabled = today && hour >= LATE[i];
      if (b.disabled && st.part === b.dataset.p) st.part = null;
      b.setAttribute('aria-pressed', b.dataset.p === st.part);
    });
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if (b.dataset.k) st.kind = b.dataset.k;
    if (b.dataset.d) st.day = b.dataset.d;
    if (b.dataset.p && !b.disabled) st.part = b.dataset.p;
    err.textContent = '';
    draw();
  });
  const when = () => {
    const d = days.find(x => x.id === st.day);
    return `${d.name.toLowerCase()}, ${st.day}, ${st.part.toLowerCase()}`;
  };
  el.addEventListener('submit', e => {
    e.preventDefault();
    const addr = $('#addr').value.trim();
    const name = $('#name').value.trim();
    const miss = [];
    if (!st.kind) miss.push('вид массажа');
    if (!st.day) miss.push('день');
    if (!st.part) miss.push('время суток');
    if (!addr) miss.push('район или адрес');
    if (!name) miss.push('имя');
    if (miss.length) { err.textContent = `Пожалуйста, укажите: ${miss.join(', ')}.`; return; }
    const kind = st.kind === 'other' ? 'другое, напишу в сообщении' : KINDS.find(k => k[0] === st.kind)[1];
    const text = [
      'Здравствуйте, Ильяз! Хочу записаться на массаж с выездом на дом.',
      `Вид массажа: ${kind}`,
      `Когда удобно: ${when()}`,
      `Район или адрес: ${addr}`,
      `Имя: ${name}`
    ].join('\n');
    el.dataset.text = text;
    location.href = `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  });
  draw();
}

chrome();
floater();
form();
