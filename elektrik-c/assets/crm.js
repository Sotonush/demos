const CRM_CFG = (() => { try { return JSON.parse(document.getElementById('crm-cfg').textContent); } catch (e) { return { services: [], pages: {}, review_url: '', name: '' }; } })();
const BK = 'Asia/Bishkek';
const SRC_T = { '3d': '3D-машина', prices: 'Прайс', hero: 'Главный экран' };
const crm = { clients: null, cursor: null, q: '', pick: null, services: null, period: 30, stats: null, tg: null, tgLink: null, tgPoll: null, due: [], loaded: {} };

function crmPlural(n, a, b, c) {
  const m = Math.abs(n) % 100;
  const k = m % 10;
  return m > 10 && m < 20 ? c : k === 1 ? a : k >= 2 && k <= 4 ? b : c;
}

function crmPad(n) { return String(n).padStart(2, '0'); }

function crmParts(d = new Date()) {
  const p = {};
  new Intl.DateTimeFormat('en-GB', { timeZone: BK, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).forEach(x => { p[x.type] = x.value; });
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute };
}

function crmIso(y, m, d, h, mi) { return new Date(Date.UTC(y, m - 1, d, h - 6, mi)).toISOString(); }

function crmDay(d = new Date()) { const p = crmParts(d); return `${p.y}-${crmPad(p.m)}-${crmPad(p.d)}`; }

function crmAddDays(key, n) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function crmDayDiff(a, b) {
  const t = k => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return Math.round((t(b) - t(a)) / 86400000);
}

function crmDateText(key, withYear) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: withYear ? 'numeric' : undefined, timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
}

function crmShortDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d))).replace('.', '');
}

function crmWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = crmParts(d);
  const diff = crmDayDiff(crmDay(), crmDay(d));
  const t = `${crmPad(p.h)}:${crmPad(p.mi)}`;
  if (diff === 0) return `сегодня в ${t}`;
  if (diff === 1) return `завтра в ${t}`;
  if (diff === -1) return `вчера в ${t}`;
  return `${crmDateText(crmDay(d))} в ${t}`;
}

function crmLastVisit(iso) {
  if (!iso) return '';
  const diff = crmDayDiff(crmDay(new Date(iso)), crmDay());
  if (diff <= 0) return 'сегодня';
  if (diff === 1) return 'вчера';
  if (diff < 7) return `${diff} ${crmPlural(diff, 'день', 'дня', 'дней')} назад`;
  return crmDateText(crmDay(new Date(iso)), diff > 300);
}

function crmMoney(n) { return Number(n).toLocaleString('ru-RU').replace(/\s/g, ' '); }

function crmDigits(p) { return String(p || '').replace(/\D/g, ''); }

