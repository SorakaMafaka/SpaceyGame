# The Pale Relay — visual direction

## Identity

Industrial salvage horror: a once-practical station built from ceramic armor, exposed steel, rubber seals and copper pipework. Work lamps remain warm; emergency guidance is sea-glass green. Ancient growth is pale bone against bruised plum, making the creature feel foreign to the machinery.

## Readability rules

- Walkable floors sit in the middle-dark range, bordered by thick raised walls. Decorative clutter stays on wall edges and never suggests new collision.
- Crew have compact pressure suits, opaque visors, distinct shoulder colors, and visible walk cycles. Color is supplemented by names and individual shoulder markings.
- Salvage objects have recognizable silhouettes shared between floor objects and cargo icons. Generic diamonds are retired.
- Cyan: portable power. Amber: human machinery and warnings. Sea-glass: extraction and safe states. Bone/plum: ancient biology. Red: immediate danger.
- Effects explain existing state: noise rings, vision cones, warning beams and lunge telegraphs remain readable above the scenery.
- Labels are emphasized near the player; hover explains interaction. Decorative world stencils are quiet and never compete with prompts.

## Construction

The game uses cached, code-drawn station surfaces and reusable canvas sprites. Floor detail is deterministic. Repeated objects share one visual vocabulary; silhouettes, outlines, highlights and directional shadows provide depth. Moving parts and breathing/walking cycles are presentation-only.

## Interface

An expedition instrument panel: dark charcoal plates, warm ivory type, stamped amber section labels, narrow technical readouts. Reserve crew colors for crew identity. Cargo should feel like packed equipment, not colored spreadsheet cells.

## Constraints

Do not change movement, collision, interaction ranges, object positions, AI, inventory rules, timers or scoring during this pass. New artwork must preserve existing gameplay readability. Verify at 1280×720 and 1440×900 on the deployed GitHub Pages site.

## Title illustration

Asset: `assets/pale-relay-keyart.png`. Generated with the built-in imagegen tool. The in-game sprites and station renderer remain code-drawn in `src/art.js`.

Generation prompt:

> Use case: stylized-concept. Asset type: landscape title-screen illustration for the game Salvage League, no typography or UI. Create a polished atmospheric INDUSTRIAL PIXEL ART illustration, 1536x1024 landscape. Three-quarter overhead view of an abandoned orbital station chamber, chunky deliberately visible pixel clusters, crisp pixel edges, restrained 32-color look, no smooth airbrushing. Four small bulky salvage workers in ceramic pressure suits with teal, blue, amber and lavender shoulder stripes stand in the foreground facing an immense sleeping PALE BONE ARMORED insectile creature curled around a glowing amber ancient reactor in the upper-right. Worn dark navy steel deck plates, heavy raised bulkheads, copper pipes, dirty cream panels, amber work lamps, faint sea-glass extraction strips, thick atmospheric shadows but clear readable silhouettes. Composition: strongest scene detail in center-right, leftmost 25 percent mostly dark unoccupied deck for HTML title overlay. Horror through scale and stillness, not gore. Retro high-end pixel game key art, tactile material detail. No text, no lettering, no logo, no watermark. Full bleed, no border.
