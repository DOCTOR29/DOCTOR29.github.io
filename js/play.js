// Playground games. Loaded on demand by main.js when a page has [data-game].
// Each game returns a cleanup function so Barba page changes don't leak loops or listeners.

const store = {
  get(k) { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } },
  set(k, v) { try { localStorage.setItem(k, String(v)); } catch {} },
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------- Gate Rush: scan valid tickets, let used/cancelled ones pass ----------
function gateRush(root) {
  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const scoreEl = root.querySelector("[data-score]");
  const bestEl = root.querySelector("[data-best]");
  const livesEl = root.querySelector("[data-lives]");
  const status = root.querySelector("[data-status]");
  const btn = root.querySelector("[data-scan]");
  const H = 220, GATE_X = 70, GATE_W = 86, T_W = 120, T_H = 74;
  let W = 600, dpr = 1, raf = 0, last = 0;
  let state = "idle", score = 0, lives = 3, speed = 150, spawnIn = 0, tickets = [], flash = null;
  let best = store.get("gate-rush-best");
  bestEl.textContent = best;

  const size = () => {
    W = canvas.clientWidth; dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  };
  const ro = new ResizeObserver(size); ro.observe(canvas);

  const say = (msg) => { status.textContent = msg; };
  const hud = () => { scoreEl.textContent = score; livesEl.textContent = "●".repeat(lives) + "○".repeat(3 - lives); };

  function start() {
    state = "play"; score = 0; lives = 3; speed = 150; spawnIn = 0.9; flash = null;
    tickets = [{ x: GATE_X + 260, seed: 3, valid: true, kind: "ok", done: false }]; // first ticket arrives quickly
    hud(); say("Go! Scan the valid tickets.");
    last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
  }
  function over() {
    state = "over";
    if (score > best) { best = score; store.set("gate-rush-best", best); bestEl.textContent = best; }
    say(`Gate closed. You admitted ${score}. Press Scan to play again.`);
    draw();
  }
  function hit(ok, label) {
    flash = { ok, label, t: 0.5 };
    if (!ok && --lives <= 0) { hud(); return over(); }
    hud();
  }
  function scan() {
    if (state !== "play") return start();
    const t = tickets.find((k) => !k.done && k.x < GATE_X + GATE_W && k.x + T_W > GATE_X);
    if (!t) { flash = { ok: false, label: "Nothing at the gate", t: 0.4 }; return; }
    t.done = true; t.lift = 0;
    if (t.valid) { score++; speed += 7; hit(true, "Valid ✓"); }
    else hit(false, t.kind === "used" ? "Already used" : "Cancelled");
  }

  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (state === "play") {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        const r = Math.random();
        tickets.push({ x: W + 10, seed: Math.floor(Math.random() * 7), valid: r < 0.62, kind: r < 0.62 ? "ok" : r < 0.85 ? "used" : "cancelled", done: false });
        spawnIn = 0.75 + Math.random() * 0.9 - Math.min(0.4, score * 0.012);
      }
      for (const t of tickets) {
        t.x -= speed * Math.max(1, W / 700) * dt; // wide screens: same time from edge to gate
        if (t.done) t.lift += dt;
        if (!t.done && !t.missed && t.x + T_W < GATE_X) { t.missed = true; if (t.valid) hit(false, "Missed one"); }
      }
      tickets = tickets.filter((t) => t.x > -T_W - 20 && (!t.done || t.lift < 0.6));
      if (flash) flash.t -= dt;
      draw();
      if (state === "play") raf = requestAnimationFrame(loop);
    }
  }

  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function draw() {
    const ink = css("--ink") || "#16140f", paper = css("--paper") || "#f6f2ea", lime = css("--lime") || "#d4f15c", violet = css("--violet") || "#5a3ff0", line = css("--line") || "#d9d1c1";
    ctx.clearRect(0, 0, W, H);
    // conveyor
    ctx.fillStyle = line; ctx.fillRect(0, H / 2 + T_H / 2 + 8, W, 3);
    // gate brackets + laser
    ctx.strokeStyle = flash && flash.t > 0 ? (flash.ok ? lime : "#ff6b6b") : ink; ctx.lineWidth = 4;
    const gy = H / 2 - T_H / 2 - 14, gh = T_H + 28;
    [[GATE_X, gy, 1, 1], [GATE_X + GATE_W, gy, -1, 1], [GATE_X, gy + gh, 1, -1], [GATE_X + GATE_W, gy + gh, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath(); ctx.moveTo(x, y + 16 * sy); ctx.lineTo(x, y); ctx.lineTo(x + 16 * sx, y); ctx.stroke();
    });
    ctx.fillStyle = violet; ctx.globalAlpha = 0.5; ctx.fillRect(GATE_X + 4, H / 2 + Math.sin(performance.now() / 180) * (T_H / 2), GATE_W - 8, 2); ctx.globalAlpha = 1;
    // tickets
    for (const t of tickets) {
      const y = H / 2 - T_H / 2 - (t.done ? t.lift * 160 : 0);
      ctx.globalAlpha = t.done ? Math.max(0, 1 - t.lift * 1.8) : 1;
      ctx.fillStyle = paper; ctx.strokeStyle = ink; ctx.lineWidth = 1.5;
      rr(t.x, y, T_W, T_H, 10); ctx.fill(); ctx.stroke();
      ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(t.x + T_W - 40, y + 6); ctx.lineTo(t.x + T_W - 40, y + T_H - 6); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = ink; ctx.font = "500 10px 'JetBrains Mono', monospace"; ctx.fillText("ADMIT ONE", t.x + 10, y + 20);
      ctx.fillRect(t.x + 10, y + 30, 50, 6); ctx.fillRect(t.x + 10, y + 42, 34, 6);
      if (t.valid) { // QR-ish block on the stub
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i * 7 + j * 3 + t.seed) % 3) ctx.fillRect(t.x + T_W - 33 + i * 6, y + 22 + j * 6, 5, 5);
      } else {
        ctx.save(); ctx.translate(t.x + T_W / 2 - 10, y + T_H / 2 + 4); ctx.rotate(-0.18);
        ctx.strokeStyle = "#e5484d"; ctx.fillStyle = "#e5484d"; ctx.lineWidth = 2; ctx.font = "700 13px 'JetBrains Mono', monospace";
        const word = t.kind === "used" ? "USED" : "CANCELLED"; const w = ctx.measureText(word).width + 12;
        ctx.strokeRect(-w / 2, -12, w, 22); ctx.fillText(word, -w / 2 + 6, 4); ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    if (flash && flash.t > 0) { ctx.fillStyle = flash.ok ? violet : "#e5484d"; ctx.font = "600 14px Inter, sans-serif"; ctx.fillText(flash.label, GATE_X, 26); }
    if (state !== "play") {
      ctx.fillStyle = ink; ctx.font = "400 30px 'Instrument Serif', serif"; ctx.textAlign = "center";
      ctx.fillText(state === "over" ? `Gate closed · ${score}` : "Press Scan to open the gate", W / 2, H / 2 + 10); ctx.textAlign = "left";
    }
  }

  const onKey = (e) => { if ((e.code === "Space" || e.key === "Enter") && document.activeElement === canvas) { e.preventDefault(); scan(); } };
  canvas.addEventListener("keydown", onKey);
  canvas.addEventListener("pointerdown", scan);
  btn.addEventListener("click", scan);
  hud(); size();
  return () => { cancelAnimationFrame(raf); ro.disconnect(); };
}

