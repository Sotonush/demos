const root = document.getElementById('xr');
const dataEl = document.getElementById('car-data');

if (root && dataEl) init();

function init() {
  const data = JSON.parse(dataEl.textContent);
  const parts = data.parts;
  const byKey = Object.fromEntries(parts.map(p => [p.k, p]));
  const card = document.getElementById('xr-card');
  const body = card.querySelector('.xr-body');
  const pins = [...root.querySelectorAll('.pin')];
  const chips = [...document.querySelectorAll('.cchip[data-k]')];
  const strip = chips.length ? chips[0].parentElement : null;
  const params = new URLSearchParams(location.search);
  const staticShot = params.has('xrstatic');
  const reduce = false;
  const narrow = matchMedia('(max-width: 820px)');
  let selected = '';
  let engine = null;

  const setCard = k => {
    const src = k && document.querySelector(`.xr-src [data-card="${k}"]`);
    if (!src) { card.hidden = true; return; }
    body.replaceChildren(...[...src.childNodes].map(n => n.cloneNode(true)));
    card.hidden = false;
    if (!reduce && card.animate) card.animate([{ opacity: 0, transform: 'translateY(12px) scale(.98)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' });
  };

  const centerChip = k => {
    const c = chips.find(b => b.dataset.k === k);
    if (!c || !strip || strip.scrollWidth <= strip.clientWidth) return;
    strip.scrollTo({ left: c.offsetLeft - (strip.clientWidth - c.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  };

  const select = (k, from) => {
    selected = selected === k ? '' : k;
    pins.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === selected)));
    chips.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === selected)));
    root.classList.toggle('picked', Boolean(selected));
    setCard(selected);
    if (engine) engine.focus(selected);
    if (!selected) return;
    centerChip(selected);
    if (from === 'hover') return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'car_part', page: document.body.dataset.page, label: byKey[selected].t, via: from || '' });
    if (narrow.matches && from) {
      requestAnimationFrame(() => {
        const r = card.getBoundingClientRect();
        const top = root.getBoundingClientRect().top - 72;
        const room = innerHeight - 104;
        const dy = r.bottom > room ? Math.min(r.bottom - room, top) : top < 0 ? Math.max(top, r.bottom - room) : 0;
        if (Math.abs(dy) > 4) window.scrollBy({ top: dy, behavior: reduce ? 'auto' : 'smooth' });
      });
    }
  };

  pins.forEach(b => b.addEventListener('click', () => { if (b.dataset.hov && selected === b.dataset.k) return; select(b.dataset.k, 'pin'); }));
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    pins.forEach(b => b.addEventListener('mouseenter', () => {
      if (selected === b.dataset.k) return;
      b.dataset.hov = '1';
      setTimeout(() => { delete b.dataset.hov; }, 400);
      select(b.dataset.k, 'hover');
    }));
  }
  chips.forEach(b => b.addEventListener('click', () => select(b.dataset.k, 'chip')));
  card.querySelector('.xr-x').addEventListener('click', () => select(selected));
  root.addEventListener('keydown', e => { if (e.key === 'Escape' && selected) select(selected); });

  const canGL = (() => {
    try {
      const c = document.createElement('canvas');
      return Boolean(window.WebGL2RenderingContext && c.getContext('webgl2'));
    } catch (e) {
      return false;
    }
  })();

  if (!canGL || reduce || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    io.disconnect();
    boot(data, root, pins, () => selected, staticShot)
      .then(e => { engine = e; if (selected) engine.focus(selected); })
      .catch(() => root.classList.remove('live'));
  }, { rootMargin: '300px 0px' });
  io.observe(root);
}

