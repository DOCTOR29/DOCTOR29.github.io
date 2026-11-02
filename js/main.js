(() => {
  const playUrl = new URL("play.js", document.currentScript.src).href; // games load only on pages that have them
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasGsap = !!window.gsap && !reduce;
  if (!hasGsap) root.classList.remove("motion");
  if (hasGsap && window.ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  let ctx;

  // Page-level motion: hero intro, scroll reveals, gentle floating art.
  function animate(container) {
    if (!hasGsap) return;
    ctx = gsap.context(() => {
      const heroKids = gsap.utils.toArray("[data-hero] > *"), artKids = gsap.utils.toArray("[data-art] > *");
      if (heroKids.length) gsap.fromTo(heroKids, { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger: 0.08, delay: 0.05 });
      if (artKids.length) gsap.from(artKids, { y: 40, opacity: 0, duration: 1.1, ease: "power3.out", stagger: 0.1, delay: 0.2 });

      gsap.utils.toArray("[data-split]").forEach(splitText);

      gsap.utils.toArray("[data-reveal]").forEach((el) => {
        gsap.from(el, { y: 40, opacity: 0, duration: 0.9, ease: "power3.out",
          scrollTrigger: { trigger: el, start: "top 88%", once: true } });
      });
      gsap.utils.toArray("[data-stagger]").forEach((list) => {
        gsap.from(list.children, { y: 24, opacity: 0, duration: 0.7, ease: "power3.out", stagger: 0.06,
          scrollTrigger: { trigger: list, start: "top 85%", once: true } });
      });
      gsap.utils.toArray("[data-parallax]").forEach((el) => {
        gsap.to(el, { yPercent: -Number(el.dataset.parallax || 8), ease: "none",
          scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });
      const floats = gsap.utils.toArray("[data-float]");
      if (floats.length) gsap.to(floats, { y: -10, rotation: "+=1", duration: 3.2, ease: "sine.inOut", yoyo: true, repeat: -1, stagger: 0.5 });
      // Apple-style tour: the section is pinned (CSS sticky) and scroll position scrubs the video.
      gsap.utils.toArray("[data-tour]").forEach((sec) => {
        const video = sec.querySelector("video");
        const steps = [...sec.querySelectorAll("[data-start]")];
        const bar = sec.querySelector(".tour-bar i");
        const dur = Number(sec.dataset.duration);
        sec.classList.add("is-scrub");
        video.removeAttribute("controls");
        video.pause();
        steps[0].classList.add("active");
        const state = { t: 0 };
        let active = 0;
        // If the user scrolled before the video was ready, jump to the right frame once it is.
        video.addEventListener("loadeddata", () => (video.currentTime = Math.min(state.t, dur - 0.05)));        gsap.to(state, {
          t: dur, ease: "none",
          scrollTrigger: { trigger: sec, start: "top top", end: "bottom bottom", scrub: 1.2 },
          onUpdate: () => {
            if (video.readyState >= 1) video.currentTime = Math.min(state.t, dur - 0.05);
            bar.style.transform = `scaleX(${state.t / dur})`;
            const i = steps.findLastIndex((s) => state.t >= Number(s.dataset.start));
            if (i !== active) { steps[active].classList.remove("active"); steps[i].classList.add("active"); active = i; }
          },
        });
      });

      // Scroll progress bar
      gsap.fromTo(progress, { scaleX: 0 }, { scaleX: 1, ease: "none",
        scrollTrigger: { start: 0, end: "max", scrub: 0.3 } });

      // Count-up numbers (final value is already in the HTML, so no-JS is fine)
      gsap.utils.toArray("[data-count]").forEach((el) => {
        const n = { v: 0 }, end = Number(el.dataset.count);
        gsap.to(n, { v: end, duration: 1.4, ease: "power2.out",
          onUpdate: () => (el.textContent = Math.round(n.v).toLocaleString("en-IN")),
          scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });
    }, container);
    if (finePointer) micro(container);
  }

  // ---------- Split headline: letters rise in, lift toward the cursor, ripple on click ----------
  function splitText(h) {
    if (h.dataset.split === "done") return;
    h.dataset.split = "done";
    h.setAttribute("aria-label", h.textContent.replace(/\s+/g, " ").trim());
    // Wrap every word (nowrap) and every letter; <em> and other inline tags are kept.
    const walk = (node) => [...node.childNodes].forEach((n) => {
      if (n.nodeType === 1) return walk(n);
      if (n.nodeType !== 3) return;
      const frag = document.createDocumentFragment();
      n.textContent.split(/( +)/).forEach((part) => {
        if (!part) return;
        if (/^ +$/.test(part)) return frag.append(" ");
        const w = Object.assign(document.createElement("span"), { className: "w" });
        w.setAttribute("aria-hidden", "true");
        [...part].forEach((ch) => w.append(Object.assign(document.createElement("span"), { className: "c", textContent: ch })));
        frag.append(w);
      });
      n.replaceWith(frag);
    });
    walk(h);
    const chars = [...h.querySelectorAll(".c")];
    gsap.from(chars, { yPercent: 70, rotationX: -90, opacity: 0, duration: 0.9, ease: "power3.out", stagger: 0.022, delay: 0.15 });

    // Click / tap: a wave runs out from the letter you hit.
    h.addEventListener("click", (e) => {
      const i = chars.indexOf(e.target.closest(".c"));
      if (i < 0) return;
      gsap.to(chars, { keyframes: { yPercent: [0, -28, 0], rotation: [0, -6, 0] }, duration: 0.7, ease: "sine.inOut",
        stagger: { each: 0.025, from: i }, overwrite: "auto" });
    });

    if (!finePointer) return;
    // Hover: letters near the pointer lift and swell, like a magnifier sliding over the line.
    const fx = chars.map((c) => ({ c, y: gsap.quickTo(c, "y", { duration: 0.45, ease: "power3.out" }),
      s: gsap.quickTo(c, "scale", { duration: 0.45, ease: "power3.out" }) }));
    const R = 140; // ponytail: rest positions cached on enter; fine while the heading doesn't reflow mid-hover
    h.addEventListener("pointerenter", () => fx.forEach((f) => {
      const r = f.c.getBoundingClientRect(); f.cx = r.left + r.width / 2; f.cy = r.top + r.height / 2;
    }));
    h.addEventListener("pointermove", (e) => fx.forEach((f) => {
      const k = Math.max(0, 1 - Math.hypot(e.clientX - f.cx, e.clientY - f.cy) / R) ** 2;
      f.y(-k * 18); f.s(1 + k * 0.12);
    }));
    h.addEventListener("pointerleave", () => fx.forEach((f) => { f.y(0); f.s(1); }));
  }

  // ---------- Micro-interactions (mouse/trackpad only) ----------
  const finePointer = hasGsap && matchMedia("(hover: hover) and (pointer: fine)").matches;
  const progress = Object.assign(document.createElement("div"), { className: "progress" });
  progress.setAttribute("aria-hidden", "true");
  document.body.prepend(progress);

  // Magnetic pull: element drifts toward the pointer, springs back on leave.
  function magnetic(el, strength = 0.3) {
    if (el._mag) return;
    el._mag = true;
    const x = gsap.quickTo(el, "x", { duration: 0.4, ease: "power3.out" });
    const y = gsap.quickTo(el, "y", { duration: 0.4, ease: "power3.out" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - r.left - r.width / 2) * strength);
      y((e.clientY - r.top - r.height / 2) * strength);
    });
    el.addEventListener("pointerleave", () => { x(0); y(0); });
  }

  // 3D tilt toward the pointer.
  function tilt(el, max = 5) {
    const rx = gsap.quickTo(el, "rotationX", { duration: 0.5, ease: "power3.out" });
    const ry = gsap.quickTo(el, "rotationY", { duration: 0.5, ease: "power3.out" });
    gsap.set(el, { transformPerspective: 900 });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - 0.5) * max * 2);
      rx(-((e.clientY - r.top) / r.height - 0.5) * max * 2);
    });
    el.addEventListener("pointerleave", () => { rx(0); ry(0); });
  }

  function micro(scope) {
    scope.querySelectorAll(".btn, .store, .copy-btn").forEach((el) => magnetic(el));
    scope.querySelectorAll(".card").forEach((el) => tilt(el, 3));
    scope.querySelectorAll(".device-stage, .cs-visual").forEach((el) => tilt(el, 4));

    // Hero art: layers drift at different depths with the pointer.
    const hero = scope.querySelector(".hero");
    if (hero) {
      const layers = [...hero.querySelectorAll(".hero-art > *")].map((el, i) => ({
        x: gsap.quickTo(el, "x", { duration: 0.8, ease: "power3.out" }),
        y: gsap.quickTo(el, "y", { duration: 0.8, ease: "power3.out" }),
        d: (i + 1) * 6,
      }));
      hero.addEventListener("pointermove", (e) => {
        const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
        layers.forEach((l) => { l.x(nx * l.d); l.y(ny * l.d); });
      });
    }
  }

  // Cursor follower: small dot that grows into a "View" badge over cards.
  if (finePointer) {
    const cursor = Object.assign(document.createElement("div"), { className: "cursor" });
    cursor.setAttribute("aria-hidden", "true");
    cursor.innerHTML = "<span></span>";
    document.body.append(cursor);
    const cx = gsap.quickTo(cursor, "x", { duration: 0.35, ease: "power3.out" });
    const cy = gsap.quickTo(cursor, "y", { duration: 0.35, ease: "power3.out" });
    addEventListener("pointermove", (e) => { cx(e.clientX); cy(e.clientY); cursor.classList.add("on"); });
    document.addEventListener("pointerleave", () => cursor.classList.remove("on"));
    document.addEventListener("pointerover", (e) => {
      const view = e.target.closest(".card, .next-project");
      const link = e.target.closest("a, button");
      cursor.classList.toggle("view", !!view);
      cursor.classList.toggle("link", !view && !!link);
      cursor.firstChild.textContent = view ? (view.classList.contains("next-project") ? "Next" : "View") : "";
    });
    document.addEventListener("pointerdown", () => gsap.to(cursor, { scale: 0.8, duration: 0.15 }));
    document.addEventListener("pointerup", () => gsap.to(cursor, { scale: 1, duration: 0.3, ease: "back.out(3)" }));
    document.querySelectorAll(".site-header .nav-cta, .menu-btn").forEach((el) => magnetic(el, 0.25));
  }

  // Mobile menu
  const menuBtn = document.querySelector(".menu-btn");
  const navList = document.getElementById("nav-list");
  const closeMenu = () => { navList.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); };
  menuBtn?.addEventListener("click", () => {
    const open = navList.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(open));
  });
  navList?.addEventListener("click", (e) => { if (e.target.closest("a")) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  // Copy email (delegated so it survives Barba swaps)
  document.addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-copy]");
    if (!btn) return;
    const status = btn.parentElement.querySelector(".copy-status");
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      status.textContent = "Copied to clipboard";
      btn.classList.add("copied");
      btn.textContent = "Copied ✓";
      if (hasGsap) gsap.fromTo(btn, { scale: 0.9 }, { scale: 1, duration: 0.5, ease: "back.out(4)" });
    } catch { status.textContent = "Copy failed. Select the address instead."; }
    setTimeout(() => { status.textContent = ""; btn.classList.remove("copied"); btn.textContent = "Copy address"; }, 2500);
  });

  // Skip tour: jump past the pinned section without scrubbing through it, then move focus on.
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-skip-tour]");
    if (!btn) return;
    const sec = btn.closest("[data-tour]");
    window.scrollTo({ top: sec.offsetTop + sec.offsetHeight, behavior: "instant" });
    const next = sec.nextElementSibling?.querySelector("h2");
    if (next) { next.setAttribute("tabindex", "-1"); next.focus({ preventScroll: true }); }
  });

  // ---------- Diagram wiring: SVG connectors between the boxes that talk to each other ----------
  const SVGNS = "http://www.w3.org/2000/svg";
  function wire(fig) {
    const nodes = Object.fromEntries([...fig.querySelectorAll("[data-id]")].map((n) => [n.dataset.id, n]));
    const pairs = [];
    fig.querySelectorAll("[data-links]").forEach((n) =>
      n.dataset.links.split(/\s+/).forEach((t) => nodes[t] && pairs.push([n, nodes[t]])));
    if (!pairs.length) return;

    let svg = fig.querySelector(":scope > svg.wires");
    if (!svg) { svg = document.createElementNS(SVGNS, "svg"); svg.setAttribute("class", "wires"); svg.setAttribute("aria-hidden", "true"); fig.prepend(svg); }

    const draw = () => {
      const f = fig.getBoundingClientRect();
      // Narrow screens stack every box in one column; fall back to the simple CSS connector there.
      if (f.width < 600) { svg.replaceChildren(); fig.classList.remove("wired"); return; }
      fig.classList.add("wired");
      const rows = [...fig.querySelectorAll(".arch-row")];
      const rowRect = (i) => { const b = rows[i].getBoundingClientRect(); return { t: b.top - f.top, b: b.bottom - f.top }; };
      const gapY = (i) => (rowRect(i).b + rowRect(i + 1).t) / 2; // middle of the gap below row i
      svg.setAttribute("viewBox", `0 0 ${f.width} ${f.height}`);
      svg.replaceChildren();
      const r = (el) => { const b = el.getBoundingClientRect(); return { l: b.left - f.left, r: b.right - f.left, t: b.top - f.top, b: b.bottom - f.top, cx: b.left - f.left + b.width / 2 }; };
      // Spread several wires leaving/entering the same edge so they don't overlap.
      const slots = new Map();
      const slot = (el, edge) => { const k = el.dataset.id + edge; const s = slots.get(k) || { n: 0, i: 0 }; s.n++; slots.set(k, s); return s; };
      const plan = pairs.map(([a, b]) => {
        const A = r(a), B = r(b);
        const kind = B.t >= A.b - 2 ? "down" : B.b <= A.t + 2 ? "up" : "side";
        return { a, b, A, B, kind, sa: kind === "side" ? null : slot(a, kind === "down" ? "b" : "t"), sb: kind === "side" ? null : slot(b, kind === "down" ? "t" : "b") };
      });
      const x = (R, s) => R.l + ((R.r - R.l) * ++s.i) / (s.n + 1);
      let lane = 0;
      plan.forEach(({ a, b, A, B, kind, sa, sb }, i) => {
        let d;
        if (kind === "side") {
          const y = Math.min(A.b, B.b) - Math.min(A.b - A.t, B.b - B.t) / 2;
          const [x1, x2] = B.l >= A.r ? [A.r, B.l] : [A.l, B.r];
          d = `M${x1},${y} L${x2},${y}`;
        } else if (Math.abs(rows.indexOf(b.closest(".arch-row")) - rows.indexOf(a.closest(".arch-row"))) > 1) {
          // Skips a layer: route through the gaps and down the right-hand gutter instead of behind the boxes.
          const x1 = x(A, sa), x2 = x(B, sb), gx = f.width - 12 - lane++ * 7; // one gutter lane per wire
          const ra = rows.indexOf(a.closest(".arch-row")), rb = rows.indexOf(b.closest(".arch-row"));
          const y1 = gapY(Math.min(ra, rb)), y2 = gapY(Math.max(ra, rb) - 1);
          d = kind === "down"
            ? `M${x1},${A.b} L${x1},${y1} L${gx},${y1} L${gx},${y2} L${x2},${y2} L${x2},${B.t}`
            : `M${x1},${A.t} L${x1},${y2} L${gx},${y2} L${gx},${y1} L${x2},${y1} L${x2},${B.b}`;
        } else {
          const x1 = x(A, sa), x2 = x(B, sb);
          const y1 = kind === "down" ? A.b : A.t, y2 = kind === "down" ? B.t : B.b, my = (y1 + y2) / 2;
          d = `M${x1},${y1} C${x1},${my} ${x2},${my} ${x2},${y2}`;
        }
        const path = document.createElementNS(SVGNS, "path");
        path.setAttribute("d", d);
        path.setAttribute("id", `w-${fig.dataset.wid}-${i}`);
        svg.append(path);
        if (!reduce) {
          const dot = document.createElementNS(SVGNS, "circle");
          dot.setAttribute("r", "3.5");
          const mo = document.createElementNS(SVGNS, "animateMotion");
          mo.setAttribute("dur", `${1.6 + (i % 3) * 0.35}s`);
          mo.setAttribute("begin", `${(i * 0.45) % 2}s`);
          mo.setAttribute("repeatCount", "indefinite");
          const mp = document.createElementNS(SVGNS, "mpath");
          mp.setAttribute("href", `#w-${fig.dataset.wid}-${i}`);
          mo.append(mp); dot.append(mo); svg.append(dot);
        }
      });
    };
    draw();
    if (!fig._wireObs) { fig._wireObs = new ResizeObserver(draw); fig._wireObs.observe(fig); }
  }
  let play = null;
  const games = (scope) => { if (scope.querySelector("[data-game]")) import(playUrl).then((m) => { play = m; m.mount(scope); }); };
  let wireCount = 0;
  const wires = (scope) => scope.querySelectorAll("figure.arch").forEach((fig) => { fig.dataset.wid ||= ++wireCount; wire(fig); });

  const scrollToHash = () => {
    const target = location.hash && document.querySelector(location.hash);
    // "instant" overrides the CSS smooth scrolling, which otherwise animates from the old position.
    if (target) target.scrollIntoView({ behavior: "instant" }); else window.scrollTo({ top: 0, behavior: "instant" });
  };


  // ---------- Easter egg: a ticket hidden somewhere along the footer opens a random mini game ----------
  const GAME_HTML = {
    "gate-rush": `<div data-game="gate-rush"><p class="label">Gate Rush</p><p class="egg-help">Scan valid tickets, let used and cancelled ones pass.</p>
      <canvas tabindex="0" role="img" aria-label="Gate Rush game. Press Space or Enter to scan, or tap the game."></canvas>
      <div class="game-bar"><button class="btn btn-primary" type="button" data-scan>Scan <span class="kbd" aria-hidden="true">Space</span></button>
      <dl class="game-stats"><div><dt class="label">Score</dt><dd data-score>0</dd></div><div><dt class="label">Lives</dt><dd data-lives>●●●</dd></div><div><dt class="label">Best</dt><dd data-best>0</dd></div></dl></div>
      <p class="game-status" role="status" aria-live="polite" data-status>Press Scan to open the gate.</p></div>`,
    "thrift-flip": `<div data-game="thrift-flip"><p class="label">Thrift Flip</p><p class="egg-help">Match the pairs in as few moves as you can.</p>
      <div class="flip-grid" data-grid></div>
      <div class="game-bar"><button class="btn btn-ghost" type="button" data-reset>Shuffle again</button>
      <dl class="game-stats"><div><dt class="label">Moves</dt><dd data-moves>0</dd></div><div><dt class="label">Best</dt><dd data-best>–</dd></div></dl></div>
      <p class="game-status" role="status" aria-live="polite" data-status></p></div>`,
  };
  const footer = document.querySelector(".site-footer");
  const egg = Object.assign(document.createElement("button"), { type: "button", className: "egg", innerHTML: '<span aria-hidden="true">🎟</span>' });
  egg.setAttribute("aria-label", "You found a hidden ticket. Open a mini game");
  const dlg = document.createElement("dialog");
  dlg.className = "egg-dialog";
  dlg.setAttribute("aria-label", "Mini game");
  footer?.append(egg); document.body.append(dlg);
  let eggCleanup = null;
  const placeEgg = () => { egg.style.left = `${8 + Math.random() * 84}%`; egg.dataset.eggGame = Math.random() < 0.5 ? "gate-rush" : "thrift-flip"; };
  egg.addEventListener("click", async () => {
    dlg.innerHTML = `<button class="egg-close" type="button" aria-label="Close game">×</button><p class="label egg-found">You found a hidden ticket 🎟</p>${GAME_HTML[egg.dataset.eggGame]}<p class="egg-more">More in the <a href="playground.html">playground</a>.</p>`;
    dlg.querySelector(".egg-close").addEventListener("click", () => dlg.close());
    dlg.querySelector(".egg-more a").addEventListener("click", () => dlg.close());
    dlg.showModal();
    const m = await import(playUrl);
    eggCleanup = m.mountOne(dlg.querySelector("[data-game]"));
  });
  dlg.addEventListener("close", () => { eggCleanup?.(); eggCleanup = null; dlg.innerHTML = ""; placeEgg(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }); // click on backdrop
  placeEgg();

  // ---------- Buddy: a little ink blob in the corner whose eyes follow the cursor ----------
  const buddy = Object.assign(document.createElement("button"), { type: "button", className: "buddy" });
  buddy.setAttribute("aria-label", "Buddy. Click to say hi");
  buddy.innerHTML = '<span class="buddy-inner" aria-hidden="true"><span class="buddy-feet"><i></i><i></i></span><span class="buddy-body"><span class="eye"><i></i></span><span class="eye"><i></i></span><span class="mouth"></span></span></span><span class="buddy-say" role="status" aria-live="polite"></span>';
  document.body.append(buddy);
  const pupils = [...buddy.querySelectorAll(".eye i")];
  const say = buddy.querySelector(".buddy-say");
  const look = (x, y) => pupils.forEach((p) => {
    const r = p.parentElement.getBoundingClientRect();
    const dx = x - (r.left + r.width / 2), dy = y - (r.top + r.height / 2);
    const d = Math.min(1, Math.hypot(dx, dy) / 120), a = Math.atan2(dy, dx);
    p.style.transform = `translate(${Math.cos(a) * 4 * d}px, ${Math.sin(a) * 4 * d}px)`;
  });
  // Walking: stroll along the bottom edge toward the cursor; wander when the pointer has been still a while.
  const SIZE = () => buddy.offsetWidth || 64;
  let bx = innerWidth - SIZE() - 18, by = 0, vy = 0, target = bx, lastMove = 0, walkRaf = 0, lastT = 0, drag = null;
  const place = () => { buddy.style.setProperty("--bx", `${bx}px`); buddy.style.setProperty("--by", `${by}px`); };
  const clampX = (x) => Math.max(8, Math.min(innerWidth - SIZE() - 8, x));
  const walk = (t) => {
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    if (drag) { walkRaf = requestAnimationFrame(walk); return; }
    if (by < 0) { walkRaf = requestAnimationFrame(walk); return; } // still falling
    if (t - lastMove > 4000 && Math.abs(target - bx) < 2) { target = clampX(Math.random() * innerWidth); lastMove = t - 2500; } // idle wander
    const d = target - bx, step = Math.sign(d) * Math.min(Math.abs(d), 260 * dt);
    bx += step; place();
    const moving = Math.abs(d) > 2;
    buddy.classList.toggle("walking", moving);
    buddy.style.setProperty("--lean", moving ? `${Math.sign(d) * 6}deg` : "0deg");
    buddy.classList.toggle("say-left", bx < 240);
    walkRaf = requestAnimationFrame(walk);
  };
  const aim = (x) => { if (drag) return; target = clampX(x - SIZE() / 2); lastMove = performance.now(); };
  // Drag: grab buddy anywhere, drop it, it falls back to the floor and walks on.
  let dragged = false;
  buddy.style.touchAction = "none";
  buddy.addEventListener("pointerdown", (e) => {
    buddy.setPointerCapture(e.pointerId);
    drag = { ox: e.clientX - bx, oy: e.clientY - by, sx: e.clientX, sy: e.clientY }; dragged = false; vy = 0;
  });
  buddy.addEventListener("pointermove", (e) => {
    if (!drag) return;
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 4) dragged = true;
    if (!dragged) return;
    bx = clampX(e.clientX - drag.ox);
    by = Math.max(-(innerHeight - SIZE() - 8), Math.min(0, e.clientY - drag.oy));
    buddy.classList.add("dragging"); buddy.classList.remove("walking"); place();
  });
  const drop = () => {
    if (!drag) return;
    drag = null; target = bx; lastMove = performance.now(); buddy.classList.remove("dragging");
    // Own fall loop, so the drop never depends on the walk loop running.
    let last = performance.now();
    const fall = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      vy += 2400 * dt; by = reduce ? 0 : Math.min(0, by + vy * dt);
      place();
      if (by < 0 && !drag) requestAnimationFrame(fall); else vy = 0;
    };
    requestAnimationFrame(fall);
  };
  buddy.addEventListener("pointerup", drop);
  buddy.addEventListener("pointercancel", drop);
  buddy.addEventListener("lostpointercapture", drop);
  addEventListener("pointermove", (e) => { look(e.clientX, e.clientY); aim(e.clientX); }, { passive: true });
  addEventListener("pointerdown", (e) => { look(e.clientX, e.clientY); aim(e.clientX); }, { passive: true });
  addEventListener("resize", () => { bx = clampX(bx); target = clampX(target); place(); });
  place();
  if (!reduce) walkRaf = requestAnimationFrame(walk);
  document.addEventListener("visibilitychange", () => { cancelAnimationFrame(walkRaf); lastT = 0; if (!document.hidden && !reduce) walkRaf = requestAnimationFrame(walk); });
  const lines = ["Hi! I'm watching your cursor 👀", "Psst… there's a ticket hidden along the bottom of the page.", "Scroll a case study. The videos play as you go.", "Want to build something? Contact's at the bottom.", "I don't blink much. I'm busy watching.", "Try the playground. Gate Rush gets fast."];
  let sayTimer = 0, lineIdx = 0;
  buddy.addEventListener("click", () => {
    if (dragged) { dragged = false; return; } // end of a drag, not a click
    target = bx; lastMove = performance.now() + 2500; // stand still while talking
    say.textContent = lines[lineIdx++ % lines.length];
    buddy.classList.add("talking");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => buddy.classList.remove("talking"), 3200);
  });

  animate(document);
  wires(document);
  games(document);
  setTimeout(() => root.classList.remove("motion"), 2500); // safety net if animations never run

  // Page transitions (skipped entirely for reduced motion: normal navigation instead)
  if (!hasGsap || !window.barba) return;
  history.scrollRestoration = "manual";
  const curtain = document.querySelector(".curtain");
  const curtainText = curtain.querySelector("span");
  const samePage = (href) => {
    const u = new URL(href, location.href);
    const norm = (p) => p.replace(/index\.html$/, "");
    return u.hash && u.origin === location.origin && norm(u.pathname) === norm(location.pathname);
  };

  barba.init({
    preventRunning: true,
    prevent: ({ href }) => samePage(href),
    transitions: [{
      name: "curtain",
      async leave({ trigger }) {
        closeMenu();
        curtainText.textContent = (trigger && trigger.dataset && trigger.dataset.title) || "";
        await gsap.timeline()
          .set(curtain, { transformOrigin: "bottom" })
          .to(curtain, { scaleY: 1, duration: 0.55, ease: "power3.inOut" })
          .to(curtainText, { opacity: 1, duration: 0.25 }, "-=0.15");
      },
      beforeEnter() { ctx?.revert(); play?.unmount(); scrollToHash(); },
      async after({ next }) {
        scrollToHash(); // again, now the old page is gone and the new page has its full height
        root.classList.add("motion");
        animate(next.container);
        wires(next.container);
        games(next.container);
        placeEgg();
        window.ScrollTrigger?.refresh();
        await gsap.timeline()
          .to(curtainText, { opacity: 0, duration: 0.2 })
          .set(curtain, { transformOrigin: "top" })
          .to(curtain, { scaleY: 0, duration: 0.6, ease: "power3.inOut" });
        root.classList.remove("motion");
        // Move focus to the new page's heading for keyboard and screen-reader users
        const h1 = next.container.querySelector("h1");
        if (h1 && !location.hash) { h1.setAttribute("tabindex", "-1"); h1.focus({ preventScroll: true }); }
      },
    }],
  });
})();