function crmInitials(name) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return '·';
  return ((w[0][0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase();
}

function crmFail(err) {
  if (err && err.status === 401) { expired(); return true; }
  toast((err && err.message) || 'Не получилось, попробуйте ещё раз');
  return false;
}

function crmSource(s) {
  const v = String(s || '');
  if (!v) return '';
  if (SRC_T[v]) return SRC_T[v];
  if (v.startsWith('service:')) { const slug = v.slice(8); return `Страница услуги: ${CRM_CFG.pages[slug] || slug}`; }
  if (v.startsWith('utm:')) return `Реклама: ${v.slice(4)}`;
  return v;
}

function crmVisit(o) {
  const c = o && o.customer;
  return c && c.orders_count > 1 ? c.orders_count : 0;
}

function crmRowTags(o) {
  const kids = [];
  if (o.callback_at && !['done', 'cancelled', 'no_show'].includes(o.status)) {
    const due = new Date(o.callback_at).getTime() <= Date.now() + 15 * 60000;
    kids.push(el('span', { class: `crm-pill crm-cbp${due ? ' crm-hot' : ''}`, title: `Перезвонить ${crmWhen(o.callback_at)}` }, [el('span', { text: due ? 'Перезвонить' : crmWhen(o.callback_at).replace(' в ', ' ') })]));
  }
  const v = crmVisit(o);
  if (v) kids.push(el('span', { class: 'crm-pill crm-rep', text: `${v}-й визит` }));
  return kids.length ? el('span', { class: 'crm-tags' }, kids) : null;
}

function crmCallbackPresets() {
  const now = crmParts();
  const today = crmDay();
  const late = now.h * 60 + now.mi >= 17 * 60 + 30;
  const eve = late ? crmAddDays(today, 1) : today;
  const tm = crmAddDays(today, 1).split('-').map(Number);
  const ev = eve.split('-').map(Number);
  return [
    ['Через 1 час', new Date(Date.now() + 3600000).toISOString()],
    [late ? 'Завтра 18:00' : 'Вечером 18:00', crmIso(ev[0], ev[1], ev[2], 18, 0)],
    ['Завтра 10:00', crmIso(tm[0], tm[1], tm[2], 10, 0)],
  ];
}

async function crmSetCallback(o, iso, onChange) {
  try {
    const nv = await auth('PATCH', `/api/owner/orders/${encodeURIComponent(o.number)}`, { callback_at: iso });
    const merged = Object.assign({}, o, nv && nv.number ? nv : {}, { callback_at: iso });
    const k = orders.findIndex(x => x.number === o.number);
    if (k >= 0) orders[k] = Object.assign(orders[k], { callback_at: iso });
    toast(iso ? `Напомним перезвонить ${crmWhen(iso)}` : 'Напоминание снято');
    if (onChange) onChange(merged);
    crmLoadDue();
  } catch (err) {
    crmFail(err);
  }
}

function crmCallback(o, onChange) {
  const box = el('div', { class: 'crm-cb' });
  const open = !['done', 'cancelled', 'no_show'].includes(o.status);
  if (!open && !o.callback_at) return null;
  const head = el('p', { class: 'crm-k' }, [el('span', { text: 'Перезвонить' })]);
  box.append(head);
  if (o.callback_at) {
    const due = new Date(o.callback_at).getTime() <= Date.now();
    box.append(el('div', { class: `crm-cb-now${due ? ' crm-hot' : ''}` }, [
      el('b', { text: due ? `Пора звонить, было ${crmWhen(o.callback_at)}` : crmWhen(o.callback_at).replace(/^./, c => c.toUpperCase()) }),
      el('button', { type: 'button', class: 'btn ghost sm', text: 'Снять', onclick: () => crmSetCallback(o, null, onChange) }),
    ]));
  }
  if (!open) return box;
  const row = el('div', { class: 'crm-cb-row', role: 'group', 'aria-label': 'Когда перезвонить' });
  crmCallbackPresets().forEach(([t, iso]) => row.append(el('button', { type: 'button', class: 'crm-chip', text: t, onclick: () => crmSetCallback(o, iso, onChange) })));
  const own = el('input', { type: 'datetime-local', class: 'crm-dt', 'aria-label': 'Своё время', step: '300' });
  const p = crmParts();
  own.min = `${p.y}-${crmPad(p.m)}-${crmPad(p.d)}T${crmPad(p.h)}:${crmPad(p.mi)}`;
  const ownBtn = el('button', { type: 'button', class: 'crm-chip', text: 'Своё время' });
  const ownBox = el('div', { class: 'crm-cb-own', hidden: true }, [own, el('button', { type: 'button', class: 'btn send sm', text: 'Напомнить', onclick: () => {
    if (!own.value) { own.focus(); return; }
    const [d, t] = own.value.split('T');
    const [y, m, dd] = d.split('-').map(Number);
    const [h, mi] = t.split(':').map(Number);
    crmSetCallback(o, crmIso(y, m, dd, h, mi), onChange);
  } })]);
  ownBtn.addEventListener('click', () => { ownBox.hidden = !ownBox.hidden; ownBtn.setAttribute('aria-pressed', String(!ownBox.hidden)); if (!ownBox.hidden) own.focus(); });
  row.append(ownBtn);
  box.append(row, ownBox);
  return box;
}

function crmReviewLink(o) {
  const name = o.name && o.name !== 'Клиент' ? `, ${o.name}` : '';
  const text = `Здравствуйте${name}! Это ${CRM_CFG.name || 'автосервис'}. Спасибо, что доверили нам машину. Если всё понравилось, оставьте, пожалуйста, пару слов в 2ГИС, нам это очень помогает: ${CRM_CFG.review_url}`;
  return `https://wa.me/${crmDigits(o.phone)}?text=${encodeURIComponent(text)}`;
}

function crmDetail(o, onChange) {
  if (!o || !o.number) return null;
  const kids = [];
  const tags = [];
  const v = crmVisit(o);
  if (v && o.customer) tags.push(el('button', { type: 'button', class: 'crm-pill crm-rep crm-big', title: 'Открыть карточку клиента', onclick: () => crmOpenClient(o.customer.id) }, [el('span', { text: `Постоянный клиент · ${v}-й визит` })]));
  else if (o.customer && o.customer.orders_count === 1) tags.push(el('span', { class: 'crm-pill crm-new', text: 'Новый клиент' }));
  const src = crmSource(o.source);
  if (src) tags.push(el('span', { class: 'crm-pill crm-src' }, [el('small', { text: 'Откуда' }), el('span', { text: src })]));
  if (tags.length) kids.push(el('div', { class: 'crm-tags crm-big' }, tags));
  const cb = crmCallback(o, onChange);
  if (cb) kids.push(cb);
  if (o.status === 'done' && o.phone && CRM_CFG.review_url) {
    kids.push(el('div', { class: 'crm-rev' }, [
      el('a', { class: 'btn ghost sm crm-rev-b', href: crmReviewLink(o), target: '_blank', rel: 'noopener' }, [icon('wa'), el('span', { text: 'Попросить отзыв' })]),
      el('span', { class: 'crm-hint', text: 'Откроет WhatsApp с готовым текстом и ссылкой на 2ГИС' }),
    ]));
  }
  return kids.length ? el('div', { class: 'crm-od' }, kids) : null;
}

async function crmLoadDue() {
  const box = $('#crm-due');
  if (!box || !owner) return;
  let data;
  try { data = await auth('GET', '/api/owner/orders?callback_due=1'); } catch (err) { if (err.status === 401) expired(); return; }
  crm.due = (data && data.items) || [];
  crmDrawDue();
}

function crmDrawDue() {
  const box = $('#crm-due');
  if (!box) return;
  const list = crm.due;
  box.hidden = !list.length;
  if (!list.length) { box.replaceChildren(); return; }
  box.replaceChildren(
    el('p', { class: 'crm-due-h' }, [el('b', { text: 'Перезвонить сейчас' }), el('span', { class: 'crm-due-n', text: String(list.length) })]),
    el('ul', { class: 'crm-due-l' }, list.map(o => {
      const what = (o.items || []).map(i => i.title).filter(Boolean).join(', ');
      return el('li', {}, [
        el('button', { type: 'button', class: 'crm-due-o', onclick: () => { if (typeof openOrder === 'function') openOrder(o.number, true); } }, [
          el('b', { text: o.name || 'Клиент' }),
          el('span', { text: [what, crmWhen(o.callback_at)].filter(Boolean).join(' · ') }),
        ]),
        el('a', { class: 'btn send sm crm-due-call', href: `tel:${crmDigits(o.phone) ? `+${crmDigits(o.phone)}` : ''}`, 'aria-label': `Позвонить ${o.name || 'клиенту'}` }, [icon('phone'), el('span', { text: 'Позвонить' })]),
        el('button', { type: 'button', class: 'btn ghost sm', text: 'Готово', title: 'Снять напоминание', onclick: () => crmSetCallback(o, null) }),
      ]);
    })),
  );
}

function crmSummary(s) {
  const n = (s && s.callbacks_due) || 0;
  if (n > 0) crmLoadDue();
  else { crm.due = []; crmDrawDue(); }
}

function crmOpenOrder(number) {
  const t = $('#tab-orders');
  if (t) t.click();
  if (typeof openOrder === 'function') openOrder(number, true);
}

function crmStatus(o) {
  const t = o.status_title || (typeof STATUS !== 'undefined' && STATUS[o.status]) || o.status;
  return el('span', { class: `crm-st crm-st-${o.status}`, text: t });
}

async function crmLoadClients(more) {
  const box = $('#crm-clients');
  if (!box) return;
  if (!more) { crm.cursor = null; crm.clients = null; crmDrawClients(true); }
  const qs = new URLSearchParams({ limit: '30' });
  if (crm.q) qs.set('q', crm.q);
  if (more && crm.cursor) qs.set('cursor', crm.cursor);
  const q = crm.q;
  let data;
  try { data = await auth('GET', `/api/owner/customers?${qs}`); } catch (err) { crmFail(err); crm.clients = crm.clients || []; crmDrawClients(); return; }
  if (q !== crm.q) return;
  crm.clients = (more ? crm.clients || [] : []).concat((data && data.items) || []);
  crm.cursor = (data && data.next_cursor) || null;
  crmDrawClients();
}

function crmClientsUi() {
  const box = $('#crm-clients');
  if (!box || box.dataset.ready) return;
  box.dataset.ready = '1';
  const input = el('input', { type: 'search', id: 'crm-q', placeholder: 'Имя, телефон или машина', autocomplete: 'off', enterkeyhint: 'search', 'aria-label': 'Поиск клиента' });
  let t = null;
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { crm.q = input.value.trim(); crmLoadClients(); }, 250); });
  box.append(
    el('div', { class: 'crm-cl' }, [
      el('div', { class: 'crm-cl-l' }, [
        el('div', { class: 'crm-search' }, [input]),
        el('ul', { class: 'crm-list', id: 'crm-cl-list', 'aria-live': 'polite' }),
        el('div', { class: 'crm-cl-more', id: 'crm-cl-more' }),
      ]),
      el('section', { class: 'crm-cl-d', id: 'crm-cl-d', 'aria-label': 'Карточка клиента', tabindex: '-1' }, [crmEmpty('Выберите клиента', 'Здесь история его заявок, машина и заметка.')]),
    ]),
  );
}

