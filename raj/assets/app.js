const { wa: WA, base: BASE, items: ITEMS } = window.RAJ;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const byId = id => ITEMS.find(i => i.id === id);
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const OPEN = 9;
const CLOSE = 21;

function shell() {
  const page = document.body.dataset.page;
  const nav = [['index', 'Витрина'], ['catalog', 'Каталог'], ['order', 'Заказ'], ['contacts', 'Контакты']];
  const links = nav.map(([k, t]) => `<a href="${k}.html"${k === page ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия<a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">Цветочный рай</a><nav class="links" aria-label="Разделы">${links}</nav><a class="wa-link" href="https://wa.me/${WA}">WhatsApp</a></div></header>`);
  document.body.insertAdjacentHTML('beforeend', `<nav class="tabs" aria-label="Разделы">${links}</nav>`);
}

function catalog() {
  const set = f => {
    $$('.seg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.f === f));
    $$('#grid .card').forEach(c => { c.hidden = f !== 'all' && c.dataset.k !== f; });
  };
  $('.seg').onclick = e => { const b = e.target.closest('button'); if (b) set(b.dataset.f); };
  if (location.hash === '#gifts') set('g');
}

function order() {
  const st = { item: byId(new URLSearchParams(location.search).get('item')) || null, day: '0', how: 'pickup' };
  const now = new Date();
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plus = n => { const d = new Date(now); d.setDate(d.getDate() + n); return d; };
  const date = $('#date'); const time = $('#time');
  date.min = iso(now);
  const pickedDate = () => st.day === 'x' ? (date.value ? new Date(`${date.value}T12:00`) : null) : plus(+st.day);
  const fmt = d => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' });

  function times() {
    const keep = time.value;
    const from = st.day === '0' ? Math.max(OPEN, now.getHours() + 1) : OPEN;
    let html = '<option value="">Выберите время</option>';
    for (let h = from; h <= CLOSE; h++) html += `<option>${String(h).padStart(2, '0')}:00</option>`;
    time.innerHTML = html;
    if ([...time.options].some(o => o.value === keep)) time.value = keep;
  }
  function pressed(box, key, val) { $$(`#${box} button`).forEach(b => b.setAttribute('aria-pressed', b.dataset[key] === val)); }
  function setDay(v) {
    st.day = v; pressed('days', 'd', v);
    $('#dwrap').hidden = v !== 'x';
    times(); render();
  }
  function setHow(v) {
    st.how = v; pressed('how', 'h', v);
    const d = v === 'delivery';
    $('#awrap').hidden = !d; $('#deliv-hint').hidden = !d; $('#pickup-hint').hidden = d;
    render();
  }
  function text() {
    const it = st.item; const d = pickedDate();
    const note = $('#note').value.trim();
    const addr = $('#addr').value.trim();
    const lines = ['Здравствуйте! Хочу сделать заказ.'];
    lines.push(`${it && it.k === 'g' ? 'Подарок' : 'Букет'}: ${it ? it.t : '—'}`);
    if (it && it.p) lines.push(`Цена по ценнику: ${it.p}`);
    if (it) lines.push(`Фото: ${BASE}/img/${it.id}.webp`);
    lines.push(`Дата: ${d ? fmt(d) : '—'}`);
    lines.push(`Время: ${time.value || '—'}`);
    lines.push(`Получение: ${st.how === 'delivery' ? 'доставка' : 'самовывоз'}`);
    if (st.how === 'delivery') lines.push(`Адрес: ${addr || '—'}`);
    if (note) lines.push(`Открытка: ${note}`);
    lines.push(`Имя: ${$('#name').value.trim() || '—'}`);
    return lines.join('\n');
  }
  function render() {
    const it = st.item;
    $('#picked').innerHTML = it ? `<figure><img src="img/${it.id}.webp" alt=""></figure><div><b>${esc(it.t)}</b>${it.p ? `<span>${esc(it.p)}</span>` : ''}</div>` : '';
    $$('#thumbs button').forEach(b => b.setAttribute('aria-pressed', !!it && b.dataset.id === it.id));
    $('#msg').textContent = text();
  }
  function validate() {
    const set = (k, m) => { $(`[data-e=${k}]`).textContent = m; return !m; };
    const ok = [
      set('item', st.item ? '' : 'Выберите букет'),
      set('when', !pickedDate() ? 'Выберите дату' : time.value ? '' : 'Выберите время'),
      set('addr', st.how === 'delivery' && !$('#addr').value.trim() ? 'Укажите адрес доставки' : ''),
      set('name', $('#name').value.trim() ? '' : 'Напишите ваше имя')
    ].every(Boolean);
    if (!ok) $('.err:not(:empty)').closest('fieldset').scrollIntoView({ behavior: motion ? 'smooth' : 'auto', block: 'center' });
    return ok;
  }

  $('#thumbs').innerHTML = ITEMS.map(i => `<button type="button" data-id="${i.id}" aria-label="${esc(i.t)}" aria-pressed="false"><img src="img/${i.id}.webp" alt="" loading="lazy"></button>`).join('');
  $('#thumbs').onclick = e => { const b = e.target.closest('button'); if (b) { st.item = byId(b.dataset.id); render(); } };
  $('#days').onclick = e => { const b = e.target.closest('button'); if (b) setDay(b.dataset.d); };
  $('#how').onclick = e => { const b = e.target.closest('button'); if (b) setHow(b.dataset.h); };
  const clear = el => { const f = el.closest('fieldset'); if (f) $$('.err', f).forEach(x => { x.textContent = ''; }); };
  $('#form').addEventListener('input', e => { clear(e.target); render(); });
  $('#form').addEventListener('click', e => { if (e.target.closest('button[type=button]')) clear(e.target); });
  $('#form').addEventListener('submit', e => {
    e.preventDefault();
    if (validate()) location.href = `https://wa.me/${WA}?text=${encodeURIComponent(text())}`;
  });
  times();
  if (time.options.length === 1) setDay('1'); else render();
  const sel = $('#thumbs [aria-pressed=true]');
  if (sel) $('#thumbs').scrollLeft = sel.offsetLeft - 16;
}

shell();
({ catalog, order }[document.body.dataset.page] || (() => {}))();
