/* Project CV · Super Admin · three.js scenes
   1. Silk: a full-page satin shader behind everything (very low cost, half resolution, 30 fps)
   2. Constellation: every account as a star; arms are colleges, distance from the warm core is reach
   3. Terrain: weekly retention cohorts as a 3D landscape
   Written against three r128 (global THREE). Each scene pauses when off screen and stops moving under reduced motion. */
(function () {
  "use strict";
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGL = (() => {
    try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch (e) { return false; }
  })();
  const ok = () => !!window.THREE && hasGL;

  // Pause a render loop while its element is off screen or the tab is hidden
  function visibility(el, onChange) {
    let inView = true;
    const io = new IntersectionObserver((es) => { inView = es[0].isIntersecting; onChange(inView && !document.hidden); }, { rootMargin: "120px" });
    io.observe(el);
    document.addEventListener("visibilitychange", () => onChange(inView && !document.hidden));
  }

  function radialTexture(stops, size) {
    size = size || 128;
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"), gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    stops.forEach((s) => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.fillRect(0, 0, size, size);
    const t = new THREE.CanvasTexture(c); return t;
  }
  function ringTexture(size) {
    size = size || 128;
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d");
    g.strokeStyle = "rgba(255,255,255,1)"; g.lineWidth = size * 0.035;
    g.beginPath(); g.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2); g.stroke();
    return new THREE.CanvasTexture(c);
  }

  /* ------------------------------------------------------------------ 1. Silk */
  const SILK_FRAG = `
    precision highp float;
    varying vec2 vUv;
    uniform float uTime; uniform vec2 uRes; uniform float uScroll;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
    float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*noise(p); p *= 2.02; a *= 0.5; } return v; }
    float silk(vec2 p, float t){
      float w = fbm(p*0.55 + vec2(t*0.035, -t*0.025));
      float f = sin(p.x*1.5 + p.y*0.85 + w*4.4 + t*0.10);
      f += 0.55*sin(-p.x*0.65 + p.y*2.2 + w*3.0 - t*0.08);
      return f;
    }
    void main(){
      vec2 uv = vUv; float asp = uRes.x / uRes.y;
      vec2 p = vec2(uv.x*asp, uv.y - uScroll*0.18) * 2.1;
      float t = uTime, e = 0.02;
      float h = silk(p, t), hx = silk(p + vec2(e, 0.0), t), hy = silk(p + vec2(0.0, e), t);
      vec3 n = normalize(vec3((h - hx)/e*0.085, (h - hy)/e*0.085, 1.0));
      vec3 L = normalize(vec3(0.55, 0.7, 0.6));
      float diff = clamp(dot(n, L), 0.0, 1.0);
      float spec = pow(clamp(dot(n, normalize(L + vec3(0.0,0.0,1.0))), 0.0, 1.0), 34.0);
      float warm = smoothstep(1.25, 0.0, distance(uv, vec2(0.98, 1.08)));
      float lime = smoothstep(1.15, 0.0, distance(uv, vec2(-0.05, -0.1)));
      vec3 col = vec3(0.008, 0.004, 0.020);
      col += vec3(0.96, 0.62, 0.30) * (diff*0.055 + spec*0.26) * warm;
      col += vec3(0.74, 0.81, 0.40) * (diff*0.022 + spec*0.11) * lime;
      col += vec3(0.035, 0.028, 0.02) * diff;
      float vig = smoothstep(1.3, 0.15, length((uv - vec2(0.5, 0.6)) * vec2(asp*0.75, 1.0)));
      col *= mix(0.5, 1.0, vig);
      col += (hash(uv*uRes + t) - 0.5) / 255.0;
      gl_FragColor = vec4(col, 1.0);
    }`;

  function initSilk(canvas) {
    if (!ok()) return null;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: "low-power" });
    renderer.setPixelRatio(0.5);
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const uniforms = { uTime: { value: 8 }, uRes: { value: new THREE.Vector2(1, 1) }, uScroll: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      uniforms, fragmentShader: SILK_FRAG,
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
      depthTest: false, depthWrite: false
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      uniforms.uRes.value.set(window.innerWidth, window.innerHeight);
    }
    resize(); window.addEventListener("resize", resize);
    let last = 0, running = true;
    document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) requestAnimationFrame(tick); });
    function tick(ts) {
      if (!running) return;
      if (ts - last > 33) {
        last = ts;
        uniforms.uTime.value = 8 + ts / 1000;
        uniforms.uScroll.value += ((window.scrollY / window.innerHeight) - uniforms.uScroll.value) * 0.08;
        renderer.render(scene, camera);
      }
      if (!REDUCED) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    canvas.classList.add("on");
    return { renderer };
  }

  /* ------------------------------------------------------------------ 2. Constellation */
  const STAR_VERT = `
    attribute float aSize; attribute vec3 aColor; attribute float aKind; attribute float aPhase; attribute float aDim;
    uniform float uTime; uniform float uPR; uniform float uIntro;
    varying vec3 vColor; varying float vKind; varying float vAlpha;
    void main(){
      vec4 mv = modelViewMatrix * vec4(position * (0.35 + 0.65*uIntro), 1.0);
      gl_Position = projectionMatrix * mv;
      float tw = 0.82 + 0.18*sin(uTime*(1.2 + aPhase) + aPhase*6.2831);
      gl_PointSize = aSize * tw * uPR * (11.0 / -mv.z) * mix(0.55, 1.0, aDim) * uIntro;
      vColor = aColor; vKind = aKind; vAlpha = mix(0.10, 1.0, aDim);
    }`;
  const STAR_FRAG = `
    varying vec3 vColor; varying float vKind; varying float vAlpha;
    void main(){
      vec2 c = gl_PointCoord - 0.5; float d = length(c);
      if (d > 0.5) discard;
      float a;
      if (vKind > 1.5) {          // disabled: hollow ring
        a = smoothstep(0.5, 0.43, d) * smoothstep(0.26, 0.34, d) * 0.85;
      } else {
        float core = smoothstep(0.16, 0.0, d);
        float halo = pow(smoothstep(0.5, 0.0, d), 2.4) * 0.6;
        a = core + halo;
        if (vKind > 0.5) a *= 1.1;  // on hold: same disc, warm colour
      }
      gl_FragColor = vec4(vColor, a * vAlpha);
    }`;

  function initConstellation(host, opts) {
    if (!ok()) { host.closest(".sky").classList.add("no-webgl"); return null; }
    const D = window.PCV_DATA, users = D.users, N = users.length, NC = D.COLLEGES.length;
    const canvas = host.querySelector("canvas");
    const labelsLayer = host.querySelector(".sky-labels");
    const tip = host.querySelector(".sky-tip");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    const PR = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(PR);
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030205, 0.035);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    const world = new THREE.Group(); scene.add(world);

    // Rank by reach so the most visited sit closest to the warm core
    const order = users.map((u, i) => i).sort((a, b) => users[b].visitors - users[a].visitors);
    const pct = new Float32Array(N); order.forEach((idx, r) => { pct[idx] = r / N; });

    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N),
      kind = new Float32Array(N), phase = new Float32Array(N), dim = new Float32Array(N), dimTarget = new Float32Array(N).fill(1);
    const cLime = new THREE.Color("#bccf67"), cCream = new THREE.Color("#f6e3c0"), cAmber = new THREE.Color("#f0b45a"),
      cCopper = new THREE.Color("#e2834f"), cOlive = new THREE.Color("#727d40"), tmp = new THREE.Color();
    const g = () => { let u = 0; while (!u) u = D.rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * D.rnd()); };
    const armTip = [];
    for (let k = 0; k < NC; k++) armTip.push(new THREE.Vector3());

    for (let i = 0; i < N; i++) {
      const u = users[i];
      const base = (u.college / NC) * Math.PI * 2;
      const r = 0.7 + Math.pow(pct[i], 0.8) * 6.4 + Math.abs(g()) * 0.25;
      const th = base + r * 0.42 + g() * 0.16 * (1 + r * 0.08);
      const y = g() * 0.22 * (1.25 - r / 8);
      pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = y; pos[i * 3 + 2] = Math.sin(th) * r;
      size[i] = 3.2 + Math.log(u.visitors + 2) * 2.1;
      phase[i] = D.rnd();
      if (u.status === "Disabled") { kind[i] = 2; tmp.copy(cOlive); size[i] = 7; }
      else if (u.status === "On hold") { kind[i] = 1; tmp.copy(cAmber); }
      else {
        kind[i] = 0;
        const fame = 1 - pct[i];
        if (fame > 0.96) tmp.copy(cCream).lerp(cAmber, 0.25);
        else if (fame > 0.88) tmp.copy(cLime).lerp(cCream, 0.55);
        else tmp.copy(cLime).multiplyScalar(0.55 + fame * 0.5);
        if (u.lastActive > 30) tmp.multiplyScalar(0.55); // quiet portfolios glow less
      }
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
      dim[i] = 1;
    }
    // Arm label anchors: the outer end of each arm
    for (let k = 0; k < NC; k++) {
      const r = 7.6, th = (k / NC) * Math.PI * 2 + r * 0.42;
      armTip[k].set(Math.cos(th) * r, 0, Math.sin(th) * r);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(col, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(size, 1));
    geo.setAttribute("aKind", new THREE.BufferAttribute(kind, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
    const dimAttr = new THREE.BufferAttribute(dim, 1); dimAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aDim", dimAttr);
    const uniforms = { uTime: { value: 0 }, uPR: { value: PR }, uIntro: { value: REDUCED ? 1 : 0 } };
    const mat = new THREE.ShaderMaterial({ uniforms, vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const stars = new THREE.Points(geo, mat); world.add(stars);

    // Dust: faint background stars for depth
    const DN = 2600, dpos = new Float32Array(DN * 3), dcol = new Float32Array(DN * 3), dsz = new Float32Array(DN), dk = new Float32Array(DN), dph = new Float32Array(DN), ddim = new Float32Array(DN).fill(1);
    for (let i = 0; i < DN; i++) {
      const r = 2 + Math.pow(D.rnd(), 0.6) * 22, th = D.rnd() * Math.PI * 2, ph = (D.rnd() - 0.5) * Math.PI * 0.9;
      dpos[i * 3] = Math.cos(th) * Math.cos(ph) * r; dpos[i * 3 + 1] = Math.sin(ph) * r * 0.55; dpos[i * 3 + 2] = Math.sin(th) * Math.cos(ph) * r;
      tmp.copy(D.rnd() < 0.3 ? cAmber : cLime).multiplyScalar(0.18 + D.rnd() * 0.22);
      dcol[i * 3] = tmp.r; dcol[i * 3 + 1] = tmp.g; dcol[i * 3 + 2] = tmp.b;
      dsz[i] = 1.6 + D.rnd() * 2.2; dph[i] = D.rnd();
    }
    const dgeo = new THREE.BufferGeometry();
    dgeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    dgeo.setAttribute("aColor", new THREE.BufferAttribute(dcol, 3));
    dgeo.setAttribute("aSize", new THREE.BufferAttribute(dsz, 1));
    dgeo.setAttribute("aKind", new THREE.BufferAttribute(dk, 1));
    dgeo.setAttribute("aPhase", new THREE.BufferAttribute(dph, 1));
    dgeo.setAttribute("aDim", new THREE.BufferAttribute(ddim, 1));
    const dust = new THREE.Points(dgeo, mat); world.add(dust);

    // Warm core: the most visited portfolios pool their light here
    const coreMat = new THREE.SpriteMaterial({
      map: radialTexture([[0, "rgba(255,236,200,0.95)"], [0.12, "rgba(246,200,130,0.55)"], [0.35, "rgba(226,131,79,0.18)"], [1, "rgba(226,131,79,0)"]], 256),
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true
    });
    const core = new THREE.Sprite(coreMat); core.scale.set(6.5, 6.5, 1); world.add(core);
    const haloMat = new THREE.SpriteMaterial({ map: radialTexture([[0, "rgba(188,207,103,0.12)"], [0.5, "rgba(188,207,103,0.04)"], [1, "rgba(188,207,103,0)"]], 256), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    const halo = new THREE.Sprite(haloMat); halo.scale.set(22, 22, 1); world.add(halo);

    // Orbit rings: 100, 500, 1000+ visitor bands
    const ringMat = new THREE.LineBasicMaterial({ color: 0x3e4324, transparent: true, opacity: 0.55 });
    [2.4, 4.6, 7.2].forEach((r) => {
      const pts = []; for (let a = 0; a <= 128; a++) { const t = (a / 128) * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r)); }
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), ringMat));
    });

    // Live pulses and the hover marker
    const ringTex = ringTexture(128);
    const pulses = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.SpriteMaterial({ map: ringTex, color: 0xbccf67, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
      const s = new THREE.Sprite(m); s.visible = false; world.add(s); pulses.push({ s, t: 1 });
    }
    const markMat = new THREE.SpriteMaterial({ map: ringTex, color: 0xf6e3c0, transparent: true, opacity: 0, depthWrite: false });
    const marker = new THREE.Sprite(markMat); marker.scale.set(0.5, 0.5, 1); world.add(marker);

    function pulseAt(i, warm) {
      const p = pulses.find((x) => x.t >= 1); if (!p) return;
      p.s.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
      p.s.material.color.set(warm ? 0xf0b45a : 0xbccf67);
      p.s.visible = true; p.t = 0;
    }

    // College labels (HTML, projected each frame)
    const labelEls = D.COLLEGES.map((c) => { const s = document.createElement("span"); s.textContent = c.short; labelsLayer.appendChild(s); return s; });

    // Camera rig
    const rig = { az: -0.6, el: 0.52, dist: REDUCED ? 15 : 34, distTarget: 15, vaz: 0, vel: 0, auto: !REDUCED };
    let W = 1, H = 1;
    function resize() {
      W = host.clientWidth; H = host.clientHeight;
      renderer.setSize(W, H, false); camera.aspect = W / H;
      rig.distTarget = W < 640 ? 19 : 15;
      camera.updateProjectionMatrix();
    }
    resize(); new ResizeObserver(resize).observe(host);

    function placeCamera() {
      const d = rig.dist;
      camera.position.set(Math.cos(rig.el) * Math.sin(rig.az) * d, Math.sin(rig.el) * d, Math.cos(rig.el) * Math.cos(rig.az) * d);
      camera.lookAt(0, -0.4, 0);
    }

    // Pointer: drag to turn, hover to identify, click to open
    let dragging = false, moved = 0, lx = 0, ly = 0, hover = -1, mouse = null, idleAt = 0;
    canvas.addEventListener("pointerdown", (e) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; canvas.classList.add("grabbing"); rig.auto = false; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
      if (dragging) {
        const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
        rig.vaz = -dx * 0.0042; rig.vel = dy * 0.003;
      }
    });
    const endDrag = () => { dragging = false; canvas.classList.remove("grabbing"); idleAt = performance.now(); };
    canvas.addEventListener("pointerup", (e) => { endDrag(); if (moved < 5 && hover >= 0 && opts.onPick) opts.onPick(users[hover]); });
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", () => { mouse = null; });

    const v3 = new THREE.Vector3();
    function findHover() {
      if (!mouse || dragging) return -1;
      let best = -1, bd = 18 * 18;
      for (let i = 0; i < N; i++) {
        if (dimTarget[i] < 0.5) continue;
        v3.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(world.matrixWorld).project(camera);
        if (v3.z > 1) continue;
        const sx = (v3.x * 0.5 + 0.5) * W, sy = (-v3.y * 0.5 + 0.5) * H;
        const dx = sx - mouse.x, dy = sy - mouse.y, dd = dx * dx + dy * dy;
        if (dd < bd) { bd = dd; best = i; }
      }
      return best;
    }
    function showTip(i) {
      if (i < 0) { tip.classList.remove("on"); markMat.opacity = 0; canvas.style.cursor = ""; return; }
      const u = users[i];
      tip.querySelector(".sky-tip__name").textContent = u.name;
      tip.querySelector(".sky-tip__meta").textContent = D.COLLEGES[u.college].name + " · " + u.status + " · " + u.role;
      tip.querySelector("[data-k=projects]").textContent = u.projects;
      tip.querySelector("[data-k=visitors]").textContent = u.visitors.toLocaleString("en-IN");
      tip.querySelector("[data-k=files]").textContent = u.filesOpened.toLocaleString("en-IN");
      v3.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(world.matrixWorld).project(camera);
      let x = (v3.x * 0.5 + 0.5) * W + 18, y = (-v3.y * 0.5 + 0.5) * H - 20;
      const tw = tip.offsetWidth || 240, th = tip.offsetHeight || 120;
      if (x + tw > W - 12) x = x - tw - 36;
      if (y + th > H - 12) y = H - th - 12;
      tip.style.left = Math.max(12, x) + "px"; tip.style.top = Math.max(12, y) + "px";
      tip.classList.add("on");
      marker.position.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]); markMat.opacity = 0.9; canvas.style.cursor = "pointer";
    }

    // Filters (colleges, status) with a satin fade rather than a snap
    let filter = { college: null, status: null };
    function setFilter(f) {
      filter = Object.assign(filter, f);
      for (let i = 0; i < N; i++) {
        const u = users[i];
        const okC = filter.college == null || u.college === filter.college;
        const okS = filter.status == null || u.status === filter.status;
        dimTarget[i] = okC && okS && !u.deleted ? 1 : 0;
      }
      labelEls.forEach((el, k) => { el.style.opacity = filter.college == null || filter.college === k ? "1" : "0.25"; });
      if (filter.college != null && !REDUCED) rig.vaz += 0.02;
    }

    // Live activity hook: the feed calls this when something happens to a portfolio
    function ping(userIndex, warm) { if (userIndex >= 0) pulseAt(userIndex, warm); }

    let running = true, t0 = performance.now(), introStart = performance.now();
    visibility(host, (v) => { const was = running; running = v; if (v && !was) requestAnimationFrame(tick); });
    const ease = (x) => 1 - Math.pow(1 - x, 4);
    function tick(now) {
      if (!running) return;
      const t = (now - t0) / 1000;
      uniforms.uTime.value = REDUCED ? 0 : t;
      if (!REDUCED) {
        const ip = Math.min(1, (now - introStart) / 2600);
        uniforms.uIntro.value = ease(ip);
        if (!dragging && !rig.auto && now - idleAt > 6000) rig.auto = true;
        if (rig.auto) rig.vaz += (-0.0012 - rig.vaz) * 0.02;
        rig.az += rig.vaz; rig.el = Math.max(0.12, Math.min(1.2, rig.el + rig.vel));
        rig.vaz *= dragging ? 0.6 : 0.95; rig.vel *= dragging ? 0.6 : 0.9;
        rig.dist += (rig.distTarget - rig.dist) * 0.035;
      } else { rig.dist = rig.distTarget; }
      placeCamera();
      // dim easing
      let changed = false;
      for (let i = 0; i < N; i++) { const d = dimTarget[i] - dim[i]; if (Math.abs(d) > 0.004) { dim[i] += d * 0.08; changed = true; } }
      if (changed) dimAttr.needsUpdate = true;
      // pulses
      pulses.forEach((p) => {
        if (p.t >= 1) { p.s.visible = false; return; }
        p.t = Math.min(1, p.t + 0.012); const k = ease(p.t);
        p.s.scale.set(0.2 + k * 1.6, 0.2 + k * 1.6, 1); p.s.material.opacity = (1 - p.t) * 0.9;
      });
      core.material.opacity = 0.85 + Math.sin(t * 0.8) * 0.08;
      world.updateMatrixWorld();
      const h = findHover(); if (h !== hover) { hover = h; } showTip(hover);
      // labels
      labelEls.forEach((el, k) => {
        v3.copy(armTip[k]).applyMatrix4(world.matrixWorld).project(camera);
        const vis = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
        el.style.transform = "translate(" + ((v3.x * 0.5 + 0.5) * W).toFixed(1) + "px," + ((-v3.y * 0.5 + 0.5) * H).toFixed(1) + "px) translate(-50%,-50%)";
        el.style.visibility = vis ? "visible" : "hidden";
      });
      renderer.render(scene, camera);
      if (!REDUCED || hover >= 0 || changed) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    if (REDUCED) canvas.addEventListener("pointermove", () => requestAnimationFrame(tick));

    return {
      setFilter, ping,
      refresh() { setFilter({}); if (REDUCED) requestAnimationFrame(tick); },
      zoom(dir) { rig.distTarget = Math.max(7, Math.min(28, rig.distTarget + dir * 3)); if (REDUCED) requestAnimationFrame(tick); },
      reset() { rig.az = -0.6; rig.el = 0.52; rig.distTarget = W < 640 ? 19 : 15; rig.auto = !REDUCED; if (REDUCED) requestAnimationFrame(tick); }
    };
  }

  /* ------------------------------------------------------------------ 3. Retention terrain */
  function initTerrain(host, opts) {
    if (!ok()) { host.classList.add("no-webgl"); return null; }
    const D = window.PCV_DATA, cohorts = D.cohorts, ROWS = cohorts.length, COLS = 12;
    const canvas = host.querySelector("canvas"), labels = host.querySelector(".terrain-labels");
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0b0a08, 26, 52);
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);

    scene.add(new THREE.HemisphereLight(0xe8f0c0, 0x0a0806, 0.55));
    const key = new THREE.DirectionalLight(0xffc78a, 1.35); key.position.set(10, 16, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0xbccf67, 0.7); rim.position.set(-12, 6, -10); scene.add(rim);
    scene.add(new THREE.AmbientLight(0x2b2e1b, 0.6));

    const CELL = 1, GAP = 0.2, step = CELL + GAP;
    const ox = -((COLS - 1) * step) / 2, oz = -((ROWS - 1) * step) / 2;
    const cells = []; cohorts.forEach((c, r) => c.values.forEach((v, w) => cells.push({ r, w, v })));
    const filled = cells.filter((c) => c.v != null), empty = cells.filter((c) => c.v == null);

    const box = new THREE.BoxGeometry(CELL, 1, CELL); box.translate(0, 0.5, 0);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.08 });
    const inst = new THREE.InstancedMesh(box, mat, filled.length);
    inst.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const ramp = [[0, "#7a3a22"], [0.22, "#e2834f"], [0.42, "#f0b45a"], [0.62, "#bccf67"], [1, "#f6e3c0"]].map((s) => [s[0], new THREE.Color(s[1])]);
    function rampColor(x, out) {
      x = Math.max(0, Math.min(1, x));
      for (let i = 1; i < ramp.length; i++) if (x <= ramp[i][0]) { const a = ramp[i - 1], b = ramp[i]; return out.copy(a[1]).lerp(b[1], (x - a[0]) / (b[0] - a[0])); }
      return out.copy(ramp[ramp.length - 1][1]);
    }
    const tc = new THREE.Color(), baseColors = [];
    filled.forEach((c, i) => {
      if (c.w === 0) tc.set("#3e4324"); else rampColor((c.v - 15) / 60, tc);
      baseColors.push(tc.clone()); inst.setColorAt(i, tc);
    });
    scene.add(inst);
    const heightOf = (c) => (c.w === 0 ? 0.35 : 0.12 + (c.v / 100) * 5.2);

    // Future weeks: flat dark tiles
    const tile = new THREE.BoxGeometry(CELL, 0.04, CELL);
    const emptyMesh = new THREE.InstancedMesh(tile, new THREE.MeshStandardMaterial({ color: 0x1c1e13, roughness: 0.9 }), empty.length);
    const m4 = new THREE.Matrix4();
    empty.forEach((c, i) => { m4.makeTranslation(ox + c.w * step, 0.02, oz + c.r * step); emptyMesh.setMatrixAt(i, m4); });
    scene.add(emptyMesh);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(COLS * step + 3, ROWS * step + 3), new THREE.MeshStandardMaterial({ color: 0x0d0c09, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; scene.add(floor);
    const grid = new THREE.GridHelper(Math.max(COLS, ROWS) * step + 3, Math.max(COLS, ROWS) + 3, 0x2b2e1b, 0x1c1e13);
    grid.position.y = 0.001; scene.add(grid);

    // Labels
    const rowLabels = cohorts.map((c) => { const s = document.createElement("span"); s.textContent = c.label; labels.appendChild(s); return s; });
    const colLabels = []; for (let w = 0; w < COLS; w++) { const s = document.createElement("span"); s.textContent = "W" + w; labels.appendChild(s); colLabels.push(s); }
    const tRow = document.createElement("span"); tRow.className = "axis-title"; tRow.textContent = "Signup week"; labels.appendChild(tRow);
    const tCol = document.createElement("span"); tCol.className = "axis-title"; tCol.textContent = "Weeks since signup"; labels.appendChild(tCol);

    const rig = { az: -0.72, el: 0.62, dist: 27, vaz: 0 };
    let W = 1, H = 1;
    function resize() { W = host.clientWidth; H = host.clientHeight; renderer.setSize(W, H, false); camera.aspect = W / H; rig.dist = W < 560 ? 34 : 27; camera.updateProjectionMatrix(); }
    resize(); new ResizeObserver(resize).observe(host);

    let dragging = false, lx = 0, mouse = null, hover = -1, started = REDUCED ? -1e9 : null, sway = 0;
    canvas.addEventListener("pointerdown", (e) => { dragging = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); canvas.classList.add("grabbing"); });
    canvas.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect(); mouse = new THREE.Vector2(((e.clientX - r.left) / W) * 2 - 1, -((e.clientY - r.top) / H) * 2 + 1);
      if (dragging) { rig.vaz = -(e.clientX - lx) * 0.005; lx = e.clientX; }
      mouse.cx = e.clientX; mouse.cy = e.clientY;
      if (REDUCED) requestAnimationFrame(tick);
    });
    const end = () => { dragging = false; canvas.classList.remove("grabbing"); };
    canvas.addEventListener("pointerup", end); canvas.addEventListener("pointercancel", end);
    canvas.addEventListener("pointerleave", () => { mouse = null; if (opts.onHover) opts.onHover(null); });

    const ray = new THREE.Raycaster(), v3 = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p3 = new THREE.Vector3();
    const ripple = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

    let running = true, inView = false;
    visibility(host, (v) => { inView = v; const was = running; running = v; if (v && started === null) started = performance.now(); if (v && !was) requestAnimationFrame(tick); });

    function tick(now) {
      if (!running) return;
      const t = now / 1000;
      if (!dragging && !REDUCED) { sway = Math.sin(t * 0.18) * 0.12; }
      rig.az += rig.vaz; rig.vaz *= dragging ? 0.5 : 0.92;
      const az = rig.az + sway;
      camera.position.set(Math.cos(rig.el) * Math.sin(az) * rig.dist, Math.sin(rig.el) * rig.dist, Math.cos(rig.el) * Math.cos(az) * rig.dist);
      camera.lookAt(0, 1.1, 0);
      camera.updateMatrixWorld();

      // bars rise in with a soft overshoot, staggered along the diagonal
      const s0 = started == null ? Infinity : started;
      let animating = false;
      filled.forEach((c, i) => {
        const delay = (c.r + c.w) * 70;
        let k = Math.max(0, Math.min(1, (now - s0 - delay) / 900));
        if (k < 1) animating = true;
        const hgt = heightOf(c) * (k <= 0 ? 0.001 : ripple(k));
        sc.set(1, Math.max(0.001, hgt), 1); p3.set(ox + c.w * step, 0, oz + c.r * step);
        m4.compose(p3, q, sc); inst.setMatrixAt(i, m4);
      });
      inst.instanceMatrix.needsUpdate = true;

      // hover
      let h = -1;
      if (mouse && !dragging) { ray.setFromCamera(mouse, camera); const hit = ray.intersectObject(inst); if (hit.length) h = hit[0].instanceId; }
      if (h !== hover) {
        if (hover >= 0) inst.setColorAt(hover, baseColors[hover]);
        if (h >= 0) { tc.copy(baseColors[h]).lerp(new THREE.Color("#ffffff"), 0.35); inst.setColorAt(h, tc); }
        inst.instanceColor.needsUpdate = true; hover = h;
        canvas.style.cursor = h >= 0 ? "pointer" : "";
      }
      if (opts.onHover) opts.onHover(h >= 0 ? { cohort: cohorts[filled[h].r], week: filled[h].w, value: filled[h].v, x: mouse && mouse.cx, y: mouse && mouse.cy } : null);

      // labels
      const proj = (x, y, z, el) => { v3.set(x, y, z).project(camera); el.style.left = ((v3.x * 0.5 + 0.5) * W).toFixed(1) + "px"; el.style.top = ((-v3.y * 0.5 + 0.5) * H).toFixed(1) + "px"; };
      rowLabels.forEach((el, r) => proj(ox - step * 1.35, 0, oz + r * step, el));
      colLabels.forEach((el, w) => proj(ox + w * step, 0, oz + ROWS * step + 0.15, el));
      proj(ox - step * 2.6, 0, oz - step * 1.4, tRow);
      proj(0, 0, oz + ROWS * step + 1.3, tCol);

      renderer.render(scene, camera);
      if (!REDUCED || animating) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    return {};
  }

  window.PCV_SCENES = { initSilk, initConstellation, initTerrain, available: ok, shaders: { SILK_FRAG, STAR_VERT, STAR_FRAG } };
})();

// Bundled as a module by AdminDashboard.tsx (no exports; it sets its window.PCV_* global as before).
export {};