function crmEmpty(title, text, extra) {
  return el('div', { class: 'crm-empty' }, [el('b', { text: title }), el('span', { text }), extra || null]);
}

function crmDrawClients(loading) {
  const ul = $('#crm-cl-list');
  if (!ul) return;
  if (loading && !crm.clients) {
    ul.replaceChildren(...[0, 1, 2, 3, 4].map(() => el('li', { class: 'crm-sk', 'aria-hidden': 'true' }, [el('i'), el('i')])));
    $('#crm-cl-more').replaceChildren();
    return;
  }
  const list = crm.clients || [];
  if (!list.length) {
    ul.replaceChildren(el('li', { class: 'crm-none' }, [crmEmpty(crm.q ? 'Никого не нашли' : 'Клиентов пока нет', crm.q ? 'Проверьте номер или попробуйте часть имени.' : 'Каждый, кто оставит заявку, появится здесь сам. Повторные визиты считаются по телефону.')]));
    $('#crm-cl-more').replaceChildren();
    return;
  }
  ul.replaceChildren(...list.map(c => {
    const sub = [phoneText(c.phone), c.car].filter(Boolean).join(' · ');
    return el('li', {}, [el('button', { type: 'button', class: `crm-ci${crm.pick === c.id ? ' on' : ''}`, 'aria-current': crm.pick === c.id ? 'true' : null, 'data-id': c.id, onclick: () => crmOpenClient(c.id) }, [
      el('span', { class: 'crm-av', 'aria-hidden': 'true', text: crmInitials(c.name || c.car) }),
      el('span', { class: 'crm-ci-t' }, [el('b', { text: c.name || phoneText(c.phone) }), el('span', { text: c.name ? sub : c.car || '' })]),
      el('span', { class: 'crm-ci-r' }, [el('b', { text: `${c.orders_count} ${crmPlural(c.orders_count, 'заявка', 'заявки', 'заявок')}` }), el('span', { text: crmLastVisit(c.last_order_at) })]),
    ])]);
  }));
  $('#crm-cl-more').replaceChildren(crm.cursor ? el('button', { type: 'button', class: 'btn ghost sm', text: 'Показать ещё', onclick: e => { e.currentTarget.disabled = true; crmLoadClients(true); } }) : '');
}

async function crmOpenClient(id) {
  const tab = $('#tab-clients');
  if (tab && tab.getAttribute('aria-selected') !== 'true') tab.click();
  crmClientsUi();
  if (!crm.clients) crmLoadClients();
  crm.pick = id;
  $$('#crm-cl-list .crm-ci').forEach(b => { const on = b.dataset.id === String(id); b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'true' : 'false'); });
  const d = $('#crm-cl-d');
  $('.crm-cl').classList.add('crm-picked');
  document.body.classList.add('crm-cl-open');
  d.replaceChildren(el('div', { class: 'crm-cd crm-loading' }, [el('div', { class: 'crm-sk' }, [el('i'), el('i')])]));
  let c;
  try { c = await auth('GET', `/api/owner/customers/${encodeURIComponent(id)}`); } catch (err) { crmFail(err); crmCloseClient(); return; }
  if (crm.pick !== id) return;
  d.replaceChildren(crmClientCard(c));
  d.focus({ preventScroll: true });
  d.scrollTop = 0;
  if (matchMedia('(max-width: 900px)').matches) window.scrollTo(0, 0);
}

