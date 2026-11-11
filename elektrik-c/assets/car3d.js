import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const BLUE = new THREE.Color('#3068c7');
const BLUE_DEEP = new THREE.Color('#1d4699');
const NAVY = new THREE.Color('#14213f');
const YELLOW = new THREE.Color('#fdc703');
const WHITE = new THREE.Color('#ffffff');
const GLASS = new THREE.Color('#bcd2f5');

const ease = {
  out: t => 1 - Math.pow(1 - t, 3),
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  back: t => { const c = 1.9; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
  bounce: t => {
    const n = 7.5625, d = 2.75;
    if (t < 1 / d) return n * t * t;
    if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
    if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
    return n * (t -= 2.625 / d) * t + 0.984375;
  },
};

function hsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

const PAINT = [48, 104, 199];
const TRIM = [20, 33, 63];
const LAMP = [253, 199, 3];
const PANE = [24, 44, 92];
const CLAY = [236, 241, 250];

function recolor(image) {
  const c = document.createElement('canvas');
  c.width = image.width;
  c.height = image.height;
  const g = c.getContext('2d');
  g.drawImage(image, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const p = d.data;
  const tint = (col, k) => [col[0] * k, col[1] * k, col[2] * k];
  for (let i = 0; i < p.length; i += 4) {
    const [h, s, l] = hsl(p[i] / 255, p[i + 1] / 255, p[i + 2] / 255);
    let out;
    if (s > 0.35 && (h < 0.1 || h > 0.92) && l > 0.3) out = tint(PAINT, Math.min(1.12, 0.62 + l * 0.6));
    else if (s > 0.4 && h >= 0.1 && h < 0.2) out = LAMP;
    else if (h > 0.5 && h < 0.75 && s > 0.45) out = tint(PANE, 0.8 + (l - 0.6) * 1.2);
    else if (l > 0.85) out = [255, 255, 255];
    else if (l < 0.3) out = tint(TRIM, 0.85 + l);
    else out = tint(CLAY, 0.78 + l * 0.4);
    p[i] = Math.min(255, out[0]);
    p[i + 1] = Math.min(255, out[1]);
    p[i + 2] = Math.min(255, out[2]);
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.magFilter = THREE.NearestFilter;
  return t;
}

function radialTexture(stops) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function boltTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fdc703';
  g.beginPath();
  g.arc(64, 64, 58, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3068c7';
  g.beginPath();
  [[74, 14], [34, 70], [60, 70], [50, 114], [94, 54], [68, 54], [74, 14]].forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function mountCar(host, { model, onReady, onFail } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    if (onFail) onFail(e);
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.7, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xa9c3f2, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.position.set(4, 7, 5);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xfff1b8, 0.9);
  rim.position.set(-5, 3, -4);
  scene.add(rim);

  const stage = new THREE.Group();
  scene.add(stage);

  const tableTop = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.14, 72), new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.6 }));
  tableTop.position.y = -0.07;
  stage.add(tableTop);
  const tableSide = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.38, 0.22, 72, 1, true), new THREE.MeshStandardMaterial({ color: BLUE_DEEP, roughness: 0.5, side: THREE.DoubleSide }));
  tableSide.position.y = -0.2;
  stage.add(tableSide);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.25, 0.035, 8, 96), new THREE.MeshBasicMaterial({ color: YELLOW }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.005;
  stage.add(ring);
  const marks = new THREE.Group();
  for (let k = 0; k < 24; k++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.16), new THREE.MeshBasicMaterial({ color: k % 6 === 0 ? YELLOW : BLUE }));
    const a = (k / 24) * Math.PI * 2;
    m.position.set(Math.sin(a) * 2.05, 0.006, Math.cos(a) * 2.05);
    m.rotation.y = a;
    marks.add(m);
  }
  stage.add(marks);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshBasicMaterial({
    map: radialTexture([[0, 'rgba(20,33,63,.42)'], [0.55, 'rgba(20,33,63,.16)'], [1, 'rgba(20,33,63,0)']]), transparent: true, depthWrite: false,
  }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  shadow.scale.set(0.8, 1.15, 1);
  stage.add(shadow);

  const carRig = new THREE.Group();
  stage.add(carRig);
  const car = new THREE.Group();
  carRig.add(car);

  const fx = {};
  const wheels = [];
  let body = null;
  let mode = 'idle';
  let modeT = 0;
  let prevMode = 'idle';
  let ready = false;
  let visible = true;
  let raf = 0;
  let last = performance.now();
  let spin = 0;
  let spinVel = 0.22;
  let drag = null;
  const lift = { y: 0, pitch: 0, roll: 0 };

  const loader = new GLTFLoader();
  loader.load(model, gltf => {
    const root = gltf.scene;
    let tex = null;
    root.traverse(o => {
      if (o.isMesh && o.material && o.material.map && !tex) tex = recolor(o.material.map.image);
    });
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05, flatShading: true });
    root.traverse(o => { if (o.isMesh) o.material = mat; });
    root.children.slice().forEach(n => {
      if (n.name.startsWith('wheel')) wheels.push(n);
      if (n.name === 'body') body = n;
    });
    root.scale.setScalar(1.4);
    car.add(root);
    build(root);
    ready = true;
    resize();
    if (onReady) onReady();
  }, undefined, err => { if (onFail) onFail(err); });

  function surfaceY(x, z) {
    const rc = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
    const hit = rc.intersectObject(body, true)[0];
    return hit ? hit.point.y : null;
  }

  function build(root) {
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(body);
    const front = box.max.z;
    const width = box.max.x - box.min.x;
    let hoodY = surfaceY(0, front - 0.18) ?? 0.7;
    let back = front - 0.2;
    for (let z = front - 0.18; z > 0; z -= 0.03) {
      const y = surfaceY(0, z);
      if (y === null || y > hoodY + 0.07) break;
      back = z;
    }
    const hoodLen = front - back - 0.04;
    const hoodW = width * 0.78;

    const hinge = new THREE.Group();
    hinge.position.set(0, hoodY + 0.006, back);
    car.add(hinge);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(hoodW, 0.035, hoodLen), new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.45, flatShading: true }));
    hood.position.z = hoodLen / 2;
    hood.position.y = 0.012;
    hinge.add(hood);
    const hoodEdge = new THREE.LineSegments(new THREE.EdgesGeometry(hood.geometry), new THREE.LineBasicMaterial({ color: BLUE_DEEP }));
    hood.add(hoodEdge);
    const under = new THREE.Mesh(new THREE.BoxGeometry(hoodW * 0.96, 0.01, hoodLen * 0.96), new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.8 }));
    under.position.set(0, -0.008, hoodLen / 2);
    hinge.add(under);
    fx.hood = hinge;

    const bay = new THREE.Group();
    bay.position.set(0, hoodY, back + hoodLen / 2);
    car.add(bay);
    const pit = new THREE.Mesh(new THREE.BoxGeometry(hoodW * 0.92, 0.02, hoodLen * 0.9), new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.9 }));
    pit.position.y = 0.004;
    bay.add(pit);
    const batt = new THREE.Group();
    const bb = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3), new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.5, flatShading: true }));
    batt.add(bb);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.05, 0.32), new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.6 }));
    lid.position.y = 0.15;
    batt.add(lid);
    [-0.12, 0.12].forEach((x, k) => {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12), new THREE.MeshStandardMaterial({ color: k ? WHITE : YELLOW, emissive: k ? 0x000000 : YELLOW, emissiveIntensity: 0.4 }));
      t.position.set(x, 0.2, 0.06);
      batt.add(t);
    });
    batt.position.set(-hoodW * 0.18, -0.2, 0);
    bay.add(batt);
    const gen = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.2, 14), new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.4, flatShading: true }));
    gen.rotation.z = Math.PI / 2;
    gen.position.set(hoodW * 0.22, -0.2, 0.04);
    bay.add(gen);
    const boltMat = new THREE.SpriteMaterial({ map: boltTexture(), transparent: true, depthTest: false });
    const bolt = new THREE.Sprite(boltMat);
    bolt.scale.setScalar(0.001);
    bolt.position.set(0, 0.75, 0);
    bolt.renderOrder = 5;
    bay.add(bolt);
    fx.batt = batt;
    fx.gen = gen;
    fx.bolt = bolt;
    fx.bay = bay;

    const hlY = (surfaceY(width * 0.33, front - 0.04) ?? hoodY) - 0.13;
    const glow = radialTexture([[0, 'rgba(255,248,214,1)'], [0.3, 'rgba(253,199,3,.85)'], [1, 'rgba(253,199,3,0)']]);
    fx.lamps = [];
    fx.beams = [];
    [-1, 1].forEach(s => {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      lamp.position.set(s * width * 0.33, hlY, front + 0.03);
      lamp.scale.setScalar(0.001);
      car.add(lamp);
      fx.lamps.push(lamp);
      const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4), new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      beam.rotation.x = -Math.PI / 2;
      beam.position.set(s * width * 0.3, 0.02, front + 1.15);
      car.add(beam);
      fx.beams.push(beam);
    });

    const roofY = surfaceY(0, -0.15) ?? 1.3;
    const dish = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.05, 0.42), new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.35, flatShading: true }));
    plate.rotation.x = -0.32;
    plate.position.y = 0.2;
    dish.add(plate);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.36), new THREE.MeshBasicMaterial({ color: 0xe9eef8 }));
    face.rotation.x = -Math.PI / 2 - 0.32;
    face.position.set(0, 0.229, 0.01);
    dish.add(face);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.2, 10), new THREE.MeshStandardMaterial({ color: NAVY }));
    mast.position.y = 0.09;
    dish.add(mast);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.03, 18), new THREE.MeshStandardMaterial({ color: NAVY }));
    foot.position.y = 0.0;
    dish.add(foot);
    dish.position.set(0, roofY, -0.15);
    dish.scale.setScalar(1.45);
    dish.visible = false;
    car.add(dish);
    fx.dish = dish;
    fx.roofY = roofY;
    fx.waves = [];
    for (let k = 0; k < 3; k++) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.018, 6, 40, Math.PI * 0.7), new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0, depthWrite: false }));
      w.rotation.z = Math.PI * 0.15;
      w.position.set(0, roofY + 0.4, -0.15);
      car.add(w);
      fx.waves.push(w);
    }

    const aura = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: GLASS, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    aura.scale.set(width * 0.58, 0.42, 0.95);
    aura.position.set(0, roofY - 0.18, -0.12);
    car.add(aura);
    fx.aura = aura;
    const flakes = new THREE.BufferGeometry();
    const N = 90;
    const pos = new Float32Array(N * 3);
    const seed = new Float32Array(N);
    for (let k = 0; k < N; k++) {
      pos[k * 3] = (Math.random() - 0.5) * width * 1.2;
      pos[k * 3 + 1] = roofY - 0.4 + Math.random() * 0.9;
      pos[k * 3 + 2] = -0.9 + Math.random() * 1.5;
      seed[k] = Math.random();
    }
    flakes.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flakeMat = new THREE.PointsMaterial({ color: WHITE, size: 0.06, transparent: true, opacity: 0, depthWrite: false, map: radialTexture([[0, 'rgba(255,255,255,1)'], [0.5, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']]) });
    const pts = new THREE.Points(flakes, flakeMat);
    car.add(pts);
    fx.flakes = { pts, pos, seed, base: pos.slice(), roofY };

    const scan = new THREE.Mesh(new THREE.PlaneGeometry(width * 1.35, 1.6), new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    scan.position.y = 0.75;
    car.add(scan);
    const scanLine = new THREE.Mesh(new THREE.BoxGeometry(width * 1.35, 0.025, 0.025), new THREE.MeshBasicMaterial({ color: YELLOW, transparent: true, opacity: 0 }));
    scan.add(scanLine);
    scanLine.position.y = 0.8;
    const scanLine2 = scanLine.clone();
    scanLine2.position.y = -0.8;
    scan.add(scanLine2);
    fx.scan = { scan, lines: [scanLine, scanLine2], front, back: box.min.z };


    const plugPts = [new THREE.Vector3(-width * 0.56, hoodY - 0.08, box.min.z + 0.45), new THREE.Vector3(-width * 1.1, 0.5, box.min.z + 0.2), new THREE.Vector3(-1.55, 0.06, box.min.z - 0.3)];
    const curve = new THREE.QuadraticBezierCurve3(...plugPts);
    const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.028, 8), new THREE.MeshStandardMaterial({ color: NAVY, roughness: 0.6 }));
    cable.visible = false;
    car.add(cable);
    const pulses = [];
    for (let k = 0; k < 3; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: YELLOW }));
      p.visible = false;
      car.add(p);
      pulses.push(p);
    }
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.16), new THREE.MeshStandardMaterial({ color: WHITE, roughness: 0.4, flatShading: true }));
    post.position.set(-1.55, 0.35, box.min.z - 0.3);
    post.visible = false;
    car.add(post);
    const postFace = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.14), new THREE.MeshBasicMaterial({ map: boltTexture(), transparent: true }));
    postFace.position.set(0, 0.16, 0.081);
    post.add(postFace);
    fx.charge = { cable, pulses, curve, post };

    const hookG = new THREE.Group();
    const cableUp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 4, 8), new THREE.MeshStandardMaterial({ color: NAVY }));
    cableUp.position.y = 2;
    hookG.add(cableUp);
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 10, 24, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.4 }));
    hook.rotation.z = Math.PI * 0.8;
    hookG.add(hook);
    hookG.position.set(0, hoodY + 4, front + 0.05);
    hookG.visible = false;
    car.add(hookG);
    fx.hook = { g: hookG, y0: hoodY + 0.12, front };

    const beacon = new THREE.Group();
    const bBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.16), new THREE.MeshStandardMaterial({ color: NAVY }));
    beacon.add(bBase);
    const bLamp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: YELLOW, emissive: YELLOW, emissiveIntensity: 0.3 }));
    bLamp.position.y = 0.08;
    beacon.add(bLamp);
    const bGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    bGlow.position.y = 0.1;
    bGlow.scale.set(1.4, 0.9, 1);
    beacon.add(bGlow);
    beacon.position.set(0, roofY + 0.02, 0.05);
    beacon.scale.setScalar(0.001);
    car.add(beacon);
    fx.beacon = { g: beacon, lamp: bLamp, glow: bGlow };
  }

  function resize() {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    const dist = w / h < 0.9 ? 12.6 : w / h < 1.25 ? 10.4 : 9.2;
    camera.position.set(dist * 0.62, dist * 0.36, dist * 0.7);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }

  function set(next) {
    if (next === mode) return;
    prevMode = mode;
    mode = next;
    modeT = 0;
    if (['batt', 'start', 'light', 'tow', 'starlink', 'tesla'].includes(next)) spinVel = 0.08;
    else spinVel = 0.22;
  }

  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const approach = (cur, to, k, dt) => cur + (to - cur) * (1 - Math.exp(-k * dt));

  function frame(now) {
    raf = 0;
    if (!visible) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (ready) step(dt, now / 1000);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function step(dt, t) {
    modeT += dt;
    if (!drag) spin += spinVel * dt;
    stage.rotation.y = spin;

    const m = mode;
    const hoodOpen = m === 'batt' || m === 'start' ? ease.back(clamp(modeT / 0.7)) : 0;
    fx.hood.rotation.x = approach(fx.hood.rotation.x, -1.05 * hoodOpen, 10, dt);
    const battUp = m === 'batt' || m === 'start' ? ease.back(clamp((modeT - 0.35) / 0.6)) : 0;
    fx.batt.position.y = approach(fx.batt.position.y, -0.2 + 0.33 * battUp, 12, dt);
    fx.gen.position.y = approach(fx.gen.position.y, -0.2 + 0.24 * battUp, 12, dt);
    fx.gen.rotation.x += battUp * dt * 9;
    const pulse = battUp ? 0.34 + 0.06 * Math.sin(t * 8) : 0.001;
    fx.bolt.scale.setScalar(approach(fx.bolt.scale.x, pulse, 10, dt));

    const lightOn = m === 'light';
    const flash = lightOn ? (modeT < 1.2 ? (Math.sin(modeT * 18) > 0 ? 1 : 0.15) : 0.85 + 0.15 * Math.sin(t * 3)) : 0;
    fx.lamps.forEach(l => l.scale.setScalar(approach(l.scale.x, 0.001 + flash * 0.75, 18, dt)));
    fx.beams.forEach(b => { b.material.opacity = approach(b.material.opacity, flash * 0.55, 14, dt); });

    let wheelSpeed = 0;
    let bob = 0;
    let pitch = 0;
    let roll = 0;
    if (m === 'susp') {
      wheelSpeed = 9;
      bob = 0.06 * Math.sin(modeT * 7) * Math.exp(-((modeT % 2.2) * 1.2)) + 0.02 * Math.sin(modeT * 13);
      roll = 0.03 * Math.sin(modeT * 4);
    } else if (m === 'brake') {
      const cyc = modeT % 2.6;
      wheelSpeed = cyc < 1.3 ? 14 : 0;
      pitch = cyc > 1.3 ? 0.07 * Math.exp(-(cyc - 1.3) * 4) * Math.cos((cyc - 1.3) * 12) : 0;
    } else if (m === 'vyezd') {
      wheelSpeed = 11;
      bob = 0.012 * Math.sin(modeT * 22);
    }
    wheels.forEach(w => { w.rotation.x += wheelSpeed * dt; });

    let towY = 0;
    let towPitch = 0;
    const tow = m === 'tow';
    fx.hook.g.visible = tow || fx.hook.g.position.y < fx.hook.y0 + 3.9;
    const hookTarget = tow ? fx.hook.y0 + (modeT > 1 ? 0.5 * ease.inOut(clamp((modeT - 1) / 1.2)) : 0) : fx.hook.y0 + 4;
    fx.hook.g.position.y = approach(fx.hook.g.position.y, hookTarget, tow && modeT < 1 ? 7 : 5, dt);
    if (tow && modeT > 1) {
      const k = ease.inOut(clamp((modeT - 1) / 1.2));
      towY = 0.2 * k;
      towPitch = -0.22 * k + 0.02 * Math.sin(t * 2.2) * k;
    }

    lift.y = approach(lift.y, bob + towY, tow ? 6 : 16, dt);
    lift.pitch = approach(lift.pitch, pitch + towPitch, tow ? 6 : 14, dt);
    lift.roll = approach(lift.roll, roll, 10, dt);
    carRig.position.y = lift.y;
    carRig.rotation.x = lift.pitch;
    carRig.rotation.z = lift.roll;
    carRig.position.z = tow ? 0.4 * clamp((modeT - 1) / 1.2) * -0.3 : approach(carRig.position.z, 0, 6, dt);

    const star = m === 'starlink';
    if (star) {
      fx.dish.visible = true;
      const k = clamp(modeT / 0.9);
      fx.dish.position.y = fx.roofY + 2.6 * (1 - ease.bounce(k));
      fx.dish.rotation.y = (1 - ease.out(k)) * 2.4;
    } else if (fx.dish.visible) {
      fx.dish.position.y = approach(fx.dish.position.y, fx.roofY + 3, 6, dt);
      if (fx.dish.position.y > fx.roofY + 2.8) fx.dish.visible = false;
    }
    fx.waves.forEach((w, k) => {
      const ph = star && modeT > 0.9 ? ((t * 0.9 + k / 3) % 1) : 0;
      w.material.opacity = star && modeT > 0.9 ? (1 - ph) * 0.95 : approach(w.material.opacity, 0, 10, dt);
      w.scale.setScalar(0.6 + ph * 1.6);
      w.position.y = fx.roofY + 0.45 + ph * 0.5;
    });

    const ac = m === 'ac';
    const warm = ac ? clamp((Math.sin(modeT * 0.9 - 1.4) + 1) / 2) : 0;
    fx.aura.material.color.copy(GLASS).lerp(YELLOW, warm);
    fx.aura.material.opacity = approach(fx.aura.material.opacity, ac ? 0.28 + 0.06 * Math.sin(t * 3) : 0, 8, dt);
    const fl = fx.flakes;
    fl.pts.material.opacity = approach(fl.pts.material.opacity, ac ? 0.95 : 0, 8, dt);
    fl.pts.material.color.copy(WHITE).lerp(YELLOW, warm);
    if (fl.pts.material.opacity > 0.01) {
      for (let k = 0; k < fl.seed.length; k++) {
        const s = fl.seed[k];
        const dir = warm > 0.5 ? 1 : -1;
        const ph = (t * (0.25 + s * 0.3) + s) % 1;
        fl.pos[k * 3 + 1] = fl.roofY - 0.45 + (dir > 0 ? ph : 1 - ph) * 1.1;
        fl.pos[k * 3] = fl.base[k * 3] + Math.sin(t * 2 + s * 9) * 0.06;
      }
      fl.pts.geometry.attributes.position.needsUpdate = true;
    }

    const diag = m === 'elec' || m === 'check';
    const sc = fx.scan;
    const sp = (modeT * 0.55) % 1;
    sc.scan.position.z = sc.front + 0.2 - sp * (sc.front - sc.back + 0.4);
    sc.scan.material.opacity = approach(sc.scan.material.opacity, diag ? 0.2 : 0, 10, dt);
    sc.lines.forEach(l => { l.material.opacity = sc.scan.material.opacity * 7; });
    sc.scan.visible = sc.scan.material.opacity > 0.005;

    const tesla = m === 'tesla';
    const ch = fx.charge;
    ch.cable.visible = ch.post.visible = tesla || ch.post.scale.y > 0.05;
    ch.post.scale.y = approach(ch.post.scale.y, tesla ? 1 : 0.001, 10, dt);
    ch.post.position.y = 0.35 * ch.post.scale.y;
    ch.cable.scale.setScalar(approach(ch.cable.scale.x, tesla ? 1 : 0.001, 10, dt));
    ch.cable.visible = tesla && ch.cable.scale.x > 0.05;
    ch.pulses.forEach((p, k) => {
      p.visible = tesla && modeT > 0.5;
      if (!p.visible) return;
      const u = 1 - ((t * 0.7 + k / 3) % 1);
      p.position.copy(ch.curve.getPoint(u));
      p.scale.setScalar(0.8 + 0.4 * Math.sin(u * Math.PI));
    });

    const vy = m === 'vyezd';
    const bk = fx.beacon;
    bk.g.scale.setScalar(approach(bk.g.scale.x, vy ? 1 : 0.001, 12, dt));
    const blink = vy ? (Math.sin(t * 14) > 0 ? 1 : 0.2) : 0;
    bk.glow.material.opacity = blink * 0.9;
    bk.lamp.material.emissiveIntensity = 0.2 + blink * 1.4;
  }

  function onDown(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, s: spin, on: false, id: e.pointerId };
  }
  function onMove(e) {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x;
    const dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { drag.on = true; host.setPointerCapture(e.pointerId); }
      else if (Math.abs(dy) > 8) { drag = null; return; }
      else return;
    }
    spin = drag.s + dx * 0.012;
  }
  function onUp() { drag = null; }
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting && document.visibilityState === 'visible';
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }, { rootMargin: '80px' });
  io.observe(host);
  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible' && host.getBoundingClientRect().bottom > 0;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  });
  resize();
  raf = requestAnimationFrame(frame);

  return {
    set,
    snapshot() { renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); renderer.dispose(); },
  };
}
