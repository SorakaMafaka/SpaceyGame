# Salvage League

A desktop browser prototype for 1–4 players. Explore the Pale Relay together, fill a spatial inventory, then escape an awakened station. The richest extracted survivor wins. Built with Canvas, Vite and PeerJS; no game backend is required.

## Play online

Open **https://sorakamafaka.github.io/SpaceyGame/**. Choose **Host expedition**, share the eight-character code, and have three friends choose **Join crew**. The host starts the match. **Solo recon** works without signaling, but the archive and reliquary require teammates during salvage.

The project is deployed to GitHub Pages. Browser testing uses the deployed site; no local server is started by the test runner.

## Controls

| Key           | Action                                                                                          |
| ------------- | ----------------------------------------------------------------------------------------------- |
| WASD / arrows | Move                                                                                            |
| E             | Use the hovered nearby object, or the nearest available object; hold for cooperative mechanisms |
| Tab           | Open or close cargo                                                                             |
| R             | Rotate selected cargo; click its current position or an empty cell to place                     |
| Mouse hover   | Explain the action, its consequences, and whether it is available                               |

Inventory: 8×5 cells, rectangular salvage, rotation, drag-and-drop, and click placement. Select an item and use **Drop item** to leave it for another player. Packing does not pause the game. Carried weight reduces movement speed; value, weight and footprint differ between items.

## The expedition

- Open the archive seal by holding E with two nearby players for two seconds.
- Hold the yellow reactor override to let another player through the reliquary seals.
- Salvage and elapsed time increase disturbance. At 100%, the ancient hunter wakes. The override seals release for evacuation.
- Return by foot or consume the lift's single emergency charge to reach the shuttle bay instantly. Sealed routes can be waited out or bypassed through the service loop where available.
- The shuttle bay is protected. E boards; boarding is final. Release E, then press E again at the departure console to start the irreversible 20-second launch countdown. All four players can survive.
- Three minutes after awakening, the station collapses even if nobody has launched. Boarded survivors escape; everyone else loses their haul. Tied top scores share victory.
- Dead players drop cargo and spectate. A disconnected player loses carried salvage unless already aboard. Host departure ends the session; no host migration or reconnection in this MVP.

## Multiplayer hosting

The host browser simulates the game and validates actions. Guests send inputs over WebRTC and receive state snapshots at 20 Hz. Public PeerJS Cloud provides signaling; it does not run the game. Keep the host tab visible: browsers throttle background tabs. This is a friends-only prototype, without authentication or anti-cheat protection against the host.

Internet access to PeerJS Cloud is required to create/join rooms. Direct WebRTC can fail behind restrictive firewalls/NAT. To add your own TURN service, configure `VITE_ICE_SERVERS` as a JSON array of RTCIceServer objects in `.env.local` before building. Browser-bundled credentials are public: use short-lived TURN credentials for a public release. Solo recon needs no signaling.

## Build and GitHub Pages

```sh
npm run build
```

`dist/` is the static output. Relative asset URLs support GitHub Pages repository paths. The included workflow assumes **SpaceyGame is the repository root**. Pages uses GitHub Actions. It deploys pushes to `main` or can be run manually. If kept inside a larger repository, adjust the workflow working directory and artifact path.

No installation or service worker is required. Fonts load from Google Fonts, with local fallbacks. All game visuals are code-drawn; there are no downloaded art assets.

## Verification

```sh
npx playwright install chromium
npx playwright test
```

Browser tests run against GitHub Pages and exercise hover guidance, contextual pickup, inventory manipulation, solo play, a full awakening-to-departure sequence, and a four-browser room via real signaling. The deployment workflow runs these checks after publishing. The multiplayer test needs internet and reachable PeerJS Cloud; it is not a substitute for testing four devices across different networks.

## MVP boundaries

One fixed station, one hunter, no combat, persistent progression, sound, procedural generation, or voice chat. Use a separate call to coordinate. Match pacing and sabotage balance need four-person playtesting. A solo run can wake the station through time and salvage in the accessible wings.

References: [PeerJS connections](https://peerjs.com/client/getting-started), [Vite static deployment](https://vite.dev/guide/static-deploy).
