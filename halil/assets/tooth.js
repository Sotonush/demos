(() => {
  const stages = [...document.querySelectorAll('[data-tooth]')];
  if (!stages.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return;

  const SPIN = .32;
  const START = -.75;
  const TURN = Math.PI * 2;
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.append(s); });
  const start = () => Promise.all([load('assets/three.min.js'), fetch('assets/tooth.bin').then(r => r.arrayBuffer())]).then(([, buf]) => run(buf)).catch(() => {});
  if (document.readyState === 'complete') start(); else addEventListener('load', start);

  function geometry(buf) {
    const [nv, ni] = new Uint32Array(buf, 0, 2);
    const scale = new Float32Array(buf, 8, 1)[0];
    let o = 12;
    const take = (T, n) => { const a = new T(buf, o, n); o += n * T.BYTES_PER_ELEMENT; return a; };
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(take(Int16Array, nv * 3), 3, true));
    g.setAttribute('normal', new THREE.BufferAttribute(take(Int16Array, nv * 3), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(take(Uint8Array, nv * 4), 4, true));
    g.setIndex(new THREE.BufferAttribute(take(Uint16Array, ni), 1));
    return { g, scale };
  }

  function studio(renderer) {
    const s = new THREE.Scene();
    s.add(new THREE.Mesh(new THREE.SphereGeometry(30, 32, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(.30, .32, .32), side: THREE.BackSide })));
    const box = (w, h, x, y, z, v, tint = [1, 1, 1]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(v * tint[0], v * tint[1], v * tint[2]), side: THREE.DoubleSide }));
      m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    };
    box(14, 14, -2, 14, 4, 4.2);
    box(5, 18, -13, 3, 7, 6, [1, .97, .93]);
    box(3, 16, 14, 1, 3, 3, [.93, .97, 1]);
    box(12, 2, 0, 4, 15, 1.6);
    box(14, 6, 0, -12, 4, .8, [1, .96, .9]);
    box(3, 14, 3, 2, -15, 4);
    const p = new THREE.PMREMGenerator(renderer);
    const t = p.fromScene(s, .015).texture;
    p.dispose();
    return t;
  }

  function shadowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const x = c.getContext('2d'), r = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    r.addColorStop(0, 'rgba(30,50,46,.28)'); r.addColorStop(.35, 'rgba(30,50,46,.13)'); r.addColorStop(.7, 'rgba(30,50,46,.04)'); r.addColorStop(1, 'rgba(30,50,46,0)');
    x.fillStyle = r; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }

  function run(buf) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0, 0);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .84;
    let ratio = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(ratio);

    const scene = new THREE.Scene();
    scene.environment = studio(renderer);
    const camera = new THREE.PerspectiveCamera(22, 1, .1, 50);
    const { g, scale } = geometry(buf);
    const material = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .34, metalness: 0, clearcoat: 1, clearcoatRoughness: .1, reflectivity: .55, envMapIntensity: .95 });
    const tooth = new THREE.Mesh(g, material);
    tooth.scale.setScalar(scale);
    const tilt = new THREE.Group();
    tilt.rotation.set(.42, 0, -.14);
    tilt.add(tooth);
    scene.add(tilt);
    const key = new THREE.DirectionalLight(0xfff3e4, .55); key.position.set(-3, 5, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xe8f2ff, .35); rim.position.set(4, 1, -4); scene.add(rim);
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, toneMapped: false }));
    shadow.rotation.x = -Math.PI / 2 + .12;
    shadow.position.y = -2.0;
    scene.add(shadow);

    let host = null, angle = START, target = START, last = 0, raf = 0, slow = 0, frames = 0;
    const seen = new Set();
    const fit = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const need = Math.max(4.75 / (2 * Math.tan(camera.fov * Math.PI / 360)), 3.2 / (2 * Math.tan(camera.fov * Math.PI / 360) * camera.aspect));
      camera.position.set(0, .35, need + 1);
      camera.lookAt(0, -.08, 0);
    };
    const progress = () => {
      const b = host.closest('[data-tooth-track]');
      if (!b) return null;
      const r = b.getBoundingClientRect(), span = r.height - innerHeight;
      return Math.min(1, Math.max(0, -r.top / (span > 0 ? span : 1)));
    };
    const frame = t => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min((t - last) / 1000, .05); last = t;
      const p = progress();
      if (p === null) angle += SPIN * dt;
      else { target = .6 + p * TURN; angle += (target - angle) * Math.min(1, dt * 7); if (Math.abs(target - angle) < .0005 && frames > 2) return; }
      tooth.rotation.y = angle;
      renderer.render(scene, camera);
      if (frames === 1) host.classList.add('live');
      frames++;
      slow = dt > .03 ? slow + 1 : Math.max(0, slow - 1);
      if (slow > 45 && ratio > 1) { ratio = Math.max(1, ratio - .5); renderer.setPixelRatio(ratio); fit(); slow = 0; }
    };
    const pick = () => {
      const next = stages.find(s => seen.has(s)) || null;
      if (next !== host) {
        if (host) host.classList.remove('live');
        host = next; frames = 0;
        if (host) { host.append(canvas); fit(); if (progress() !== null) angle = .6 + progress() * TURN; }
      }
      cancelAnimationFrame(raf); raf = 0;
      if (host && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); }
    };
    const io = new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)); pick(); }, { rootMargin: '60px' });
    stages.forEach(s => io.observe(s));
    document.addEventListener('visibilitychange', pick);
    addEventListener('resize', () => { if (host) { fit(); frames = Math.min(frames, 2); } });
  }
})();
