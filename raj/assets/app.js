const { wa: WA, base: BASE, items: ITEMS } = window.RAJ;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const byId = id => ITEMS.find(i => i.id === id);
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const WA_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.8 9.8 0 0 0-8.4 14.9L2.3 21.8l4.8-1.3A9.8 9.8 0 1 0 12 2.2Zm5.7 13.9c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.8-.7-3.1-1.3-5.1-4.5-5.3-4.7-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1.1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.2.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.2.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.3.1.2.1.8-.1 1.3Z"/></svg>';
const OPEN = 9;
const CLOSE = 21;

function shell() {
  const page = document.body.dataset.page === 'bouquet' ? 'catalog' : document.body.dataset.page;
  const nav = [['index', 'Витрина'], ['catalog', 'Каталог'], ['order', 'Заказ'], ['contacts', 'Контакты']];
  const links = nav.map(([k, t]) => `<a href="${k}.html"${k === page ? ' aria-current="page"' : ''}>${t}</a>`).join('');
  document.body.insertAdjacentHTML('afterbegin', `<div class="demo">Демо-версия<a href="owner.html">Как это работает</a></div>
  <header class="top"><div class="wrap"><a class="logo" href="index.html">Цветочный рай</a><nav class="links" aria-label="Разделы">${links}</nav><a class="wa-link" href="https://wa.me/${WA}">${WA_ICON}<span>WhatsApp</span></a></div></header>`);
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

function bouquet() {
  const it = byId(new URLSearchParams(location.search).get('item'));
  if (!it) { location.replace('catalog.html'); return; }
  document.title = `${it.t}, Цветочный рай`;
  const ask = `Здравствуйте! Хочу заказать: ${it.t}.\nФото: ${BASE}/img/${it.id}.webp`;
  const back = it.k === 'g' ? 'Подарки' : 'Букеты';
  $('#item').innerHTML = `<figure><img src="img/${it.id}.webp" alt="${esc(it.t)}"></figure><div class="about"><a class="crumb" href="catalog.html">${back}</a><h1>${esc(it.t)}</h1>
  <p class="cost big">${it.p ? esc(it.p) : 'Цену уточним в WhatsApp'}</p>
  <a class="btn" href="https://wa.me/${WA}?text=${encodeURIComponent(ask)}">${WA_ICON}Заказать в WhatsApp</a><a class="more" href="order.html?item=${it.id}">Указать дату и текст открытки</a>
  <dl class="rows"><div><dt>Самовывоз</dt><dd>Гвардейская улица, 7Б/1</dd></div><div><dt>Доставка</dt><dd>По Кара-Балте</dd></div><div><dt>Открытка</dt><dd>С вашим текстом</dd></div></dl></div>`;
  const pool = ITEMS.filter(i => i.k === it.k && i.id !== it.id);
  const from = ITEMS.indexOf(it) % pool.length;
  const next = [0, 1, 2].map(n => pool[(from + n) % pool.length]);
  $('#more').innerHTML = next.map(i => `<a class="card" href="bouquet.html?item=${i.id}"><figure><img src="img/${i.id}.webp" alt="${esc(i.t)}" loading="lazy"></figure><h3>${esc(i.t)}</h3>${i.p ? `<p class="cost">${esc(i.p)}</p>` : ''}</a>`).join('');
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
    if (it && it.p) lines.push(`Цена из Instagram: ${it.p}`);
    if (it) lines.push(`Фото: ${BASE}/img/${it.id}.webp`);
    lines.push(`Дата: ${d ? fmt(d) : '—'}`);
    lines.push(`Время: ${time.value || '—'}`);
    lines.push(`Получение: ${st.how === 'delivery' ? 'доставка' : 'самовывоз'}`);
    if (st.how === 'delivery') lines.push(`Адрес: ${addr || '—'}`);
    if (note) lines.push(`Открытка: ${note}`);
    lines.push(`Имя: ${$('#name').value.trim() || '—'}`);
    return lines.join('\n');
  }
  let open = false;
  function render() {
    const it = st.item;
    $('#picked').innerHTML = it ? `<figure><img src="img/${it.id}.webp" alt=""></figure><div><b>${esc(it.t)}</b>${it.p ? `<span class="cost">${esc(it.p)}</span>` : ''}</div>` : '';
    $('#change').hidden = !it || open;
    $('#thumbs').hidden = !!it && !open;
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
  $('#thumbs').onclick = e => { const b = e.target.closest('button'); if (b) { st.item = byId(b.dataset.id); open = false; render(); } };
  $('#change').onclick = () => { open = true; render(); };
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
}

shell();
({ catalog, order, bouquet }[document.body.dataset.page] || (() => {}))();
