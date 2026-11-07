const WA = '996500121128';
const IG = 'https://instagram.com/maras_beauty_kb';
const GROUPS = [
  ['hair', 'Волосы', [
    ['wcut', 'Женская стрижка', '', 'от 300 сом'],
    ['mcut', 'Мужская стрижка', '', 'от 350 сом'],
    ['kcut', 'Детская стрижка', '', ''],
    ['color', 'Покраска волос', '', '']
  ]],
  ['face', 'Макияж', [
    ['makeup', 'Макияж', 'любой сложности', ''],
    ['pmu', 'Перманентный макияж', '', '']
  ]],
  ['brows', 'Брови', [
    ['bcor', 'Коррекция бровей', '', ''],
    ['barch', 'Архитектура бровей', '', ''],
    ['bcol', 'Покраска бровей', '', ''],
    ['blam', 'Ламинирование бровей', '', '']
  ]],
  ['lashes', 'Ресницы', [
    ['lext', 'Наращивание ресниц', 'классика, 2D, 3D', ''],
    ['llam', 'Ламинация ресниц', '', '']
  ]],
  ['nails', 'Ногти', [
    ['mani', 'Маникюр', '', ''],
    ['pedi', 'Педикюр', '', '']
  ]]
];
const QUICK = ['wcut', 'mcut', 'kcut', 'color', 'makeup', 'pmu', 'bcor', 'blam', 'lext', 'llam', 'mani', 'pedi'];
const PARTS = [['Утро', '09:00–12:00', 720], ['День', '12:00–15:00', 900], ['Вечер', '15:00–19:00', 1140]];
const ALL = {};
GROUPS.forEach(g => g[2].forEach(r => { ALL[r[0]] = r; }));
const title = id => ALL[id][1];
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.23,1,.32,1)';
const PLUS = '<svg class="plus" viewBox="0 0 20 20" aria-hidden="true"><path d="M3 10h14M10 3v14"/></svg>';
let mem = [];
const cart = {
  get() { try { return JSON.parse(localStorage.getItem('maras-order') || '[]').filter(id => ALL[id]); } catch { return mem; } },
  set(v) { mem = v; try { localStorage.setItem('maras-order', JSON.stringify(v)); } catch {} count(); },
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
function openText() {
  const m = localMinutes();
  return m < 540 ? 'Сегодня откроемся в 09:00.' : m < 1140 ? 'Сегодня работаем до 19:00.' : 'Завтра откроемся в 09:00.';
}
function shell() {
  const page = document.body.dataset.page;
  const cur = k => k === page ? ' aria-current="page"' : '';
  const logo = '<img src="img/logo.png" alt="MarAs Beauty" width="1000" height="376">';
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия для MarAs Beauty. <a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">${logo}</a>
  <nav class="links" aria-label="Разделы">${[['index', 'Главная'], ['prices', 'Услуги'], ['book', 'Запись'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}${k === 'book' ? '<span class="cnt" hidden>0</span>' : ''}</a>`).join('')}</nav></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<footer class="foot"><div class="wrap"><p>Гвардейская улица, 24/1, Кара-Балта</p><p><a href="https://wa.me/${WA}">WhatsApp</a><a href="${IG}">Instagram</a><a href="https://2gis.kg/kara-balta/firm/70000001110733158">2ГИС</a></p></div></footer>
  <nav class="tabs" aria-label="Быстрые разделы">${[['index', 'Главная'], ['prices', 'Услуги'], ['book', 'Запись'], ['visit', 'Контакты']].map(([k, t]) => `<a href="${k}.html"${cur(k)}>${t}${k === 'book' ? '<span class="cnt" hidden>0</span>' : ''}</a>`).join('')}</nav>`);
  count();
}
const row = ([id, n, note, p]) => `<button class="row" type="button" data-id="${id}" aria-pressed="false"><span class="n">${esc(n)}${note ? `<small>${esc(note)}</small>` : ''}</span>${p ? `<span class="p">${esc(p)}</span>` : ''}${PLUS}</button>`;
function home() {
  const b = $('.morebtn');
  b.onclick = () => { $('.quotes').classList.add('all'); b.hidden = true; };
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
  const now = localMinutes(), skip = now >= 1080 ? 1 : 0;
  const days = Array.from({ length: 6 }, (_, i) => new Date(Date.now() + (i + skip) * 864e5));
  const label = i => i + skip === 0 ? 'Сегодня' : i + skip === 1 ? 'Завтра' : wd.format(days[i]);
  const today = () => !skip && st.day === fmt.format(days[0]);
  const chips = () => [...new Set([...QUICK, ...cart.get()])];
  $('#days').innerHTML = days.map((d, i) => `<button class="chip" type="button" data-d="${fmt.format(d)}" aria-pressed="false">${label(i)}<small>${fmt.format(d)}</small></button>`).join('');
  $('#parts').innerHTML = PARTS.map(([t, h]) => `<button class="chip" type="button" data-p="${t}" aria-pressed="false">${t}<small>${h}</small></button>`).join('');
  const when = () => { const p = PARTS.find(x => x[0] === st.part); return st.day && p ? `${st.day}, ${p[0].toLowerCase()} (${p[1]})` : st.day || (p ? `${p[0].toLowerCase()} (${p[1]})` : ''); };
  const draw = () => {
    const c = cart.get();
    $('.note').classList.remove('sent');
    $('#svc').innerHTML = chips().map(id => `<button class="chip" type="button" data-id="${id}" aria-pressed="${c.includes(id)}">${esc(title(id))}</button>`).join('');
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
({ index: home, prices, book, visit }[document.body.dataset.page] || (() => {}))();