// ---------- Thrift Flip: match the pairs ----------
function thriftFlip(root) {
  const grid = root.querySelector("[data-grid]");
  const movesEl = root.querySelector("[data-moves]");
  const bestEl = root.querySelector("[data-best]");
  const status = root.querySelector("[data-status]");
  const items = [["🧥", "Denim jacket"], ["👗", "Maxi dress"], ["👟", "Sneakers"], ["👜", "Handbag"], ["🧢", "Cap"], ["👖", "Jeans"]];
  let best = store.get("thrift-flip-best"), open = [], moves = 0, matched = 0, lock = false, timer = 0;
  bestEl.textContent = best || "–";

  function deal() {
    clearTimeout(timer); open = []; moves = 0; matched = 0; lock = false; movesEl.textContent = 0;
    const deck = [...items, ...items].map((it) => ({ it, r: Math.random() })).sort((a, b) => a.r - b.r).map((d) => d.it);
    grid.replaceChildren(...deck.map(([icon, name], i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "flip-card"; b.dataset.name = name;
      b.setAttribute("aria-label", `Card ${i + 1}, face down`);
      b.innerHTML = `<span class="flip-inner"><span class="flip-back" aria-hidden="true">TF</span><span class="flip-front" aria-hidden="true">${icon}</span></span>`;
      b.addEventListener("click", () => turn(b, i));
      return b;
    }));
    status.textContent = "Find the 6 pairs.";
  }
  function turn(b, i) {
    if (lock || b.classList.contains("up")) return;
    b.classList.add("up"); b.setAttribute("aria-label", `Card ${i + 1}, ${b.dataset.name}`);
    open.push(b);
    if (open.length < 2) return;
    movesEl.textContent = ++moves;
    const [a, c] = open; open = [];
    if (a.dataset.name === c.dataset.name) {
      a.classList.add("matched"); c.classList.add("matched"); a.disabled = c.disabled = true;
      status.textContent = `Pair: ${a.dataset.name}.`;
      if (++matched === items.length) {
        if (!best || moves < best) { best = moves; store.set("thrift-flip-best", best); bestEl.textContent = best; }
        status.textContent = `Sold out in ${moves} moves!`;
      }
    } else {
      lock = true; status.textContent = "No match.";
      timer = setTimeout(() => {
        [a, c].forEach((x) => { x.classList.remove("up"); x.setAttribute("aria-label", x.getAttribute("aria-label").replace(/, .*$/, ", face down")); });
        lock = false;
      }, 750);
    }
  }
  root.querySelector("[data-reset]").addEventListener("click", deal);
  deal();
  return () => clearTimeout(timer);
}

const games = { "gate-rush": gateRush, "thrift-flip": thriftFlip };
let cleanups = [];
export function mount(scope) {
  unmount();
  scope.querySelectorAll("[data-game]").forEach((el) => { const g = games[el.dataset.game]; if (g) cleanups.push(g(el)); });
}
// Mount a single game element; returns its cleanup (used by the footer easter egg).
export function mountOne(el) { const g = games[el.dataset.game]; return g ? g(el) : () => {}; }
export function unmount() { cleanups.forEach((f) => f && f()); cleanups = []; }