function crmCloseClient() {
  const cl = $('.crm-cl');
  if (cl) cl.classList.remove('crm-picked');
  document.body.classList.remove('crm-cl-open');
  const b = crm.pick && $(`#crm-cl-list .crm-ci[data-id="${crm.pick}"]`);
  crm.pick = null;
  if (b) { b.classList.remove('on'); b.focus({ preventScroll: true }); }
}

function crmField(c, key, label, opts = {}) {
  const id = `crm-f-${key}`;
  const input = el(opts.area ? 'textarea' : 'input', { id, class: 'crm-in', maxlength: opts.max || '120', placeholder: opts.ph || '', rows: opts.area ? '3' : null, autocomplete: 'off' });
  input.value = c[key] || '';
  const st = el('span', { class: 'crm-saved', 'aria-live': 'polite' });
  let saved = c[key] || '';
  const save = async () => {
    const v = input.value.trim();
    if (v === saved) return;
    st.textContent = 'Сохраняем…';
    try {
      const nv = await auth('PATCH', `/api/owner/customers/${encodeURIComponent(c.id)}`, { [key]: v });
      saved = (nv && nv[key] !== undefined ? nv[key] : v) || '';
      c[key] = saved;
      st.textContent = 'Сохранено';
      const it = (crm.clients || []).find(x => x.id === c.id);
      if (it) { it[key] = saved; crmDrawClients(); }
    } catch (err) {
      if (!crmFail(err)) st.textContent = 'Не сохранилось';
    }
  };
  input.addEventListener('blur', save);
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && (!opts.area || e.metaKey || e.ctrlKey)) { e.preventDefault(); input.blur(); } });
  return el('div', { class: 'crm-fld' }, [el('label', { for: id, class: 'crm-lbl' }, [el('span', { text: label }), st]), input]);
}

function crmClientCard(c) {
  const ords = c.orders || [];
  const tel = crmDigits(c.phone) ? `tel:+${crmDigits(c.phone)}` : null;
  const wa = `https://wa.me/${crmDigits(c.phone)}?text=${encodeURIComponent(`Здравствуйте${c.name ? `, ${c.name}` : ''}! Это ${CRM_CFG.name || 'автосервис'}.`)}`;
  const since = c.created_at ? crmDay(new Date(c.created_at)).split('-').reverse().join('.') : '';
  return el('div', { class: 'crm-cd' }, [
    el('div', { class: 'crm-cd-top' }, [
      el('button', { type: 'button', class: 'crm-back', onclick: crmCloseClient }, [icon(document.getElementById('ico-left') ? 'left' : 'back'), el('span', { text: 'Клиенты' })]),
    ]),
    el('div', { class: 'crm-cd-h' }, [
      el('span', { class: 'crm-av crm-big', 'aria-hidden': 'true', text: crmInitials(c.name || c.car) }),
      el('div', {}, [el('h2', { text: c.name || 'Без имени' }), el('a', { class: 'crm-tel', href: tel || '#', translate: 'no', text: phoneText(c.phone) })]),
    ]),
    el('div', { class: 'crm-cd-acts' }, [
      el('a', { class: 'btn send sm', href: tel || '#' }, [icon('phone'), el('span', { text: 'Позвонить' })]),
      el('a', { class: 'btn ghost sm', href: wa, target: '_blank', rel: 'noopener' }, [icon('wa'), el('span', { text: 'WhatsApp' })]),
    ]),
    el('dl', { class: 'crm-cd-n' }, [
      el('div', {}, [el('dt', { text: 'Заявок' }), el('dd', { text: String(c.orders_count || ords.length) })]),
      el('div', {}, [el('dt', { text: 'Выполнено' }), el('dd', { text: String(c.done_count || 0) })]),
      el('div', {}, [el('dt', { text: 'С нами с' }), el('dd', { text: since || '—' })]),
    ]),
    el('div', { class: 'crm-cd-f' }, [
      crmField(c, 'name', 'Имя', { ph: 'Как зовут клиента', max: '80' }),
      crmField(c, 'car', 'Машина', { ph: 'Например, Toyota Camry 2015', max: '80' }),
      crmField(c, 'note', 'Заметка', { ph: 'Что важно помнить: скидка, особенности машины…', max: '1000', area: true }),
    ]),
    el('p', { class: 'crm-k' }, [el('span', { text: 'История заявок' })]),
    ords.length ? el('ol', { class: 'crm-hist' }, ords.map(o => el('li', {}, [el('button', { type: 'button', class: 'crm-ho', onclick: () => crmOpenOrder(o.number) }, [
      el('span', { class: 'crm-ho-t' }, [el('b', { text: (o.items || []).map(i => i.title).filter(Boolean).join(', ') || 'Заявка' }), el('span', { text: `№${o.number} · ${crmLastVisit(o.created_at)}` })]),
      crmStatus(o),
    ])]))) : el('p', { class: 'crm-hint', text: 'Заявок пока нет.' }),
  ]);
}

