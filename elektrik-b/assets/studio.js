import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeVertices, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

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
const RIM = new THREE.Color(0xc9d0da);
const LAMP_Z = 2.2;
const LAMP_Y = 0.71;
const LAMP_X = 0.6;

const KEYS = [
  { cam: [5.7, 2.05, 6.3], tgt: [0, 0.62, 0.1] },
  { cam: [3.0, 3.3, 6.4], tgt: [0, 0.6, 1.3], batt: 1 },
  { cam: [3.6, 1.35, 7.4], tgt: [0.9, 0.5, 2.0], light: 1 },
  { cam: [5.2, 3.5, 4.0], tgt: [0, 0.9, 0.15], ac: 1 },
  { cam: [4.7, 0.9, 4.4], tgt: [0.6, 0.42, 1.2], susp: 1, spin: 0.35 },
  { cam: [7.8, 2.2, 0.9], tgt: [0, 0.65, 0.05], scan: 1 },
  { cam: [-6.5, 2.2, -6.0], tgt: [0, 0.55, -0.3], ev: 1 },
  { cam: [5.6, 6.0, 5.2], tgt: [0, 0.9, -0.3], star: 1 },
  { cam: [8.8, 1.5, 1.9], tgt: [0, 0.6, 0.2], road: 1, spin: 1 },
];
const FX = ['batt', 'light', 'ac', 'susp', 'scan', 'ev', 'star', 'road', 'spin'];

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

