// "Visits per day: a satin ribbon with a dot for every visitor", from who-saw-your-page/index.html.
// The scene code is unchanged apart from taking its data as an argument and cleaning up on dispose.
import * as THREE from "three";

export type RibbonData = { days: [string, number][]; unitWord: string };

const INK = 0x141414;
const ripple = (x: number) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };

const DOT_VERT = `
    attribute float aDay; attribute float aToday; attribute float aSeed;
    uniform float uTime; uniform float uHover; uniform float uPR; uniform float uShow;
    varying float vA; varying float vToday;
    void main(){
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      float pulse = aToday * (0.5 + 0.5 * sin(uTime * 2.6 + aSeed * 6.28));
      gl_PointSize = (4.0 + aToday * 1.5 + pulse * 2.0) * uPR;
      float on = uHover < 0.0 ? 1.0 : (abs(aDay - uHover) < 0.5 ? 1.0 : 0.18);
      vA = uShow * on; vToday = aToday;
    }`;
const DOT_FRAG = `
    uniform vec3 uInk; varying float vA; varying float vToday;
    void main(){
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float core = smoothstep(0.5, 0.34, d) * 0.88;
      float halo = vToday * smoothstep(0.5, 0.0, d) * 0.25;
      gl_FragColor = vec4(uInk, max(core, halo) * vA);
    }`;

