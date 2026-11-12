const root = document.getElementById('xr');
const dataEl = document.getElementById('car-data');

if (root && dataEl) {
  const data = JSON.parse(dataEl.textContent);
  const parts = data.parts;
  const byKey = Object.fromEntries(parts.map(p => [p.k, p]));
  const card = document.getElementById('xr-card');
  const pins = [...root.querySelectorAll('.pin')];
  const chips = [...document.querySelectorAll('.xr-b')];
  const params = new URLSearchParams(location.search);
  const staticShot = params.has('xrstatic');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches && !staticShot;
  let selected = '';
  let engine = null;

  const setCard = k => {
    const p = byKey[k];
    if (!p) { card.hidden = true; return; }
    card.querySelector('.xr-t').textContent = p.t;
    card.querySelector('.xr-d').textContent = p.d;
    const pr = card.querySelector('.xr-pr');
    pr.replaceChildren();
    if (p.p) {
      const ot = p.p.startsWith('от ');
      if (ot) pr.append(Object.assign(document.createElement('span'), { className: 'ot', textContent: 'от' }));
      pr.append(Object.assign(document.createElement('b'), { textContent: ot ? p.p.slice(3) : p.p }));
      pr.append(Object.assign(document.createElement('span'), { className: 'cur', textContent: 'сом' }));
    } else {
      pr.append(Object.assign(document.createElement('span'), { className: 'ask', textContent: 'цену назовёт мастер' }));
    }
    const go = card.querySelector('.xr-go');
    go.href = `book.html?s=${p.s}`;
    go.dataset.label = p.t;
    const more = card.querySelector('.xr-more');
    if (more && p.u) { more.href = p.u; more.dataset.label = p.t; }
    card.hidden = false;
  };

  const select = (k, from) => {
    selected = selected === k ? '' : k;
    pins.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === selected)));
    chips.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.k === selected)));
    root.classList.toggle('picked', Boolean(selected));
    setCard(selected);
    if (engine) engine.focus(selected);
    if (selected && window.dataLayer) window.dataLayer.push({ event: 'car_part', label: byKey[selected].t });
    if (selected && from === 'chip' && matchMedia('(max-width: 820px)').matches) {
      root.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }
  };

  pins.forEach(b => b.addEventListener('click', () => select(b.dataset.k, 'pin')));
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

  if (canGL && !reduce && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      if (!es.some(e => e.isIntersecting)) return;
      io.disconnect();
      boot().then(e => { engine = e; if (selected) engine.focus(selected); }).catch(() => root.classList.remove('live'));
    }, { rootMargin: '400px 0px' });
    io.observe(root);
  }

  async function boot() {
    const THREE = await import('three');
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const canvas = document.createElement('canvas');
    canvas.className = 'xr-c';
    canvas.setAttribute('aria-hidden', 'true');
    root.querySelector('.xr-gl').append(canvas);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: staticShot });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
    const car = new THREE.Group();
    scene.add(car);

    const fresnel = (color, rim, alpha, power, base) => new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(color) },
        uRim: { value: new THREE.Color(rim) },
        uAlpha: { value: alpha },
        uBase: { value: base },
        uPow: { value: power },
        uHot: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vY = (modelMatrix * vec4(position,1.0)).y; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform vec3 uColor; uniform vec3 uRim; uniform float uAlpha; uniform float uBase; uniform float uPow; uniform float uHot; uniform float uTime;
        varying vec3 vN; varying vec3 vV; varying float vY;
        void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPow);
          float scan = smoothstep(0.0, 0.06, abs(fract(vY * 3.0 - uTime * 0.35) - 0.5) - 0.44) * 0.0 + 0.5 + 0.5 * sin(vY * 9.0 - uTime * 1.6);
          vec3 hot = vec3(0.99, 0.78, 0.01);
          vec3 c = mix(mix(uColor, uRim, f), hot, uHot);
          float a = (uBase + f * uAlpha) * (0.86 + 0.14 * scan) + uHot * (0.28 + 0.12 * sin(uTime * 5.0));
          gl_FragColor = vec4(c * a, a); }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    const bodyMat = fresnel(0x2e68c6, 0xa9d1ff, 0.95, 2.2, 0.05);
    const glassMat = fresnel(0x2e68c6, 0xd6ecff, 0.5, 3.0, 0.02);
    const wheelMat = fresnel(0x3d7ae0, 0xcfe6ff, 0.9, 1.6, 0.08);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x8fc0ff, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });

    const gltf = await new GLTFLoader().loadAsync(data.model);
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    model.position.set(-center.x, -box.min.y, -center.z);
    model.traverse(o => {
      if (!o.isMesh) return;
      const n = o.name.toLowerCase();
      if (n.includes('window')) o.material = glassMat;
      else if (n.includes('wheel') || o.parent && o.parent.name.toLowerCase().includes('wheel')) o.material = wheelMat;
      else o.material = bodyMat;
      if (n.includes('body')) {
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 32), lineMat);
        o.add(edges);
      }
      o.renderOrder = 2;
    });
    car.add(model);

    const partMats = {};
    const partMat = k => (partMats[k] = partMats[k] || (k === 'tesla' ? fresnel(0x2e68c6, 0xbfe0ff, 0.5, 1.6, 0.035) : fresnel(0x4a86e8, 0xe4f1ff, 0.9, 1.3, 0.12)));
    const mesh = (k, geo, pos, rot) => {
      const m = new THREE.Mesh(geo, partMat(k));
      m.position.set(...pos);
      if (rot) m.rotation.set(...rot);
      m.renderOrder = 3;
      car.add(m);
      return m;
    };
    const cells = new THREE.BoxGeometry(1.28, 0.1, 2.3);
    mesh('tesla', cells, [0, 0.3, -0.05]);
    const grid = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.28, 0.1, 2.3, 4, 1, 8)), new THREE.LineBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false }));
    grid.position.set(0, 0.3, -0.05);
    car.add(grid);
    mesh('batt', new THREE.BoxGeometry(0.3, 0.2, 0.22), [0.42, 0.72, 1.62]);
    mesh('batt', new THREE.CylinderGeometry(0.1, 0.1, 0.2, 20), [-0.36, 0.64, 1.72], [0, 0, Math.PI / 2]);
    mesh('light', new THREE.SphereGeometry(0.1, 20, 14).scale(1.7, 0.55, 0.7), [0.62, 0.8, 2.16]);
    mesh('light', new THREE.SphereGeometry(0.1, 20, 14).scale(1.7, 0.55, 0.7), [-0.62, 0.8, 2.16]);
    mesh('ac', new THREE.BoxGeometry(0.95, 0.2, 0.26), [0, 0.86, 1.02]);
    mesh('ac', new THREE.CylinderGeometry(0.11, 0.11, 0.08, 24), [0.32, 0.86, 1.2], [Math.PI / 2, 0, 0]);
    mesh('check', new THREE.BoxGeometry(0.62, 0.22, 0.03), [0, 1.08, 0.66], [-0.45, 0, 0]);
    mesh('check', new THREE.TorusGeometry(0.16, 0.022, 10, 36), [0.36, 1.0, 0.45], [-0.35, 0, 0]);
    for (const [x, z] of [[0.77, 1.4], [-0.77, 1.4], [0.77, -1.38], [-0.77, -1.38]]) {
      mesh('susp', new THREE.CylinderGeometry(0.19, 0.19, 0.03, 32), [x * 0.86, 0.35, z], [0, 0, Math.PI / 2]);
      mesh('susp', new THREE.CylinderGeometry(0.05, 0.05, 0.36, 12), [x * 0.78, 0.68, z]);
    }
    const dish = new THREE.BoxGeometry(0.5, 0.035, 0.3);
    mesh('starlink', dish, [0, 1.47, -0.5]);
    mesh('start', new THREE.TorusGeometry(0.07, 0.02, 10, 24), [0, 0.42, -2.27]);
    mesh('start', new THREE.BoxGeometry(0.5, 0.06, 0.08), [0, 0.42, 2.3]);

    const glow = new THREE.Mesh(new THREE.CircleGeometry(3.2, 64), new THREE.ShaderMaterial({
      uniforms: { uC: { value: new THREE.Color(0x4a86e8) } },
      vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 uC; varying vec2 vU; void main(){ float d = distance(vU, vec2(0.5)) * 2.0; float a = smoothstep(1.0, 0.0, d) * 0.42; gl_FragColor = vec4(uC * a, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.scale.set(0.8, 1.25, 1);
    glow.position.y = 0.005;
    scene.add(glow);
    const floor = new THREE.GridHelper(14, 28, 0x6aa2f5, 0x3b6fc4);
    floor.material.transparent = true;
    floor.material.opacity = 0.16;
    floor.material.depthWrite = false;
    scene.add(floor);

    const anchors = Object.fromEntries(parts.map(p => [p.k, new THREE.Vector3(...p.a)]));
    const views = Object.fromEntries(parts.map(p => [p.k, p.v]));
    const home = data.home;
    const st = { yaw: home[0], dist: home[1], h: home[2], tx: home[3], ty: home[4], tz: home[5], off: 0 };
    const goal = { ...st };
    let userYaw = 0;
    let autoYaw = 0;
    let lastT = performance.now();
    let visible = true;
    let running = false;
    let w = 0;
    let h = 0;
    const tmp = new THREE.Vector3();
    const pinEls = Object.fromEntries(pins.map(b => [b.dataset.k, b]));
    const stage = root.querySelector('.xr-gl');

    const resize = () => {
      const r = stage.getBoundingClientRect();
      w = Math.max(1, Math.round(r.width));
      h = Math.max(1, Math.round(r.height));
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.fov = w / h < 1 ? 38 : 28;
      camera.updateProjectionMatrix();
    };
    new ResizeObserver(resize).observe(stage);
    resize();

    const wrapNear = (a, ref) => a + Math.round((ref - a) / (Math.PI * 2)) * Math.PI * 2;
    const focus = k => {
      const v = k ? views[k] : home;
      const cur = st.yaw;
      goal.yaw = wrapNear(v[0], cur - userYaw - autoYaw);
      goal.dist = v[1]; goal.h = v[2]; goal.tx = v[3]; goal.ty = v[4]; goal.tz = v[5];
      goal.off = k && w / h > 1.2 ? 0.17 : 0;
      if (k) { userYaw = 0; autoYaw = 0; }
      Object.values(partMats).forEach(m => { m.userData.on = false; });
      if (k && partMats[k]) partMats[k].userData.on = true;
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
        if (Math.abs(dx) < 6 || Math.abs(dx) < Math.abs(dy)) return;
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
      return (Math.min(1, Math.max(0, p)) - 0.5) * 1.3;
    };

    const frame = t => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      if (!staticShot && !selected && !drag) autoYaw += dt * 0.16;
      const k = 1 - Math.exp(-dt * 3.6);
      for (const key of ['yaw', 'dist', 'h', 'tx', 'ty', 'tz', 'off']) st[key] += (goal[key] - st[key]) * k;
      const far = w / h < 1 ? 1.32 : 1;
      camera.setViewOffset(w, h, st.off * w, 0, w, h);
      const yaw = st.yaw + userYaw + autoYaw + (selected || staticShot ? 0 : scrollYaw());
      car.rotation.y = yaw;
      tmp.set(st.tx, st.ty, st.tz).applyAxisAngle(THREE.Object3D.DEFAULT_UP, yaw);
      camera.position.set(tmp.x, st.h * far, tmp.z + st.dist * far);
      camera.lookAt(tmp.x, st.ty, tmp.z);
      const time = t / 1000;
      for (const m of [bodyMat, glassMat, wheelMat, ...Object.values(partMats)]) {
        m.uniforms.uTime.value = time;
        const target = m.userData.on ? 1 : 0;
        m.uniforms.uHot.value += (target - m.uniforms.uHot.value) * k * 1.4;
      }
      bodyMat.uniforms.uAlpha.value += ((bodyMat.userData.dim ? 0.5 : 0.95) - bodyMat.uniforms.uAlpha.value) * k;
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
        el.classList.toggle('far', tmp.z > cz + 0.002 && p.k !== selected);
      }
      if (running) requestAnimationFrame(frame);
    };
    const kick = () => {
      if (running || !visible || document.hidden) return;
      running = true;
      lastT = performance.now();
      requestAnimationFrame(frame);
    };
    const stop = () => { running = false; };
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); else stop(); }).observe(root);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else kick(); });
    root.classList.add('live');
    if (staticShot) {
      document.documentElement.classList.add('xr-shot');
      st.yaw = goal.yaw; userYaw = 0; autoYaw = 0;
      running = true;
      requestAnimationFrame(t => {
        lastT = t;
        frame(t);
        running = false;
        const r = stage.getBoundingClientRect();
        window.__xr = Object.fromEntries(pins.map(b => {
          const m = /translate\(([\d.-]+)px, ([\d.-]+)px\)/.exec(b.style.transform);
          return [b.dataset.k, [(+m[1] / r.width * 100).toFixed(2), (+m[2] / r.height * 100).toFixed(2)]];
        }));
      });
    } else kick();
    return { focus };
  }
}