async function crmLoadServices() {
  const box = $('#crm-prices');
  if (!box) return;
  if (!crm.services) box.replaceChildren(el('ul', { class: 'crm-pl' }, [0, 1, 2, 3].map(() => el('li', { class: 'crm-sk', 'aria-hidden': 'true' }, [el('i'), el('i')]))));
  let data;
  try { data = await auth('GET', '/api/owner/services'); } catch (err) { crmFail(err); box.replaceChildren(crmEmpty('Прайс не загрузился', 'Проверьте интернет и откройте вкладку ещё раз.')); return; }
  crm.services = ((data && data.items) || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
  crmDrawServices();
}

async function crmSeed(btn) {
  btn.disabled = true;
  btn.setAttribute('aria-busy', 'true');
  const items = CRM_CFG.services.map((s, k) => ({ slug: s.slug, title: s.title, price_from: s.price_from, price_text: s.price_text, published: true, position: k }));
  try {
    const data = await auth('PUT', '/api/owner/services', { items });
    crm.services = ((data && data.items) || items).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
    crmDrawServices();
    toast(`Прайс загружен: ${crm.services.length} ${crmPlural(crm.services.length, 'услуга', 'услуги', 'услуг')}`);
  } catch (err) {
    crmFail(err);
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
  }
}

function crmDrawServices() {
  const box = $('#crm-prices');
  const list = crm.services || [];
  if (!list.length) {
    box.replaceChildren(el('div', { class: 'crm-first' }, [
      el('b', { text: 'Прайс ещё не перенесён в кабинет' }),
      el('span', { text: `Одной кнопкой заберём ${CRM_CFG.services.length} ${crmPlural(CRM_CFG.services.length, 'услугу', 'услуги', 'услуг')} с цены на сайте. Потом меняйте цены здесь, сайт обновится сам.` }),
      el('button', { type: 'button', class: 'btn send', text: 'Загрузить текущий прайс с сайта', onclick: e => crmSeed(e.currentTarget) }),
    ]));
    return;
  }
  box.replaceChildren(
    el('p', { class: 'crm-hint crm-pl-h', text: 'Цена сохраняется, когда вы уходите из поля. На сайте обновится в течение минуты. Пустая цена и пустой текст: на сайте останется цена по умолчанию.' }),
    el('ul', { class: 'crm-pl' }, list.map((s, k) => crmServiceRow(s, k, list.length))),
  );
}

async function crmPatchService(s, data, ok) {
  try {
    const nv = await auth('PATCH', `/api/owner/services/${encodeURIComponent(s.slug)}`, data);
    Object.assign(s, data, nv && nv.slug ? nv : {});
    toast(ok);
    return true;
  } catch (err) {
    crmFail(err);
    return false;
  }
}

async function crmMoveService(k, d) {
  const list = crm.services;
  const j = k + d;
  if (j < 0 || j >= list.length) return;
  const next = list.slice();
  [next[k], next[j]] = [next[j], next[k]];
  try {
    const data = await auth('PUT', '/api/owner/services/order', { slugs: next.map(s => s.slug) });
    crm.services = data && data.items && data.items.length ? data.items.slice().sort((a, b) => (a.position || 0) - (b.position || 0)) : next;
    crmDrawServices();
    const row = $$('#crm-prices .crm-pr')[j];
    const b = row && $(d < 0 ? '.crm-up' : '.crm-down', row);
    if (b && !b.disabled) b.focus(); else if (row) $('.crm-up, .crm-down', row).focus();
    toast('Порядок сохранён');
  } catch (err) {
    crmFail(err);
  }
}

function crmServiceRow(s, k, n) {
  const pid = `crm-p-${k}`;
  const tid = `crm-t-${k}`;
  const price = el('input', { id: pid, class: 'crm-in crm-pin', inputmode: 'numeric', autocomplete: 'off', placeholder: '—', 'aria-label': `Цена от, сом: ${s.title}` });
  price.value = s.price_from ? crmMoney(s.price_from) : '';
  const text = el('input', { id: tid, class: 'crm-in crm-ptx', maxlength: '60', autocomplete: 'off', placeholder: 'или текст вместо цены', 'aria-label': `Текст вместо цены: ${s.title}` });
  text.value = s.price_text || '';
  price.addEventListener('input', () => { const d = price.value.replace(/\D/g, '').slice(0, 7); price.value = d ? crmMoney(Number(d)) : ''; });
  price.addEventListener('blur', async () => {
    const d = price.value.replace(/\D/g, '');
    const v = d ? Number(d) : null;
    if (v === (s.price_from || null)) return;
    const ok = await crmPatchService(s, { price_from: v }, v ? `${s.title.split(/[.,:]/)[0]}: от ${crmMoney(v)} сом` : 'Цена убрана');
    if (!ok) price.value = s.price_from ? crmMoney(s.price_from) : '';
  });
  text.addEventListener('blur', async () => {
    const v = text.value.trim();
    if (v === (s.price_text || '')) return;
    const ok = await crmPatchService(s, { price_text: v || null }, 'Текст цены сохранён');
    if (!ok) text.value = s.price_text || '';
  });
  [price, text].forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); i.blur(); } }));
  const pub = el('input', { type: 'checkbox', checked: s.published !== false });
  pub.addEventListener('change', async () => {
    const ok = await crmPatchService(s, { published: pub.checked }, pub.checked ? 'Услуга показана на сайте' : 'Услуга скрыта, на сайте останется цена по умолчанию');
    if (!ok) pub.checked = !pub.checked;
    li.classList.toggle('crm-off', !pub.checked);
  });
  const li = el('li', { class: `crm-pr${s.published === false ? ' crm-off' : ''}` }, [
    el('div', { class: 'crm-pr-h' }, [
      el('b', { class: 'crm-pr-t', text: s.title }),
      el('label', { class: 'crm-sw' }, [pub, el('span', { class: 'crm-sw-k', 'aria-hidden': 'true' }), el('span', { class: 'crm-sw-t', text: 'На сайте' })]),
    ]),
    el('div', { class: 'crm-pr-v' }, [
      el('label', { class: 'crm-pr-p', for: pid }, [el('span', { text: 'от' }), price, el('span', { text: 'сом' })]),
      text,
    ]),
    el('div', { class: 'crm-pr-mv' }, [
      el('button', { type: 'button', class: 'crm-ib crm-up', 'aria-label': `Выше: ${s.title}`, disabled: k === 0, onclick: () => crmMoveService(k, -1) }, [icon('up')]),
      el('button', { type: 'button', class: 'crm-ib crm-down', 'aria-label': `Ниже: ${s.title}`, disabled: k === n - 1, onclick: () => crmMoveService(k, 1) }, [icon('down')]),
    ]),
  ]);
  return li;
}

