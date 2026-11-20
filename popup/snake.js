// Snake - lightweight canvas game for the "Relax" overlay.
// Exposes snakeStart() / snakeStop(); popup.js wires them to the menu.
(function () {
  const N = 13;            // grid is N x N
  const C = 18;            // cell size in px
  const SIZE = N * C;
  const LEVEL_EVERY = 5;   // foods per level
  const BEST_KEY = "snakeBest";

  const screen = document.getElementById("snakeScreen");
  const canvas = document.getElementById("snakeCanvas");
  const scoreEl = document.getElementById("snakeScore");
  const levelEl = document.getElementById("snakeLevel");
  const lenEl = document.getElementById("snakeLen");
  const bestEl = document.getElementById("snakeBest");
  const msgEl = document.getElementById("snakeMsg");
  if (!screen || !canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  canvas.width = SIZE * dpr;
  canvas.height = SIZE * dpr;
  canvas.style.width = SIZE + "px";
  canvas.style.height = SIZE + "px";
  ctx.scale(dpr, dpr);

  const DIRS = {
    ArrowUp: [0, -1], w: [0, -1], W: [0, -1],
    ArrowDown: [0, 1], s: [0, 1], S: [0, 1],
    ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
    ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  };

  let snake, dir, queue, food, golden, pending;
  let eaten, score, best, state, timer, flash;
  // state: "ready" | "running" | "paused" | "dead" | "won"

  try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { best = 0; }

  const level = () => 1 + Math.floor(eaten / LEVEL_EVERY);
  const delay = () => Math.max(65, 150 - (level() - 1) * 12);
  const wrap = (v) => (v + N) % N;

  function freeCell() {
    const taken = new Set(snake.map((s) => s.x + "," + s.y));
    if (food) taken.add(food.x + "," + food.y);
    if (golden) taken.add(golden.x + "," + golden.y);
    const free = [];
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) if (!taken.has(x + "," + y)) free.push({ x, y });
    return free.length ? free[Math.floor(Math.random() * free.length)] : null;
  }

  function reset() {
    clearTimeout(timer);
    const mid = Math.floor(N / 2);
    snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
    dir = [1, 0];
    queue = [];
    food = null;
    golden = null;
    pending = 0;
    eaten = 0;
    score = 0;
    flash = 0;
    food = freeCell();
    state = "ready";
    setMsg("Press an arrow key / WASD to start");
    updateHud();
    draw();
  }

  function setMsg(t) { msgEl.textContent = t; }

  function updateHud() {
    scoreEl.textContent = score;
    levelEl.textContent = level();
    lenEl.textContent = snake.length;
    bestEl.textContent = best;
  }

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(tick, delay());
  }

  function tick() {
    if (state !== "running") return;

    // apply the next queued turn, never allowing a direct reverse
    while (queue.length) {
      const d = queue.shift();
      if (d[0] !== -dir[0] || d[1] !== -dir[1]) { dir = d; break; }
    }

    const head = { x: wrap(snake[0].x + dir[0]), y: wrap(snake[0].y + dir[1]) };
    const ateFood = food && head.x === food.x && head.y === food.y;
    const ateGolden = golden && head.x === golden.x && head.y === golden.y;
    const growing = ateFood || ateGolden || pending > 0;

    // The tail cell is free this tick unless we are growing
    const body = growing ? snake : snake.slice(0, -1);
    if (body.some((s) => s.x === head.x && s.y === head.y)) return die();

    snake.unshift(head);
    if (growing) { if (!ateFood && !ateGolden) pending--; }
    else snake.pop();

    if (ateFood) {
      eaten++;
      score += 10 * level();
      if (eaten % LEVEL_EVERY === 0) {
        pending += 2; // level-up bonus growth
        setMsg(`Level ${level()}! Faster + longer 🐍`);
      } else setMsg("");
      food = freeCell();
      if (eaten % 4 === 0 && !golden) {
        const g = freeCell();
        if (g) golden = { x: g.x, y: g.y, ttl: 28 };
      }
      if (!food) return win();
    } else if (ateGolden) {
      score += 50;
      pending += 2;
      golden = null;
      setMsg("⭐ Bonus! +50");
    }

    if (golden && !ateGolden && --golden.ttl <= 0) golden = null;

    updateHud();
    draw();
    schedule();
  }

  function die() {
    state = "dead";
    clearTimeout(timer);
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
      setMsg(`💀 You bit yourself! New best: ${best}`);
    } else {
      setMsg(`💀 You bit yourself! Score ${score}`);
    }
    updateHud();
    flash = 1;
    draw();
  }

  function win() {
    state = "won";
    clearTimeout(timer);
    if (score > best) {
      best = score;
      try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) {}
    }
    setMsg("🏆 Board cleared! Legend.");
    updateHud();
    draw();
  }

  // ---------- drawing ----------
  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // Food is drawn with shapes (no emoji) so it renders the same on every OS.
  function drawClock(cx, cy) {
    ctx.save();
    ctx.shadowColor = "rgba(251,146,60,0.9)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#fb923c";
    ctx.beginPath(); ctx.arc(cx, cy, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#fff7ed";
    ctx.beginPath(); ctx.arc(cx, cy, 4.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#9a3412";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - 3.2); ctx.lineTo(cx, cy); ctx.lineTo(cx + 2.4, cy + 1.2);
    ctx.stroke();
  }

  function drawStar(cx, cy) {
    ctx.save();
    ctx.shadowColor = "rgba(250,204,21,0.95)";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#facc15";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 8 : 3.6;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.fillStyle = "#0b1220";
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let y = 0; y < N; y++)
      for (let x = 0; x < N; x++) ctx.fillRect(x * C + C / 2 - 1, y * C + C / 2 - 1, 2, 2);

    if (food) drawClock(food.x * C + C / 2, food.y * C + C / 2);
    if (golden && (golden.ttl > 8 || golden.ttl % 2 === 0))
      drawStar(golden.x * C + C / 2, golden.y * C + C / 2);

    const dead = state === "dead";
    for (let i = snake.length - 1; i >= 0; i--) {
      const s = snake[i];
      const t = 1 - i / Math.max(snake.length, 1) * 0.55; // fade toward the tail
      ctx.fillStyle = dead
        ? `rgba(239,68,68,${t})`
        : i === 0 ? "#7dd3fc" : `rgba(56,189,248,${t})`;
      rr(s.x * C + 1, s.y * C + 1, C - 2, C - 2, i === 0 ? 6 : 4);
      ctx.fill();
    }

    // eyes on the head
    const h = snake[0];
    ctx.fillStyle = "#0f172a";
    const ex = dir[0] !== 0 ? dir[0] * 3 : 0;
    const ey = dir[1] !== 0 ? dir[1] * 3 : 0;
    const px = dir[1] !== 0 ? 3 : 0;
    const py = dir[0] !== 0 ? 3 : 0;
    const cx = h.x * C + C / 2, cy = h.y * C + C / 2;
    ctx.beginPath(); ctx.arc(cx + ex + px, cy + ey + py, 1.8, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + ex - px, cy + ey - py, 1.8, 0, 7); ctx.fill();

    if (state === "paused") {
      ctx.fillStyle = "rgba(15,23,42,0.6)";
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("Paused", SIZE / 2, SIZE / 2);
    }
  }

  // ---------- input ----------
  function onKey(e) {
    if (e.key === " " || e.key === "p" || e.key === "P") {
      e.preventDefault();
      if (state === "running") { state = "paused"; clearTimeout(timer); setMsg("Paused - Space to resume"); draw(); }
      else if (state === "paused") { state = "running"; setMsg(""); schedule(); }
      return;
    }
    const d = DIRS[e.key];
    if (!d) return;
    e.preventDefault();
    if (state === "ready") {
      if (d[0] === -1) return; // can't start by turning into the body
      dir = d; state = "running"; setMsg(""); schedule();
    } else if (state === "running" && queue.length < 2) {
      queue.push(d);
    }
  }

  function start() {
    screen.style.display = "block";
    document.addEventListener("keydown", onKey);
    reset();
  }

  function stop() {
    clearTimeout(timer);
    timer = null;
    document.removeEventListener("keydown", onKey);
    screen.style.display = "none";
  }

  document.getElementById("snakeNew")?.addEventListener("click", reset);
  window.snakeStart = start;
  window.snakeStop = stop;
})();
