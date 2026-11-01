/* Project CV · Super Admin · app
   Wires sample data to the page: range switching, KPIs, charts, the constellation, live feed, users table, drawer, palette. */
(function () {
  "use strict";
  const D = window.PCV_DATA, C = window.PCV_CHARTS, SC = window.PCV_SCENES;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const fmt = C.fmt, esc = C.esc;
  const ME = "Siddharth Sadu";
  const state = { range: 30, trendMetric: "signups", status: "", query: "", page: 8 };

  // ---------- helpers ----------
  const days = () => (state.range === "all" ? D.DAYS : state.range);
  const sum = (a, from, to) => { let s = 0; for (let i = from; i < Math.min(to, a.length); i++) s += a[i]; return s; };
  const mean = (a, from, to) => sum(a, from, to) / Math.max(1, Math.min(to, a.length) - from);
  const pctChange = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : 0);
  const dateAgo = (d) => { const t = new Date(D.now); t.setDate(t.getDate() - d); return t; };
  const dShort = (d) => dateAgo(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const mins = (m) => { const mm = Math.floor(m), ss = Math.round((m - mm) * 60); return mm + "m " + String(ss).padStart(2, "0") + "s"; };
  const secs = (s) => Math.floor(s / 60) + "m " + String(Math.round(s % 60)).padStart(2, "0") + "s";
  const rangeLabel = () => (state.range === "all" ? "all time" : "the last " + state.range + " days");
  const prevLabel = () => (state.range === "all" ? "" : "vs prior " + state.range + " days");
  const lastActiveText = (d) => (d === 0 ? "Today" : d === 1 ? "Yesterday" : d < 7 ? d + " days ago" : d < 30 ? Math.round(d / 7) + (Math.round(d / 7) === 1 ? " week ago" : " weeks ago") : Math.round(d / 30) + (Math.round(d / 30) === 1 ? " month ago" : " months ago"));
  const alive = () => D.users.filter((u) => !u.deleted);
  const first = (n) => n.split(" ")[0];
  function ago(minutes) { return minutes < 1 ? "Just now" : minutes < 60 ? minutes + " min ago" : minutes < 60 * 24 ? Math.round(minutes / 60) + " h ago" : Math.round(minutes / 1440) + " d ago"; }

  // Bucket a daily series (index 0 = today) for the chosen range: oldest first
  function bucket(arr, agg) {
    const r = state.range;
    const size = r === 7 || r === 30 ? 1 : r === 90 ? 7 : 30.4;
    const n = r === 7 ? 7 : r === 30 ? 30 : r === 90 ? 13 : 12;
    const f = agg === "mean" ? mean : sum;
    const cur = [], prev = [], labels = [], tips = [];
    for (let b = n - 1; b >= 0; b--) {
      const from = Math.round(b * size), to = Math.round((b + 1) * size);
      cur.push(f(arr, from, to));
      prev.push(r === "all" ? null : f(arr, from + days(), to + days()));
      const lbl = size === 1 ? dShort(from) : size === 7 ? dShort(to - 1) : dateAgo(from).toLocaleDateString("en-IN", { month: "short" });
      labels.push(lbl);
      tips.push(size === 1 ? dateAgo(from).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" }) : size === 7 ? "Week of " + dShort(to - 1) : dateAgo(from).toLocaleDateString("en-IN", { month: "long", year: "numeric" }));
    }
    return { cur, prev: r === "all" ? null : prev, labels, tips };
  }

  // Count numbers up from where they were, on satin timing
  function countTo(el, to, format, ms) {
    const from = el._v || 0; el._v = to;
    if (REDUCED) { el.textContent = format(to); return; }
    const t0 = performance.now(), dur = ms || 1600, ease = (x) => 1 - Math.pow(1 - x, 4);
    (function step(now) {
      const k = Math.min(1, (now - t0) / dur);
      el.textContent = format(from + (to - from) * ease(k));
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }
  function whenVisible(el, fn) { C.whenIn(el, fn); }

  // ---------- segmented controls ----------
  function seg(el, onPick) {
    const thumb = $(".seg__thumb", el), btns = $$("button", el);
    function place() { const b = btns.find((x) => x.getAttribute("aria-pressed") === "true") || btns[0]; thumb.style.left = b.offsetLeft + "px"; thumb.style.width = b.offsetWidth + "px"; }
    btns.forEach((b) => b.addEventListener("click", () => { btns.forEach((x) => x.setAttribute("aria-pressed", String(x === b))); place(); onPick && onPick(b); }));
    window.addEventListener("resize", place);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
    requestAnimationFrame(place);
    return { place, set(pred) { btns.forEach((x) => x.setAttribute("aria-pressed", String(pred(x)))); place(); } };
  }

  // ---------- reveal on scroll ----------
  const revealIO = new IntersectionObserver((es) => {
    let k = 0;
    es.forEach((e) => { if (e.isIntersecting) { const el = e.target; setTimeout(() => el.classList.add("in"), REDUCED ? 0 : 70 * k++); revealIO.unobserve(el); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
  function observeReveals(root) { $$(".reveal", root).forEach((el) => { if (!el.classList.contains("in")) revealIO.observe(el); }); }

  // ---------- toast ----------
  let toastT;
  function toast(msg) { const t = $("#toast"); $("span", t).textContent = msg; t.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("on"), 3200); }

  /* ================================================================= KPIs */
  function kpiDefs() {
    const r = days(), all = state.range === "all", d = D.daily, users = alive();
    const signNow = sum(d.signups, 0, r), signPrev = sum(d.signups, r, 2 * r);
    const activeNow = users.filter((u) => u.projects > 0 && u.status !== "Disabled").length;
    const activeNew = users.filter((u) => u.projects > 0 && u.status !== "Disabled" && u.signupDay < r).length;
    const viewsNow = sum(d.pageViews, 0, r), viewsPrev = sum(d.pageViews, r, 2 * r);
    const editNow = mean(d.editMinutes, 0, r) / 10, editPrev = mean(d.editMinutes, r, 2 * r) / 10;
    const ret = D.retention;
    const spark = (arr, agg) => bucket(arr, agg).cur;
    let cum = users.length - signNow; const cumSpark = spark(d.signups).map((v) => (cum += v));
    return [
      { label: "New signups", value: signNow, f: fmt, delta: all ? null : pctChange(signNow, signPrev), ctx: all ? "since launch" : prevLabel(), spark: spark(d.signups), accent: true },
      { label: "Total accounts", value: users.length, f: fmt, deltaText: "+" + fmt(signNow), ctx: all ? "since launch" : "joined this range", spark: cumSpark },
      { label: "Active portfolios", value: activeNow, f: fmt, deltaText: "+" + fmt(activeNew), ctx: "with a project", spark: spark(d.projectsAdded) },
      { label: "Page views", value: viewsNow, f: (v) => C.compact(v), delta: all ? null : pctChange(viewsNow, viewsPrev), ctx: all ? "across every portfolio" : prevLabel(), spark: spark(d.pageViews) },
      { label: "Avg. time editing", value: editNow, f: mins, delta: all ? null : pctChange(editNow, editPrev), ctx: "per session", spark: spark(d.editMinutes, "mean") },
      { label: "Came back", value: ret.d30, f: (v) => Math.round(v) + "%", deltaText: "▲ " + (ret.d30 - ret.prev.d30) + " pts", ctx: "back by day 30", spark: D.cohorts.slice(0, 11).map((c) => c.values[1]) }
    ];
  }
  function renderKPIs(first) {
    const host = $("#kpis"), defs = kpiDefs();
    if (first) {
      host.innerHTML = defs.map((k, i) => '<article class="card kpi reveal' + (k.accent ? " kpi--accent" : "") + '" data-i="' + i + '"><p class="overline">' + esc(k.label) + '</p><div class="stat-value tnum">0</div><div class="kpi__row"><span class="delta"></span><span class="ctx"></span></div><div class="spark"></div></article>').join("");
      observeReveals(host);
    }
    defs.forEach((k, i) => {
      const card = $('[data-i="' + i + '"]', host), v = $(".stat-value", card), dEl = $(".delta", card);
      whenVisible(v, () => countTo(v, k.value, k.f));
      if (k.delta != null) { const up = k.delta >= 0; dEl.textContent = (up ? "▲ " : "▼ ") + Math.abs(k.delta).toFixed(0) + "%"; dEl.className = "delta" + (up ? "" : " delta--down"); dEl.hidden = false; dEl.setAttribute("aria-label", (up ? "Up " : "Down ") + Math.abs(k.delta).toFixed(0) + " percent"); }
      else if (k.deltaText) { dEl.textContent = k.deltaText; dEl.className = "delta"; dEl.hidden = false; }
      else dEl.hidden = true;
      $(".ctx", card).textContent = k.ctx;
      C.sparkline($(".spark", card), k.spark, k.accent ? { color: "#020105", fillColor: "#020105", dark: true } : {});
    });
  }

  /* ================================================================= Constellation + live */
  let sky = null;
  function initSky() {
    sky = SC.initConstellation($("#sky"), { onPick: openDrawer });
    const chips = $("#collegeChips");
    const list = [{ short: "All colleges", idx: null }].concat(D.COLLEGES.map((c, i) => ({ short: c.short, idx: i })));
    chips.innerHTML = list.map((c) => '<button class="chip" type="button" data-idx="' + (c.idx == null ? "" : c.idx) + '" aria-pressed="' + (c.idx == null) + '">' + esc(c.short) + "</button>").join("");
    chips.addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) pickCollege(b.dataset.idx === "" ? null : +b.dataset.idx); });
    $("#zoomIn").addEventListener("click", () => sky && sky.zoom(-1));
    $("#zoomOut").addEventListener("click", () => sky && sky.zoom(1));
    $("#skyReset").addEventListener("click", () => { sky && sky.reset(); pickCollege(null); });
    $("#skyTotal").textContent = fmt(alive().length);
  }
  function pickCollege(idx, scroll) {
    $$("#collegeChips .chip").forEach((b) => b.setAttribute("aria-pressed", String((b.dataset.idx === "" ? null : +b.dataset.idx) === idx)));
    if (sky) sky.setFilter({ college: idx });
    if (scroll) $("#sky").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "center" });
  }
  function renderSkyNumbers() { countTo($("#skyVisitors"), sum(D.daily.visitorsDaily, 0, days()), C.compact); }

  const EVENTS = [
    { t: (u) => "<b>" + esc(u.name) + "</b> added a project", warm: false },
    { t: (u) => "<b>" + esc(u.name) + "</b> uploaded Certificate.pdf", warm: false },
    { t: (u) => "<b>" + esc(u.name) + "</b> attached a GitHub link", warm: false },
    { t: (u) => "Someone opened <b>" + esc(first(u.name)) + "'s</b> portfolio", warm: true },
    { t: (u) => "A viewer opened a file on <b>" + esc(first(u.name)) + "'s</b> page", warm: true },
    { t: (u) => "<b>" + esc(u.name) + "</b> switched to " + esc(D.WALLPAPERS[u.wallpaper].name), warm: false },
    { t: (u) => "<b>" + esc(u.name) + "</b> signed up from " + esc(D.COLLEGES[u.college].short), warm: false }
  ];
  function liveFeed() {
    const feed = $("#feed"), users = D.users;
    function push(silent) {
      let i; do { i = Math.floor(Math.random() * users.length); } while (users[i].status !== "Active" || users[i].deleted);
      const u = users[i], ev = EVENTS[Math.floor(Math.random() * EVENTS.length)];
      const li = document.createElement("li");
      li.innerHTML = '<span class="avatar avatar--xs' + (ev.warm ? " avatar--warm" : "") + '">' + esc(u.name.charAt(0)) + "</span><span>" + ev.t(u) + "</span><time>now</time>";
      li.addEventListener("click", () => openDrawer(u)); li.style.cursor = "pointer";
      feed.prepend(li);
      $$("time", feed).forEach((t, k) => { t.textContent = k === 0 ? "now" : k * 3 + "s"; });
      while (feed.children.length > 9) feed.lastChild.remove();
      if (!silent && sky) sky.ping(i, ev.warm);
    }
    for (let k = 0; k < 7; k++) push(true);
    if (!REDUCED) setInterval(() => { if (!document.hidden) push(false); }, 2800);
    const lc = $("#liveCount"); let live = 24;
    if (!REDUCED) setInterval(() => { live = Math.max(12, Math.min(38, live + Math.round((Math.random() - 0.5) * 4))); lc.textContent = live; }, 4000);
  }
  function renderHealth() {
    const users = alive(), withProj = users.filter((u) => u.projects > 0).length / users.length * 100;
    const r = days(), fileShare = (sum(D.daily.filesOpened, 0, r) / sum(D.daily.visitorsDaily, 0, r)) * 100;
    countTo($("#hActiveShare"), withProj, (v) => Math.round(v) + "%"); countTo($("#hFileShare"), fileShare, (v) => Math.round(v) + "%");
    whenVisible($("#hActiveBar"), () => { $("#hActiveBar").style.width = withProj + "%"; $("#hFileBar").style.width = fileShare + "%"; });
  }

  /* ================================================================= Growth */
  const TREND = {
    signups: { label: "New signups", arr: () => D.daily.signups, f: fmt },
    activeEditors: { label: "Active editors", arr: () => D.daily.activeEditors, f: fmt, agg: "mean", note: "daily average" },
    pageViews: { label: "Page views", arr: () => D.daily.pageViews, f: fmt },
    visitorsDaily: { label: "Portfolio visitors", arr: () => D.daily.visitorsDaily, f: fmt }
  };
  function renderTrendTabs() {
    const host = $("#trendTabs"), r = days();
    host.innerHTML = Object.keys(TREND).map((k) => {
      const t = TREND[k], total = t.agg === "mean" ? mean(t.arr(), 0, r) : sum(t.arr(), 0, r);
      return '<button class="metric-tab" type="button" data-k="' + k + '" aria-pressed="' + (state.trendMetric === k) + '"><span class="overline">' + t.label + '</span><span class="big tnum">' + C.compact(total) + "</span></button>";
    }).join("");
  }
  function renderTrend() {
    const t = TREND[state.trendMetric], b = bucket(t.arr(), t.agg);
    const el = $("#trendChart");
    C.trend(el, { cur: b.cur, prev: b.prev || b.cur.map(() => 0), labels: b.labels, tipLabels: b.tips, fmt: (v) => fmt(v) + (t.agg ? " a day" : ""), h: window.innerWidth < 640 ? 230 : 300, aria: t.label + " over " + rangeLabel(), noPrev: !b.prev });
  }
  function renderColleges() {
    const r = days(), counts = D.COLLEGES.map(() => 0);
    alive().forEach((u) => { if (u.signupDay < r) counts[u.college]++; });
    const rows = D.COLLEGES.map((c, i) => ({ c, i, n: counts[i] })).sort((a, b) => b.n - a.n), max = rows[0].n || 1;
    const host = $("#collegeBars");
    host.innerHTML = rows.slice(0, 8).map((x) => '<button class="hbar" type="button" data-idx="' + x.i + '" style="background:none;border:0;padding:0;text-align:left;cursor:pointer"><span class="hbar__label">' + esc(x.c.name) + '</span><span class="hbar__val">' + fmt(x.n) + '</span><span class="hbar__track"><i data-w="' + ((x.n / max) * 100).toFixed(1) + '"></i></span></button>').join("");
    whenVisible(host, () => $$("i", host).forEach((i, k) => setTimeout(() => { i.style.width = i.dataset.w + "%"; }, k * 70)));
  }

  /* ================================================================= Retention */
  let terrainTip = false;
  function initRetention() {
    SC.initTerrain($("#terrain"), {
      onHover(h) {
        if (h) {
          terrainTip = true;
          C.tipShow('<span class="caption">Joined week of ' + esc(h.cohort.label) + " · " + h.cohort.size + ' people</span><span class="tip__big">' + h.value + "%</span>" + (h.week === 0 ? "signed up this week" : "came back in week " + h.week), h.x, h.y);
        } else if (terrainTip) { terrainTip = false; C.tipHide(); }
      }
    });
    // Table view (also the accessible reading of the terrain)
    const tbl = '<table class="heat-table"><thead><tr><th>Joined</th>' + Array.from({ length: 12 }, (_, w) => "<th>W" + w + "</th>").join("") + "</tr></thead><tbody>" +
      D.cohorts.map((c) => "<tr><th>" + esc(c.label) + "</th>" + c.values.map((v, w) => v == null ? "<td></td>" : '<td style="background:' + (w === 0 ? "#3e4324;color:#bccf67" : terrainColor(v)) + '">' + v + "</td>").join("") + "</tr>").join("") + "</tbody></table>";
    $("#terrainTable").innerHTML = tbl;
    seg($("#terrainSeg"), (b) => { const t = b.dataset.view === "table"; $("#terrain").hidden = t; $("#terrainTable").hidden = !t; });

    const R = D.retention;
    const items = [
      { label: "Day 1", long: "Came back the next day", value: R.d1, prev: R.prev.d1, color: "#bccf67" },
      { label: "Day 7", long: "Came back within a week", value: R.d7, prev: R.prev.d7, color: "#f0b45a" },
      { label: "Day 30", long: "Came back within a month", value: R.d30, prev: R.prev.d30, color: "#e2834f" }
    ];
    C.rings($("#rings"), items);
    $("#ringLegend").innerHTML = items.map((it) => '<div class="row"><span class="bar" style="background:' + it.color + '"></span><div><p class="overline">' + it.label + '</p><span class="big tnum">' + it.value + '%</span> <span class="delta">▲ ' + (it.value - it.prev) + " pts</span></div></div>").join("");
    const old = D.cohorts[0].values[4], recent = D.cohorts[7].values[4];
    $("#retInsight").textContent = "Newer cohorts come back more. Week 4 return rose from " + old + "% for people who joined " + D.cohorts[0].label + " to " + recent + "% for those who joined " + D.cohorts[7].label + ".";
  }
  function terrainColor(v) {
    const stops = [[0, [122, 58, 34]], [0.22, [226, 131, 79]], [0.42, [240, 180, 90]], [0.62, [188, 207, 103]], [1, [246, 227, 192]]], x = Math.max(0, Math.min(1, (v - 15) / 60));
    for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) { const a = stops[i - 1], b = stops[i], k = (x - a[0]) / (b[0] - a[0]); return "rgb(" + a[1].map((c, j) => Math.round(c + (b[1][j] - c) * k)).join(",") + ")"; }
    return "rgb(246,227,192)";
  }

  /* ================================================================= Activity */
  function renderActivity() {
    const p = bucket(D.daily.projectsAdded), d = bucket(D.daily.docsUploaded), l = bucket(D.daily.linksAttached);
    const buckets = p.cur.map((_, i) => ({ label: p.labels[i], tip: p.tips[i], values: [p.cur[i], d.cur[i], l.cur[i]] }));
    C.stacked($("#contentChart"), { buckets, colors: ["#bccf67", "#f0b45a", "#e2834f"], names: ["Projects", "Documents", "Links"], h: window.innerWidth < 640 ? 220 : 280, aria: "Projects, documents and links added over " + rangeLabel() });
    const tp = p.cur.reduce((a, b) => a + b, 0), td = d.cur.reduce((a, b) => a + b, 0), tl = l.cur.reduce((a, b) => a + b, 0);
    $("#contentTotals").textContent = fmt(tp) + " projects, " + fmt(td) + " documents and " + fmt(tl) + " links in " + rangeLabel();

    const r = days(), eNow = mean(D.daily.editMinutes, 0, r) / 10, ePrev = mean(D.daily.editMinutes, r, 2 * r) / 10;
    countTo($("#mEdit"), eNow, mins);
    $("#mEditDelta").textContent = state.range === "all" ? "since launch" : (eNow >= ePrev ? "up " : "down ") + Math.abs(pctChange(eNow, ePrev)).toFixed(0) + "% on the period before";
    C.sparkline($("#editSpark"), bucket(D.daily.editMinutes, "mean").cur, { h: 64 });
  }
  function renderEngagement() {
    C.heatmap($("#heatmap"), D.heat);
    const users = alive(), s = users.map((u) => u.sessions).sort((a, b) => a - b), median = s[Math.floor(s.length / 2)];
    const binsDef = [["1", 1, 1], ["2", 2, 2], ["3", 3, 3], ["4", 4, 4], ["5", 5, 5], ["6 to 8", 6, 8], ["9+", 9, 999]];
    const bins = binsDef.map((b) => ({ label: b[0], value: s.filter((x) => x >= b[1] && x <= b[2]).length, hi: median >= b[1] && median <= b[2] }));
    countTo($("#mSessions"), median, (v) => Math.round(v));
    C.histogram($("#sessionsHist"), bins, { unit: "sessions", what: "people" });

    const groups = [["Today", 0, 0, "#bccf67"], ["1 to 6 days", 1, 6, "#f0b45a"], ["7 to 29 days", 7, 29, "#e2834f"], ["30+ days", 30, 9999, "#565e31"]];
    const counts = groups.map((g) => users.filter((u) => u.lastActive >= g[1] && u.lastActive <= g[2]).length);
    const bar = $("#lastActiveBar");
    bar.innerHTML = groups.map((g, k) => '<i style="background:' + g[3] + '" data-g="' + counts[k] + '"></i>').join("");
    $("#lastActiveLegend").innerHTML = groups.map((g, k) => '<span><i class="sw" style="background:' + g[3] + '"></i>' + g[0] + "<b>" + fmt(counts[k]) + "</b></span>").join("");
    countTo($("#mWeekly"), ((counts[0] + counts[1]) / users.length) * 100, (v) => Math.round(v) + "%");
    whenVisible(bar, () => $$("i", bar).forEach((i) => { i.style.flexGrow = i.dataset.g; }));
  }

  /* ================================================================= Reach */
  function renderReach() {
    const r = days(), share = sum(D.daily.visitorsDaily, 0, r) / sum(D.daily.visitorsDaily, 0, D.DAYS);
    const top = alive().filter((u) => u.status !== "Disabled").sort((a, b) => b.visitors - a.visitors).slice(0, 8);
    const max = top[0].visitors * share;
    const tb = $("#leaderboard tbody");
    tb.innerHTML = top.map((u, i) => {
      const v = Math.max(1, Math.round(u.visitors * share));
      return '<tr class="clickable" data-id="' + u.id + '"><td><div class="user-cell"><span class="rank">' + (i + 1) + '</span><span class="avatar avatar--sm' + (i === 0 ? " avatar--warm" : "") + '">' + esc(u.name.charAt(0)) + '</span><div><div class="user-cell__name">' + esc(u.name) + '</div><div class="user-cell__mail">' + esc(D.COLLEGES[u.college].short) + " · " + u.projects + (u.projects === 1 ? " project" : " projects") + '</div></div></div></td><td><div class="inline-bar"><span class="track"><i data-w="' + ((v / max) * 100).toFixed(1) + '"' + (i === 0 ? ' style="background:linear-gradient(90deg,#bccf67,#f6e3c0)"' : "") + '></i></span><b>' + fmt(v) + "</b></div></td><td>" + secs(u.avgViewSec) + "</td><td>" + fmt(Math.round(u.filesOpened * share)) + '</td><td><button class="link-btn" type="button">Open</button></td></tr>';
    }).join("");
    whenVisible(tb, () => $$(".track i", tb).forEach((i, k) => setTimeout(() => { i.style.width = i.dataset.w + "%"; }, k * 60)));

    const views = sum(D.daily.pageViews, 0, r), vPrev = sum(D.daily.pageViews, r, 2 * r);
    countTo($("#rViews"), views, C.compact);
    $("#rViewsSub").textContent = state.range === "all" ? "since launch" : (views >= vPrev ? "Up " : "Down ") + Math.abs(pctChange(views, vPrev)).toFixed(0) + "% on the period before";
    countTo($("#rTime"), mean(D.daily.viewSeconds, 0, r), secs);
    const totalFiles = sum(D.daily.filesOpened, 0, r), wsum = D.FILES.reduce((s, f) => s + f.w, 0);
    $("#rFilesTotal").textContent = fmt(totalFiles) + " opens";
    const host = $("#filesBars");
    host.innerHTML = D.FILES.slice(0, 6).map((f) => '<div class="hbar"><span class="hbar__label">' + esc(f.name) + '</span><span class="hbar__val">' + fmt((totalFiles * f.w) / wsum) + ' opens</span><span class="hbar__track"><i data-w="' + (f.w * 100).toFixed(0) + '"></i></span></div>').join("");
    whenVisible(host, () => $$("i", host).forEach((i, k) => setTimeout(() => { i.style.width = i.dataset.w + "%"; }, k * 70)));
  }

  /* ================================================================= Customisation */
  function renderCustom() {
    const users = alive(), N = users.length;
    const count = (key, len) => { const c = new Array(len).fill(0); users.forEach((u) => c[u[key]]++); return c; };
    const wp = count("wallpaper", D.WALLPAPERS.length), order = wp.map((n, i) => ({ n, i })).sort((a, b) => b.n - a.n), wmax = order[0].n;
    const host = $("#wallpapers");
    host.innerHTML = order.map((o, k) => { const w = D.WALLPAPERS[o.i]; return '<div class="wp' + (k === 0 ? " wp--top" : "") + '"><div class="wp__thumb" style="background:' + w.css + '"></div><div class="wp__meta"><span>' + esc(w.name) + "</span><b>" + Math.round((o.n / N) * 100) + '%</b></div><div class="meter' + (k === 0 ? " meter--warm" : "") + '"><i data-w="' + ((o.n / wmax) * 100).toFixed(0) + '"></i></div></div>'; }).join("");
    whenVisible(host, () => $$(".meter i", host).forEach((i, k) => setTimeout(() => { i.style.width = i.dataset.w + "%"; }, k * 60)));

    const ts = count("tableStyle", D.TABLE_STYLES.length), tmax = Math.max.apply(null, ts);
    const th = $("#tableStyles");
    th.innerHTML = D.TABLE_STYLES.map((t, i) => ({ t, n: ts[i] })).sort((a, b) => b.n - a.n).map((x) => '<div class="hbar"><span class="hbar__label">' + esc(x.t.name) + '</span><span class="hbar__val">' + Math.round((x.n / N) * 100) + '%</span><span class="hbar__track"><i data-w="' + ((x.n / tmax) * 100).toFixed(0) + '"></i></span></div>').join("");
    whenVisible(th, () => $$("i", th).forEach((i, k) => setTimeout(() => { i.style.width = i.dataset.w + "%"; }, k * 70)));

    const sw = (sel, list, key) => {
      const c = count(key, list.length), mx = Math.max.apply(null, c);
      $(sel).innerHTML = list.map((x, i) => ({ x, n: c[i] })).sort((a, b) => b.n - a.n).map((o) => { const s = 16 + (o.n / mx) * 30; return '<div class="swatch" title="' + esc(o.x.name) + '"><i style="width:' + s + "px;height:" + s + "px;background:" + (o.x.solid || o.x.hex) + '"></i><b>' + Math.round((o.n / N) * 100) + "%</b>" + esc(o.x.name) + "</div>"; }).join("");
    };
    sw("#textColours", D.TEXT_COLOURS, "textColour");
    sw("#glassColours", D.GLASS_COLOURS, "glassColour");
  }

  /* ================================================================= Accounts */
  function renderAccounts() {
    const users = alive(), N = users.length;
    const st = { Active: 0, "On hold": 0, Disabled: 0 }; users.forEach((u) => st[u.status]++);
    $("#accTotal").textContent = fmt(N) + " total";
    const badge = { Active: "badge--active", "On hold": "badge--hold", Disabled: "badge--disabled" };
    const host = $("#statusRows");
    host.innerHTML = Object.keys(st).map((k) => '<div class="status-row"><div class="status-row__top"><span class="badge ' + badge[k] + '">' + k + '</span><b class="tnum">' + fmt(st[k]) + '</b></div><div class="meter' + (k === "On hold" ? " meter--warm" : "") + '"><i data-w="' + ((st[k] / N) * 100).toFixed(1) + '"' + (k === "Disabled" ? ' style="background:var(--olive-500)"' : "") + "></i></div></div>").join("");
    whenVisible(host, () => $$("i", host).forEach((i, k) => setTimeout(() => { i.style.width = Math.max(1, +i.dataset.w) + "%"; }, k * 90)));

    const roles = [{ label: "Editor", color: "#bccf67" }, { label: "Viewer", color: "#8e9c4e" }, { label: "Super admin", color: "#f0b45a" }];
    roles.forEach((r) => { r.value = users.filter((u) => u.role === r.label).length; });
    C.donut($("#rolesDonut"), roles);
    $("#rolesLegend").innerHTML = roles.map((r) => '<div class="row"><span class="bar" style="background:' + r.color + '"></span><div><p class="overline">' + r.label + '</p><span class="tnum" style="font-weight:600">' + fmt(r.value) + '</span> <span class="caption">' + ((r.value / N) * 100).toFixed(1) + "%</span></div></div>").join("");

    const holdOld = users.filter((u) => u.status === "On hold").length, disOld = users.filter((u) => u.status === "Disabled" && u.lastActive >= 30).length;
    const unknown = users.filter((u) => u.college === 10 && u.signupDay < days()).length;
    const att = [
      { ico: "i-flag", title: "3 portfolios reported by viewers", text: "Oldest report waiting 2 days", act: "Review", fn: () => toast("Opening reports. This screen is next on the build list.") },
      { ico: "i-pause", title: holdOld + " accounts on hold", text: "Meera Iyer has waited 12 days", act: "Review", fn: () => { setStatusFilter("On hold"); $("#users").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); } },
      { ico: "i-moon", title: disOld + " disabled accounts gone quiet", text: "No sign in for 30 days or more", act: "Review", fn: () => { setStatusFilter("Disabled"); $("#users").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }); } },
      { ico: "i-building", title: unknown + " signups from unlisted organisations", text: "Add their college so reports group them", act: "Sort", fn: () => toast("Organisation matching opens here in the full build.") }
    ];
    const ul = $("#attention");
    ul.innerHTML = att.map((a, i) => '<li><span class="att-ico"><svg class="ico"><use href="#' + a.ico + '"/></svg></span><span><b>' + esc(a.title) + "</b>" + esc(a.text) + '</span><button class="btn btn--secondary btn--sm" type="button" data-i="' + i + '">' + a.act + "</button></li>").join("");
    ul.onclick = (e) => { const b = e.target.closest("button"); if (b) att[+b.dataset.i].fn(); };
  }
  function renderAudit() {
    $("#auditLog").innerHTML = D.AUDIT.slice(0, 6).map((a, i) => '<li class="' + (a.fresh ? "new" : "") + '"><span class="avatar avatar--xs">' + esc(a.who.charAt(0)) + '</span><div><b>' + esc(a.who) + "</b> " + esc(a.text) + "<time>" + ago(a.when) + "</time></div></li>").join("");
    D.AUDIT.forEach((a) => { a.fresh = false; });
  }

  /* ================================================================= Users table */
  function filteredUsers() {
    const q = state.query.trim().toLowerCase();
    return alive().filter((u) => (!state.status || u.status === state.status) && (!q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || D.COLLEGES[u.college].name.toLowerCase().includes(q) || D.COLLEGES[u.college].short.toLowerCase().includes(q)))
      .sort((a, b) => a.lastActive - b.lastActive || b.visitors - a.visitors);
  }
  const statusBadge = (s) => '<span class="badge ' + ({ Active: "badge--active", "On hold": "badge--hold", Disabled: "badge--disabled" }[s]) + '">' + s + "</span>";
  function renderUsers() {
    const list = filteredUsers(), show = list.slice(0, state.page);
    $("#usersTable tbody").innerHTML = show.length ? show.map((u) => '<tr class="clickable" data-id="' + u.id + '"><td><div class="user-cell"><span class="avatar avatar--sm">' + esc(u.name.charAt(0)) + '</span><div><div class="user-cell__name">' + esc(u.name) + '</div><div class="user-cell__mail">' + esc(u.email) + "</div></div></div></td><td>" + esc(D.COLLEGES[u.college].short) + '</td><td><span class="badge badge--role' + (u.role === "Super admin" ? " badge--super" : "") + '">' + u.role + "</span></td><td>" + u.projects + "</td><td>" + (u.lastActive === 0 && u.role === "Super admin" ? "Now" : lastActiveText(u.lastActive)) + "</td><td>" + statusBadge(u.status) + '</td><td><button class="link-btn" type="button">Manage</button></td></tr>').join("")
      : '<tr><td colspan="7" style="padding:32px 16px;text-align:center;color:var(--text-muted)">No one matches that search.</td></tr>';
    $("#usersCount").textContent = "Showing " + fmt(show.length) + " of " + fmt(list.length) + " users";
    $("#moreUsers").hidden = show.length >= list.length;
  }
  let statusSegCtl;
  function setStatusFilter(s) { state.status = s; state.page = 8; statusSegCtl.set((b) => b.dataset.status === s); renderUsers(); }
  function initUsers() {
    statusSegCtl = seg($("#statusSeg"), (b) => { state.status = b.dataset.status; state.page = 8; renderUsers(); });
    $("#userSearch").addEventListener("input", (e) => { state.query = e.target.value; state.page = 8; renderUsers(); });
    $("#moreUsers").addEventListener("click", () => { state.page += 8; renderUsers(); });
    const byId = (id) => D.users.find((u) => u.id === id);
    ["#usersTable", "#leaderboard"].forEach((sel) => $(sel).addEventListener("click", (e) => { const tr = e.target.closest("tr[data-id]"); if (tr) openDrawer(byId(tr.dataset.id)); }));
    renderUsers();
  }

  /* ================================================================= Drawer */
  const STATUS_TEXT = {
    Active: (u) => first(u.name) + " can sign in, edit their portfolio and share it. Their read-only link works for everyone.",
    "On hold": (u) => u.name + " cannot sign in or edit for now. Their share link still works, so viewers can see the page.",
    Disabled: (u) => u.name + " cannot sign in, and their share link stops working. Nothing is deleted, so you can turn it back on."
  };
  const ROLES = [
    { v: "Super admin", d: "Full control of every account, role and report." },
    { v: "Editor", d: "Builds and shares their own portfolio." },
    { v: "Viewer", d: "Opens read-only pages they are sent. Cannot make a portfolio." }
  ];
  let current = null, draft = null, dStatusCtl, lastFocus = null;
  function lum(hex) { const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; }
  function openDrawer(u) {
    if (!u) return;
    current = u; draft = { status: u.status, role: u.role }; lastFocus = document.activeElement;
    $("#dAvatar").textContent = u.name.charAt(0); $("#dName").textContent = u.name; $("#dEmail").textContent = u.email;
    $("#dCollege").textContent = D.COLLEGES[u.college].name + " · joined " + dShort(u.signupDay);
    $("#dProjects").textContent = u.projects; $("#dVisitors").textContent = fmt(u.visitors); $("#dLast").textContent = lastActiveText(u.lastActive);
    // Their portfolio in their own colours (brand colours never touch a CV)
    const wp = D.WALLPAPERS[u.wallpaper], tc = D.TEXT_COLOURS[u.textColour], gc = D.GLASS_COLOURS[u.glassColour];
    $("#dPreview").style.background = wp.css;
    const lightText = lum(tc.hex) > 0.4;
    $("#dPane").style.background = lightText ? "rgba(14,14,18,.62)" : "rgba(255,255,255,.72)";
    $("#dPane").style.boxShadow = "inset 0 0 0 999px " + gc.hex.replace(/[\d.]+\)$/, "0.18)");
    $("#dPaneName").textContent = u.name; $("#dPaneName").style.color = tc.hex;
    $$(".preview__line", $("#dPane")).forEach((l) => { l.style.background = tc.hex; });
    $("#dEye").textContent = fmt(u.visitors);
    dStatusCtl.set((b) => b.dataset.v === u.status); $("#dStatusText").textContent = STATUS_TEXT[u.status](u);
    renderRoles();
    $("#scrim").classList.add("on"); const dr = $("#drawer"); dr.classList.add("on"); dr.setAttribute("aria-hidden", "false");
    setTimeout(() => { dStatusCtl.place(); $("#drawerClose").focus(); }, 60);
  }
  function renderRoles() {
    $("#dRoles").innerHTML = ROLES.map((r) => '<label class="radio-row' + (draft.role === r.v ? " checked" : "") + '"><input type="radio" name="role" value="' + r.v + '"' + (draft.role === r.v ? " checked" : "") + '><div><b>' + r.v + "</b><span>" + r.d + "</span></div></label>").join("");
  }
  function closeDrawer() {
    $("#scrim").classList.remove("on"); const dr = $("#drawer"); dr.classList.remove("on"); dr.setAttribute("aria-hidden", "true");
    current = null; if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function logChange(text) { D.AUDIT.unshift({ who: ME, text, when: 0, fresh: true }); renderAudit(); }
  function saveDrawer() {
    if (!current) return;
    const u = current, msgs = [];
    if (draft.status !== u.status) {
      u.status = draft.status;
      msgs.push(draft.status === "On hold" ? "put " + u.name + " on hold" : draft.status === "Disabled" ? "disabled " + u.name : "activated " + u.name);
    }
    if (draft.role !== u.role) { msgs.push("changed " + u.name + " from " + u.role + " to " + draft.role); u.role = draft.role; }
    closeDrawer();
    if (!msgs.length) return;
    msgs.forEach(logChange);
    renderUsers(); renderAccounts();
    toast("Saved. " + u.name + " is now " + (u.status === "Active" ? "active" : u.status.toLowerCase()) + " as " + (u.role === "Super admin" ? "a super admin" : "an " + u.role.toLowerCase()).replace("an viewer", "a viewer") + ".");
  }
  function initDrawer() {
    dStatusCtl = seg($("#dStatus"), (b) => { draft.status = b.dataset.v; $("#dStatusText").textContent = STATUS_TEXT[draft.status](current); });
    $("#dRoles").addEventListener("change", (e) => { draft.role = e.target.value; renderRoles(); });
    ["#drawerClose", "#dCancel", "#scrim"].forEach((s) => $(s).addEventListener("click", () => { closeDrawer(); closeDialogs(); closePalette(); }));
    $("#dSave").addEventListener("click", saveDrawer);
    $("#dDelete").addEventListener("click", () => {
      if (!current) return;
      $("#cTitle").textContent = "Delete " + current.name + "'s account?";
      $("#cBody").textContent = "Their portfolio, " + current.projects + " projects and every attached document are removed, and their share link stops working. This cannot be undone.";
      $("#confirmDialog").classList.add("on"); $("#cConfirm").focus();
    });
    $("#cConfirm").addEventListener("click", () => {
      const u = current; if (!u) return;
      u.deleted = true; closeDialogs(); closeDrawer(); logChange("deleted " + u.name + "'s account");
      if (sky) sky.refresh(); renderUsers(); renderAccounts(); renderKPIs(false); $("#skyTotal").textContent = fmt(alive().length);
      toast(u.name + "'s account was deleted.");
    });
  }
  function closeDialogs() { $$(".dialog").forEach((d) => d.classList.remove("on")); }

  /* ================================================================= Add user */
  function initAddUser() {
    $("#addUserBtn").addEventListener("click", () => { $("#addDialog").classList.add("on"); $("#scrim").classList.add("on"); setTimeout(() => $("#aName").focus(), 50); });
    $$("[data-close]").forEach((b) => b.addEventListener("click", () => { closeDialogs(); if (!$("#drawer").classList.contains("on")) $("#scrim").classList.remove("on"); }));
    $("#aConfirm").addEventListener("click", () => {
      const name = $("#aName").value.trim(), email = $("#aEmail").value.trim(), role = $("#aRole").value;
      if (!name || !/^\S+@\S+\.\S+$/.test(email)) { toast("Add a name and a valid email to continue."); return; }
      D.users.push({ id: "u" + D.users.length, name, email, college: 10, role, status: "Active", projects: 0, documents: 0, links: 0, visitors: 0, avgViewSec: 0, filesOpened: 0, signupDay: 0, lastActive: 0, editMin: 0, sessions: 1, wallpaper: 0, tableStyle: 0, textColour: 0, glassColour: 0 });
      closeDialogs(); $("#scrim").classList.remove("on");
      logChange("added " + name + " as " + (role === "Editor" ? "an Editor" : role === "Viewer" ? "a Viewer" : "a Super admin"));
      $("#aName").value = ""; $("#aEmail").value = "";
      state.query = name; $("#userSearch").value = name; setStatusFilter(""); renderAccounts();
      toast(name + " was added. A sign in link is on its way to " + email + ".");
    });
  }

  /* ================================================================= Command palette */
  let palItems = [], palSel = 0;
  function openPalette() { $("#palette").classList.add("on"); $("#scrim").classList.add("on"); const i = $("#paletteInput"); i.value = ""; renderPalette(""); setTimeout(() => i.focus(), 30); }
  function closePalette() { if (!$("#palette").classList.contains("on")) return; $("#palette").classList.remove("on"); if (!$("#drawer").classList.contains("on")) $("#scrim").classList.remove("on"); }
  function renderPalette(q) {
    q = q.trim().toLowerCase();
    const jump = (id, label) => ({ group: "Jump to", label, run: () => document.getElementById(id).scrollIntoView({ behavior: REDUCED ? "auto" : "smooth", block: "start" }) });
    const actions = [
      { group: "Actions", label: "Add user", run: () => $("#addUserBtn").click() },
      { group: "Actions", label: "Export report for " + rangeLabel(), run: () => $("#exportBtn").click() },
      { group: "Actions", label: "Show accounts on hold", run: () => { setStatusFilter("On hold"); $("#users").scrollIntoView({ behavior: "smooth" }); } },
      jump("growth", "Growth"), jump("retention", "Retention"), jump("activity", "Activity and engagement"), jump("reach", "Portfolio reach"), jump("custom", "Customisation"), jump("access", "Accounts and access")
    ];
    const colleges = D.COLLEGES.map((c, i) => ({ group: "Light up in the sky", label: c.name, run: () => pickCollege(i, true) }));
    const people = alive().filter((u) => q && (u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))).slice(0, 6).map((u) => ({ group: "People", label: u.name, sub: u.email, run: () => openDrawer(u) }));
    palItems = people.concat(actions.filter((a) => !q || a.label.toLowerCase().includes(q)), colleges.filter((c) => q && c.label.toLowerCase().includes(q)));
    if (!q) palItems = actions.concat(colleges.slice(0, 3));
    palSel = 0;
    let lastGroup = "", html = "";
    palItems.forEach((it, i) => {
      if (it.group !== lastGroup) { html += '<div class="palette__group">' + esc(it.group) + "</div>"; lastGroup = it.group; }
      html += '<li role="option" data-i="' + i + '" class="' + (i === 0 ? "sel" : "") + '">' + (it.group === "People" ? '<span class="avatar avatar--xs">' + esc(it.label.charAt(0)) + "</span>" : '<svg class="ico"><use href="#' + (it.group === "Jump to" ? "i-arrow" : it.group === "Actions" ? "i-spark" : "i-building") + '"/></svg>') + "<span>" + esc(it.label) + (it.sub ? ' <span class="caption">' + esc(it.sub) + "</span>" : "") + "</span></li>";
    });
    $("#paletteList").innerHTML = html || '<li class="caption">Nothing matches. Try a name, an email or a college.</li>';
  }
  function runPalette(i) { const it = palItems[i]; if (!it) return; closePalette(); setTimeout(it.run, 60); }
  function initPalette() {
    const isMac = /Mac|iPhone|iPad/.test(navigator.platform); $("#kbdHint").textContent = isMac ? "⌘ K" : "Ctrl K";
    $("#openPalette").addEventListener("click", openPalette);
    $("#paletteInput").addEventListener("input", (e) => renderPalette(e.target.value));
    $("#paletteList").addEventListener("click", (e) => { const li = e.target.closest("li[data-i]"); if (li) runPalette(+li.dataset.i); });
    $("#paletteInput").addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault(); palSel = (palSel + (e.key === "ArrowDown" ? 1 : -1) + palItems.length) % palItems.length;
        $$("#paletteList li[data-i]").forEach((li) => li.classList.toggle("sel", +li.dataset.i === palSel));
        const s = $("#paletteList li.sel"); if (s) s.scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") { e.preventDefault(); runPalette(palSel); }
    });
    document.addEventListener("keydown", (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $("#palette").classList.contains("on") ? closePalette() : openPalette(); }
      else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); openPalette(); }
      else if (e.key === "Escape") { closePalette(); closeDialogs(); if ($("#drawer").classList.contains("on")) closeDrawer(); else $("#scrim").classList.remove("on"); }
    });
    $("#bellBtn").addEventListener("click", () => $("#access").scrollIntoView({ behavior: REDUCED ? "auto" : "smooth" }));
  }

  /* ================================================================= Range */
  function renderRange(firstTime) {
    renderKPIs(firstTime); renderSkyNumbers(); renderHealth(); renderTrendTabs(); renderTrend(); renderColleges(); renderActivity(); renderReach();
  }

  /* ================================================================= Boot */
  function boot() {
    const h = new Date().getHours();
    const greet = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    $(".head__sub").insertAdjacentText("afterbegin", greet + ", " + first(ME) + ". ");
    $("#footTime").textContent = "Updated " + new Date().toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) + " IST · sample data";

    SC.initSilk($("#silk"));
    initSky();
    seg($("#rangeSeg"), (b) => { state.range = b.dataset.range === "all" ? "all" : +b.dataset.range; renderRange(false); });
    $("#trendTabs").addEventListener("click", (e) => { const b = e.target.closest(".metric-tab"); if (!b) return; state.trendMetric = b.dataset.k; $$(".metric-tab").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); renderTrend(); });
    $("#collegeBars").addEventListener("click", (e) => { const b = e.target.closest(".hbar"); if (b) { pickCollege(+b.dataset.idx, true); toast("Showing " + D.COLLEGES[+b.dataset.idx].name + " in the sky."); } });
    $("#exportBtn").addEventListener("click", () => toast("Preparing a PDF of " + rangeLabel() + ". It downloads when ready."));

    renderRange(true);
    initRetention(); renderEngagement(); renderCustom(); renderAccounts(); renderAudit();
    initUsers(); initDrawer(); initAddUser(); initPalette();
    liveFeed();
    observeReveals(document);

    // Redraw width-driven charts on resize
    let rw = window.innerWidth, rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(window.innerWidth - rw) < 40) return; rw = window.innerWidth; renderTrend(); renderActivity(); C.heatmap($("#heatmap"), D.heat); renderKPIs(false); renderEngagement(); }, 200); });

    // Scroll cue disappears at the bottom
    const cue = $("#scrollCue");
    const onScroll = () => cue.classList.toggle("gone", window.innerHeight + window.scrollY > document.body.scrollHeight - 160);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
