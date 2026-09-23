import { hazardState } from "./expedition.js";
import { walkable } from "./game.js";
let audio = null,
  enabled = true,
  lastNoise = 0,
  lastPhase = "lobby";
export function enableAudio() {
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    audio.resume();
  } catch {}
}
export function toggleAudio() {
  enabled = !enabled;
  if (enabled) enableAudio();
  return enabled;
}
function tone(freq, duration, shape = "sine") {
  if (!enabled || !audio || audio.state !== "running") return;
  const o = audio.createOscillator(),
    g = audio.createGain();
  o.type = shape;
  o.frequency.setValueAtTime(freq, audio.currentTime);
  o.frequency.exponentialRampToValueAtTime(
    Math.max(40, freq * 0.45),
    audio.currentTime + duration,
  );
  g.gain.setValueAtTime(0.045, audio.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
  o.connect(g);
  g.connect(audio.destination);
  o.start();
  o.stop(audio.currentTime + duration);
}
export function playCues(s) {
  if (s.noiseSeq > lastNoise) {
    lastNoise = s.noiseSeq;
    tone(150 + s.noises.at(-1)?.power * 8, 0.18, "triangle");
  }
  if (s.phase !== lastPhase) {
    lastPhase = s.phase;
    if (s.phase === "escape") tone(160, 1.4, "sawtooth");
    if (s.phase === "ended") tone(440, 0.5);
  }
}
export function drawExpedition(ctx, s, text, rect) {
  const symbol = (o, label, color, icon = "E") => {
    rect(o.x - 17, o.y - 17, 34, 34, "#11232c");
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x - 17, o.y - 17, 34, 34);
    text(icon, o.x, o.y + 5, 16, color, "center");
    text(label, o.x, o.y + 33, 9, color, "center");
  };
  for (const h of s.hazards) {
    const state = hazardState(s, h),
      color =
        state === "active"
          ? "#ff567b"
          : state === "warning"
            ? "#ffd078"
            : "#52736a";
    ctx.fillStyle = color + (state === "active" ? "99" : "33");
    if (h.kind === "scanner") {
      ctx.fillRect(h.x - 7, h.y - h.length, 14, h.length * 2);
      text(
        state === "safe"
          ? "CROSSING CLEAR"
          : state === "warning"
            ? "BEAM WARNING"
            : "BEAM ACTIVE",
        h.x,
        h.y - h.length - 12,
        9,
        color,
        "center",
      );
    } else {
      ctx.beginPath();
      ctx.arc(h.x, h.y, h.length, 0, Math.PI * 2);
      ctx.fill();
      text("STEAM VENT", h.x, h.y + 4, 9, color, "center");
    }
  }
  for (const d of s.debris) {
    for (let j = 0; j < 5; j++) {
      ctx.save();
      ctx.translate(d.x + ((j % 3) - 1) * 12, d.y + ((j % 2) - 0.5) * 18);
      ctx.rotate(j * 0.8);
      rect(-7, -3, 14, 6, "#9a9990");
      ctx.restore();
    }
  }
  for (const c of s.cells)
    if (!c.taken) symbol(c, "POWER CELL", "#a5faff", "▥");
  for (const c of s.sockets)
    symbol(
      c,
      c.installed ? "RESTORED" : "VAULT CIRCUIT",
      c.installed ? "#73e6ad" : "#f6c16e",
      c.installed ? "✓" : "E",
    );
  for (const c of s.consoles)
    symbol(
      c,
      c.id === "security"
        ? "SHUTTERS"
        : c.id === "maintenance-console"
          ? "SHORTCUT"
          : c.id === "circuit-lift"
            ? "POWER LIFT"
            : "POWER BRIDGE",
      "#8ebcf9",
    );
  symbol(s.stabilizer, "HOLD / STABILIZE", "#f6c16e");
  if (!s.salvage.taken) {
    rect(s.salvage.x - 24, s.salvage.y - 27, 48, 54, "#625746");
    symbol(s.salvage, "QUANTUM ASSEMBLY", "#ffd086", "◈");
  }
  for (const c of s.containers)
    symbol(
      c,
      c.opened ? "OPENED" : "SEALED CACHE",
      c.opened ? "#526875" : "#dba3ff",
      c.opened ? "·" : "▣",
    );
  for (const l of s.locks)
    symbol(
      l,
      s.core.unlocked ? "RELEASED" : "HOLD / RESTRAINT",
      s.core.unlocked ? "#73e6ad" : "#ee99bc",
    );
  if (!s.core.taken) {
    const c = s.core;
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#fc8ac1";
    symbol(c, "ANCIENT CORE", "#ff9bca", "◈");
    ctx.shadowBlur = 0;
  }
  const m = s.monster;
  if (!m.active) {
    ctx.strokeStyle = "#854465";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.ellipse(m.x, m.y, 55 + Math.sin(s.time) * 3, 38, 0, 0, Math.PI * 1.8);
    ctx.stroke();
    ctx.lineWidth = 2;
    text("DORMANT", m.x, m.y - 55, 10, "#d788ac", "center");
  }
  if (m.windup > 0 && m.aim) {
    ctx.strokeStyle = "#ffcd86";
    ctx.lineWidth = 22;
    ctx.globalAlpha = 0.4 + Math.sin(s.time * 20) * 0.2;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x + m.aim.x * 185, m.y + m.aim.y * 185);
    ctx.stroke();
    ctx.globalAlpha = 1;
    text("LUNGE", m.x, m.y - 40, 12, "#ffcd86", "center");
  }
  const d = s.drone;
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  for (let a = d.angle - 0.65; a <= d.angle + 0.65; a += 0.065) {
    let r = 0;
    for (; r < 220; r += 10)
      if (!walkable(s, d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 1)) break;
    ctx.lineTo(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = "#ffc86a22";
  ctx.fill();
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.angle);
  rect(-13, -10, 26, 20, "#d5b67d");
  rect(5, -4, 14, 8, "#ff677f");
  ctx.restore();
  text(
    d.interest > 0 ? "INVESTIGATING" : "PATROL",
    d.x,
    d.y - 22,
    9,
    "#e3bd80",
    "center",
  );
  for (const n of s.noises) {
    ctx.globalAlpha = Math.max(0, 1 - n.age / 1.5);
    ctx.strokeStyle = n.power >= 20 ? "#ff7286" : "#f1c682";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(n.x, n.y, 10 + n.age * (55 + n.power), 0, Math.PI * 2);
    ctx.stroke();
    text(n.label, n.x, n.y - 30, 10, "#ffdbab", "center");
    ctx.globalAlpha = 1;
  }
}
