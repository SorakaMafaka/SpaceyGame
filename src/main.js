import {
  drawStation,
  drawCrew,
  drawCreature,
  drawLoot,
  itemIcon,
} from "./art.js";
import {
  drawExpedition,
  playCues,
  enableAudio,
  toggleAudio,
} from "./presentation.js";
import {
  interactions,
  selectInteraction,
  instruction,
} from "./interactions.js";
import "./style.css";
import {
  createGame,
  addPlayer,
  start,
  tick,
  action,
  MAP,
  ROOMS,
  TILE,
  COLS,
  ROWS,
  COLORS,
  score,
  value,
  distance,
} from "./game.js";
import { Network } from "./network.js";
const $ = (id) => document.getElementById(id);
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let state = createGame(),
  myId = "local",
  host = false,
  net = null,
  room = "",
  practice = false,
  inventoryOpen = false,
  selected = null,
  dragging = false,
  rotated = false,
  lastInv = "",
  keys = new Set(),
  fatal = false,
  lastHostMessage = performance.now();
document.querySelector("#app").innerHTML =
  `<div id="lobby"><nav><span class="brand-mark">◈</span><b>SALVAGE LEAGUE</b><span class="version">THE PALE RELAY / 03</span></nav><main class="landing"><div class="eyebrow">OUTER RIM SALVAGE DIVISION</div><h1>Good crew.<br>Bad <em>odds.</em></h1><p class="intro">Four scavengers. One sleeping station.<br>Work together to get rich. Get yourself out alive.</p><div class="features"><span>01 / SALVAGE</span><span>02 / AWAKEN</span><span>03 / ABANDON</span></div><section class="lobby-card"><label for="name">CALLSIGN</label><input id="name" maxlength="18" value="${escape(localStorage.getItem("salvage-name") || "Rook")}" autocomplete="off"><div class="buttons"><button id="host" class="primary">HOST EXPEDITION <span>↗</span></button><button id="practice">SOLO RECON</button></div><div class="join-line"><input id="code" maxlength="8" placeholder="ROOM CODE" aria-label="Room code"><button id="join">JOIN CREW →</button></div><p id="status">Browser hosted · 1–4 players · Keyboard & mouse</p></section><div class="brief"><b>THE CONTRACT</b><p>Recover valuable salvage. Disturb the station at your own risk. Only the richest survivor wins.</p></div></main><div class="hero-art" aria-hidden="true"><div class="art-label">VESSEL 09–K<br><strong>THE PALE RELAY</strong><br><span>STATUS: DORMANT</span></div></div><footer>NO RESCUE. NO REFUNDS. <span>Headphones recommended. Friends negotiable.</span></footer></div><div id="game" hidden><canvas id="world"></canvas><header class="hud"><div><b>◈ SALVAGE LEAGUE</b><small id="sector">THE PALE RELAY / 09–K</small></div><div id="vitals"><div><span>HEALTH</span><strong id="hp-text">100 / 100 HP</strong></div><div class="health-track"><i id="hp-fill"></i></div><small id="hp-state">SUIT INTEGRITY NORMAL</small></div><div class="threat"><div><span id="phase">STATION DORMANT</span><b id="meter-label">0%</b></div><div class="meter"><i id="meter"></i></div></div><div class="cargo-summary"><b id="credits">0 CR</b><small id="load">0 / 40 CARGO CELLS</small></div></header><aside id="crew"></aside><aside id="objectives"></aside><button id="sound">SOUND ON</button><div id="room-panel" class="panel"><div class="eyebrow">CREW MANIFEST</div><h2>Prepare to board.</h2><p>Room <b id="room-code"></b> <button id="copy">COPY</button></p><div id="roster"></div><p id="lobby-help"></p><button id="start" class="primary">DEPLOY CREW →</button></div><section id="inventory" class="panel" hidden><div class="inv-title"><div><div class="eyebrow">PERSONAL CARGO</div><h2>Make it fit.</h2></div><button id="close-inv">✕</button></div><p>Drag or select an item, then click a cell. <b>R</b> rotates.</p><div id="grid"></div><div class="inv-bottom"><span id="item-info">Select cargo to inspect</span><button id="drop">DROP ITEM</button></div><small>The station does not wait while you pack.</small></section><div id="hover-tip" role="tooltip" hidden></div><div id="threat-warning" role="status"></div><div id="prompt"></div><div id="notice"></div><div id="events"></div><div id="controls"><span><kbd>WASD</kbd> Move</span><span><kbd>E</kbd> Use / hold</span><span>Hover objects for details</span><span><kbd>TAB</kbd> Cargo</span></div><section id="results" class="panel" hidden></section><button id="leave">LEAVE RUN</button></div>`;