async function crmLoadStats() {
  const box = $('#crm-stats');
  if (!box) return;
  const to = crmDay();
  const from = crmAddDays(to, -(crm.period - 1));
  crmDrawStatsFrame();
  $('#crm-st-body').classList.add('crm-loading');
  let s;
  try { s = await auth('GET', `/api/owner/stats?from=${from}&to=${to}`); } catch (err) { crmFail(err); $('#crm-st-body').classList.remove('crm-loading'); return; }
  crm.stats = { s, from, to };
  crmDrawStats();
}

function crmDrawStatsFrame() {
  const box = $('#crm-stats');
  if (box.dataset.ready) {
    $$('#crm-period .crm-chip').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.p) === crm.period)));
    return;
  }
  box.dataset.ready = '1';
  box.append(
    el('div', { class: 'crm-period', id: 'crm-period', role: 'group', 'aria-label': 'Период' }, [7, 30, 90].map(p => el('button', { type: 'button', class: 'crm-chip', 'data-p': p, 'aria-pressed': String(p === crm.period), text: `${p} дней`, onclick: () => { crm.period = p; crmLoadStats(); } }))),
    el('div', { class: 'crm-st-body', id: 'crm-st-body' }, [el('div', { class: 'crm-tiles' }, [0, 1, 2, 3].map(() => el('div', { class: 'crm-tile crm-sk' }, [el('i'), el('i')])))]),
  );
}

function crmBars(rows, label) {
  const max = Math.max(1, ...rows.map(r => r.count));
  return el('ul', { class: 'crm-hb', 'aria-label': label }, rows.map(r => el('li', {}, [
    el('span', { class: 'crm-hb-t', text: r.label }),
    el('span', { class: 'crm-hb-n', text: String(r.count) }),
    el('span', { class: 'crm-hb-b', 'aria-hidden': 'true' }, [el('i', { style: `width:${Math.max(2, (r.count / max) * 100)}%` })]),
  ])));
}

function crmDayChart(days, total) {
  const max = Math.max(1, ...days.map(d => d.count));
  const nice = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const n = days.length;
  const W = 1000;
  const H = 220;
  const gap = n > 45 ? 2 : 4;
  const bw = (W - gap * (n - 1)) / n;
  const peak = days.reduce((a, d) => (d.count > a.count ? d : a), days[0]);
  const avg = total / n;
  const avgT = avg >= 10 ? Math.round(avg) : avg.toFixed(1).replace('.', ',');
  const read = el('p', { class: 'crm-read', 'aria-live': 'polite' });
  const base = () => { read.replaceChildren(el('b', { text: `${avgT} в день` }), el('span', { text: peak && peak.count ? ` в среднем · больше всего ${crmDateText(peak.date)}: ${peak.count}` : ' в среднем' })); };
  base();
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'crm-svg');
  svg.setAttribute('aria-hidden', 'true');
  [0.5, 1].forEach(f => {
    const ln = document.createElementNS(svgNS, 'line');
    const y = H - (H * f * nice) / nice;
    ln.setAttribute('x1', '0'); ln.setAttribute('x2', String(W)); ln.setAttribute('y1', String(y)); ln.setAttribute('y2', String(y));
    ln.setAttribute('class', 'crm-grid');
    ln.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.append(ln);
  });
  const bars = [];
  days.forEach((d, k) => {
    const h = d.count ? Math.max(3, (d.count / nice) * (H - 4)) : 0;
    const x = k * (bw + gap);
    const r = document.createElementNS(svgNS, 'path');
    const rr = Math.min(4, bw / 2, h);
    const y = H - h;
    r.setAttribute('d', h ? `M${x},${H}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + bw - rr}Q${x + bw},${y} ${x + bw},${y + rr}V${H}Z` : `M${x},${H - 1.5}H${x + bw}V${H}H${x}Z`);
    r.setAttribute('class', d.count ? 'crm-bar' : 'crm-bar crm-zero');
    svg.append(r);
    bars.push(r);
  });
  const hit = el('div', { class: 'crm-hit', role: 'list' }, days.map((d, k) => {
    const b = el('span', { role: 'listitem', tabindex: '0', 'aria-label': `${crmDateText(d.date)}: ${d.count} ${crmPlural(d.count, 'заявка', 'заявки', 'заявок')}` });
    const on = () => { bars.forEach((x, j) => x.classList.toggle('crm-dim', j !== k)); read.replaceChildren(el('b', { text: `${d.count} ${crmPlural(d.count, 'заявка', 'заявки', 'заявок')}` }), el('span', { text: ` · ${crmDateText(d.date)}` })); };
    const off = () => { bars.forEach(x => x.classList.remove('crm-dim')); base(); };
    b.addEventListener('pointerenter', on);
    b.addEventListener('pointerdown', on);
    b.addEventListener('focus', on);
    b.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') off(); });
    b.addEventListener('blur', off);
    return b;
  }));
  const mid = days[Math.floor((n - 1) / 2)];
  return el('figure', { class: 'crm-chart' }, [
    el('figcaption', { class: 'crm-k' }, [el('span', { text: 'Заявки по дням' })]),
    read,
    el('div', { class: 'crm-plot' }, [
      el('span', { class: 'crm-y crm-yt', text: String(nice) }),
      el('span', { class: 'crm-y crm-ym', text: nice % 2 ? '' : String(nice / 2) }),
      svg,
      hit,
    ]),
    el('div', { class: 'crm-x', 'aria-hidden': 'true' }, [el('span', { text: crmShortDate(days[0].date) }), el('span', { text: crmShortDate(mid.date) }), el('span', { text: 'сегодня' })]),
  ]);
}

