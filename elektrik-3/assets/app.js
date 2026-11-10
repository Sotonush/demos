const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const WA = document.body.dataset.wa;
const PAGE = document.body.dataset.page;
const motion = !matchMedia('(prefers-reduced-motion: reduce)').matches;
const TZ = 'Asia/Bishkek';

window.dataLayer = window.dataLayer || [];
function goal(name, label) {
  window.dataLayer.push({ event: name, page: PAGE, label: label || '' });
}
document.addEventListener('click', e => {
  const a = e.target.closest('[data-goal]');
  if (a) goal(a.dataset.goal, a.dataset.label || a.textContent.trim().slice(0, 60));
});

function dates() {
  const d = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TZ }).format(new Date());
  $$('[data-today]').forEach(e => { e.textContent = d; });
  const clocks = $$('[data-clock]');
  if (!clocks.length) return;
  const f = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
  const tick = () => clocks.forEach(e => { e.textContent = f.format(new Date()); });
  tick();
  setInterval(tick, 15000);
}

function openWa(text) {
  const url = `https://wa.me/${WA}?text=${encodeURIComponent(text)}`;
  const w = window.open(url, '_blank');
  if (w) w.opener = null; else location.href = url;
}

function chipGroup(box, set, onChange) {
  const draw = () => $$('.chip', box).forEach(b => b.setAttribute('aria-pressed', String(set.has(b.dataset.id))));
  box.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    set.has(b.dataset.id) ? set.delete(b.dataset.id) : set.add(b.dataset.id);
    draw();
    onChange();
  });
  draw();
}

function estimate(list, box, set, empty) {
  const picked = $$('.chip', box).filter(b => set.has(b.dataset.id));
  if (!picked.length) {
    list.innerHTML = empty ? `<li class="est-e">${empty}</li>` : '';
    return;
  }
  const have = new Map($$('li[data-id]', list).map(li => [li.dataset.id, li]));
  $$('.est-e', list).forEach(li => li.remove());
  have.forEach((li, id) => { if (!set.has(id)) li.remove(); });
  picked.forEach(b => {
    if (have.has(b.dataset.id)) return;
    const li = document.createElement('li');
    li.dataset.id = b.dataset.id;
    const p = b.dataset.price;
    const sum = p ? `<span class="sum">${p.startsWith('от ') ? `<span class="ot">от</span><span class="cur">${p.slice(3)}</span>` : p}<span class="ot cur">сом</span></span>` : '<span class="sum ask">цену скажет мастер</span>';
    li.innerHTML = `<span><b></b><small></small></span>${sum}`;
    li.querySelector('b').textContent = b.textContent;
    li.querySelector('small').textContent = b.dataset.svc;
    list.append(li);
  });
}

function names(box, set) {
  return $$('.chip', box).filter(b => set.has(b.dataset.id)).map(b => b.textContent);
}

function digits(v) {
  return v.replace(/\D/g, '');
}

function quick() {
  const form = $('#quick');
  if (!form) return;
  const box = $('#qsym');
  const list = $('#qest');
  const tel = $('#qtel');
  const err = $('#qerr');
  const set = new Set();
  const empty = list.querySelector('.est-e').textContent;
  const clear = () => { err.textContent = ''; tel.closest('.o-f').classList.remove('bad'); tel.removeAttribute('aria-invalid'); };
  chipGroup(box, set, () => estimate(list, box, set, empty));
  tel.addEventListener('input', clear);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = digits(tel.value);
    if (d.length < 9) {
      err.textContent = d.length ? 'Номер короткий. Напишите полностью, например +996 555 12 34 56' : 'Напишите телефон, по нему мастер перезвонит';
      tel.closest('.o-f').classList.add('bad');
      tel.setAttribute('aria-invalid', 'true');
      tel.focus();
      return;
    }
    const what = names(box, set);
    const text = ['Здравствуйте! Перезвоните мне, пожалуйста.', `Телефон: ${tel.value.trim()}`, `Что случилось: ${what.length ? what.join('; ') : 'расскажу по телефону'}`].join('\n');
    goal('form_submit', `перезвоните: ${what.join(', ') || 'без поломки'}`);
    openWa(text);
  });
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
  if (q.get('s') === 'other') $('#note').value = 'Tesla или Starlink';
  if (['call', 'come'].includes(q.get('m'))) st.mode = q.get('m');
  const soon = ['Сейчас', 'Через час', 'Вечером', 'Ночью', 'Завтра утром'];
  $('#soon').innerHTML = soon.map(t => `<button type="button" class="chip" data-t="${t}" aria-pressed="false">${t}</button>`).join('');
  const problem = () => [...names(box, set), val('#note')].filter(Boolean).join('; ');
  const place = () => (st.mode === 'come' ? st.soon : val('#place'));
  const text = () => {
    const l = ['Здравствуйте! Нужна помощь.', `Авто: ${val('#car') || '...'}`, `Что случилось: ${problem() || '...'}`];
    if (st.mode === 'call') l.push(`Где машина: ${place() || '...'}`);
    if (st.mode === 'come') l.push(`Приеду сам: ${place() || '...'}`);
    return l.join('\n');
  };
  const draw = () => {
    $$('#soon .chip').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.t === st.soon)));
    $$('#mode button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.m === st.mode)));
    $('#where').hidden = st.mode !== 'call';
    $('#when').hidden = st.mode !== 'come';
    $('#preview').textContent = text();
    estimate($('#best'), box, set, '');
    $('#berr').textContent = '';
    $$('.o-f.bad', form).forEach(s => s.classList.remove('bad'));
  };
  chipGroup(box, set, draw);
  $('#soon').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; st.soon = st.soon === b.dataset.t ? '' : b.dataset.t; draw(); });
  $('#mode').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { st.mode = b.dataset.m; draw(); } });
  $$('input', form).forEach(i => i.addEventListener('input', draw));
  form.addEventListener('submit', e => {
    e.preventDefault();
    const checks = [
      [!val('#car'), 'car', '#car', 'Напишите марку и модель'],
      [!problem(), 'sym', '#sym .chip', 'Отметьте, что случилось, или напишите своими словами'],
      [!st.mode, 'mode', '#mode button', 'Машина на ходу или нужен мастер?'],
      [!place(), 'mode', st.mode === 'call' ? '#place' : '#soon .chip', st.mode === 'call' ? 'Напишите, где машина' : 'Выберите, когда приедете'],
    ];
    const miss = checks.find(c => c[0]);
    if (miss) {
      $('#berr').textContent = miss[3];
      const step = $(`[data-step="${miss[1]}"]`, form);
      step.classList.add('bad');
      $(miss[2]).focus({ preventScroll: true });
      step.scrollIntoView({ block: 'center', behavior: motion ? 'smooth' : 'auto' });
      return;
    }
    goal('form_submit', `запись: ${problem()}`);
    openWa(text());
  });
  draw();
}

function pins() {
  if (!motion || !('IntersectionObserver' in window)) return;
  const list = $$('.pins .pin').filter(p => p.getBoundingClientRect().top > innerHeight * .9);
  if (!list.length) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    e.target.classList.remove('pre');
    io.unobserve(e.target);
  }), { rootMargin: '0px 0px -12% 0px' });
  list.forEach((p, i) => { p.style.setProperty('--d', `${i * 90}ms`); p.classList.add('pre'); io.observe(p); });
}

dates();
quick();
book();
pins();
