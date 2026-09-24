import { drawSprite } from "./art.js";
import { hazardState } from "./expedition.js";
import { walkable } from "./game.js";
let audio = null,
  enabled = true,
  lastNoise = 0,
  lastPhase = "lobby",
  lastShot = 0;
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
  if (s.drone.windup > 0 && !lastShot) tone(650, 0.45, "sawtooth");
  lastShot = s.drone.windup;
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
export function drawExpedition(ctx, s, text, rect, viewer) {
  const symbol = (o, label, color, icon = "E") => {
    const kind =
      o === s.core
        ? "core"
        : o === s.salvage
          ? "assembly"
          : s.cells.includes(o)
            ? "cell"
            : s.sockets.includes(o)
              ? "socket"
              : s.containers.includes(o)
                ? "cache"
                : s.locks.includes(o)
                  ? "lock"
                  : "console";
    ctx.fillStyle = "#07111a88";
    ctx.beginPath();
    ctx.ellipse(o.x + 2, o.y + 15, 21, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    const fixed = kind === "console" || kind === "socket" || kind === "lock";
    if (fixed) {
      rect(o.x - 24, o.y + 13, 48, 12, "#0b1720");
      rect(o.x - 24, o.y + 13, 48, 3, "#648a9b");
      rect(o.x - 21, o.y + 19, 5, 3, "#a5c7d1");
      rect(o.x + 16, o.y + 19, 5, 3, "#a5c7d1");
    }
    drawSprite(
      ctx,
      kind,
      o.x,
      o.y,
      color,
      o === s.salvage ? 56 : fixed ? 50 : 34,
    );
    if (kind === "console")
      text("CONTROL", o.x, o.y - 31, 9, "#9dd5ee", "center");
    if (s.cells.includes(o))
      text("MISSION ITEM", o.x, o.y - 25, 9, "#9df5db", "center");
    if (
      viewer &&
      (kind === "console" || Math.hypot(viewer.x - o.x, viewer.y - o.y) < 160)
    ) {
      ctx.shadowColor = "#101822";
      ctx.shadowBlur = 3;
      text(label, o.x, o.y + 34, 9, color, "center");
      ctx.shadowBlur = 0;
    }
  };
  for (const h of s.hazards) {
    const state = hazardState(s, h),
      color =
        state === "active"
          ? "#ff567b"
          : state === "warning"
            ? "#ffd078"
            : "#52736a";
    ctx.fillStyle = color + (state === "active" ? "cc" : "44");
    if (h.kind === "scanner") {
      ctx.fillRect(h.x - 7, h.y - h.length, 14, h.length * 2);
      for (const side of [-1, 1]) {
        rect(h.x - 17, h.y + side * h.length - 8, 34, 16, "#152632");
        rect(h.x - 12, h.y + side * h.length - 4, 24, 8, color);
      }
      if (state === "active")
        rect(h.x - 2, h.y - h.length, 4, h.length * 2, "#ffe7db");
      if (
        viewer &&
        Math.abs(viewer.x - h.x) < 150 &&
        Math.abs(viewer.y - h.y) < h.length + 70
      ) {
        text(
          state === "safe"
            ? "SAFE TO CROSS"
            : state === "warning"
              ? "WAIT — ACTIVATING"
              : "DANGER · 10 HP + ALARM",
          h.x,
          h.y + 22,
          10,
          color,
          "center",
        );
      }
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
    ctx.strokeStyle = "#d8ae60";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(d.x - 25, d.y - 25, 50, 50);
    ctx.setLineDash([]);
    text("NOISE", d.x, d.y + 38, 10, "#e4c380", "center");
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
  if ((d.windup > 0 || d.flash > 0) && d.shot) {
    ctx.save();
    ctx.strokeStyle = d.flash > 0 ? "#e4faff" : "#ff7064";
    ctx.lineWidth = d.flash > 0 ? 5 : 2;
    ctx.setLineDash(d.flash > 0 ? [] : [7, 5]);
    let reach = 0;
    for (; reach < 260; reach += 8)
      if (!walkable(s, d.x + d.shot.dx * reach, d.y + d.shot.dy * reach, 1))
        break;
    ctx.beginPath();
    ctx.moveTo(d.x, d.y);
    ctx.lineTo(d.x + d.shot.dx * reach, d.y + d.shot.dy * reach);
    ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(d.x, d.y);
  for (let a = d.angle - 0.65; a <= d.angle + 0.65; a += 0.065) {
    let r = 0;
    for (; r < 220; r += 10)
      if (!walkable(s, d.x + Math.cos(a) * r, d.y + Math.sin(a) * r, 1)) break;
    ctx.lineTo(d.x + Math.cos(a) * r, d.y + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = d.mode === "pursuit" ? "#ff665b33" : "#ffc86a22";
  ctx.fill();
  ctx.save();
  ctx.translate(d.x, d.y);
  ctx.rotate(d.angle);
  rect(-17, -13, 34, 26, "#111e26");
  rect(-15, -10, 29, 20, "#a2a387");
  rect(-9, -8, 15, 16, "#5d7370");
  rect(-5, -5, 14, 10, "#c8c9a8");
  rect(9, -5, 9, 10, "#1c2e39");
  rect(12, -3, 7, 6, "#eeaf6c");
  rect(-12, -17, 8, 5, "#435d60");
  rect(-12, 12, 8, 5, "#435d60");
  rect(5, -15, 7, 4, "#788e80");
  rect(5, 11, 7, 4, "#788e80");
  ctx.restore();
  text(
    d.windup > 0
      ? "FIRING — DODGE"
      : d.mode === "pursuit"
        ? "PURSUING"
        : d.interest > 0
          ? "INVESTIGATING"
          : "PATROL",
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
