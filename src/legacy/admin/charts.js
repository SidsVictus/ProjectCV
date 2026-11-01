/* Project CV · Super Admin · SVG charts
   Small, dependency-free chart helpers. Every chart: sized from its container, satin entrance, tooltip that stays on screen. */
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let uid = 0;

  function S(tag, attrs, parent) {
    const el = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) el.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(el);
    return el;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  const fmt = (n) => Math.round(n).toLocaleString("en-IN");

  // ---------- tooltip ----------
  const tipEl = () => document.getElementById("tip");
  function tipShow(html, x, y) {
    const t = tipEl(); t.innerHTML = html; t.classList.add("on");
    const w = t.offsetWidth, h = t.offsetHeight, vw = window.innerWidth, vh = window.innerHeight;
    let left = x + 16, top = y - h - 12;
    if (left + w > vw - 12) left = x - w - 16;
    if (top < 12) top = y + 18;
    if (top + h > vh - 12) top = vh - h - 12;
    t.style.left = Math.max(12, left) + "px"; t.style.top = top + "px";
  }
  function tipHide() { tipEl().classList.remove("on"); }

  // Run fn once the element's card has revealed (so entrances play where people can see them)
  function whenIn(el, fn) {
    const card = el.closest(".reveal");
    if (REDUCED || !card || card.classList.contains("in")) { requestAnimationFrame(() => requestAnimationFrame(fn)); return; }
    const io = new IntersectionObserver((es) => { if (es[0].isIntersecting) { io.disconnect(); setTimeout(fn, 120); } }, { threshold: 0.2 });
    io.observe(el);
  }

  // Monotone cubic path (no overshoot), points [[x,y],...]
  function monotone(pts) {
    const n = pts.length; if (n < 2) return "";
    if (n === 2) return "M" + pts[0] + "L" + pts[1];
    const dx = [], dy = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i]);
    let d = "M" + pts[0][0].toFixed(1) + "," + pts[0][1].toFixed(1);
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += "C" + (pts[i][0] + h).toFixed(1) + "," + (pts[i][1] + h * t[i]).toFixed(1) + " " + (pts[i + 1][0] - h).toFixed(1) + "," + (pts[i + 1][1] - h * t[i + 1]).toFixed(1) + " " + pts[i + 1][0].toFixed(1) + "," + pts[i + 1][1].toFixed(1);
    }
    return d;
  }
  function niceMax(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  function compact(n) { return n >= 100000 ? (n / 100000).toFixed(1).replace(/\.0$/, "") + "L" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n)); }

  function drawLine(path, ms) {
    if (REDUCED) return;
    const len = path.getTotalLength();
    path.style.strokeDasharray = len + " " + len; path.style.strokeDashoffset = len;
    path.getBoundingClientRect();
    path.style.transition = "stroke-dashoffset " + ms + "ms cubic-bezier(.22,1,.36,1)";
    path.style.strokeDashoffset = "0";
    setTimeout(() => { path.style.strokeDasharray = path.dataset.dash || ""; }, ms + 50);
  }

  // ---------- sparkline ----------
  function sparkline(el, values, opt) {
    opt = opt || {};
    el.innerHTML = "";
    const W = el.clientWidth || 160, H = opt.h || 34, pad = 3;
    const svg = S("svg", { viewBox: "0 0 " + W + " " + H, preserveAspectRatio: "none", height: H, "aria-hidden": "true", class: "kpi__spark" }, el);
    const max = Math.max.apply(null, values), min = Math.min.apply(null, values);
    const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (W - pad * 2), H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2)]);
    const id = "sg" + uid++, c = opt.color || "var(--lime)";
    const defs = S("defs", null, svg), lg = S("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    S("stop", { offset: "0", "stop-color": opt.fillColor || "#bccf67", "stop-opacity": opt.dark ? 0.25 : 0.22 }, lg);
    S("stop", { offset: "1", "stop-color": opt.fillColor || "#bccf67", "stop-opacity": 0 }, lg);
    const line = monotone(pts);
    S("path", { d: line + "L" + (W - pad) + "," + H + "L" + pad + "," + H + "Z", fill: "url(#" + id + ")" }, svg);
    const p = S("path", { d: line, fill: "none", stroke: c, "stroke-width": 1.6, "stroke-linecap": "round", "vector-effect": "non-scaling-stroke" }, svg);
    whenIn(el, () => drawLine(p, 1400));
  }

  // ---------- trend chart: this period vs period before ----------
  function trend(el, o) {
    el.innerHTML = "";
    const W = el.clientWidth || 600, H = o.h || 300, m = { l: 44, r: 10, t: 14, b: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.cur.length, hasPrev = !o.noPrev;
    const max = niceMax(Math.max.apply(null, hasPrev ? o.cur.concat(o.prev) : o.cur) * 1.08);
    const x = (i) => m.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw), y = (v) => m.t + ih - (v / max) * ih;
    const svg = S("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": o.aria || "Trend chart" }, el);
    const id = "tg" + uid++, defs = S("defs", null, svg), lg = S("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    S("stop", { offset: "0", "stop-color": "#bccf67", "stop-opacity": 0.32 }, lg);
    S("stop", { offset: "0.6", "stop-color": "#bccf67", "stop-opacity": 0.06 }, lg);
    S("stop", { offset: "1", "stop-color": "#bccf67", "stop-opacity": 0 }, lg);
    const ax = S("g", { class: "axis" }, svg);
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k, yy = y(v);
      S("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: k === 0 ? "baseline" : "gridline" }, ax);
      S("text", { x: m.l - 10, y: yy + 4, "text-anchor": "end" }, ax).textContent = compact(v);
    }
    const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 76))));
    o.labels.forEach((l, i) => { if (i % every === 0 || i === n - 1) { if (i !== n - 1 && n - 1 - i < every * 0.6) return; S("text", { x: x(i), y: H - 8, "text-anchor": i === 0 ? "start" : i === n - 1 ? "end" : "middle" }, ax).textContent = l; } });

    const cp = o.cur.map((v, i) => [x(i), y(v)]), pp = o.prev.map((v, i) => [x(i), y(v)]);
    const area = S("path", { d: monotone(cp) + "L" + x(n - 1) + "," + y(0) + "L" + x(0) + "," + y(0) + "Z", fill: "url(#" + id + ")", opacity: REDUCED ? 1 : 0 }, svg);
    const prev = S("path", { d: monotone(pp), fill: "none", stroke: "#f0b45a", "stroke-width": 1.6, "stroke-dasharray": "5 6", opacity: hasPrev ? 0.85 : 0 }, svg);
    prev.dataset.dash = "5 6";
    const line = S("path", { d: monotone(cp), fill: "none", stroke: "#bccf67", "stroke-width": 2.4, "stroke-linecap": "round", "stroke-linejoin": "round" }, svg);
    const last = S("circle", { cx: x(n - 1), cy: y(o.cur[n - 1]), r: 4.5, fill: "#bccf67", opacity: REDUCED ? 1 : 0 }, svg);
    const lastRing = S("circle", { cx: x(n - 1), cy: y(o.cur[n - 1]), r: 10, fill: "none", stroke: "#bccf67", "stroke-opacity": 0.35, opacity: REDUCED ? 1 : 0 }, svg);
    whenIn(el, () => {
      drawLine(line, 1600); drawLine(prev, 1800);
      [area, last, lastRing].forEach((e) => { e.style.transition = "opacity 1200ms cubic-bezier(.22,1,.36,1) 500ms"; e.setAttribute("opacity", 1); });
    });

    // hover
    const g = S("g", { opacity: 0, style: "transition:opacity 200ms" }, svg);
    const vl = S("line", { y1: m.t, y2: m.t + ih, stroke: "#8e9c4e", "stroke-width": 1, "stroke-dasharray": "2 4" }, g);
    const dp = S("circle", { r: 4, fill: "#f0b45a", stroke: "#020105", "stroke-width": 2, opacity: hasPrev ? 1 : 0 }, g);
    const dc = S("circle", { r: 5.5, fill: "#bccf67", stroke: "#020105", "stroke-width": 2 }, g);
    const hit = S("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);
    hit.addEventListener("pointermove", (e) => {
      const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(n - 1, Math.round(((px - m.l) / iw) * (n - 1))));
      g.setAttribute("opacity", 1);
      vl.setAttribute("x1", x(i)); vl.setAttribute("x2", x(i));
      dc.setAttribute("cx", x(i)); dc.setAttribute("cy", y(o.cur[i])); dp.setAttribute("cx", x(i)); dp.setAttribute("cy", y(o.prev[i]));
      const d = o.prev[i] ? ((o.cur[i] - o.prev[i]) / o.prev[i]) * 100 : 0;
      tipShow('<span class="caption">' + esc(o.tipLabels ? o.tipLabels[i] : o.labels[i]) + '</span><span class="tip__big">' + esc(o.fmt(o.cur[i])) + "</span>" + (hasPrev ? '<div class="tip__row"><span>Period before</span><b>' + esc(o.fmt(o.prev[i])) + '</b></div><div class="tip__row"><span>Change</span><b style="color:' + (d >= 0 ? "#bccf67" : "#e2834f") + '">' + (d >= 0 ? "Up " : "Down ") + Math.abs(d).toFixed(0) + "%</b></div>" : ""), e.clientX, e.clientY);
    });
    hit.addEventListener("pointerleave", () => { g.setAttribute("opacity", 0); tipHide(); });
  }

  // ---------- stacked bars ----------
  function stacked(el, o) {
    el.innerHTML = "";
    const W = el.clientWidth || 600, H = o.h || 280, m = { l: 40, r: 6, t: 18, b: 30 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = o.buckets.length;
    const totals = o.buckets.map((b) => b.values.reduce((s, v) => s + v, 0));
    const max = niceMax(Math.max.apply(null, totals) * 1.05);
    const slot = iw / n, bw = Math.max(4, Math.min(40, slot * 0.62)), y = (v) => (v / max) * ih;
    const svg = S("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": o.aria || "Stacked bar chart" }, el);
    const ax = S("g", { class: "axis" }, svg);
    for (let k = 0; k <= 4; k++) {
      const v = (max / 4) * k, yy = m.t + ih - y(v);
      S("line", { x1: m.l, x2: W - m.r, y1: yy, y2: yy, class: k === 0 ? "baseline" : "gridline" }, ax);
      S("text", { x: m.l - 10, y: yy + 4, "text-anchor": "end" }, ax).textContent = compact(v);
    }
    const every = Math.max(1, Math.ceil(n / Math.max(3, Math.floor(iw / 64))));
    const defs = S("defs", null, svg), bars = [];
    o.buckets.forEach((b, i) => {
      const cx = m.l + slot * i + slot / 2, x0 = cx - bw / 2, total = totals[i], th = y(total);
      const cid = "cl" + uid++, clip = S("clipPath", { id: cid }, defs);
      const rTop = Math.min(8, bw / 2), rBot = Math.min(4, bw / 2), yt = m.t + ih - th, yb = m.t + ih;
      S("path", { d: "M" + x0 + "," + (yt + rTop) + "Q" + x0 + "," + yt + " " + (x0 + rTop) + "," + yt + "H" + (x0 + bw - rTop) + "Q" + (x0 + bw) + "," + yt + " " + (x0 + bw) + "," + (yt + rTop) + "V" + (yb - rBot) + "Q" + (x0 + bw) + "," + yb + " " + (x0 + bw - rBot) + "," + yb + "H" + (x0 + rBot) + "Q" + x0 + "," + yb + " " + x0 + "," + (yb - rBot) + "Z" }, clip);
      const grp = S("g", { "clip-path": "url(#" + cid + ")" }, svg);
      const inner = S("g", { class: "grow" }, grp);
      let acc = 0;
      b.values.forEach((v, k) => { const h = y(v); S("rect", { x: x0, y: yb - acc - h, width: bw, height: Math.max(0, h - (k < b.values.length - 1 ? 1.5 : 0)), fill: o.colors[k] }, inner); acc += h; });
      if (i % every === 0 || i === n - 1) { if (!(i !== n - 1 && n - 1 - i < every * 0.6)) S("text", { x: cx, y: H - 8, "text-anchor": "middle" }, ax).textContent = b.label; }
      if (bw >= 22) S("text", { x: cx, y: yt - 6, "text-anchor": "middle", class: "axis-label" }, svg).textContent = compact(total);
      const hit = S("rect", { x: m.l + slot * i, y: m.t, width: slot, height: ih, fill: "transparent" }, svg);
      hit.addEventListener("pointermove", (e) => {
        grp.style.opacity = 1; bars.forEach((bb) => { if (bb !== grp) bb.style.opacity = 0.42; });
        tipShow('<span class="caption">' + esc(b.tip || b.label) + '</span><span class="tip__big">' + fmt(total) + " added</span>" + o.names.map((nm, k) => '<div class="tip__row"><span><i class="sw" style="width:8px;height:8px;margin-right:6px;background:' + o.colors[k] + '"></i>' + nm + "</span><b>" + fmt(b.values[k]) + "</b></div>").join(""), e.clientX, e.clientY);
      });
      hit.addEventListener("pointerleave", () => { bars.forEach((bb) => { bb.style.opacity = 1; }); tipHide(); });
      grp.style.transition = "opacity 260ms cubic-bezier(.22,1,.36,1)";
      bars.push(grp);
      inner.style.transformBox = "fill-box"; inner.style.transformOrigin = "50% 100%";
      if (!REDUCED) { inner.style.transform = "scaleY(0)"; inner.style.transition = "transform 900ms cubic-bezier(.34,1.36,.64,1) " + Math.min(i * 40, 900) + "ms"; }
    });
    whenIn(el, () => svg.querySelectorAll(".grow").forEach((g) => { g.style.transform = "scaleY(1)"; }));
  }

  // ---------- heatmap ----------
  const WARM = ["#14110c", "#2a1d14", "#5a2f1c", "#9a4c2a", "#e2834f", "#f0b45a", "#f6e3c0"];
  function warmColor(t) {
    t = Math.max(0, Math.min(1, t)); const f = t * (WARM.length - 1), i = Math.floor(f), k = f - i;
    if (i >= WARM.length - 1) return WARM[WARM.length - 1];
    const a = parseInt(WARM[i].slice(1), 16), b = parseInt(WARM[i + 1].slice(1), 16);
    const r = ((a >> 16) & 255) + (((b >> 16) & 255) - ((a >> 16) & 255)) * k, g = ((a >> 8) & 255) + (((b >> 8) & 255) - ((a >> 8) & 255)) * k, bl = (a & 255) + ((b & 255) - (a & 255)) * k;
    return "rgb(" + Math.round(r) + "," + Math.round(g) + "," + Math.round(bl) + ")";
  }
  function heatmap(el, matrix) {
    el.innerHTML = "";
    const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], hours = (h) => (h === 0 ? "12 am" : h < 12 ? h + " am" : h === 12 ? "12 pm" : h - 12 + " pm");
    const W = el.clientWidth || 420, lw = 34, gap = 3, cw = (W - lw) / 24, ch = Math.min(26, Math.max(14, cw * 1.25)), H = 7 * ch + 24;
    const svg = S("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": "Heatmap of editing sessions by weekday and hour" }, el);
    const max = Math.max.apply(null, matrix.map((r) => Math.max.apply(null, r)));
    const ax = S("g", { class: "axis" }, svg);
    days.forEach((d, r) => S("text", { x: 0, y: r * ch + ch / 2 + 4 }, ax).textContent = d);
    [0, 6, 12, 18, 23].forEach((h) => S("text", { x: lw + h * cw + cw / 2, y: H - 4, "text-anchor": h === 23 ? "end" : "middle" }, ax).textContent = h === 23 ? "11 pm" : hours(h));
    matrix.forEach((row, r) => row.forEach((v, h) => {
      const cell = S("rect", { x: lw + h * cw + gap / 2, y: r * ch + gap / 2, width: Math.max(1, cw - gap), height: ch - gap, rx: Math.min(5, cw / 3), fill: warmColor(Math.pow(v / max, 0.85)) }, svg);
      if (!REDUCED) { cell.style.opacity = 0; cell.style.transition = "opacity 700ms cubic-bezier(.22,1,.36,1) " + (h * 22 + r * 40) + "ms"; }
      cell.addEventListener("pointermove", (e) => { cell.setAttribute("stroke", "#f6e3c0"); tipShow('<span class="caption">' + ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"][r] + ", " + hours(h) + '</span><span class="tip__big">' + fmt(v) + "</span>sessions started", e.clientX, e.clientY); });
      cell.addEventListener("pointerleave", () => { cell.removeAttribute("stroke"); tipHide(); });
    }));
    whenIn(el, () => svg.querySelectorAll("rect").forEach((c) => { c.style.opacity = 1; }));
  }

  // ---------- rings (D1, D7, D30) ----------
  function rings(el, items) {
    el.innerHTML = "";
    const size = 200, c = size / 2, sw = 13, gap = 7;
    const svg = S("svg", { viewBox: "0 0 " + size + " " + size, height: size, role: "img", "aria-label": items.map((it) => it.label + " " + it.value + "%").join(", ") }, el);
    items.forEach((it, k) => {
      const r = c - sw / 2 - k * (sw + gap), C = 2 * Math.PI * r;
      S("circle", { cx: c, cy: c, r, fill: "none", stroke: "#3e4324", "stroke-opacity": 0.55, "stroke-width": sw }, svg);
      const arc = S("circle", { cx: c, cy: c, r, fill: "none", stroke: it.color, "stroke-width": sw, "stroke-linecap": "round", transform: "rotate(-90 " + c + " " + c + ")", "stroke-dasharray": C + " " + C, "stroke-dashoffset": REDUCED ? C * (1 - it.value / 100) : C }, svg);
      arc.style.transition = "stroke-dashoffset 1600ms cubic-bezier(.22,1,.36,1) " + k * 160 + "ms";
      arc.addEventListener("pointermove", (e) => tipShow('<span class="caption">' + esc(it.long) + '</span><span class="tip__big">' + it.value + "%</span>came back", e.clientX, e.clientY));
      arc.addEventListener("pointerleave", tipHide);
      whenIn(el, () => arc.setAttribute("stroke-dashoffset", C * (1 - it.value / 100)));
    });
  }

  // ---------- donut ----------
  function donut(el, parts) {
    el.innerHTML = "";
    const size = 140, c = size / 2, r = 54, sw = 16, C = 2 * Math.PI * r, total = parts.reduce((s, p) => s + p.value, 0);
    const svg = S("svg", { viewBox: "0 0 " + size + " " + size, height: size, role: "img", "aria-label": parts.map((p) => p.label + " " + p.value).join(", ") }, el);
    S("circle", { cx: c, cy: c, r, fill: "none", stroke: "#2b2e1b", "stroke-width": sw }, svg);
    let acc = 0;
    parts.forEach((p, k) => {
      const frac = p.value / total, len = Math.max(0, C * frac - 3);
      const seg = S("circle", { cx: c, cy: c, r, fill: "none", stroke: p.color, "stroke-width": sw, "stroke-dasharray": (REDUCED ? len : 0) + " " + C, transform: "rotate(" + (-90 + (acc / total) * 360) + " " + c + " " + c + ")" }, svg);
      seg.style.transition = "stroke-dasharray 1400ms cubic-bezier(.22,1,.36,1) " + k * 180 + "ms";
      seg.addEventListener("pointermove", (e) => tipShow('<span class="caption">' + esc(p.label) + '</span><span class="tip__big">' + fmt(p.value) + "</span>" + (frac * 100).toFixed(1) + "% of accounts", e.clientX, e.clientY));
      seg.addEventListener("pointerleave", tipHide);
      whenIn(el, () => seg.setAttribute("stroke-dasharray", len + " " + C));
      acc += p.value;
    });
    const t = S("text", { x: c, y: c + 2, "text-anchor": "middle", "font-family": "Boska, Georgia, serif", "font-style": "italic", "font-size": 30, fill: "#bccf67" }, svg); t.textContent = fmt(total);
    S("text", { x: c, y: c + 20, "text-anchor": "middle", "font-size": 10, fill: "#8e9c4e", "letter-spacing": "1" }, svg).textContent = "ACCOUNTS";
  }

  // ---------- small histogram ----------
  function histogram(el, bins, opt) {
    el.innerHTML = "";
    opt = opt || {};
    const W = el.clientWidth || 260, H = 96, m = { t: 16, b: 20 }, n = bins.length, slot = W / n, bw = Math.min(30, slot * 0.66);
    const max = Math.max.apply(null, bins.map((b) => b.value));
    const svg = S("svg", { viewBox: "0 0 " + W + " " + H, height: H, role: "img", "aria-label": opt.aria || "Histogram" }, el);
    S("line", { x1: 0, x2: W, y1: H - m.b, y2: H - m.b, class: "baseline" }, svg);
    bins.forEach((b, i) => {
      const h = (b.value / max) * (H - m.t - m.b), x = i * slot + (slot - bw) / 2, yb = H - m.b;
      const rr = Math.min(6, bw / 2);
      const p = S("path", { d: "M" + x + "," + yb + "V" + (yb - h + rr) + "Q" + x + "," + (yb - h) + " " + (x + rr) + "," + (yb - h) + "H" + (x + bw - rr) + "Q" + (x + bw) + "," + (yb - h) + " " + (x + bw) + "," + (yb - h + rr) + "V" + yb + "Z", fill: b.hi ? "#f0b45a" : "#bccf67", "fill-opacity": b.hi ? 1 : 0.85 }, svg);
      p.style.transformBox = "fill-box"; p.style.transformOrigin = "50% 100%";
      if (!REDUCED) { p.style.transform = "scaleY(0)"; p.style.transition = "transform 900ms cubic-bezier(.34,1.36,.64,1) " + i * 70 + "ms"; }
      S("text", { x: x + bw / 2, y: H - 5, "text-anchor": "middle", class: "axis-label" }, svg).textContent = b.label;
      p.addEventListener("pointermove", (e) => tipShow('<span class="caption">' + esc(b.label) + " " + esc(opt.unit || "") + '</span><span class="tip__big">' + fmt(b.value) + "</span>" + esc(opt.what || "people"), e.clientX, e.clientY));
      p.addEventListener("pointerleave", tipHide);
    });
    whenIn(el, () => svg.querySelectorAll("path").forEach((p) => { p.style.transform = "scaleY(1)"; }));
  }

  window.PCV_CHARTS = { S, esc, fmt, compact, sparkline, trend, stacked, heatmap, rings, donut, histogram, tipShow, tipHide, whenIn, warmColor };
})();
