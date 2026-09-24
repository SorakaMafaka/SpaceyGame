# Salvage League — The Pale Relay

A four-player browser stealth heist with a competitive escape. Work together to reach an ancient core, pack your salvage, then decide who gets left behind. The richest extracted survivor wins.

**Play: https://sorakamafaka.github.io/SpaceyGame/**

Host an expedition and share the eight-character room code. Up to three friends join before deployment. Solo recon assists two-person mechanisms so you can explore the full expedition alone.

## Controls

- WASD / arrows: move. Cargo never slows you down.
- Hover objects: see what they do and their consequences.
- E: use the hovered nearby object, or nearest available object. Hold E for cooperative mechanisms.
- Tab: cargo grid. Drag or select an item and click a cell; R rotates. Drop unwanted cargo for others to collect.
- Sound button: toggle synthesized sound cues. Noise and hazards also have visual cues.

## Your expedition

1. Recover the two **power cells** in Engineering and Storage. Each uses 1×2 inventory cells. Install them into the two **vault circuits** in the Power Junction. Cells can be dropped, traded, or recovered from fallen crew.
2. Negotiate the **security crossing**. One player holds the shutter control while others cross; it remains safe for six seconds after release, allowing the operator to follow. Beams flash amber before becoming dangerous.
3. Open the **salvage wing seal** with two crew holding E. Hold the extraction stabilizer while a teammate takes the 900-credit quantum assembly. Taking it without help triggers a large alarm. Forced caches offer extra loot at the cost of noise.
4. Prepare your return. The salvage-wing console permanently opens a maintenance shortcut back to the shuttle. At the junction, choose **one** emergency circuit: the single-use lift, or the permanent service-loop bridge. This choice is irreversible.
5. Two players hold the separate **core restraints** for two seconds. They latch open permanently. The core needs 2×3 inventory space. Press E, read the warning, and press E again within five seconds to extract it and wake the creature.
6. Escape! Shutters cycle faster and steam vents become active. The beast investigates sounds, pursues visible crew and their last known positions, and warns before lunging. Walls and doors block sight; breaking contact can lose it. The shuttle bay is protected.
7. E boards the shuttle permanently. Release E, then press E again to begin the irreversible 20-second departure countdown. There are four seats. After three minutes of evacuation the station collapses, extracting only those already aboard.

**Premature awakening:** machinery alarms, loose metal underfoot, security beams and full drone detection raise disturbance. Quiet play slowly reduces it; time alone and ordinary loot pickup never wake the creature. At 100%, it wakes immediately and the core locks down. Escape with what you have. Mandatory vault seals release, so no one needs a living teammate to get out.

**Stealth:** avoid the drone's visible sight cone. Detection builds gradually and falls when you break sight. Noise rings show the location and severity of sounds; the drone investigates them. Ordinary walking has no noise penalty.

**Scoring:** carried salvage scores only if you survive aboard. The core is worth 1,200 credits to its carrier; extracting it also gives **every survivor 200 credits**. Ties share victory. Dead crew drop cargo. A disconnected player drops cargo unless already aboard.

## Browser hosting and verification

GitHub Actions builds and deploys the game, then runs browser checks against the published Pages URL. No local development server is used for testing.

```sh
npm ci
npx playwright install chromium
npm test
```

The suite tests the actual UI (hover, inventory drag/rotation/drop and four-peer rooms) and imports the shipped simulation module into Chromium on the deployed page for deterministic gameplay checks. It covers constant movement speed, noise and premature awakening, power delivery, cooperative restraints, route choices, stabilized extraction, cargo validation, contested lift use, bulkhead sealing, lunge warnings and extraction scoring.

`npm run build` produces static files in `dist/`. `PLAYWRIGHT_BASE_URL` can select a different hosted deployment. The `simulation` build entry exports the same mechanics used by the game; it does not provide controls for changing an active match.

PeerJS Cloud provides connection signaling; the host browser runs the authoritative simulation. Keep the host tab open and visible. Direct WebRTC may need a TURN relay on restrictive networks. Configure `VITE_ICE_SERVERS` before building to supply your relay configuration. Browser-visible relay credentials should be short-lived. No host migration or reconnection is implemented. New expedition rooms use a separate protocol prefix from the original prototype; all crew should refresh the site before joining.

## Current scope

One handcrafted station, one security drone, one ancient creature, spatial inventory, cooperative machinery, optional route preparation and competitive extraction. No combat, procedural generation, permanent progression or built-in voice chat. Use a call for coordination. In-game pixel sprites and station surfaces are code-drawn; the title illustration was generated with imagegen. Sound is synthesized. See [art direction and asset provenance](docs/ART_DIRECTION.md). Match balance still needs human four-player playtesting.