function crmDrawStats() {
  const { s, from, to } = crm.stats;
  const body = $('#crm-st-body');
  body.classList.remove('crm-loading');
  const map = {};
  (s.by_day || []).forEach(d => { map[d.date] = d.count; });
  const days = [];
  for (let k = crmDayDiff(from, to); k >= 0; k--) { const d = crmAddDays(to, -k); days.push({ date: d, count: map[d] || 0 }); }
  const by = s.by_status || {};
  const total = s.total || 0;
  const done = by.done || 0;
  const repeat = s.repeat_orders || 0;
  const fresh = Math.max(0, total - repeat);
  const tile = (n, t, cls) => el('div', { class: `crm-tile${cls ? ` crm-${cls}` : ''}` }, [el('b', { text: String(n) }), el('span', { text: t })]);
  if (!total) {
    body.replaceChildren(crmEmpty('За этот период заявок нет', 'Выберите период побольше или загляните позже.'));
    return;
  }
  const svc = (s.by_service || []).slice(0, 6).map(r => ({ label: r.title || 'Без услуги', count: r.count }));
  const src = (s.by_source || []).map(r => ({ label: crmSource(r.source) || 'Не указан', count: r.count })).sort((a, b) => b.count - a.count).slice(0, 6);
  const share = total ? Math.round((repeat / total) * 100) : 0;
  body.replaceChildren(
    el('div', { class: 'crm-tiles' }, [
      tile(total, `${crmPlural(total, 'заявка', 'заявки', 'заявок')} за ${crm.period} дней`, 'main'),
      tile(done, 'выполнено'),
      tile(s.new_customers || 0, crmPlural(s.new_customers || 0, 'новый клиент', 'новых клиента', 'новых клиентов')),
      tile(repeat, crmPlural(repeat, 'повторная заявка', 'повторные заявки', 'повторных заявок')),
    ]),
    crmDayChart(days, total),
    el('div', { class: 'crm-st-g' }, [
      el('section', { class: 'crm-st-c' }, [el('h2', { class: 'crm-k', text: 'Что чаще просят' }), svc.length ? crmBars(svc, 'Услуги') : el('p', { class: 'crm-hint', text: 'Пока нет данных.' })]),
      el('section', { class: 'crm-st-c' }, [el('h2', { class: 'crm-k', text: 'Откуда пришли' }), src.length ? crmBars(src, 'Источники') : el('p', { class: 'crm-hint', text: 'Пока нет данных.' })]),
      el('section', { class: 'crm-st-c' }, [
        el('h2', { class: 'crm-k', text: 'Новые и постоянные' }),
        el('div', { class: 'crm-split', role: 'img', 'aria-label': `Новые ${fresh}, повторные ${repeat}` }, [
          el('i', { class: 'crm-sa', style: `flex:${fresh || 0.0001}` }),
          el('i', { class: 'crm-sb', style: `flex:${repeat || 0.0001}` }),
        ]),
        el('ul', { class: 'crm-lg' }, [
          el('li', {}, [el('i', { class: 'crm-sa' }), el('span', { text: 'Первая заявка' }), el('b', { text: String(fresh) })]),
          el('li', {}, [el('i', { class: 'crm-sb' }), el('span', { text: 'Повторная' }), el('b', { text: String(repeat) })]),
        ]),
        el('p', { class: 'crm-hint', text: repeat ? `Каждая ${share >= 50 ? 'вторая' : share >= 30 ? 'третья' : share >= 20 ? 'пятая' : 'десятая'} заявка от того, кто уже был у вас (${share}%).` : 'Повторных заявок за этот период нет.' }),
      ]),
    ]),
  );
}

async function crmLoadTg() {
  const box = $('#crm-tg');
  if (!box) return;
  let t;
  try { t = await auth('GET', '/api/owner/telegram'); } catch (err) { if (err.status === 401) { expired(); return; } box.replaceChildren(el('h2', { text: 'Уведомления в Telegram' }), el('p', { class: 'hint', text: err.message })); return; }
  crm.tg = t;
  crmDrawTg();
  if (t.enabled) crmTgLink();
}

async function crmTgLink() {
  try { crm.tgLink = await auth('POST', '/api/owner/telegram/link'); } catch (err) { crm.tgLink = null; }
  const a = $('#crm-tg-go');
  if (a && crm.tgLink && crm.tgLink.url) a.href = crm.tgLink.url;
}

function crmTgWatch() {
  clearInterval(crm.tgPoll);
  const before = ((crm.tg && crm.tg.chats) || []).length;
  let n = 0;
  crm.tgPoll = setInterval(async () => {
    n += 1;
    if (n > 40 || !owner) { clearInterval(crm.tgPoll); return; }
    try {
      const t = await auth('GET', '/api/owner/telegram');
      if ((t.chats || []).length > before) { clearInterval(crm.tgPoll); crm.tg = t; crmDrawTg(); toast('Telegram подключён'); crmTgLink(); }
    } catch (e) { clearInterval(crm.tgPoll); }
  }, 3000);
}

