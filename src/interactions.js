// Shared by the UI and host so tooltip promises match validated actions.
export function interactions(s, p) {
  if (!p?.alive || !p.connected || !["salvage", "escape"].includes(s.phase))
    return [];
  const objects = [];
  const add = (
    id,
    o,
    range,
    title,
    description,
    command,
    hold = false,
    reason = "",
  ) =>
    objects.push({
      id,
      x: o.x,
      y: o.y,
      range,
      title,
      description,
      command,
      hold,
      reason,
      near: Math.hypot(p.x - o.x, p.y - o.y) < range,
    });
  if (p.aboard) {
    add(
      "shuttle",
      s.shuttle,
      Infinity,
      "Departure console",
      "Start an irreversible 20-second countdown. Anyone left outside loses their haul.",
      "launch",
      false,
      s.launch !== null ? `Departure in ${Math.ceil(s.launch)} seconds.` : "",
    );
    return objects;
  }
  add(
    "shuttle",
    s.shuttle,
    100,
    "Board shuttle",
    "Secure yourself and your cargo. Boarding is final; departure is a separate interaction.",
    "use",
    false,
    s.phase !== "escape" ? "Available after the station awakens." : "",
  );
  add(
    "lift",
    s.lift,
    80,
    "Emergency lift",
    "Use the only remaining charge to return to the shuttle bay. Everyone else must walk.",
    "use",
    false,
    !s.prepared.circuit
      ? "Choose lift power at the Power Junction first."
      : !s.lift.charges
        ? "No charges left. Take the long way."
        : s.phase !== "escape"
          ? "Available during evacuation."
          : "",
  );
  const allPower = s.sockets.every((c) => c.installed);
  for (const c of s.cells)
    if (!c.taken)
      add(
        c.id,
        c,
        70,
        "Power cell",
        "Takes 1×2 cargo space. Install at a vault circuit in the Power Junction.",
        "expedition",
      );
  for (const c of s.sockets)
    add(
      c.id,
      c,
      75,
      "Vault circuit",
      c.installed
        ? "Power restored."
        : "Install a carried power cell. Both circuits are needed for vault access.",
      "expedition",
      false,
      c.installed
        ? "Already restored."
        : !p.inventory.some((i) => i.kind === "power")
          ? "Bring a power cell from Engineering or Storage."
          : "",
    );
  add(
    "security",
    s.consoles[0],
    75,
    "Security shutter control",
    "Hold E to suppress the crossing beams. Shutters stay safe for six seconds after release so you can cross too.",
    "hold",
    true,
  );
  add(
    "maintenance-console",
    s.consoles[1],
    75,
    "Maintenance shortcut",
    "Unlock a permanent passage from Engineering back to the shuttle.",
    "expedition",
    false,
    s.prepared.maintenance ? "Shortcut is open." : "",
  );
  for (const c of s.consoles.slice(2))
    add(
      c.id,
      c,
      75,
      c.id === "circuit-lift" ? "Power emergency lift" : "Power service bridge",
      "Choose one escape route: a single-use lift OR a permanent bridge across the service loop. This choice cannot be changed.",
      "expedition",
      false,
      s.prepared.circuit
        ? `Power committed to ${s.prepared.circuit}.`
        : !allPower
          ? "Restore both vault circuits first."
          : "",
    );
  add(
    "stabilizer",
    s.stabilizer,
    75,
    "Extraction stabilizer",
    "Hold E while another player extracts the quantum assembly to prevent a loud alarm.",
    "hold",
    true,
    s.salvage.taken ? "Assembly already extracted." : "",
  );
  if (!s.salvage.taken)
    add(
      "salvage-machine",
      s.salvage,
      70,
      "Quantum assembly",
      "900 credits · 2×3 cargo. Have someone hold the stabilizer. Extracting without help causes a major alarm.",
      "expedition",
    );
  for (const c of s.containers)
    if (!c.opened)
      add(
        c.id,
        c,
        70,
        "Sealed salvage container",
        "Force this container for valuable loot. The noise raises disturbance and attracts the drone.",
        "expedition",
      );
  for (const l of s.locks)
    add(
      l.id,
      l,
      75,
      "Core restraint",
      "Two players hold separate restraints for two seconds. Once released, both stay open. Solo recon latches them one at a time.",
      "hold",
      true,
      s.core.unlocked
        ? "Restraints released."
        : !allPower
          ? "Restore both vault circuits first."
          : s.phase !== "salvage"
            ? "Core sealed by emergency lockdown."
            : "",
    );
  if (!s.core.taken)
    add(
      "core",
      s.core,
      75,
      "Ancient core",
      p.coreConfirmUntil > s.time
        ? "CONFIRM EXTRACTION: press E again. The creature will wake immediately."
        : "1200 credits · 2×3 cargo. WARNING: extraction wakes the creature. Extracting the core also pays every survivor 200 credits.",
      "expedition",
      false,
      s.phase !== "salvage"
        ? "Emergency lockdown. Escape with your salvage."
        : !s.core.unlocked
          ? "Release both core restraints first."
          : "",
    );
  for (const d of s.doors) {
    const duo = d.kind === "duo" && !d.open && s.phase === "salvage";
    add(
      d.id,
      d,
      duo ? 120 : 100,
      duo ? "Two-person seal" : "Bulkhead",
      duo
        ? "Two nearby crew must hold E together for two seconds."
        : "Seal this passage for seven seconds. This can cut off other crew members.",
      duo ? "hold" : "sabotage",
      duo,
      d.locked > 0
        ? `Sealed for ${Math.ceil(d.locked)} more seconds.`
        : !duo && s.phase !== "escape"
          ? d.open
            ? "Passage is open. Sealing is available during evacuation."
            : "Restore both vault circuits to open this passage."
          : "",
    );
  }
  for (const i of s.loot)
    add(
      i.id,
      i,
      70,
      i.name,
      `${i.value} credits · ${i.w}×${i.h} cargo space. Pick up into your inventory.`,
      "pickup",
    );
  return objects;
}
export function selectInteraction(s, p, target) {
  const list = interactions(s, p);
  if (target) return list.find((i) => i.id === target) || null;
  return (
    list
      .filter((i) => i.near)
      .sort(
        (a, b) =>
          Number(!!a.reason) - Number(!!b.reason) ||
          Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y),
      )[0] || null
  );
}
export function instruction(i) {
  return !i.near
    ? "Move closer to interact."
    : i.reason || `${i.hold ? "Hold" : "Press"} E to ${i.hold ? "use" : "use"}`;
}
