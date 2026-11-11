import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const root = document.documentElement;
const story = document.getElementById('story');
const stage = story && story.querySelector('.stage');
const canvas = stage && stage.querySelector('canvas');
const chapters = story ? [...story.querySelectorAll('.ch')] : [];
const railLinks = story ? [...story.querySelectorAll('.rail a')] : [];
const progEl = story && story.querySelector('.st-prog i');
const params = new URLSearchParams(location.search);
const STILL = params.has('still') ? Number(params.get('still')) : null;
const BASE = (document.querySelector('script[data-studio]') || {}).dataset || {};

const BLUE = new THREE.Color('#2f67c6');
const GLOW = new THREE.Color('#5d93ff');
const YELLOW = new THREE.Color('#fdc703');
const PAINT = new THREE.Color(0xf3f5f8);
const LAMP = new THREE.Color(0xeaf1ff);
const RIM = new THREE.Color(0xd9dee6);

const KEYS = [
  { cam: [6.3, 2.15, 7.2], tgt: [0, 0.55, 0.15], fov: 30 },
  { cam: [2.6, 3.6, 5.6], tgt: [0, 0.55, 1.35], fov: 30, hood: 1, batt: 1 },
  { cam: [-4.6, 1.5, 5.4], tgt: [0, 0.55, 1.6], fov: 30, light: 1 },
  { cam: [4.1, 2.7, 3.4], tgt: [0, 0.78, 0.45], fov: 30, ac: 1 },
  { cam: [4.6, 0.85, 4.3], tgt: [0.55, 0.45, 1.15], fov: 30, susp: 1, spin: 0.35 },
  { cam: [7.4, 2.4, 1.1], tgt: [0, 0.55, 0.2], fov: 30, scan: 1 },
  { cam: [-5.3, 1.7, -5.1], tgt: [0, 0.55, -0.2], fov: 30, ev: 1 },
  { cam: [4.6, 5.0, 4.4], tgt: [0, 0.9, -0.05], fov: 30, star: 1 },
  { cam: [8.6, 1.45, 1.9], tgt: [0, 0.5, 0.25], fov: 30, road: 1, spin: 1 },
];
const FX = ['hood', 'batt', 'light', 'ac', 'susp', 'scan', 'ev', 'star', 'road', 'spin'];

function fail() {
  root.classList.remove('js3d');
  story && story.classList.remove('live');
}