function radial(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
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
  g.strokeStyle = 'rgba(63,122,224,.9)';
  g.shadowColor = 'rgba(93,147,255,.9)';
  g.shadowBlur = 18;
  g.lineWidth = 4;
  g.beginPath();
  g.roundRect(70, 70, s - 140, s * 2 - 140, 60);
  g.stroke();
  g.shadowBlur = 0;
  g.lineWidth = 2;
  g.strokeStyle = 'rgba(63,122,224,.35)';
  for (let k = 1; k < 10; k++) {
    const y = 70 + ((s * 2 - 140) * k) / 10;
    g.beginPath();
    g.moveTo(110, y);
    g.lineTo(s - 110, y);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTex() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 512;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 300);
  gr.addColorStop(0, 'rgba(47,103,198,0)');
  gr.addColorStop(0.5, 'rgba(47,103,198,.85)');
  gr.addColorStop(1, 'rgba(47,103,198,0)');
  g.fillStyle = gr;
  g.fillRect(13, 0, 6, 300);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function beamMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uAmt: { value: 0 }, uCol: { value: new THREE.Color('#8fb4ff') } },
    vertexShader: 'varying float vT; varying vec3 vN; varying vec3 vV; void main(){ vT = 0.5 - position.y / 3.6; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform float uAmt; uniform vec3 uCol; varying float vT; varying vec3 vN; varying vec3 vV; void main(){ float along = pow(1.0 - clamp(vT,0.0,1.0), 2.2); float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.6); gl_FragColor = vec4(uCol, along * edge * uAmt); }',
  });
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
  renderer.setPixelRatio(STILL !== null ? 1 : Math.min(window.devicePixelRatio || 1, small.matches ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);
  const key = new THREE.DirectionalLight(0xffffff, 1.9);
  key.position.set(3.5, 8, 4.5);
  key.castShadow = true;
  key.shadow.mapSize.set(small.matches ? 1024 : 2048, small.matches ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  key.shadow.radius = 10;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdfe8ff, 0.8);
  rim.position.set(-5, 3, -4);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xdfe5ee, 0.5));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ color: 0x1a2c4d, opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const flat = (tex, w, h, opacity = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  };
  const blob = flat(radial([[0, 'rgba(14,26,52,.7)'], [0.35, 'rgba(14,26,52,.38)'], [0.7, 'rgba(14,26,52,.08)'], [1, 'rgba(14,26,52,0)']]), 2.7, 5.6);
  blob.position.set(0, 0.002, 0);
  scene.add(blob);

  const pack = flat(packTex(), 1.55, 3.3, 0);
  pack.position.set(0, 0.004, -0.02);
  scene.add(pack);

  const rTex = roadTex();
  rTex.repeat.set(1, 5);
  const road = flat(rTex, 0.08, 30, 0);
  road.position.set(1.55, 0.004, 0);
  const road2 = road.clone();
  road2.material = road.material;
  road2.position.x = -1.55;
  scene.add(road, road2);

  const uni = { uScan: { value: -4 }, uScanAmt: { value: 0 }, uFront: { value: 0 }, uGlow: { value: new THREE.Color('#3f7ae0') } };
  const patch = (m, front) => {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { uScan: uni.uScan, uScanAmt: uni.uScanAmt, uGlow: uni.uGlow, uFront: uni.uFront });
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWp;').replace('#include <project_vertex>', '#include <project_vertex>\nvWp = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWp;\nuniform float uScan;\nuniform float uScanAmt;\nuniform float uFront;\nuniform vec3 uGlow;')
        .replace('#include <dithering_fragment>', `float bd = vWp.z - uScan;
float bnd = clamp(exp(-bd * bd / 0.0016) * 0.55 + exp(-bd * bd / 0.16) * 0.1, 0.0, 1.0) * uScanAmt;
gl_FragColor.rgb = mix(gl_FragColor.rgb, uGlow, bnd);
${front ? 'float fr = smoothstep(0.75, 1.25, vWp.z) * uFront; gl_FragColor.a *= 1.0 - fr * 0.82; gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.86,0.9,0.97), fr * 0.3);' : ''}
#include <dithering_fragment>`);
    };
    return m;
  };

  const mats = {
    paint: patch(new THREE.MeshPhysicalMaterial({ color: 0xf2f4f7, roughness: 0.34, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.18, transparent: true }), true),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x101a2c, roughness: 0.05, metalness: 0.35, envMapIntensity: 1.4, transparent: true, opacity: 0.86 }),
    tire: new THREE.MeshStandardMaterial({ color: 0x1a1f29, roughness: 0.9 }),
    rim: new THREE.MeshPhysicalMaterial({ color: RIM, roughness: 0.28, metalness: 0.6, clearcoat: 0.5 }),
    hub: new THREE.MeshStandardMaterial({ color: 0x8e99a8, roughness: 0.35, metalness: 0.7 }),
    trim: patch(new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.55, metalness: 0.2 }), false),
    port: new THREE.MeshStandardMaterial({ color: 0x9fb4d6, roughness: 0.3, emissive: 0x000000 }),
  };
  const pick = (mname, node) => {
    if (/glass/.test(mname)) return mats.glass;
    if (/tire/.test(mname)) return mats.tire;
    if (/rim/.test(mname) && !/ring/.test(mname)) return mats.rim;
    if (/hubcap/.test(mname)) return mats.hub;
    if (/ring/.test(mname)) return mats.port;
    if (/charcoal/.test(mname)) return /wheel/.test(node) ? mats.hub : mats.trim;
    return mats.paint;
  };

  const car = new THREE.Group();
  scene.add(car);
  const wheels = [];

  const lampMat = new THREE.MeshStandardMaterial({ color: 0xdfe8f7, roughness: 0.2, metalness: 0.2, emissive: GLOW, emissiveIntensity: 0 });
  const halo = radial([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(170,200,255,.85)'], [0.5, 'rgba(110,155,255,.25)'], [1, 'rgba(110,155,255,0)']], 128);
  const beamMat = beamMaterial();
  const pool = radial([[0, 'rgba(93,147,255,.55)'], [0.5, 'rgba(93,147,255,.18)'], [1, 'rgba(93,147,255,0)']]);
  const lights = new THREE.Group();
  const halos = [];
  const pools = [];
  [-1, 1].forEach(sx => {
    const strip = new THREE.Mesh(new RoundedBoxGeometry(0.36, 0.035, 0.05, 2, 0.015), lampMat);
    strip.position.set(sx * LAMP_X, LAMP_Y, LAMP_Z);
    strip.rotation.y = sx * -0.32;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, opacity: 0, depthWrite: false }));
    sp.position.set(sx * LAMP_X, LAMP_Y, LAMP_Z + 0.08);
    sp.scale.set(0.42, 0.2, 1);
    halos.push(sp);
    const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.6, 3.6, 40, 1, true), beamMat);
    cone.rotation.x = -Math.PI / 2;
    cone.position.set(sx * LAMP_X * 1.05, LAMP_Y - 0.1, LAMP_Z + 0.12 + 1.8);
    cone.rotation.z = sx * 0.04;
    const pl = flat(pool, 1.1, 1.9, 0);
    pl.position.set(sx * 0.7, 0.006, LAMP_Z + 1.5);
    pools.push(pl);
    lights.add(strip, sp, cone, pl);
  });
  car.add(lights);

  const batt = new THREE.Group();
  const bMat = new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.45, emissive: BLUE, emissiveIntensity: 0.25 });
  const bBox = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.24, 0.28, 4, 0.035), bMat);
  const tMat = new THREE.MeshStandardMaterial({ color: YELLOW, roughness: 0.4, emissive: YELLOW, emissiveIntensity: 0.3 });
  const term = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 20), tMat);
  term.position.set(0.13, 0.14, 0.06);
  const term2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.045, 20), new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.4 }));
  term2.position.set(-0.13, 0.14, 0.06);
  batt.add(bBox, term, term2);
  batt.position.set(0.35, 0.58, 1.65);
  car.add(batt);

  const airN = 180;
  const airPos = new Float32Array(airN * 3);
  const airSeed = new Float32Array(airN * 3);
  for (let k = 0; k < airN; k++) {
    airSeed[k * 3] = (Math.random() - 0.5) * 1.1;
    airSeed[k * 3 + 1] = 0.85 + Math.random() * 0.35;
    airSeed[k * 3 + 2] = Math.random();
  }
  const airGeo = new THREE.BufferGeometry();
  airGeo.setAttribute('position', new THREE.BufferAttribute(airPos, 3));
  const airMat = new THREE.PointsMaterial({ size: 0.035, map: radial([[0, 'rgba(120,170,255,1)'], [1, 'rgba(120,170,255,0)']], 64), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const air = new THREE.Points(airGeo, airMat);
  car.add(air);

  const portHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, transparent: true, opacity: 0, depthWrite: false }));
  portHalo.position.set(0.86, 0.8, -1.9);
  portHalo.scale.setScalar(0.5);
  car.add(portHalo);

  const dish = new THREE.Group();
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.03, 0.42, 4, 0.014), new THREE.MeshPhysicalMaterial({ color: 0xe8edf4, roughness: 0.3, clearcoat: 0.7 }));
  plate.castShadow = true;
  const edge = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.012, 0.44, 4, 0.006), new THREE.MeshStandardMaterial({ color: BLUE, roughness: 0.4 }));
  edge.position.y = -0.018;
  dish.add(plate, edge);
  dish.position.set(0, 1.475, -0.42);
  dish.rotation.x = -0.06;
  const rings = [];
  for (let k = 0; k < 3; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.0035, 6, 96), new THREE.MeshBasicMaterial({ color: GLOW, transparent: true, opacity: 0, depthWrite: false }));
    r.rotation.x = Math.PI / 2;
    dish.add(r);
    rings.push(r);
  }
  car.add(dish);

  const cur = { cam: new THREE.Vector3(...KEYS[0].cam), tgt: new THREE.Vector3(...KEYS[0].tgt) };
  const goal = { cam: new THREE.Vector3(), tgt: new THREE.Vector3() };
  FX.forEach(k => { cur[k] = 0; goal[k] = 0; });

  let W = 0;
  let H = 0;
  let centers = [];
  const measure = () => {
    const y = window.scrollY;
    centers = chapters.map(c => {
      const r = c.getBoundingClientRect();
      return r.top + y + Math.min(r.height, window.innerHeight) / 2 + Math.max(0, r.height - window.innerHeight) / 2;
    });
  };
  const size = () => {
    const r = stage.getBoundingClientRect();
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.fov = camera.aspect >= 1.5 ? 30 : Math.min(62, (2 * Math.atan(Math.tan(Math.PI / 12) * 1.5 / camera.aspect) * 180) / Math.PI);
    if (W < 760) camera.setViewOffset(W, H, 0, H * 0.17, W, H);
    else camera.setViewOffset(W, H, -W * 0.2, H * 0.02, W, H);
    camera.updateProjectionMatrix();
    measure();
  };

  const progress = () => {
    if (STILL !== null) return STILL;
    const y = window.scrollY + window.innerHeight / 2;
    if (!centers.length || y <= centers[0]) return 0;
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
  const sa = new THREE.Spherical();
  const sb = new THREE.Spherical();
  const setGoal = p => {
    const i = Math.min(KEYS.length - 1, Math.floor(p));
    const j = Math.min(KEYS.length - 1, i + 1);
    const f = ease(p - i);
    const a = KEYS[i];
    const b = KEYS[j];
    sa.setFromVector3(vA.fromArray(a.cam).sub(vB.fromArray(a.tgt)));
    sb.setFromVector3(vA.fromArray(b.cam).sub(vB.fromArray(b.tgt)));
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
    sw.setFromVector3(vA.copy(cur.cam).sub(cur.tgt));
    if (STILL === null) sw.theta += Math.sin(t * 0.32) * 0.03;
    sw.radius *= 1.24;
    camera.position.setFromSpherical(sw).add(cur.tgt);
    camera.lookAt(cur.tgt);

    uni.uFront.value = cur.batt;
    mats.paint.depthWrite = cur.batt < 0.4;
    batt.visible = cur.batt > 0.02;
    batt.scale.setScalar(0.9 + cur.batt * 0.1);
    bMat.emissiveIntensity = 0.2 + cur.batt * (0.45 + Math.sin(t * 3) * 0.12);

    const L = cur.light;
    lampMat.emissiveIntensity = 0.15 + L * 2.4;
    halos.forEach(h => { h.material.opacity = L * (0.85 + Math.sin(t * 2) * 0.05); });
    beamMat.uniforms.uAmt.value = L * 0.2;
    pools.forEach(p => { p.material.opacity = L * 0.75; });
    lights.children.forEach(o => { if (o.material === beamMat || pools.includes(o)) o.visible = L > 0.02; });

    mats.glass.opacity = 0.86 - cur.ac * 0.42;
    airMat.opacity = cur.ac * 0.7;
    air.visible = cur.ac > 0.02;
    if (air.visible) {
      for (let n = 0; n < airN; n++) {
        const ph = (airSeed[n * 3 + 2] + t * 0.16) % 1;
        airPos[n * 3] = airSeed[n * 3] * (0.55 + ph * 0.45);
        airPos[n * 3 + 1] = airSeed[n * 3 + 1] + Math.sin(ph * 6.28 + n) * 0.025;
        airPos[n * 3 + 2] = 0.95 - ph * 1.7;
      }
      airGeo.attributes.position.needsUpdate = true;
    }

    mats.rim.color.lerpColors(RIM, BLUE, cur.susp * 0.5);
    wheels.forEach(w => { w.rotation.x += cur.spin * dt * 9; });
    car.position.y = cur.susp * Math.sin(t * 2.2) * 0.01;

    uni.uScanAmt.value = cur.scan;
    uni.uScan.value = STILL !== null ? 0.4 : -2.8 + ((t * 0.42) % 1) * 5.6;

    pack.material.opacity = cur.ev * (0.55 + Math.sin(t * 2.2) * 0.12);
    pack.visible = cur.ev > 0.02;
    mats.port.emissive.copy(GLOW).multiplyScalar(cur.ev * 1.4);
    portHalo.material.opacity = cur.ev * 0.8;

    dish.visible = cur.star > 0.02;
    dish.scale.setScalar(0.75 + Math.min(1, cur.star) * 0.25);
    rings.forEach((r, n) => {
      const ph = (t * 0.4 + n / 3) % 1;
      r.position.y = 0.04 + ph * 0.6;
      r.scale.setScalar(0.45 + ph * 1.1);
      r.material.opacity = cur.star * (1 - ph) * 0.7;
    });

    road.material.opacity = cur.road * 0.5;
    road.visible = road2.visible = cur.road > 0.02;
    rTex.offset.y -= cur.road * dt * 1.4;

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
  let tries = 0;
  const load = () => loader.load(BASE.model || 'assets/car.glb', g => {
    const m = g.scene;
    m.traverse(o => {
      if (/_wheel_(fl|fr|rl|rr)$/.test(o.name)) wheels.push(o);
      if (!o.isMesh) return;
      const node = (o.parent && o.parent.name) || o.name;
      const mat = pick((o.material && o.material.name) || '', `${node} ${o.name}`);
      if (mat === mats.paint) {
        let geo = o.geometry.clone();
        geo.deleteAttribute('normal');
        geo = mergeVertices(geo, 1e-4);
        geo = toCreasedNormals(geo, Math.PI / 4.2);
        o.geometry = geo;
      }
      o.material = mat;
      o.castShadow = mat !== mats.glass;
      o.receiveShadow = mat !== mats.glass;
    });
    car.add(m);
    ready = true;
    size();
    renderer.compile(scene, camera);
    requestAnimationFrame(() => stage.classList.add('ready'));
    if (STILL !== null) run(true);
  }, undefined, () => { tries += 1; if (tries < 3) setTimeout(load, 1200 * tries); else fail(); });
  load();

  if (STILL !== null) {
    size();
    return;
  }

  new ResizeObserver(() => size()).observe(stage);
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
