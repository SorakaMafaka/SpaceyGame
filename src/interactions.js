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
    !s.lift.charges
      ? "No charges left. Take the long way."
      : s.phase !== "escape"
        ? "Available during evacuation."
        : "",
  );
  add(
    "switch",
    s.switch,
    75,
    "Manual override",
    "Keep holding E to open both reliquary seals for your teammates.",
    "hold",
    true,
    s.phase === "escape" ? "Emergency release is already active." : "",
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
            : "A teammate must hold the reactor override."
          : "",
    );
  }
  for (const i of s.loot)
    add(
      i.id,
      i,
      70,
      i.name,
      `${i.value} credits · ${i.weight} kg · ${i.w}×${i.h} cargo space. Pick up into your inventory.`,
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