function webgl() {
  try {
    const c = document.createElement('canvas');
    return Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

if (!story || !canvas || !webgl()) fail();
else if (matchMedia('(prefers-reduced-motion: reduce)').matches && STILL === null) fail();
else start();

function gradTex(stops, w = 256, h = 4, radial = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = radial ? w : h;
  const g = c.getContext('2d');
  const gr = radial ? g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2) : g.createLinearGradient(0, 0, w, 0);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, c.width, c.height);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function packTex() {
  const s = 512;
  const c = document.createElement('canvas');
  c.width = s;
  c.height = s * 2;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(93,147,255,1)';
  g.shadowColor = 'rgba(93,147,255,1)';
  g.shadowBlur = 28;
  g.lineWidth = 10;
  const r = 70;
  const x = 60;
  const y = 60;
  const w = s - 120;
  const h = s * 2 - 120;
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.stroke();
  g.lineWidth = 3;
  g.shadowBlur = 0;
  g.strokeStyle = 'rgba(93,147,255,.45)';
  for (let k = 1; k < 8; k++) {
    const yy = y + (h * k) / 8;
    g.beginPath();
    g.moveTo(x + 40, yy);
    g.lineTo(x + w - 40, yy);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTex() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(47,103,198,.9)';
  g.fillRect(26, 0, 12, 300);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function start() {
  story.classList.add('live');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: STILL !== null });
  } catch (e) {
    fail();
    return;
  }
  const small = matchMedia('(max-width: 760px)');
  const dprCap = () => Math.min(window.devicePixelRatio || 1, small.matches ? 1.5 : 2);
  renderer.setPixelRatio(STILL !== null ? 1 : dprCap());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(3.5, 7, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(small.matches ? 1024 : 2048, small.matches ? 1024 : 2048);
  key.shadow.camera.left = -4;
  key.shadow.camera.right = 4;
  key.shadow.camera.top = 4;
  key.shadow.camera.bottom = -4;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.radius = 9;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.9);
  rim.position.set(-5, 3, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ee, 0.55));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x1a2c4d, opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 6.2),
    new THREE.MeshBasicMaterial({ map: gradTex([[0, 'rgba(18,32,60,.55)'], [0.45, 'rgba(18,32,60,.22)'], [1, 'rgba(18,32,60,0)']], 256, 4, true), transparent: true, depthWrite: false }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.set(0, 0.002, 0.2);
  scene.add(blob);

  const pack = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 3.8), new THREE.MeshBasicMaterial({ map: packTex(), transparent: true, opacity: 0, depthWrite: false }));
  pack.rotation.x = -Math.PI / 2;
  pack.position.set(0, 0.006, 0.2);
  scene.add(pack);

  const rTex = roadTex();
  rTex.repeat.set(1, 6);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 30), new THREE.MeshBasicMaterial({ map: rTex, transparent: true, opacity: 0, depthWrite: false }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(1.85, 0.004, 0);
  const road2 = road.clone();
  road2.material = road.material;
  road2.position.x = -1.85;
  scene.add(road, road2);

  const uni = { uScan: { value: -4 }, uScanAmt: { value: 0 }, uGlow: { value: new THREE.Color('#3f7ae0') } };
  const patch = m => {
    m.onBeforeCompile = sh => {
      sh.uniforms.uScan = uni.uScan;
      sh.uniforms.uScanAmt = uni.uScanAmt;
      sh.uniforms.uGlow = uni.uGlow;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform float uScan;\nuniform float uScanAmt;\nuniform vec3 uGlow;')
        .replace('#include <dithering_fragment>', 'float bd = vWp.z - uScan;\nfloat bnd = clamp(exp(-bd * bd / 0.01) + exp(-bd * bd / 0.35) * 0.22, 0.0, 1.0) * uScanAmt;\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uGlow, bnd * 0.9);\n#include <dithering_fragment>');
    };
    return m;
  };

  const mats = {
    paint: patch(new THREE.MeshPhysicalMaterial({ color: 0xf3f5f8, roughness: 0.42, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.28 })),
    paint2: patch(new THREE.MeshPhysicalMaterial({ color: 0xe2e7ee, roughness: 0.48, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.3 })),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x0f1d36, roughness: 0.06, metalness: 0.2, transparent: true, opacity: 0.72, depthWrite: false }),
    dark: patch(new THREE.MeshStandardMaterial({ color: 0x9aa6b8, roughness: 0.8, metalness: 0.1 })),
    inner: new THREE.MeshStandardMaterial({ color: 0xc4ccd8, roughness: 0.85 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1c2331, roughness: 0.92 }),
    rim: new THREE.MeshPhysicalMaterial({ color: 0xd9dee6, roughness: 0.3, metalness: 0.55, clearcoat: 0.4, emissive: 0x000000 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x9aa3af, roughness: 0.35, metalness: 0.8, emissive: 0x000000 }),
    caliper: new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.4, metalness: 0.2, emissive: 0x000000 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xeaf1ff, roughness: 0.15, metalness: 0.3, emissive: 0x000000 }),
    hood: patch(new THREE.MeshPhysicalMaterial({ color: 0xf3f5f8, roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.28, transparent: true })),
    mirror: new THREE.MeshStandardMaterial({ color: 0xd6dde8, roughness: 0.1, metalness: 0.9 }),
  };

  const pick = (name, mname) => {
    if (/Headlights|Taillights|Turnsignals/.test(name)) return mats.lamp;
    if (/BrakePad/.test(name)) return mats.caliper;
    if (/BrakeDisc/.test(name)) return mats.disc;
    if (/Rim$/.test(name)) return mats.rim;
    if (name === 'BodyHood') return mats.hood;
    switch (mname) {
      case 'Paint 1': return mats.paint;
      case 'Paint 2': return mats.paint2;
      case 'Glass': return mats.glass;
      case 'Tireside': case 'Tiretread': return mats.tire;
      case 'Mirror': return mats.mirror;
      case 'Interior 1': case 'Interior 3': case 'Dashboard': return mats.inner;
      default: return /^Interior/.test(name) ? mats.inner : mats.dark;
    }
  };

  const car = new THREE.Group();
  scene.add(car);
  const wheels = [];
  let hood = null;

  const batt = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.45, emissive: BLUE, emissiveIntensity: 0.25 });
  const bBox = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.26, 0.3, 4, 0.035), bMat);
  const tMat = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.4, emissive: YELLOW, emissiveIntensity: 0.3 });
  const term = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 20), tMat);
  term.position.set(0.14, 0.15, 0.06);
  const term2 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 20), new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.4 }));
  term2.position.set(-0.14, 0.15, 0.06);
  batt.add(bBox, term, term2);
  batt.position.set(0.42, 0.6, 1.72);
  batt.scale.setScalar(0.001);
  car.add(batt);

  const beamTex = gradTex([[0, 'rgba(63,122,224,.9)'], [0.4, 'rgba(63,122,224,.3)'], [1, 'rgba(63,122,224,0)']]);
  beamTex.center.set(0.5, 0.5);
  beamTex.rotation = Math.PI / 2;
  const beamMat = new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
  const beams = new THREE.Group();
  [-0.62, 0.62].forEach(x => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.62, 2.6, 32, 1, true), beamMat);
    b.rotation.x = Math.PI / 2;
    b.position.set(x * 0.95, 0.62, 2.25 + 1.3);
    beams.add(b);
  });
  car.add(beams);

  const airN = 260;
  const airPos = new Float32Array(airN * 3);
  const airSeed = new Float32Array(airN * 3);
  for (let k = 0; k < airN; k++) {
    airSeed[k * 3] = (Math.random() - 0.5) * 1.15;
    airSeed[k * 3 + 1] = 0.62 + Math.random() * 0.4;
    airSeed[k * 3 + 2] = Math.random();
  }
  const airGeo = new THREE.BufferGeometry();
  airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3));
  const airMat = new THREE.PointsMaterial({ size: 0.06, map: gradTex([[0, 'rgba(63,122,224,1)'], [1, 'rgba(63,122,224,0)']], 64, 4, true), transparent: true, opacity: 0, depthWrite: false, color: 0xffffff });
  const air = new THREE.Points(airGeo, airMat);
  car.add(air);

  const dish = new THREE.Group();
  const dMat = new THREE.MeshPhysicalMaterial({ color: 0x9fb4d6, roughness: 0.3, clearcoat: 0.7 });
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.035, 0.44, 4, 0.016), dMat);
  plate.castShadow = true;
  const mount = new THREE.Mesh(new RoundedBoxGeometry(0.08, 0.05, 0.08, 2, 0.01), mats.dark);
  mount.position.y = -0.035;
  dish.add(plate, mount);
  dish.position.set(0, 1.235, -0.12);
  dish.rotation.x = -0.12;
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.008, 8, 96), new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0, depthWrite: false }));
    r.rotation.x = Math.PI / 2;
    dish.add(r);
    rings.push(r);
  }
  dish.scale.setScalar(0.001);
  car.add(dish);

  const cur = { cam: new THREE.Vector3(...KEYS[0].cam), tgt: new THREE.Vector3(...KEYS[0].tgt) };
  FX.forEach(k => { cur[k] = 0; });
  const goal = { cam: new THREE.Vector3(), tgt: new THREE.Vector3() };
  FX.forEach(k => { goal[k] = 0; });

  let W = 0;
  let H = 0;
  const size = () => {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = camera.aspect >= 1.5 ? 30 : Math.min(62, (2 * Math.atan(Math.tan(Math.PI / 12) * 1.5 / camera.aspect) * 180) / Math.PI);
    const narrow = W < 760;
    if (narrow) camera.setViewOffset(W, H, 0, H * 0.17, W, H);
    else camera.setViewOffset(W, H, -W * 0.2, H * 0.02, W, H);
    camera.updateProjectionMatrix();
    measure();
  };

  let centers = [];
  const measure = () => {
    const y = window.scrollY;
    centers = chapters.map(c => {
      const r = c.getBoundingClientRect();
      return r.top + y + Math.min(r.height, window.innerHeight) / 2 + Math.max(0, r.height - window.innerHeight) / 2;
    });
  };

  const progress = () => {
    if (STILL !== null) return STILL;
    const y = window.scrollY + window.innerHeight / 2;
    if (!centers.length) return 0;
    if (y <= centers[0]) return 0;
    for (let k = 0; k < centers.length - 1; k++) {
      if (y < centers[k + 1]) return k + (y - centers[k]) / (centers[k + 1] - centers[k]);
    }
    return centers.length - 1;
  };

  const ease = f => {
    const x = Math.min(1, Math.max(0, (f - 0.18) / 0.64));
    return x * x * (3 - 2 * x);
  };
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const setGoal = p => {
    const i = Math.min(KEYS.length - 1, Math.floor(p));
    const j = Math.min(KEYS.length - 1, i + 1);
    const f = ease(p - i);
    const a = KEYS[i];
    const b = KEYS[j];
    const sa = new THREE.Spherical().setFromVector3(vA.fromArray(a.cam).sub(vB.fromArray(a.tgt)));
    const sb = new THREE.Spherical().setFromVector3(vA.fromArray(b.cam).sub(vB.fromArray(b.tgt)));
    let dt = sb.theta - sa.theta;
    if (dt > Math.PI) dt -= Math.PI * 2;
    if (dt < -Math.PI) dt += Math.PI * 2;
    const s = new THREE.Spherical(sa.radius + (sb.radius - sa.radius) * f, sa.phi + (sb.phi - sa.phi) * f, sa.theta + dt * f);
    goal.tgt.fromArray(a.tgt).lerp(vB.fromArray(b.tgt), f);
    goal.cam.setFromSpherical(s).add(goal.tgt);
    FX.forEach(k => { goal[k] = (a[k] || 0) * (1 - f) + (b[k] || 0) * f; });
    return Math.round(p);
  };

  let active = -1;
  const mark = n => {
    if (n === active) return;
    active = n;
    chapters.forEach((c, k) => c.classList.toggle('on', k === n));
    railLinks.forEach((a, k) => {
      if (k + 1 === n) a.setAttribute('aria-current', 'step');
      else a.removeAttribute('aria-current');
    });
    story.dataset.ch = String(n);
  };

  let t = 0;
  let last = performance.now();
  let running = false;
  let ready = false;
  const sw = new THREE.Spherical();

  const frame = now => {
    if (!running) return;
    const dt = Math.min(0.12, (now - last) / 1000);
    last = now;
    t += dt;
    const pr = progress();
    mark(setGoal(pr));
    if (progEl) progEl.style.transform = `scaleX(${pr / (KEYS.length - 1)})`;
    const k = STILL !== null ? 1 : 1 - Math.exp(-dt * 3.4);
    cur.cam.lerp(goal.cam, k);
    cur.tgt.lerp(goal.tgt, k);
    FX.forEach(n => { cur[n] += (goal[n] - cur[n]) * k; });
    vA.copy(cur.cam).sub(cur.tgt);
    sw.setFromVector3(vA);
    if (STILL === null) sw.theta += Math.sin(t * 0.32) * 0.035;
    camera.position.setFromSpherical(sw).add(cur.tgt);
    camera.lookAt(cur.tgt);

    mats.hood.opacity = 1 - cur.hood * 0.78;
    mats.hood.depthWrite = cur.hood < 0.5;
    const bs = Math.max(0.001, cur.batt);
    batt.scale.setScalar(0.85 + bs * 0.15);
    batt.visible = cur.batt > 0.02;
    bMat.emissiveIntensity = 0.2 + cur.batt * (0.5 + Math.sin(t * 3) * 0.15);
    mats.hood.color.lerpColors(PAINT, GLOW, cur.batt * 0.25);

    mats.lamp.emissive.copy(GLOW).multiplyScalar(cur.light * 1.6);
    beamMat.opacity = cur.light * 0.42;
    mats.lamp.color.lerpColors(LAMP, GLOW, cur.light);
    beams.visible = cur.light > 0.02;

    mats.glass.opacity = 0.72 - cur.ac * 0.5;
    airMat.opacity = cur.ac * 0.9;
    air.visible = cur.ac > 0.02;
    if (air.visible) {
      for (let n = 0; n < airN; n++) {
        const ph = (airSeed[n * 3 + 2] + t * 0.18) % 1;
        airPos[n * 3] = airSeed[n * 3] * (0.55 + ph * 0.45);
        airPos[n * 3 + 1] = airSeed[n * 3 + 1] + Math.sin(ph * 6.28 + n) * 0.03;
        airPos[n * 3 + 2] = 1.25 - ph * 1.45;
      }
      airGeo.attributes.position.needsUpdate = true;
    }

    mats.rim.color.lerpColors(RIM, BLUE, cur.susp * 0.55);
    mats.disc.emissive.copy(GLOW).multiplyScalar(cur.susp * 0.5);
    mats.caliper.emissive.copy(GLOW).multiplyScalar(cur.susp * 0.6);
    const spin = cur.spin * dt * 9;
    wheels.forEach(w => { w.rotation.x += spin; });
    car.position.y = cur.susp * Math.sin(t * 2.2) * 0.012;

    uni.uScanAmt.value = cur.scan;
    uni.uScan.value = STILL !== null ? 0.6 : -2.6 + ((t * 0.55) % 1) * 5.6;

    pack.material.opacity = cur.ev * (0.75 + Math.sin(t * 2.4) * 0.2);
    pack.visible = cur.ev > 0.02;

    const ds = Math.max(0.001, cur.star);
    dish.scale.setScalar(ds < 0.01 ? 0.001 : 0.7 + ds * 0.3);
    dish.visible = cur.star > 0.02;
    rings.forEach((r, n) => {
      const ph = (t * 0.45 + n / 3) % 1;
      r.position.y = 0.05 + ph * 0.7;
      r.scale.setScalar(0.4 + ph * 1.2);
      r.material.opacity = cur.star * (1 - ph) * 0.8;
    });

    road.material.opacity = cur.road * 0.55;
    road.visible = road2.visible = cur.road > 0.02;
    rTex.offset.y -= cur.road * dt * 1.6;

    renderer.render(scene, camera);
    if (STILL !== null && ready) {
      window.__still = true;
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  };

  const run = on => {
    if (on === running) return;
    running = on;
    if (on) {
      last = performance.now();
      requestAnimationFrame(frame);
    }
  };

  const draco = new DRACOLoader();
  draco.setDecoderPath(BASE.draco || 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
  const loader = new GLTFLoader();
  loader.setDRACOLoader(draco);
  loader.load(BASE.model || 'assets/car.glb', g => {
    const m = g.scene;
    m.traverse(o => {
      if (o.name === 'BodyHood') hood = o;
      if (/^Wheel(Front|Rear)[LR]$/.test(o.name)) wheels.push(o);
      if (!o.isMesh) return;
      const pName = o.name || (o.parent && o.parent.name) || '';
      o.material = pick(pName, o.material && o.material.name);
      o.castShadow = o.material !== mats.glass;
      o.receiveShadow = o.material !== mats.glass;
    });
    car.add(m);
    ready = true;
    size();
    renderer.compile(scene, camera);
    requestAnimationFrame(() => stage.classList.add('ready'));
    if (STILL !== null) run(true);
  }, undefined, () => fail());

  if (STILL !== null) {
    size();
    return;
  }

  const ro = new ResizeObserver(() => size());
  ro.observe(stage);
  window.addEventListener('load', measure);
  if (document.fonts) document.fonts.ready.then(measure);
  new ResizeObserver(measure).observe(story);
  const io = new IntersectionObserver(([e]) => run(e.isIntersecting && !document.hidden), { rootMargin: '100px 0px' });
  io.observe(story);
  document.addEventListener('visibilitychange', () => {
    const r = story.getBoundingClientRect();
    run(!document.hidden && r.bottom > 0 && r.top < window.innerHeight);
  });
  size();
}