async function boot(data, root, pins, getSelected, staticShot) {
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const stage = root.querySelector('.xr-gl');
  const canvas = document.createElement('canvas');
  canvas.className = 'xr-c';
  canvas.setAttribute('aria-hidden', 'true');
  const small = matchMedia('(max-width: 820px)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: staticShot || !small || devicePixelRatio < 2, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: staticShot });
  renderer.setPixelRatio(staticShot ? 2 : Math.min(devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  const car = new THREE.Group();
  scene.add(car);
  const HOT = new THREE.Color(0xfdc703);

  const fresnel = (color, rim, alpha, power, base) => new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uRim: { value: new THREE.Color(rim) },
      uHotC: { value: HOT },
      uAlpha: { value: alpha },
      uBase: { value: base },
      uPow: { value: power },
      uHot: { value: 0 },
      uTime: { value: 0 },
    },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = (modelMatrix * vec4(position,1.0)).y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform vec3 uRim; uniform vec3 uHotC; uniform float uAlpha; uniform float uBase; uniform float uPow; uniform float uHot; uniform float uTime;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
        float scan = 0.5 + 0.5 * sin(vY * 9.0 - uTime * 1.6);
        vec3 c = mix(mix(uColor, uRim, f), uHotC, uHot);
        float a = (uBase + f * uAlpha) * (0.86 + 0.14 * scan) + uHot * (0.3 + 0.14 * sin(uTime * 5.0));
        gl_FragColor = vec4(c * a, a); }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });

  const flow = () => new THREE.ShaderMaterial({
    uniforms: { uHot: { value: 0 }, uTime: { value: 0 }, uC: { value: new THREE.Color(0x7fb0ff) }, uHotC: { value: HOT } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uHot; uniform float uTime; uniform vec3 uC; uniform vec3 uHotC; varying vec2 vU;
      void main(){ float p = smoothstep(0.82, 1.0, fract(vU.x * 7.0 - uTime * (0.35 + uHot * 0.9)));
        vec3 c = mix(uC, uHotC, uHot);
        float a = 0.1 + p * (0.25 + uHot * 0.75) + uHot * 0.18;
        gl_FragColor = vec4(c * a, a); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });

  const bodyMat = fresnel(0x3068c7, 0xa9c8ff, 0.95, 2.2, 0.05);
  const glassMat = fresnel(0x3068c7, 0xd6e6ff, 0.5, 3.0, 0.02);
  const wheelMat = fresnel(0x3d74d8, 0xcfe0ff, 0.9, 1.6, 0.08);
  const lineMat = new THREE.LineBasicMaterial({ color: 0x8fb8ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });

  const gltf = await new GLTFLoader().loadAsync(data.model);
  const model = gltf.scene;
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.set(-center.x, -box.min.y, -center.z);
  const wheels = [];
  model.traverse(o => {
    const n = o.name.toLowerCase();
    if (n.includes('wheel') && !o.parent?.name.toLowerCase().includes('wheel')) wheels.push({ o, x: o.position.x, front: o.position.z > 0 });
    if (!o.isMesh) return;
    if (n.includes('window')) o.material = glassMat;
    else if (n.includes('wheel') || o.parent && o.parent.name.toLowerCase().includes('wheel')) o.material = wheelMat;
    else o.material = bodyMat;
    if (n.includes('body')) o.add(new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 32), lineMat));
    o.renderOrder = 2;
  });
  car.add(model);

  const mats = {};
  const anim = {};
  const partMat = k => (mats[k] = mats[k] || (k === 'tesla' ? fresnel(0x3068c7, 0xbfd8ff, 0.5, 1.6, 0.035) : fresnel(0x4a80e0, 0xe4efff, 0.9, 1.3, 0.11)));
  const add = (k, geo, pos, rot, parent = car) => {
    const m = new THREE.Mesh(geo, partMat(k));
    m.position.set(...pos);
    if (rot) m.rotation.set(...rot);
    m.renderOrder = 3;
    parent.add(m);
    return m;
  };
  const grp = (pos, parent = car) => { const g = new THREE.Group(); g.position.set(...pos); parent.add(g); return g; };
  const X = [0, 0, Math.PI / 2];

  const motor = grp([-0.05, 0, 1.62]);
  add('motor', new THREE.BoxGeometry(0.66, 0.3, 0.42), [0, 0.6, 0], null, motor);
  add('motor', new THREE.BoxGeometry(0.6, 0.09, 0.34), [0, 0.8, -0.02], null, motor);
  add('motor', new THREE.BoxGeometry(0.2, 0.26, 0.36), [-0.42, 0.56, 0], null, motor);
  const pistons = [];
  for (let i = 0; i < 4; i++) pistons.push(add('motor', new THREE.CylinderGeometry(0.045, 0.045, 0.08, 16), [-0.21 + i * 0.14, 0.88, -0.02], null, motor));
  anim.motor = (t, h) => pistons.forEach((p, i) => { p.position.y = 0.88 + Math.sin(t * 9 + i * Math.PI / 2) * 0.035 * h; });

  const alt = add('batt', new THREE.CylinderGeometry(0.085, 0.085, 0.14, 24), [-0.3, 0.72, 1.92], X);
  const pulley = add('batt', new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), [-0.39, 0.72, 1.92], X);
  add('batt', new THREE.CylinderGeometry(0.055, 0.055, 0.22, 20), [0.2, 0.44, 1.38], X);
  add('batt', new THREE.CylinderGeometry(0.03, 0.03, 0.12, 12), [0.22, 0.52, 1.38], X);
  add('batt', new THREE.BoxGeometry(0.28, 0.19, 0.2), [0.56, 0.66, 1.44]);
  add('batt', new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10), [0.48, 0.77, 1.44]);
  add('batt', new THREE.CylinderGeometry(0.022, 0.022, 0.04, 10), [0.64, 0.77, 1.44]);
  anim.batt = (t, h, dt) => { alt.rotation.x += dt * h * 14; pulley.rotation.x = alt.rotation.x; };

  add('ac', new THREE.BoxGeometry(1.12, 0.3, 0.03), [0, 0.56, 2.12]);
  const fan = grp([-0.28, 0.56, 2.06]);
  for (let i = 0; i < 4; i++) add('ac', new THREE.BoxGeometry(0.03, 0.2, 0.012), [0, 0, 0], [0, 0, i * Math.PI / 4], fan);
  add('ac', new THREE.CylinderGeometry(0.07, 0.07, 0.16, 20), [-0.42, 0.46, 1.78], X);
  add('ac', new THREE.BoxGeometry(0.9, 0.18, 0.24), [0, 0.86, 1.0]);
  anim.ac = (t, h, dt) => { fan.rotation.z += dt * (0.6 + h * 12); };

  const beams = [];
  for (const s of [1, -1]) {
    add('light', new THREE.SphereGeometry(0.1, 20, 14).scale(1.7, 0.55, 0.7), [0.62 * s, 0.8, 2.16]);
    add('light', new THREE.SphereGeometry(0.08, 16, 12).scale(1.6, 0.5, 0.5), [0.66 * s, 0.93, -2.2]);
    const beam = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.6, 32, 1, true), new THREE.ShaderMaterial({
      uniforms: { uO: { value: 0 }, uC: { value: new THREE.Color(0xfff1b0) } },
      vertexShader: 'varying float vT; void main(){ vT = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform float uO; uniform vec3 uC; varying float vT; void main(){ float a = uO * pow(vT, 2.2) * 0.4; gl_FragColor = vec4(uC * a, a); }',
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    }));
    beam.rotation.x = -Math.PI / 2;
    beam.position.set(0.66 * s, 0.76, 2.98);
    car.add(beam);
    beams.push(beam);
  }
  anim.light = (t, h) => beams.forEach(b => { b.material.uniforms.uO.value = h; b.visible = h > 0.01; });

  const discs = [];
  const springs = [];
  for (const w of wheels) {
    const s = Math.sign(w.x);
    const z = w.o.position.z;
    discs.push(add('brake', new THREE.CylinderGeometry(0.2, 0.2, 0.024, 36), [s * 0.64, 0.35, z], X));
    add('brake', new THREE.BoxGeometry(0.07, 0.13, 0.1), [s * 0.6, 0.46, z - 0.13], [0.6, 0, 0]);
    add('susp', new THREE.CylinderGeometry(0.032, 0.032, 0.44, 12), [s * 0.58, 0.62, z]);
    const pts = [];
    for (let i = 0; i <= 120; i++) { const a = i / 120 * Math.PI * 12; pts.push(new THREE.Vector3(Math.cos(a) * 0.07, i / 120 * 0.3, Math.sin(a) * 0.07)); }
    const spring = add('susp', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.011, 6), [s * 0.58, 0.5, z]);
    springs.push(spring);
    add('susp', new THREE.BoxGeometry(0.42, 0.028, 0.09), [s * 0.4, 0.3, z]);
  }
  anim.brake = (t, h, dt) => discs.forEach(d => { d.rotation.x += dt * h * 6; });
  anim.susp = (t, h) => springs.forEach((s, i) => { s.scale.y = 1 - h * (0.12 + 0.12 * Math.sin(t * 6 + i)); });

  const rack = add('steer', new THREE.CylinderGeometry(0.035, 0.035, 1.0, 14), [0, 0.38, 1.22], X);
  for (const s of [1, -1]) add('steer', new THREE.CylinderGeometry(0.014, 0.014, 0.2, 8), [s * 0.6, 0.37, 1.3], X);
  const col = new THREE.Vector3(0.38, 0.46, 1.16).lerp(new THREE.Vector3(0.38, 0.98, 0.62), 0.5);
  add('steer', new THREE.CylinderGeometry(0.02, 0.02, 0.76, 10), [col.x, col.y, col.z], [-0.77, 0, 0]);
  const sw = grp([0.38, 1.0, 0.58]);
  sw.rotation.x = 0.77;
  add('steer', new THREE.TorusGeometry(0.17, 0.018, 10, 40), [0, 0, 0], null, sw);
  anim.steer = (t, h) => {
    const a = Math.sin(t * 1.8) * h;
    rack.position.x = a * 0.06;
    sw.rotation.z = a * 0.9;
    wheels.forEach(w => { if (w.front) w.o.rotation.y = a * 0.35; });
  };

  const bag = add('srs', new THREE.SphereGeometry(0.13, 20, 14).scale(1, 1, 0.4), [0, 0, -0.02], null, sw);
  const bag2 = add('srs', new THREE.SphereGeometry(0.16, 20, 14).scale(1.4, 0.5, 1), [-0.38, 1.04, 0.74], [0.5, 0, 0]);
  for (const s of [1, -1]) add('srs', new THREE.BoxGeometry(0.02, 0.07, 1.5), [s * 0.72, 1.3, -0.25]);
  anim.srs = (t, h) => { const k = 0.5 + h * 0.75; bag.scale.setScalar(k); bag2.scale.setScalar(k); };

  add('check', new THREE.BoxGeometry(0.42, 0.22, 0.02), [0, 1.08, 0.72], [-0.45, 0, 0]);
  add('check', new THREE.BoxGeometry(0.2, 0.05, 0.14), [-0.2, 0.62, 0.86]);
  add('check', new THREE.BoxGeometry(0.08, 0.04, 0.05), [0.3, 0.64, 0.62]);
  const harness = new THREE.CatmullRomCurve3([[0.56, 0.8, 1.44], [0.3, 0.86, 1.8], [-0.2, 0.8, 1.95], [-0.5, 0.74, 1.4], [-0.2, 0.66, 0.9], [0.3, 0.66, 0.62], [0.55, 0.5, -0.4], [0.62, 0.86, -2.0]].map(p => new THREE.Vector3(...p)));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(harness, 220, 0.013, 6), flow());
  wire.renderOrder = 3;
  car.add(wire);

  add('tesla', new THREE.BoxGeometry(1.28, 0.1, 2.3), [0, 0.3, -0.05]);
  const cells = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.28, 0.1, 2.3, 4, 1, 8)), new THREE.LineBasicMaterial({ color: 0xbfd8ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
  cells.position.set(0, 0.3, -0.05);
  car.add(cells);

  const dish = add('starlink', new THREE.BoxGeometry(0.52, 0.035, 0.32), [0, 1.48, -0.5]);
  anim.starlink = (t, h) => { dish.rotation.x = -h * (0.25 + 0.05 * Math.sin(t * 2)); dish.position.y = 1.48 + h * 0.05; };

  add('vyezd', new THREE.TorusGeometry(0.07, 0.02, 10, 24), [0, 0.42, -2.27]);
  const beacon = add('vyezd', new THREE.BoxGeometry(0.4, 0.06, 0.12), [0, 1.5, 0.15]);
  anim.vyezd = (t, h) => { beacon.scale.y = 1 + h * (Math.sin(t * 14) > 0 ? 1.4 : 0); };

  const bumper = add('otsenka', new THREE.BoxGeometry(1.7, 0.22, 0.1), [0, 0.45, 2.22]);
  const crackPts = [];
  let cx = -0.62, cy = 0.5;
  for (let i = 0; i < 9; i++) { const nx = cx + 0.06 + (i * 37 % 5) / 100; const ny = 0.5 + (i % 2 ? 0.07 : -0.06); crackPts.push(cx, cy, 2.29, nx, ny, 2.29); cx = nx; cy = ny; }
  const crackGeo = new THREE.BufferGeometry();
  crackGeo.setAttribute('position', new THREE.Float32BufferAttribute(crackPts, 3));
  const crack = new THREE.LineSegments(crackGeo, new THREE.LineBasicMaterial({ color: 0xfdc703, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
  car.add(crack);
  anim.otsenka = (t, h) => { crack.material.opacity = h; bumper.position.z = 2.22 - h * 0.05; };

  const keys = new Set(data.parts.map(p => p.k));
  car.children.forEach(c => {
    const m = c.material || (c.children[0] && c.children[0].material);
    const k = m && Object.keys(mats).find(x => mats[x] === m);
    if (k && !keys.has(k)) c.visible = false;
  });
  if (!keys.has('otsenka')) crack.visible = false;

  const glow = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.ShaderMaterial({
    uniforms: { uC: { value: new THREE.Color(0x3a74e0) } },
    vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 uC; varying vec2 vU; void main(){ float d = distance(vU, vec2(0.5)) * 2.0; float a = smoothstep(1.0, 0.0, d) * 0.42; gl_FragColor = vec4(uC * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  glow.rotation.x = -Math.PI / 2;
  glow.scale.set(0.8, 1.25, 1);
  glow.position.y = 0.005;
  scene.add(glow);
  const floor = new THREE.GridHelper(14, 28, 0x6a9cf0, 0x3866b8);
  floor.material.transparent = true;
  floor.material.opacity = 0.16;
  floor.material.depthWrite = false;
  scene.add(floor);
  if (staticShot) glow.visible = floor.visible = false;

  const parts = data.parts;
  const anchors = Object.fromEntries(parts.map(p => [p.k, new THREE.Vector3(...p.a)]));
  const views = Object.fromEntries(parts.map(p => [p.k, p.v]));
  const hlOf = Object.fromEntries(parts.map(p => [p.k, p.hl && p.hl.length ? p.hl : [p.k]]));
  const home = data.home;
  const st = { yaw: home[0], dist: home[1], h: home[2], tx: home[3], ty: home[4], tz: home[5], off: 0, out: 0, far: 1 };
  const goal = { ...st };
  let userYaw = 0;
  let autoYaw = 0;
  let lastT = performance.now();
  let visible = true;
  let running = false;
  let w = 0;
  let h = 0;
  let current = '';
  const tmp = new THREE.Vector3();
  const pinEls = Object.fromEntries(pins.map(b => [b.dataset.k, b]));

  const resize = () => {
    const r = stage.getBoundingClientRect();
    w = Math.max(1, Math.round(r.width));
    h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1.2 ? 38 : 28;
    camera.updateProjectionMatrix();
    goal.far = farFor(current);
    if (!running) st.far = goal.far;
    kick();
  };

  const farFor = k => (w / h < 1.2 ? (k ? 0.95 : 1.06) : 1);
  const wrapNear = (a, ref) => a + Math.round((ref - a) / (Math.PI * 2)) * Math.PI * 2;
  const focus = k => {
    current = k;
    const v = k ? views[k] : home;
    goal.yaw = wrapNear(v[0], st.yaw + userYaw + autoYaw);
    st.yaw += userYaw + autoYaw;
    userYaw = 0;
    autoYaw = 0;
    goal.dist = v[1]; goal.h = v[2]; goal.tx = v[3]; goal.ty = v[4]; goal.tz = v[5];
    goal.off = k && w / h > 1.2 ? 0.16 : 0;
    const hl = k ? hlOf[k] || [k] : [];
    goal.out = hl.includes('brake') || hl.includes('susp') ? 1 : 0;
    goal.far = farFor(k);
    Object.values(mats).forEach(m => { m.userData.on = false; });
    hl.forEach(key => { if (mats[key]) mats[key].userData.on = true; });
    wire.material.userData.on = hl.includes('check');
    bodyMat.userData.dim = Boolean(k);
    kick();
  };

  let drag = null;
  canvas.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId, on: false }; });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { drag = null; return; }
      if (Math.abs(dx) < 8) return;
      drag.on = true;
      canvas.setPointerCapture(e.pointerId);
      root.classList.add('dragging');
    }
    userYaw += dx * 0.009;
    drag.x = e.clientX;
    drag.y = e.clientY;
    kick();
  });
  const end = () => { drag = null; root.classList.remove('dragging'); };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  const scrollYaw = () => {
    const r = root.getBoundingClientRect();
    const p = (innerHeight - r.top) / (innerHeight + r.height);
    return (Math.min(1, Math.max(0, p)) - 0.5) * 1.1;
  };

  const allMats = () => [bodyMat, glassMat, wheelMat, wire.material, ...Object.values(mats)];
  const frame = t => {
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    const sel = getSelected();
    if (!staticShot && !sel && !drag) autoYaw += dt * 0.14;
    const k = 1 - Math.exp(-dt * 3.6);
    for (const key of ['yaw', 'dist', 'h', 'tx', 'ty', 'tz', 'off', 'out', 'far']) st[key] += (goal[key] - st[key]) * k;
    const far = st.far;
    camera.setViewOffset(w, h, st.off * w, 0, w, h);
    const yaw = st.yaw + userYaw + autoYaw + (sel || staticShot ? 0 : scrollYaw());
    car.rotation.y = yaw;
    tmp.set(st.tx, st.ty, st.tz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
    camera.position.set(tmp.x, st.h * far, tmp.z + st.dist * far);
    camera.lookAt(tmp.x, st.ty, tmp.z);
    const time = t / 1000;
    for (const m of allMats()) {
      m.uniforms.uTime.value = time;
      const target = m.userData.on ? 1 : 0;
      m.uniforms.uHot.value += (target - m.uniforms.uHot.value) * Math.min(1, k * 1.4);
    }
    bodyMat.uniforms.uAlpha.value += ((bodyMat.userData.dim ? 0.42 : 0.95) - bodyMat.uniforms.uAlpha.value) * k;
    wheelMat.uniforms.uAlpha.value += ((st.out > 0.5 || bodyMat.userData.dim ? 0.45 : 0.9) - wheelMat.uniforms.uAlpha.value) * k;
    wheels.forEach(wh => { wh.o.position.x = wh.x + Math.sign(wh.x) * 0.34 * st.out; });
    for (const [key, fn] of Object.entries(anim)) fn(time, mats[key] ? mats[key].uniforms.uHot.value : 0, dt);
    renderer.render(scene, camera);
    car.updateMatrixWorld();
    const cz = tmp.set(0, 0.7, 0).applyMatrix4(car.matrixWorld).project(camera).z;
    for (const p of parts) {
      const el = pinEls[p.k];
      if (!el) continue;
      tmp.copy(anchors[p.k]).applyMatrix4(car.matrixWorld).project(camera);
      const x = (tmp.x * 0.5 + 0.5) * w;
      const y = (-tmp.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.classList.toggle('far', tmp.z > cz + 0.002 && p.k !== sel);
    }
    if (running) requestAnimationFrame(frame);
  };
  const kick = () => {
    if (running || !visible || document.hidden || staticShot) return;
    running = true;
    lastT = performance.now();
    requestAnimationFrame(frame);
  };
  const stop = () => { running = false; };

  stage.prepend(canvas);
  new ResizeObserver(resize).observe(stage);
  resize();
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); else stop(); }).observe(root);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else kick(); });
  root.classList.add('live');
  if (staticShot) {
    document.documentElement.classList.add('xr-shot');
    requestAnimationFrame(t => {
      lastT = t;
      frame(t);
      const r = stage.getBoundingClientRect();
      window.__xr = Object.fromEntries(pins.map(b => {
        const m = /translate\(([\d.-]+)px, ([\d.-]+)px\)/.exec(b.style.transform);
        return [b.dataset.k, [+(+m[1] / r.width * 100).toFixed(2), +(+m[2] / r.height * 100).toFixed(2)]];
      }));
    });
  } else kick();
  return { focus };
}
