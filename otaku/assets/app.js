(() => {
  const D = window.OTAKU;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const NB = ' ';
  const KEY = 'otaku-cart-v1';
  const FORM_KEY = 'otaku-form-v1';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byId = Object.fromEntries(D.items.map(i => [i.id, i]));
  const catName = Object.fromEntries(D.cats.map(c => [c.id, c.t]));
  const branch = Object.fromEntries(D.branches.map(b => [b.id, b]));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const som = n => `${fmt(n)}${NB}сом`;
  const PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const MINUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/></svg>';
  const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true" class="arr"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const MAX = 99;

  document.documentElement.classList.add('js');

  const store = {
    get(k, fallback) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { }
    }
  };

  let cart = clean(store.get(KEY, {}));
  function clean(c) {
    const out = {};
    if (c && typeof c === 'object') for (const [id, q] of Object.entries(c)) {
      const n = Math.min(MAX, Math.floor(Number(q)));
      if (byId[id] && n > 0) out[id] = n;
    }
    return out;
  }
  const count = () => Object.values(cart).reduce((a, b) => a + b, 0);
  const listeners = [];
  function setQty(id, q) {
    q = Math.max(0, Math.min(MAX, q));
    if (q) cart[id] = q; else delete cart[id];
    store.set(KEY, cart);
    listeners.forEach(f => f(id));
  }
  window.addEventListener('storage', e => {
    if (e.key === KEY) { cart = clean(store.get(KEY, {})); listeners.forEach(f => f(null)); }
  });

  function syncCount(bump) {
    const n = count();
    $$('[data-count]').forEach(el => {
      el.textContent = n;
      el.classList.toggle('zero', n === 0);
      if (bump && !reduce) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
    });
  }

  function stepper(id, lg) {
    const it = byId[id];
    return `<span class="step${lg ? ' lg' : ''}" role="group" aria-label="Количество: ${esc(it.t)}"><button type="button" data-dec="${id}" aria-label="Убрать одну штуку">${MINUS}</button><output aria-live="polite">${cart[id]}</output><button type="button" data-inc="${id}" aria-label="Добавить ещё одну">${PLUS}</button></span>`;
  }
  function renderBuy(el, animate) {
    const id = el.dataset.buy;
    const it = byId[id];
    if (cart[id]) {
      const had = el.querySelector('.step');
      el.innerHTML = stepper(id);
      if (!had && animate) el.firstChild.classList.add('step-in');
    } else {
      el.innerHTML = `<button class="add" type="button" data-add="${id}" aria-label="Добавить «${esc(it.t)}» в корзину">${PLUS}</button>`;
    }
  }
  function renderBuys(id, animate) {
    $$('[data-buy]').forEach(el => { if (!id || el.dataset.buy === id) renderBuy(el, animate); });
  }

  function cartTarget() {
    const m = $('[data-cart-target-m]');
    const d = $('[data-cart-target]');
    const visible = el => el && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
    if (visible(d)) return d.querySelector('.cp-n') || d;
    if (visible(m)) return m.querySelector('svg') || m;
    return null;
  }
  function fly(a, cat) {
    const to = cartTarget();
    if (reduce || !to || !a || !document.body.animate) return Promise.resolve();
    const b = to.getBoundingClientRect();
    const el = document.createElement('i');
    el.className = 'fly';
    el.style.setProperty('--cc', `var(--c-${cat})`);
    document.body.appendChild(el);
    const x0 = a.left + a.width / 2 - 9, y0 = a.top + a.height / 2 - 13;
    const x1 = b.left + b.width / 2 - 9, y1 = b.top + b.height / 2 - 13;
    const lift = Math.min(140, Math.abs(y1 - y0) * .35 + 60);
    const midY = Math.min(y0, y1) - lift;
    const anim = el.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.9) rotate(0deg)`, opacity: 0 },
      { transform: `translate(${x0}px, ${y0 - 18}px) scale(1.15) rotate(-12deg)`, opacity: 1, offset: .14 },
      { transform: `translate(${(x0 + x1) / 2}px, ${midY}px) scale(1) rotate(90deg)`, opacity: 1, offset: .55 },
      { transform: `translate(${x1}px, ${y1}px) scale(.6) rotate(180deg)`, opacity: .9 }
    ], { duration: 620, easing: 'cubic-bezier(0.77, 0, 0.175, 1)' });
    return anim.finished.then(() => el.remove(), () => el.remove());
  }

  let toastTimer;
  function toast(text, undo) {
    let t = $('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      t.setAttribute('role', 'status');
      t.innerHTML = '<span></span><a href="cart.html">Корзина</a><button type="button" class="undo">Вернуть</button>';
      document.body.appendChild(t);
    }
    $('span', t).textContent = text;
    const a = $('a', t), u = $('.undo', t);
    a.hidden = !!undo || document.body.dataset.page === 'cart';
    u.hidden = !undo;
    u.onclick = undo ? () => { undo(); t.classList.remove('on'); } : null;
    requestAnimationFrame(() => t.classList.add('on'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('on'), undo ? 5000 : 2600);
  }

  function add(id, from, qty = 1) {
    const it = byId[id];
    const first = !cart[id];
    const rect = from ? from.getBoundingClientRect() : null;
    setQty(id, (cart[id] || 0) + qty);
    renderBuys(id, true);
    fly(rect, it.c).then(() => syncCount(true));
    if (reduce) syncCount(false);
    toast(first ? `В корзине: ${it.t}` : `${it.t}: ${cart[id]} шт.`);
  }

  document.addEventListener('click', e => {
    const a = e.target.closest('[data-add]');
    if (a) { e.preventDefault(); add(a.dataset.add, a); return; }
    const inc = e.target.closest('[data-inc]');
    if (inc) { e.preventDefault(); const id = inc.dataset.inc; setQty(id, (cart[id] || 0) + 1); renderBuys(id); syncCount(false); return; }
    const dec = e.target.closest('[data-dec]');
    if (dec) {
      e.preventDefault();
      const id = dec.dataset.dec;
      setQty(id, (cart[id] || 0) - 1);
      renderBuys(id);
      syncCount(false);
      if (!cart[id]) { const b = $(`[data-buy="${id}"] .add`); if (b) b.focus(); }
    }
  });

  function shell() {
    const top = $('.top');
    const onScroll = () => top && top.classList.toggle('scrolled', scrollY > 4);
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    syncCount(false);
    renderBuys();
    live();
    if (!reduce && window.Lenis) {
      const lenis = new Lenis({ duration: 1.05, easing: t => 1 - Math.pow(1 - t, 4), smoothWheel: true });
      const raf = time => { lenis.raf(time); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
      window.__lenis = lenis;
    }
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => {
      es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 }) : null;
    $$('[data-reveal]').forEach(el => io ? io.observe(el) : el.classList.add('in'));
  }

  function bishkekHour() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bishkek', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
      const h = +parts.find(p => p.type === 'hour').value;
      const m = +parts.find(p => p.type === 'minute').value;
      return h + m / 60;
    } catch (e) { return null; }
  }
  function live() {
    const h = bishkekHour();
    if (h === null) return;
    const open = h >= 10 && h < 22;
    $$('[data-live]').forEach(el => {
      el.textContent = open ? `Открыто${NB}·${NB}` : `Закрыто${NB}·${NB}`;
      el.classList.toggle('open', open);
    });
  }

  function home() {
    const btn = $('#moreqbtn');
    if (btn) btn.addEventListener('click', () => {
      const box = $('#moreq');
      const show = box.hidden;
      box.hidden = !show;
      btn.setAttribute('aria-expanded', String(show));
      btn.textContent = show ? 'Свернуть отзывы' : 'Ещё отзывы';
    });
  }

  function catalog() {
    const grid = $('#grid');
    const cards = $$('.card', grid);
    const set = (f, push) => {
      if (f !== 'all' && !catName[f]) f = 'all';
      $$('.seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === f)));
      cards.forEach(c => c.classList.toggle('out', f !== 'all' && c.dataset.c !== f));
      if (push) history.replaceState(null, '', f === 'all' ? location.pathname : `#${f}`);
      const on = $(`.seg button[data-f="${f}"]`);
      if (on && on.scrollIntoView && push) on.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      if (push && !reduce && grid.animate) grid.animate([{ opacity: .3, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
    };
    $('.seg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      set(b.dataset.f, true);
      const head = $('.filters-wrap');
      const y = grid.getBoundingClientRect().top + scrollY - head.offsetHeight - ($('.top') ? $('.top').offsetHeight : 0) - 8;
      if (scrollY > y) window.__lenis ? window.__lenis.scrollTo(y, { immediate: reduce }) : scrollTo(0, y);
    });
    set(location.hash.slice(1) || 'all', false);
    addEventListener('hashchange', () => set(location.hash.slice(1) || 'all', false));
  }

  function item() {
    const id = new URLSearchParams(location.search).get('item') || new URLSearchParams(location.search).get('id');
    const it = byId[id];
    if (!it) { location.replace('catalog.html'); return; }
    document.title = `${it.t}, Отаку`;
    const box = $('#item');
    const pickup = D.branches.map(b => b.name).join(', ');
    box.innerHTML = `<figure class="big"><img src="img/${it.id}.webp" alt="${esc(it.t)}" width="720" height="720"></figure>
<div class="about"><a class="crumb" href="catalog.html#${it.c}"><i class="cap" data-c="${it.c}" aria-hidden="true"></i>${esc(catName[it.c])}</a>
<h1>${esc(it.t)}</h1>
${it.p ? `<p class="cost">${som(it.p)}</p><p class="cost-note">Цена с ценника в магазине</p>` : `<p class="cost ask">Цена по запросу</p><p class="cost-note">Менеджер назовёт цену в WhatsApp, когда получит заказ.</p>`}
<div class="buyrow" id="buyrow"></div>
<p class="incart" id="incart" hidden><a class="more" href="cart.html">Перейти в корзину${ARROW}</a></p>
<dl class="rows"><div><dt>Самовывоз</dt><dd>${esc(pickup)}</dd></div><div><dt>Доставка</dt><dd>По Бишкеку, стоимость подтвердит менеджер</dd></div><div><dt>Часы</dt><dd>Ежедневно 10:00–22:00</dd></div></dl></div>`;
    let want = 1;
    const row = $('#buyrow');
    const draw = () => {
      const q = cart[id] || 0;
      if (q) {
        row.innerHTML = `${stepper(id, true)}<a class="btn" href="cart.html">Оформить заказ${ARROW}</a>`;
      } else {
        row.innerHTML = `<span class="step lg" role="group" aria-label="Количество"><button type="button" data-want="-1" aria-label="Меньше">${MINUS}</button><output aria-live="polite">${want}</output><button type="button" data-want="1" aria-label="Больше">${PLUS}</button></span><button class="btn" type="button" id="addbtn">${PLUS}В корзину</button>`;
      }
      $('#incart').hidden = !q;
    };
    row.addEventListener('click', e => {
      const w = e.target.closest('[data-want]');
      if (w) { want = Math.max(1, Math.min(MAX, want + Number(w.dataset.want))); $('output', row).textContent = want; return; }
      const b = e.target.closest('#addbtn');
      if (b) { add(id, b, want); want = 1; draw(); }
    });
    listeners.push(changed => { if (!changed || changed === id) draw(); });
    draw();
    const pool = D.items.filter(i => i.c === it.c && i.id !== it.id);
    const start = D.items.indexOf(it) % pool.length;
    const next = [0, 1, 2, 3].map(n => pool[(start + n) % pool.length]);
    $('#more-h').textContent = catName[it.c];
    $('#more').innerHTML = next.map(i => `<article class="card" data-c="${i.c}"><div class="media"><a class="ph" href="item.html?id=${i.id}" tabindex="-1" aria-hidden="true"><img src="img/${i.id}-s.webp" alt="" width="360" height="360" loading="lazy" decoding="async"></a><span class="buy" data-buy="${i.id}"></span></div><a class="card-a" href="item.html?id=${i.id}"><span class="nm">${esc(i.t)}</span>${i.p ? `<span class="pr">${som(i.p)}</span>` : ''}</a></article>`).join('');
    renderBuys();
  }

  function message(f) {
    const ids = Object.keys(cart);
    const out = ['Здравствуйте! Заказ с сайта Отаку:', ''];
    let total = 0, ask = 0;
    ids.forEach((id, n) => {
      const it = byId[id], q = cart[id];
      if (it.p) { total += it.p * q; out.push(`${n + 1}. ${it.t} — ${q} × ${fmt(it.p)} = ${fmt(it.p * q)} сом`); }
      else { ask += q; out.push(`${n + 1}. ${it.t} — ${q} шт., цена по запросу`); }
      out.push(`${D.base}/item.html?id=${id}`);
    });
    out.push('');
    if (total) out.push(`Итого: ${fmt(total)} сом` + (ask ? ` + ${ask} шт. по запросу` : ''));
    else out.push(`Цены всех товаров (${ask} шт.) уточните, пожалуйста`);
    out.push('');
    if (f.how === 'delivery') out.push(`Доставка: ${f.addr || '…'}`);
    else { const b = branch[f.branch] || D.branches[0]; out.push(`Самовывоз: ${b.name}, ${b.addr}, ${b.spot}`); }
    out.push(`Имя: ${f.name || '…'}`);
    if (f.note) out.push(`Комментарий: ${f.note}`);
    return out.join('\n').replace(/\u00a0/g, ' ').replace(/\u2011/g, '-');
  }

  function cartPage() {
    const form = $('#checkout');
    const empty = $('#cart-empty');
    const saved = store.get(FORM_KEY, {});
    const f = { how: saved.how === 'delivery' ? 'delivery' : 'pickup', branch: branch[saved.branch] ? saved.branch : D.branches[0].id, addr: saved.addr || '', name: saved.name || '', note: saved.note || '' };
    const how = () => $('input[name="how"]:checked', form).value;
    $(`input[name="how"][value="${f.how}"]`, form).checked = true;
    $(`input[name="branch"][value="${f.branch}"]`, form).checked = true;
    $('#addr').value = f.addr; $('#name').value = f.name; $('#note').value = f.note;

    const read = () => {
      f.how = how();
      f.branch = ($('input[name="branch"]:checked', form) || {}).value || D.branches[0].id;
      f.addr = $('#addr').value.trim();
      f.name = $('#name').value.trim();
      f.note = $('#note').value.trim();
      store.set(FORM_KEY, f);
    };
    const toggleHow = () => {
      $('#pickup-box').hidden = how() !== 'pickup';
      $('#delivery-box').hidden = how() !== 'delivery';
    };
    const lines = () => {
      const ids = Object.keys(cart);
      $('#lines').innerHTML = ids.map(id => {
        const it = byId[id], q = cart[id];
        return `<li class="line" data-line="${id}"><img src="img/${id}-s.webp" alt="" width="72" height="72" loading="lazy">
<div class="line-t"><div><a href="item.html?id=${id}">${esc(it.t)}</a><p class="line-u">${it.p ? `${som(it.p)} за шт.` : 'Цена по запросу'}</p></div><button type="button" class="rm" data-rm="${id}" aria-label="Убрать «${esc(it.t)}» из корзины">${CROSS}</button></div>
<div class="line-b"><span class="buy" data-buy="${id}"></span><span class="line-s${it.p ? '' : ' ask'}">${it.p ? som(it.p * q) : 'уточнит менеджер'}</span></div></li>`;
      }).join('');
      renderBuys();
    };
    const sum = () => {
      const ids = Object.keys(cart);
      const total = ids.reduce((s, id) => s + (byId[id].p || 0) * cart[id], 0);
      const ask = ids.reduce((s, id) => s + (byId[id].p ? 0 : cart[id]), 0);
      const n = count();
      const priced = n - ask;
      $('#sum').innerHTML = total
        ? `<span>Итого за ${priced} шт. с ценой</span><b>${som(total)}</b>${ask ? `<p>Ещё ${ask} шт. с ценой по запросу: менеджер назовёт сумму в WhatsApp.</p>` : ''}`
        : `<span>Цена по запросу</span><b>${n} шт.</b><p>У этих товаров нет цены на ценнике, менеджер назовёт сумму в WhatsApp.</p>`;
    };
    const preview = () => { read(); $('#msg').innerHTML = message(f).split('\n').map(l => l.startsWith('http') ? `<span class="u">${esc(l)}</span>` : esc(l)).join('\n'); };
    const all = () => {
      const has = count() > 0;
      empty.hidden = has;
      form.hidden = !has;
      $('#cart-sub').hidden = !has;
      if (!has) return;
      sum();
      preview();
    };
    lines();
    toggleHow();
    all();

    listeners.push(id => {
      if (id && !cart[id]) { const li = $(`[data-line="${id}"]`); if (li) li.remove(); }
      else if (!id) lines();
      else {
        const li = $(`[data-line="${id}"] .line-s`);
        const it = byId[id];
        if (li && it.p) li.textContent = som(it.p * cart[id]);
      }
      all();
    });
    form.addEventListener('click', e => {
      const rm = e.target.closest('[data-rm]');
      if (!rm) return;
      const id = rm.dataset.rm;
      const li = rm.closest('.line');
      const q = cart[id];
      const go = () => {
        setQty(id, 0); syncCount(false);
        toast(`Убрано: ${byId[id].t}`, () => { setQty(id, q); syncCount(false); lines(); all(); });
      };
      if (reduce) go(); else { li.classList.add('gone'); setTimeout(go, 200); }
    });
    form.addEventListener('input', () => { toggleHow(); preview(); clearErr(); });
    form.addEventListener('change', () => { toggleHow(); preview(); });
    const setErr = (k, t) => { const p = $(`[data-e="${k}"]`, form); if (p) p.textContent = t; };
    const clearErr = () => {
      if ($('#name').value.trim()) { setErr('name', ''); $('#name').removeAttribute('aria-invalid'); }
      if ($('#addr').value.trim() || how() !== 'delivery') { setErr('addr', ''); $('#addr').removeAttribute('aria-invalid'); }
    };
    form.addEventListener('submit', e => {
      e.preventDefault();
      read();
      let bad = null;
      if (f.how === 'delivery' && !f.addr) { setErr('addr', 'Укажите адрес доставки: улицу и дом.'); $('#addr').setAttribute('aria-invalid', 'true'); bad = bad || $('#addr'); }
      if (!f.name) { setErr('name', 'Напишите имя, чтобы менеджер знал, как к вам обращаться.'); $('#name').setAttribute('aria-invalid', 'true'); bad = bad || $('#name'); }
      if (bad) { bad.focus({ preventScroll: false }); return; }
      const url = `https://wa.me/${D.wa}?text=${encodeURIComponent(message(f))}`;
      const w = window.open(url, '_blank', 'noopener');
      if (!w) location.href = url;
    });
  }

  function branchesPage() {
    const frame = $('#mapframe');
    const show = (id, scroll) => {
      const b = branch[id];
      if (!b) return;
      if (frame.dataset.cur !== id) { frame.src = b.map; frame.title = `Отаку, ${b.name}, на карте`; frame.dataset.cur = id; }
      $$('.map-tabs button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.map === id)));
      if (scroll) {
        const y = $('#map').getBoundingClientRect().top + scrollY - ($('.top') ? $('.top').offsetHeight : 0) - 16;
        window.__lenis ? window.__lenis.scrollTo(y) : scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
      }
    };
    frame.dataset.cur = D.branches[0].id;
    document.addEventListener('click', e => {
      const b = e.target.closest('[data-map]');
      if (b) show(b.dataset.map, !b.closest('.map-tabs'));
    });
    const h = location.hash.slice(1);
    if (branch[h]) show(h, false);
  }

  shell();
  const page = document.body.dataset.page;
  if (page === 'index') home();
  if (page === 'catalog') catalog();
  if (page === 'item') item();
  if (page === 'cart') cartPage();
  if (page === 'branches') branchesPage();
})();
