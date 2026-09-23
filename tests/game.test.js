import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  addPlayer,
  start,
  tick,
  action,
  fits,
  firstFit,
  awaken,
  finish,
  weight,
  value,
  TILE,
  walkable,
} from "../src/game.js";
function setup(n = 1) {
  const s = createGame();
  for (let i = 0; i < n; i++) addPlayer(s, "p" + i, "Crew " + i);
  start(s);
  return s;
}
const near = (p, o) => Object.assign(p, { x: o.x - 30, y: o.y });
test("room capacity and late join protection", () => {
  const s = createGame();
  for (let i = 0; i < 4; i++) assert.ok(addPlayer(s, "" + i, "A"));
  assert.equal(addPlayer(s, "5", "B"), null);
  start(s);
  assert.equal(addPlayer(s, "6", "C"), null);
});
test("inventory bounds, overlap, rotation and atomic failed move", () => {
  const items = [{ id: "a", gx: 0, gy: 0, w: 2, h: 3 }];
  assert.equal(fits(items, { id: "b", w: 2, h: 2 }, 1, 1), false);
  assert.equal(fits(items, { id: "b", w: 2, h: 2 }, 7, 4), false);
  assert.deepEqual(firstFit(items, { id: "b", w: 2, h: 2 }), { gx: 2, gy: 0 });
  const s = setup(),
    p = s.players[0];
  p.inventory = [{ ...items[0], value: 1, weight: 1 }];
  action(s, p.id, { type: "moveItem", id: "a", x: 6, y: 4, rotate: true });
  assert.equal(p.inventory[0].w, 2);
  action(s, p.id, { type: "moveItem", id: "a", x: 2, y: 0, rotate: true });
  assert.equal(p.inventory[0].w, 3);
  assert.equal(p.inventory[0].h, 2);
});
test("full inventory rejects pickup without losing loot or raising disturbance", () => {
  const s = setup(),
    p = s.players[0];
  p.inventory = [{ id: "full", gx: 0, gy: 0, w: 8, h: 5, weight: 1, value: 1 }];
  near(p, s.loot[0]);
  const count = s.loot.length;
  action(s, p.id, { type: "pickup" });
  assert.equal(s.loot.length, count);
  assert.equal(s.disturbance, 0);
});
test("host resolves contested pickup once, drop permits stealing", () => {
  const s = setup(2),
    [a, b] = s.players;
  near(a, s.loot[0]);
  Object.assign(b, { x: a.x, y: a.y });
  s.loot = [s.loot[0]];
  action(s, a.id, { type: "pickup" });
  action(s, b.id, { type: "pickup" });
  assert.equal(a.inventory.length, 1);
  assert.equal(b.inventory.length, 0);
  action(s, a.id, { type: "drop", id: a.inventory[0].id });
  action(s, b.id, { type: "pickup" });
  assert.equal(b.inventory.length, 1);
  assert.equal(a.inventory.length, 0);
  assert.ok(weight(b) > 0);
});
test("duo door requires two fresh held inputs and opens after two seconds", () => {
  const s = setup(2),
    d = s.doors[0];
  for (const p of s.players) near(p, d);
  for (let i = 0; i < 30; i++) {
    action(s, "p0", { type: "input", interact: true });
    tick(s, 0.1);
  }
  assert.equal(d.open, false);
  for (let i = 0; i < 21; i++) {
    for (const p of s.players)
      action(s, p.id, { type: "input", interact: true });
    tick(s, 0.1);
  }
  assert.equal(d.open, true);
});
test("manual override closes on release and emergency opens on awakening", () => {
  const s = setup(),
    p = s.players[0],
    d = s.doors[1];
  near(p, s.switch);
  action(s, p.id, { type: "input", interact: true });
  tick(s, 0.1);
  assert.equal(d.open, true);
  action(s, p.id, { type: "input", interact: false });
  tick(s, 0.1);
  assert.equal(d.open, false);
  awaken(s);
  tick(s, 0.1);
  assert.equal(d.open, true);
});
test("emergency lift is an atomic single use", () => {
  const s = setup(2);
  awaken(s);
  for (const p of s.players) near(p, s.lift);
  action(s, "p0", { type: "use" });
  action(s, "p1", { type: "use" });
  assert.equal(s.lift.charges, 0);
  assert.ok(s.players[0].x < 8 * TILE);
  assert.ok(s.players[1].x > 30 * TILE);
});
test("sabotage has range, expires, and blocks collision", () => {
  const s = setup(),
    p = s.players[0],
    d = s.doors.find((d) => d.id === "bulkhead");
  awaken(s);
  action(s, p.id, { type: "sabotage" });
  assert.equal(d.locked, 0);
  near(p, d);
  action(s, p.id, { type: "sabotage" });
  assert.equal(d.locked, 7);
  assert.equal(walkable(s, d.x, d.y), false);
  for (let i = 0; i < 71; i++) tick(s, 0.1);
  assert.equal(d.open, true);
});
test("only boarded crew can launch, countdown cannot restart and richest survivor wins", () => {
  const s = setup(3);
  awaken(s);
  action(s, "p0", { type: "launch" });
  assert.equal(s.launch, null);
  for (let i = 0; i < 2; i++) {
    const p = s.players[i];
    near(p, s.shuttle);
    p.inventory = [{ id: "i" + i, value: 100 + i * 100, weight: 2 }];
    action(s, p.id, { type: "use" });
  }
  s.players[2].inventory = [{ id: "rich", value: 9999, weight: 1 }];
  action(s, "p0", { type: "launch" });
  tick(s, 0.1);
  action(s, "p1", { type: "launch" });
  assert.ok(s.launch < 20);
  for (let i = 0; i < 201; i++) tick(s, 0.1);
  assert.equal(s.phase, "ended");
  assert.deepEqual(s.result.winners, ["p1"]);
  assert.equal(value(s.players[1]), 200);
});
test("collapse ends a run even if nobody launches; ties and zero survivors are defined", () => {
  const s = setup();
  awaken(s);
  s.escapeLeft = 0.05;
  tick(s, 0.1);
  assert.equal(s.phase, "ended");
  assert.deepEqual(s.result.winners, []);
  const t = setup(2);
  for (const p of t.players) p.aboard = true;
  finish(t);
  assert.deepEqual(t.result.winners, ["p0", "p1"]);
});
test("stale movement stops, invalid inputs cannot corrupt position", () => {
  const s = setup(),
    p = s.players[0];
  action(s, p.id, { type: "input", dx: NaN, dy: Infinity });
  tick(s, 0.1);
  assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  action(s, p.id, { type: "input", dx: 1, dy: 0 });
  for (let i = 0; i < 8; i++) tick(s, 0.1);
  const x = p.x;
  tick(s, 0.1);
  assert.equal(p.x, x);
});
test("monster reaches a nearby player and dead crew drop inventory", () => {
  const s = setup(),
    p = s.players[0];
  awaken(s);
  p.x = s.monster.x;
  p.y = s.monster.y;
  p.inventory = [{ id: "death-drop", value: 100, weight: 1, w: 1, h: 1 }];
  for (let i = 0; i < 40; i++) tick(s, 0.1);
  assert.equal(p.alive, false);
  assert.equal(p.inventory.length, 0);
  assert.ok(s.loot.some((i) => i.id === "death-drop"));
});