/** Draws the ribbon into host (which holds a canvas). Returns a dispose function. */
export function mountRibbon(host: HTMLElement, DATA: RibbonData): () => void {
  const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TODAY = DATA.days.length - 1;
  const canvas = host.querySelector("canvas")!;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(24, 1, 0.1, 100);

  // Soft studio reflections so the satin catches light along its folds
  const env = new THREE.Scene();
  const panel = (c: number, w: number, h: number, x: number, y: number, z: number) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m); };
  panel(0xffffff, 8, 1.5, 0, 5, 3); panel(0xffe2b8, 3, 5, -6, 2, 2); panel(0x9a9a9a, 3, 4, 6, 1, -2);
  const pmrem = new THREE.PMREMGenerator(r);
  scene.environment = pmrem.fromScene(env, 0.04).texture;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a6a48, 0.5));
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.9); sun.position.set(-2, 8, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); sun.shadow.radius = 8;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 4, bottom: -3, near: 1, far: 20 });
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 10), new THREE.ShadowMaterial({ opacity: 0.14 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // The ribbon's spine runs through each day's value
  const n = DATA.days.length, gap = 1.2, peak = Math.max(1, ...DATA.days.map((d) => d[1]));
  const dayX = (i: number) => (i - (n - 1) / 2) * gap;
  const pts = DATA.days.map((d, i) => new THREE.Vector3(dayX(i), 0.45 + (d[1] / peak) * 1.9, 0));
  pts.unshift(new THREE.Vector3(dayX(0) - gap * 0.75, pts[0].y * 0.7, 0));
  pts.push(new THREE.Vector3(dayX(n - 1) + gap * 0.75, pts[pts.length - 1].y * 0.7, 0));
  const SEG = 260, ROWS = 14, WIDTH = 1.1;
  const spine = new THREE.CatmullRomCurve3(pts, false, "centripetal").getPoints(SEG);
  const baseY = (x: number) => { // height of the spine at x
    for (let i = 1; i < spine.length; i++) if (spine[i].x >= x) { const a = spine[i - 1], b = spine[i], k = (x - a.x) / (b.x - a.x || 1); return a.y + (b.y - a.y) * k; }
    return spine[spine.length - 1].y;
  };
  const fold = (x: number, z: number, t: number) => z * Math.sin(x * 0.75 + t * 0.55) * 0.42 + Math.sin(x * 1.6 - t * 0.9 + z * 2.5) * 0.045;

  const geo = new THREE.PlaneGeometry(1, 1, SEG, ROWS - 1), pos = geo.attributes.position as THREE.BufferAttribute;
  const satinMat = new THREE.MeshPhysicalMaterial({ color: INK, roughness: 0.38, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  const satin = new THREE.Mesh(geo, satinMat);
  satin.castShadow = true; scene.add(satin);

  // One dot per visitor, floating over the day they came
  const total = DATA.days.reduce((s, d) => s + d[1], 0);
  const dpos = new Float32Array(total * 3), aDay = new Float32Array(total), aToday = new Float32Array(total), aSeed = new Float32Array(total);
  const off: { x: number; z: number; lift: number; s: number }[] = [];
  let k = 0;
  DATA.days.forEach((d, i) => {
    for (let j = 0; j < d[1]; j++, k++) {
      const s = ((k * 0.618034) % 1), s2 = ((k * 0.414214) % 1);
      aDay[k] = i; aToday[k] = i === TODAY ? 1 : 0; aSeed[k] = s;
      off.push({ x: dayX(i) + (s - 0.5) * gap * 0.78, z: (s2 - 0.5) * WIDTH * 0.9, lift: 0.22 + s2 * 0.5, s });
    }
  });
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
  dg.setAttribute("aDay", new THREE.BufferAttribute(aDay, 1));
  dg.setAttribute("aToday", new THREE.BufferAttribute(aToday, 1));
  dg.setAttribute("aSeed", new THREE.BufferAttribute(aSeed, 1));
  const du = { uTime: { value: 0 }, uHover: { value: -1 }, uPR: { value: r.getPixelRatio() }, uShow: { value: 0 }, uInk: { value: new THREE.Color(INK) } };
  const dotMat = new THREE.ShaderMaterial({ uniforms: du, vertexShader: DOT_VERT, fragmentShader: DOT_FRAG, transparent: true, depthWrite: false });
  const dots = new THREE.Points(dg, dotMat);
  dots.frustumCulled = false; scene.add(dots);

  // Day names under the ribbon; a number over the busiest day, or the hovered one
  const labels = DATA.days.map((d) => {
    const lbl = document.createElement("span"); lbl.className = "lbl"; lbl.textContent = d[0]; host.appendChild(lbl);
    const val = document.createElement("span"); val.className = "val"; val.innerHTML = d[1] + "<small>" + DATA.unitWord + "</small>"; host.appendChild(val);
    return { lbl, val };
  });
  const peakDay = DATA.days.findIndex((d) => d[1] === peak);

  let hover = -1, px = 0, dist = 11;
  const v = new THREE.Vector3();
  const onMove = (e: PointerEvent) => {
    const b = host.getBoundingClientRect(); px = ((e.clientX - b.left) / b.width) * 2 - 1;
    let best = -1, bd = Infinity; // nearest day column on screen
    DATA.days.forEach((_d, i) => { v.set(dayX(i), 0, 0).project(cam); const dx = Math.abs((v.x * 0.5 + 0.5) * b.width - (e.clientX - b.left)); if (dx < bd) { bd = dx; best = i; } });
    hover = best;
  };
  const onLeave = () => { hover = -1; px = 0; };
  host.addEventListener("pointermove", onMove);
  host.addEventListener("pointerleave", onLeave);

  function frame() {
    const w = host.clientWidth, h = host.clientHeight;
    r.setSize(w, h, false); cam.aspect = w / h;
    const span = n * gap + 1.2; // pull back until the whole week fits the card
    dist = Math.max(10, (span / 2 / Math.tan((cam.fov * Math.PI) / 360) / cam.aspect) * 1.02);
    cam.updateProjectionMatrix();
  }
  frame();
  const ro = new ResizeObserver(frame); ro.observe(host);

  const t0 = performance.now();
  let raf = 0;
  (function tick(now: number) {
    const t = REDUCED ? 0 : (now - t0) / 1000, w = host.clientWidth, h = host.clientHeight;
    const grow = REDUCED ? 1 : Math.max(0.02, ripple(Math.min(1, Math.max(0, (now - t0 - 200) / 1400))));
    cam.position.set(cam.position.x + (px * 0.7 - cam.position.x) * 0.05, dist * 0.22, dist);
    cam.lookAt(0, 1.05, 0); cam.updateMatrixWorld();

    // drape the satin over the spine
    for (let row = 0; row < ROWS; row++) {
      const z = (row / (ROWS - 1) - 0.5) * WIDTH;
      for (let c = 0; c <= SEG; c++) { const x = spine[c].x; pos.setXYZ(row * (SEG + 1) + c, x, 0.12 + (spine[c].y - 0.12) * grow + fold(x, z, t), z); }
    }
    pos.needsUpdate = true; geo.computeVertexNormals();

    // dots ride just above the surface
    off.forEach((o, i) => {
      const y = 0.12 + (baseY(o.x) - 0.12) * grow + fold(o.x, o.z, t) + o.lift + Math.sin(t * 0.9 + o.s * 6.28) * 0.05;
      dpos[i * 3] = o.x + Math.sin(t * 0.4 + o.s * 9) * 0.04; dpos[i * 3 + 1] = y; dpos[i * 3 + 2] = o.z;
    });
    dg.attributes.position.needsUpdate = true;
    du.uTime.value = t; du.uHover.value = hover; du.uShow.value = REDUCED ? 1 : Math.min(1, Math.max(0, (now - t0 - 900) / 900));

    labels.forEach((l, i) => {
      v.set(dayX(i), -0.1, 0).project(cam);
      l.lbl.style.left = (v.x * 0.5 + 0.5) * w + "px"; l.lbl.style.top = (-v.y * 0.5 + 0.5) * h + 4 + "px";
      l.lbl.style.opacity = hover < 0 || hover === i ? "1" : "0.34";
      v.set(dayX(i), 0.12 + (baseY(dayX(i)) - 0.12) * grow + 0.95, 0).project(cam);
      l.val.style.left = (v.x * 0.5 + 0.5) * w + "px"; l.val.style.top = (-v.y * 0.5 + 0.5) * h + "px";
      l.val.style.opacity = grow >= 0.99 && (hover < 0 ? i === peakDay : i === hover) ? "1" : "0";
    });
    r.render(scene, cam);
    raf = requestAnimationFrame(tick);
  })(t0);

  return () => {
    cancelAnimationFrame(raf); ro.disconnect();
    host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave);
    labels.forEach((l) => { l.lbl.remove(); l.val.remove(); });
    geo.dispose(); satinMat.dispose(); dg.dispose(); dotMat.dispose(); floor.geometry.dispose();
    scene.environment?.dispose(); pmrem.dispose(); r.dispose();
  };
}