function crmDrawTg() {
  const box = $('#crm-tg');
  const t = crm.tg || {};
  const h = el('h2', { text: 'Уведомления в Telegram' });
  if (!t.enabled) {
    box.replaceChildren(h, el('p', { class: 'hint', text: 'Бот ещё не подключён администратором. Как только его включат, здесь появится кнопка «Подключить Telegram», и новые заявки будут приходить вам в телефон.' }));
    return;
  }
  const chats = t.chats || [];
  const go = el('a', { class: 'btn send crm-tg-go', id: 'crm-tg-go', href: (crm.tgLink && crm.tgLink.url) || `https://t.me/${t.bot_username || ''}`, target: '_blank', rel: 'noopener' }, [el('span', { text: chats.length ? 'Подключить ещё чат' : 'Подключить Telegram' })]);
  go.addEventListener('click', async e => {
    const exp = crm.tgLink && crm.tgLink.expires_at && new Date(crm.tgLink.expires_at).getTime() < Date.now() + 15000;
    if (!crm.tgLink || exp) {
      e.preventDefault();
      await crmTgLink();
      if (crm.tgLink && crm.tgLink.url) location.href = crm.tgLink.url;
      else toast('Не получилось получить ссылку, попробуйте ещё раз');
    }
    crmTgWatch();
  });
  box.replaceChildren(
    h,
    el('p', { class: 'hint', text: 'Каждая новая заявка сразу придёт в Telegram: имя, телефон, машина и что случилось. Нажмите кнопку, в Telegram нажмите «Запустить» (Start).' }),
    chats.length ? el('ul', { class: 'crm-chats' }, chats.map(c => crmChatRow(c))) : null,
    go,
    t.bot_username ? el('p', { class: 'hint', text: `Бот: @${t.bot_username}. Можно подключить общий чат мастеров: добавьте бота в группу.` }) : null,
  );
}

function crmChatRow(c) {
  const rm = el('button', { type: 'button', class: 'btn ghost sm', text: 'Отключить' });
  const li = el('li', {}, [el('span', { class: 'crm-chat-t' }, [el('b', { text: c.title || 'Чат' }), el('span', { text: c.linked_at ? `подключён ${crmWhen(c.linked_at)}` : 'подключён' })]), rm]);
  rm.addEventListener('click', () => {
    const yes = el('button', { type: 'button', class: 'btn danger sm', text: 'Да, отключить' });
    const no = el('button', { type: 'button', class: 'btn ghost sm', text: 'Нет' });
    const g = el('span', { class: 'crm-confirm', role: 'group', 'aria-label': 'Подтвердите' }, [yes, no]);
    rm.replaceWith(g);
    no.focus();
    no.addEventListener('click', () => { g.replaceWith(rm); rm.focus(); });
    yes.addEventListener('click', async () => {
      yes.disabled = true;
      try {
        await auth('DELETE', `/api/owner/telegram/chats/${encodeURIComponent(c.id)}`);
        crm.tg.chats = (crm.tg.chats || []).filter(x => x.id !== c.id);
        crmDrawTg();
        toast('Чат отключён, заявки туда больше не придут');
      } catch (err) {
        crmFail(err);
        yes.disabled = false;
      }
    });
  });
  return li;
}

function crmMore() {
  const nav = $('[role=tablist]');
  if (!nav || $('#crm-more')) return;
  const extra = $$('[role=tab][data-more]', nav);
  if (!extra.length) return;
  const sheet = el('div', { class: 'crm-sheet', id: 'crm-sheet', hidden: true, role: 'menu', 'aria-label': 'Ещё разделы' }, extra.map(t => el('button', { type: 'button', role: 'menuitem', class: 'crm-sheet-i', 'data-for': t.id, onclick: () => { close(); t.click(); } }, [...[...t.childNodes].filter(n => n.nodeType === 1 && !n.classList.contains('badge')).map(n => n.cloneNode(true))])));
  const btn = el('button', { type: 'button', class: 'crm-more', id: 'crm-more', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': 'crm-sheet' }, [icon('dots'), el('span', { text: 'Ещё' })]);
  const scrim = el('div', { class: 'crm-scrim', hidden: true, onclick: () => close() });
  function close() { sheet.hidden = true; scrim.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', e => { const on = sheet.hidden; sheet.hidden = !on; scrim.hidden = !on; btn.setAttribute('aria-expanded', String(on)); if (on && e.detail === 0) $('.crm-sheet-i', sheet).focus(); });
  sheet.addEventListener('keydown', e => { if (e.key === 'Escape') { close(); btn.focus(); } });
  nav.append(btn);
  document.body.append(scrim, sheet);
  const mark = () => { const on = extra.some(t => t.getAttribute('aria-selected') === 'true'); btn.classList.toggle('on', on); $$('.crm-sheet-i', sheet).forEach(i => i.setAttribute('aria-current', String($(`#${i.dataset.for}`).getAttribute('aria-selected') === 'true'))); };
  $$('[role=tab]', nav).forEach(t => t.addEventListener('click', mark));
  mark();
}

function crmTabs() {
  const on = (id, fn) => { const t = $(`#${id}`); if (t) t.addEventListener('click', fn); };
  on('tab-clients', () => { crmClientsUi(); crmLoadClients(); });
  on('tab-prices', () => crmLoadServices());
  on('tab-stats', () => crmLoadStats());
  on('tab-sec', () => crmLoadTg());
  crmMore();
}

function crmEnter() {
  const sel = $('[role=tab][aria-selected=true]');
  if (sel && sel.id !== 'tab-orders') sel.click();
}

function crmStop() {
  clearInterval(crm.tgPoll);
  crm.clients = null;
  crm.services = null;
  crm.due = [];
  crmDrawDue();
}

crmTabs();