const canvas = $("world"),
  ctx = canvas.getContext("2d");
let width = innerWidth,
  height = innerHeight;
function resize() {
  width = innerWidth;
  height = innerHeight;
  canvas.width = width * devicePixelRatio;
  canvas.height = height * devicePixelRatio;
  canvas.style.width = width + "px";
  canvas.style.height = height + "px";
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
addEventListener("resize", resize);
resize();
const me = () => state.players.find((p) => p.id === myId);
function status(t) {
  $("status").textContent = t;
}
function error(t) {
  status(t);
  $("notice").textContent = t;
}
function send(a) {
  if (fatal) return;
  if (host) action(state, myId, a);
  else net?.send({ type: "action", action: a });
}
function setupNetwork() {
  return new Network({
    error,
    hostLost: () => {
      if (!host) {
        fatal = true;
        keys.clear();
        $("notice").textContent =
          "Host disconnected. Leave this run to join another.";
      }
    },
    join: (id, name) => {
      const p = addPlayer(state, id, name);
      if (!p) {
        net.send(
          { type: "reject", message: "This room is full or already deployed." },
          id,
        );
        setTimeout(() => net.links.get(id)?.close(), 200);
        return;
      }
      net.send({ type: "welcome", id, state }, id);
      net.broadcast({ type: "state", state });
    },
    leave: (id) => {
      if (state.phase === "lobby")
        state.players = state.players.filter((p) => p.id !== id);
      else {
        const p = state.players.find((p) => p.id === id);
        if (p) {
          p.connected = false;
          p.input = { dx: 0, dy: 0 };
          if (!p.aboard) {
            state.loot.push(
              ...p.inventory.map((i) => ({ ...i, x: p.x, y: p.y })),
            );
            p.inventory = [];
            p.alive = false;
          }
        }
      }
    },
    data: (id, d) => {
      if (!d || typeof d !== "object") return;
      if (host) {
        if (d.type === "action") action(state, id, d.action);
      } else if (d.type === "welcome") {
        lastHostMessage = performance.now();
        myId = d.id;
        state = d.state;
        enter();
      } else if (d.type === "state") {
        lastHostMessage = performance.now();
        state = d.state;
      } else if (d.type === "reject") {
        error(d.message);
        net.close();
        busy(false);
      }
    },
  });
}
function busy(b) {
  for (const id of ["host", "join", "practice"]) $(id).disabled = b;
}
function name() {
  const n = $("name").value.trim() || "Rook";
  localStorage.setItem("salvage-name", n);
  return n;
}
function enter() {
  $("lobby").hidden = true;
  $("game").hidden = false;
  $("room-code").textContent = room;
  $("start").hidden = !host;
  $("lobby-help").textContent = practice
    ? "Solo recon assists the two-person seal and latches vault locks individually. Restore both power circuits, prepare a shortcut, and recover the core."
    : "Share this code with up to three friends. Keep the host tab open and visible during the match.";
  resize();
}
$("host").onclick = async () => {
  busy(true);
  status("Establishing uplink…");
  try {
    host = true;
    net = setupNetwork();
    room = await net.host();
    myId = net.peer.id;
    state = createGame();
    addPlayer(state, myId, name());
    enter();
  } catch (e) {
    net?.close();
    host = false;
    busy(false);
    error(e.message);
  }
};
$("join").onclick = async () => {
  if (!/^[a-z0-9]{8}$/i.test($("code").value.trim()))
    return status("Enter the host’s eight-character room code.");
  busy(true);
  status("Connecting to crew…");
  try {
    host = false;
    net = setupNetwork();
    room = $("code").value.trim().toUpperCase();
    await net.join(room, name());
  } catch (e) {
    net?.close();
    busy(false);
    error(e.message);
  }
};
$("practice").onclick = () => {
  host = true;
  practice = true;
  room = "SOLO RECON";
  state = createGame();
  addPlayer(state, myId, name());
  enter();
};
$("start").onclick = () => {
  start(state);
  net?.broadcast({ type: "state", state });
};
$("copy").onclick = () =>
  navigator.clipboard
    ?.writeText(room)
    .then(() => {
      $("copy").textContent = "COPIED";
    })
    .catch(() => {
      $("copy").textContent = "SELECT CODE";
    });
$("leave").onclick = () => {
  net?.close();
  location.reload();
};
function toggleInventory() {
  inventoryOpen = !inventoryOpen;
  $("inventory").hidden = !inventoryOpen;
  lastInv = "";
}
$("close-inv").onclick = toggleInventory;
$("drop").onclick = () => {
  if (selected) {
    send({ type: "drop", id: selected });
    selected = null;
    lastInv = "";
  }
};
addEventListener("keydown", (e) => {
  if ($("game").hidden || e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (
    ["tab", " ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)
  )
    e.preventDefault();
  keys.add(k);
  if (e.repeat) return;
  if (k === "tab") toggleInventory();
  if (k === "e") {
    heldTarget = (hovered() || selectInteraction(state, me()))?.id;
    send({ type: "interact", target: heldTarget });
  }
  if (k === "r" && selected && inventoryOpen) {
    rotated = !rotated;
    lastInv = "";
  }
  if (k === "escape" && inventoryOpen) toggleInventory();
});
addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
addEventListener("blur", () => {
  keys.clear();
  send({ type: "input", dx: 0, dy: 0, interact: false });
});
function moveCargo(x, y) {
  if (selected) send({ type: "moveItem", id: selected, x, y, rotate: rotated });
  rotated = false;
  lastInv = "";
}
function inventory(p) {
  if (dragging) return;
  const signature = JSON.stringify(p.inventory) + selected + rotated;
  if (signature === lastInv) return;
  lastInv = signature;
  const grid = $("grid");
  grid.innerHTML = "";
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 8; x++) {
      const cell = document.createElement("button");
      cell.className = "cell";
      cell.style.gridArea = `${y + 1} / ${x + 1}`;
      cell.setAttribute("aria-label", `Cargo cell ${x + 1}, ${y + 1}`);
      cell.onclick = () => moveCargo(x, y);
      cell.ondragover = (e) => e.preventDefault();
      cell.ondrop = (e) => {
        e.preventDefault();
        moveCargo(x, y);
      };
      grid.append(cell);
    }
  for (const i of p.inventory) {
    const b = document.createElement("button");
    b.className =
      "cargo-item" +
      (i.w * i.h <= 2 ? " compact" : "") +
      (selected === i.id ? " selected" : "");
    b.style.gridArea = `${i.gy + 1} / ${i.gx + 1} / span ${i.h} / span ${i.w}`;
    b.style.setProperty("--item", i.color);
    b.draggable = true;
    b.innerHTML = `<img class="cargo-sprite" alt="" src="${itemIcon(i)}"><strong>${escape(i.name)}</strong><small>${i.value} CR</small>`;
    b.title = `${i.name} · ${i.value} CR · ${i.w}×${i.h}`;
    b.onclick = () => {
      if (selected === i.id && rotated) {
        moveCargo(i.gx, i.gy);
        return;
      }
      selected = selected === i.id ? null : i.id;
      rotated = false;
      lastInv = "";
    };
    b.ondragend = () => {
      dragging = false;
      lastInv = "";
    };
    b.ondragstart = (e) => {
      dragging = true;
      selected = i.id;
      rotated = false;
      e.dataTransfer.setData("text/plain", i.id);
    };
    grid.append(b);
  }
  const item = p.inventory.find((i) => i.id === selected);
  $("item-info").textContent = item
    ? `${item.name} · ${rotated ? item.h + "×" + item.w + " rotated" : item.w + "×" + item.h}`
    : "Select cargo to inspect";
  $("drop").disabled = !item || p.aboard;
}
let heldTarget = null;
let hudTime = 0;
function hud() {
  const p = me();
  if (!p) return;
  $("room-panel").hidden = state.phase !== "lobby";
  $("roster").innerHTML = Array.from({ length: 4 }, (_, i) => {
    const p = state.players[i];
    return `<div class="roster-row"><i style="background:${p?.color || "#334148"}"></i><span>${p ? escape(p.name) : "Waiting for salvager…"}</span><small>${p ? "CONNECTED" : "EMPTY"}</small></div>`;
  }).join("");
  $("phase").textContent =
    state.phase === "escape"
      ? `AWAKE / ${Math.ceil(state.escapeLeft)}s TO COLLAPSE`
      : state.phase === "ended"
        ? "EXPEDITION COMPLETE"
        : "STATION DORMANT";
  $("meter-label").textContent =
    state.launch !== null
      ? `LAUNCH ${Math.ceil(state.launch)}s`
      : `${Math.floor(state.disturbance)}%`;
  $("meter").style.width = state.disturbance + "%";
  $("meter").style.background =
    state.phase === "escape" ? "#ff6577" : "#62dfba";
  $("hp-text").textContent = `${p.hp} / 100 HP`;
  $("hp-fill").style.width = p.hp + "%";
  $("vitals").dataset.severity = !p.alive
    ? "lost"
    : p.hp <= 30
      ? "critical"
      : p.hp <= 60
        ? "hurt"
        : "healthy";
  $("hp-state").textContent = !p.alive
    ? "SIGNAL LOST"
    : p.lastDamage && state.time - p.lastDamage.time < 3
      ? `−${p.lastDamage.amount} · ${p.lastDamage.source}`
      : p.hp <= 30
        ? "CRITICAL — GET TO SAFETY"
        : "SUIT INTEGRITY";
  $("game").classList.toggle("damage-flash", p.hit > 0.8);
  const drone = state.drone;
  $("threat-warning").textContent =
    !p.alive || p.aboard
      ? ""
      : drone.targetId === p.id && drone.pursuit > 0
        ? drone.windup > 0
          ? "SHOCK SHOT INCOMING — SIDESTEP OR TAKE COVER"
          : "DRONE PURSUING — BREAK LINE OF SIGHT"
        : p.detection > 0
          ? `DRONE DETECTION ${Math.round(p.detection)}% — LEAVE THE SIGHT CONE`
          : "";
  $("credits").textContent = value(p).toLocaleString() + " CR";
  $("load").textContent =
    `${p.inventory.reduce((n, i) => n + i.w * i.h, 0)} / 40 CARGO CELLS`;
  $("crew").innerHTML = state.players
    .map(
      (q) =>
        `<div class="crew-member"><i style="background:${q.color}"></i><span>${escape(q.name)}${q.id === myId ? " / YOU" : ""}</span><small>${!q.connected ? "OFFLINE" : !q.alive ? "LOST" : q.aboard ? "ABOARD" : q.hp + " HP" + (q.detection > 0 ? " / " + Math.round(q.detection) + "% SEEN" : "")}</small><div class="crew-hp"><i style="width:${q.hp}%;background:${q.hp <= 30 ? "#ed756c" : q.color}"></i></div></div>`,
    )
    .join("");
  $("events").innerHTML = state.logs
    .slice(0, 3)
    .map((t) => `<div>${escape(t)}</div>`)
    .join("");
  if (!fatal) $("notice").textContent = p.noteUntil > state.time ? p.note : "";
  const target = hovered() || selectInteraction(state, p);
  $("prompt").innerHTML = !p.alive
    ? "SIGNAL LOST · Spectating the remaining crew"
    : target
      ? `<b>${escape(target.category || "CONTROL")} · ${escape(target.title)}</b><span>${escape(target.description)}</span><strong>${escape(instruction(target))}</strong>`
      : "Explore the station. Get close and hover over objects to interact.";
  $("objectives").innerHTML =
    `<b>${state.phase === "escape" ? "EVACUATE" : "EXPEDITION OBJECTIVES"}</b><div>${state.sockets.filter((c) => c.installed).length}/2 vault circuits restored</div><div>${state.core.taken ? "Core recovered" : state.core.unlocked ? "Core restraints released" : "Release the two vault restraints"}</div><div>Shortcut: ${state.prepared.maintenance ? "open" : "not prepared"}</div><div>Emergency route: ${state.prepared.circuit || "choose at junction"}</div><small>${state.phase === "escape" ? "Watch for warning beams. Reach the shuttle." : "Noise raises disturbance. Break line of sight to evade the drone."}</small>`;
  playCues(state);
  updateHover();
  if (inventoryOpen) inventory(p);
  if (state.phase === "ended") {
    $("results").hidden = false;
    const won = state.result.winners.includes(myId);
    $("results").innerHTML =
      `<div class="eyebrow">EXPEDITION REPORT</div><h2>${won ? "A profitable betrayal." : p.aboard ? "You made it out." : "The station keeps its due."}</h2><p>${
        state.result.winners.length
          ? "Richest survivor" +
            (state.result.winners.length > 1 ? "s" : "") +
            ": " +
            state.players
              .filter((q) => state.result.winners.includes(q.id))
              .map((q) => escape(q.name))
              .join(", ")
          : "No survivors."
      }</p><p>${state.players.some((q) => q.aboard && q.alive && q.inventory.some((i) => i.id === "core-loot")) ? "Core extracted: +200 CR to every survivor." : "Core not extracted: no crew bonus."}</p>${[
        ...state.players,
      ]
        .sort((a, b) => score(state, b) - score(state, a))
        .map(
          (q) =>
            `<div class="roster-row"><span>${escape(q.name)}</span><b>${q.aboard && q.alive ? score(state, q) + " CR" : "LOST"}</b></div>`,
        )
        .join("")}<button id="again" class="primary">BACK TO DOCK →</button>`;
    $("again").onclick = () => {
      net?.close();
      location.reload();
    };
  }
}
function rect(x, y, w, h, fill) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}
function text(t, x, y, size, color = "#99adb5", align = "left") {
  ctx.font = `${size}px "Courier New",monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(t, x, y);
}
let pointer = null;
canvas.addEventListener("pointermove", (e) => {
  pointer = { x: e.clientX, y: e.clientY };
  updateHover();
});
canvas.addEventListener("pointerleave", () => {
  pointer = null;
  updateHover();
});
function hovered() {
  const p = me();
  if (!pointer || !p || inventoryOpen || fatal) return null;
  const camera = p.alive
    ? p
    : state.players.find((q) => q.alive && !q.aboard) || p;
  const zoom = Math.min(1.15, Math.max(0.72, width / 1400));
  const x = (pointer.x - width / 2) / zoom + camera.x,
    y = (pointer.y - height / 2) / zoom + camera.y;
  return (
    interactions(state, p)
      .filter((i) => {
        const door = state.doors.find((d) => d.id === i.id);
        const rx =
          i.hitW ??
          (i.id === "shuttle"
            ? 74
            : door
              ? door.axis === "h"
                ? 48
                : 24
              : i.id === "lift"
                ? 30
                : 18);
        const ry =
          i.hitH ??
          (i.id === "shuttle"
            ? 53
            : door
              ? door.axis === "h"
                ? 24
                : 48
              : i.id === "lift"
                ? 30
                : 18);
        return Math.abs(x - i.x) <= rx && Math.abs(y - i.y) <= ry;
      })
      .sort(
        (a, b) => Math.hypot(x - a.x, y - a.y) - Math.hypot(x - b.x, y - b.y),
      )[0] || null
  );
}
function updateHover() {
  const target = hovered(),
    tip = $("hover-tip");
  tip.hidden = !target;
  canvas.style.cursor = target ? "help" : "default";
  if (!target) return;
  tip.innerHTML = `<small>${escape(target.category || "CONTROL")}</small><strong>${escape(target.title)}</strong><p>${escape(target.description)}</p><b>${escape(instruction(target))}</b>`;
  tip.style.left = Math.max(10, Math.min(width - 300, pointer.x + 18)) + "px";
  tip.style.top =
    Math.max(95, Math.min(height - tip.offsetHeight - 65, pointer.y + 18)) +
    "px";
}
function draw(now) {
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  rect(0, 0, width, height, "#0b1019");
  const p = me();
  if (!p) return;
  const target = p.alive
    ? p
    : state.players.find((q) => q.alive && !q.aboard) || p;
  const zoom = Math.min(1.15, Math.max(0.72, width / 1400));
  const cx = target.x,
    cy = target.y;
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cx, -cy);
  drawStation(ctx, state);
  const sh = state.shuttle;
  text("EXTRACTION", sh.x, sh.y + 65, 10, "#b2dbba", "center");
  for (const i of state.loot) {
    drawLoot(ctx, i);
    if (distance(target, i) < 90)
      text(`LOOT · ${i.value} CR`, i.x, i.y + 27, 9, "#edca85", "center");
  }
  drawExpedition(ctx, state, text, rect, target);
  drawCreature(ctx, state.monster, state.time);
  for (const [i, q] of state.players.entries()) {
    drawCrew(ctx, q, state.time, q.id === myId, i);
    if (!q.aboard) {
      ctx.shadowColor = "#080f16";
      ctx.shadowBlur = 4;
      text(q.name, q.x, q.y - 31, 11, q.color, "center");
      ctx.shadowBlur = 0;
    }
  }
  const focus = hovered();
  if (focus) {
    ctx.strokeStyle = focus.near ? "#efd49b" : "#869991";
    ctx.lineWidth = 1;
    const x = focus.x,
      y = focus.y;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x + sx * 26, y + sy * 17);
      ctx.lineTo(x + sx * 26, y + sy * 26);
      ctx.lineTo(x + sx * 17, y + sy * 26);
      ctx.stroke();
    }
    if (focus.near && !focus.reason && focus.command !== "inspect") {
      rect(x - 9, y - 43, 18, 17, "#17252bf0");
      text("E", x, y - 30, 12, "#f2dbab", "center");
    }
  }
  const gradient = ctx.createRadialGradient(cx, cy, 110, cx, cy, 760);
  gradient.addColorStop(0, "#00000000");
  gradient.addColorStop(1, "#060d1666");
  ctx.fillStyle = gradient;
  ctx.fillRect(
    cx - width / zoom,
    cy - height / zoom,
    (width * 2) / zoom,
    (height * 2) / zoom,
  );
  ctx.restore();
  // Screen-edge alarm tint is presentation only; warning geometry remains unobscured.
  if (state.phase === "escape") {
    const edge = ctx.createLinearGradient(0, 0, 0, height);
    edge.addColorStop(0, "#a7483620");
    edge.addColorStop(0.2, "#00000000");
    edge.addColorStop(0.8, "#00000000");
    edge.addColorStop(1, "#a748361b");
    ctx.fillStyle = edge;
    ctx.fillRect(0, 0, width, height);
  }
  // Whole-station schematic keeps the return route readable.
  const scale = 4,
    mw = COLS * scale,
    mh = ROWS * scale,
    mx = width - mw - 22,
    my = height - mh - 75;
  rect(mx - 9, my - 23, mw + 18, mh + 33, "#09151dea");
  text("STATION SCHEMATIC", mx, my - 9, 9, "#789aa8");
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      if (MAP[y][x])
        rect(mx + x * scale, my + y * scale, scale, scale, "#31434d");
  for (const q of state.players)
    if (q.alive)
      rect(
        mx + (q.x / TILE) * scale - 2,
        my + (q.y / TILE) * scale - 2,
        4,
        4,
        q.color,
      );
  rect(
    mx + (sh.x / TILE) * scale - 3,
    my + (sh.y / TILE) * scale - 3,
    6,
    6,
    "#62dfba",
  );
  for (const c of state.cells)
    if (!c.taken)
      rect(
        mx + (c.x / TILE) * scale - 2,
        my + (c.y / TILE) * scale - 2,
        4,
        4,
        "#a5faff",
      );
  if (!state.core.taken)
    rect(
      mx + (state.core.x / TILE) * scale - 3,
      my + (state.core.y / TILE) * scale - 3,
      6,
      6,
      "#f8a2cf",
    );
  if (state.monster.active)
    rect(
      mx + (state.monster.x / TILE) * scale - 2,
      my + (state.monster.y / TILE) * scale - 2,
      4,
      4,
      "#ff557c",
    );
}
let previous = performance.now(),
  inputClock = 0,
  syncClock = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - previous) / 1000);
  previous = now;
  if (!$("game").hidden) {
    if (!host && !fatal && now - lastHostMessage > 8000) {
      fatal = true;
      keys.clear();
      $("notice").textContent =
        "Host disconnected or stopped responding. Leave this run to reconnect.";
    }
    inputClock += dt;
    syncClock += dt;
    hudTime += dt;
    if (inputClock >= 0.05) {
      inputClock = 0;
      send({
        type: "input",
        dx:
          (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
          (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
        dy:
          (keys.has("s") || keys.has("arrowdown") ? 1 : 0) -
          (keys.has("w") || keys.has("arrowup") ? 1 : 0),
        interact: keys.has("e"),
        target: heldTarget,
      });
    }
    if (host && !fatal) {
      tick(state, dt);
      if (syncClock >= 0.05) {
        syncClock = 0;
        net?.broadcast({ type: "state", state });
      }
    }
    draw(now);
    if (hudTime > 0.1) {
      hudTime = 0;
      hud();
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

addEventListener("beforeunload", () => net?.close());

document.addEventListener("pointerdown", enableAudio, { once: true });
$("sound").onclick = () => {
  $("sound").textContent = toggleAudio() ? "SOUND ON" : "SOUND OFF";
};
