# PackSpace — Product and Technical Specification

## Product goal

PackSpace helps a person stage and pack real objects while keeping both hands free. It turns a detected horizontal surface into a spatial packing workspace whose areas, labels, and checklist items remain attached to the physical environment.

The experience is designed for a focused 10–15 minute session and must be meaningfully better on SPECS than on a phone.

## Primary user flow

1. The user launches PackSpace and selects an existing preset or creates a custom preset.
2. For a custom preset, the user enters the preset name and first category name in the dedicated creation menu, then selects `PLACE CATEGORY`.
3. PackSpace immediately enters category placement; there is no separate canvas or surface-lock step.
4. The user pinch-drags a category rectangle directly on any valid horizontal World Query surface. A live outlined rectangle follows the drag until release.
5. Each placed category uses a terminal/ASCII visual language and contains a centered `+` action. Selecting `+` opens inline item-name entry with keyboard and voice input.
6. Selecting `ADD CATEGORY` asks for the next category name, then arms another direct rectangle placement on the horizontal surface.
7. Added items appear inside their category boundary. Finishing converts the spatial draft into a normal reusable packing preset.
8. PackSpace arranges the preset's areas as spatial zones on the detected surface.
9. Each area is a fixed square staging frame with a separate checklist beside it. The user physically places objects inside the frame, then manually marks the corresponding checklist items.
10. A compact screen-space packing HUD remains fixed in the glasses display, shows all preset items grouped by area, and mirrors every manual item update immediately.
    HUD instructions and progress must remain inside a conservative display safe area, inset from the top and right edges.
11. Progress is visible in the world as completed items change state.
12. The session ends with a final sweep and a concise packed/missing summary.

## Presets

PackSpace ships with one starter preset:

- **Two-Day Work Trip**
  - Clothes: Shirt, Trousers, Underwear, Socks
  - Tech: Laptop, Charger, Headphones
  - Essentials: Wallet, Keys, Medication

Users can create custom presets containing:

- A custom preset name.
- One to six custom packing areas.
- A custom name and color for each area.
- One to eight custom item names per area.
- The ability to add, remove, or rename areas and items before starting.

For the hackathon MVP, custom presets persist for the active Lens session. The state layer exposes serialization-ready data contracts so durable storage can be added as a contained follow-up.

## Spatial interaction requirements

- The main workspace must be placed on a real horizontal surface using World Query.
- Packing areas must exist as separate world-space zones, not as rows in a floating checklist.
- Areas must be arranged relative to the surface hit position and normal.
- The user must be able to walk around the workspace while it remains stable.
- Packing frames are fixed after surface placement: they cannot be dragged, scaled, or attached to a hand/mouse interactor.
- Item completion is always an explicit manual action on the checklist after the physical object is placed in its square area.
- Conventional UIKit panels are limited to preset creation, short onboarding, and final summary.
- Status UI must not occlude the physical packing workspace.

## MVP screens and spatial surfaces

### Preset launcher

- Starter preset card.
- Custom preset card.
- Start button.

### Preset editor

- Preset-name text input.
- Area-name text input.
- Item-name text input.
- Add area, add item, remove, save, and cancel actions.
- A compact preview of the current preset structure.

### Placement coach

- Short instruction: look at a clear horizontal surface and pinch to place.
- Placement reticle and surface-validity feedback.

### Spatial workspace

- Two to six authored-at-runtime pack-area roots arranged in a grid around the surface anchor.
- Area title, large square physical staging frame, adjacent manual checklist, completion count, and distinct color per zone.
- Completed items visibly dim/check off while remaining readable.

### Session summary

- Packed count, missing count, and areas completed.
- Restart and return-to-presets actions.

## State model

```ts
type PackItem = {
  id: string;
  name: string;
  packed: boolean;
};

type PackArea = {
  id: string;
  name: string;
  colorIndex: number;
  items: PackItem[];
};

type PackPreset = {
  id: string;
  name: string;
  areas: PackArea[];
  userCreated: boolean;
};
```

`PackSpaceState` owns presets and active-session progress. UI modules are passive views and emit user intent. Spatial controllers consume state snapshots and report completion events back to the state owner.

## Architecture

- `PackSpaceMain.ts` — lifecycle and orchestration only.
- `PackSpaceState.ts` — preset editing, validation, active-session progress, and serialization-ready data contracts.
- `PackSpaceLauncherUI.ts` — UIKit preset selection and onboarding.
- `PackSpaceEditorUI.ts` — UIKit custom preset and area/item authoring.
- `PackSpaceSummaryUI.ts` — UIKit completion summary.
- `PackSpaceWorldController.ts` — World Query placement and spatial workspace lifecycle.
- `PackSpaceAreaController.ts` — runtime pack-area generation and direct item interactions.
- `PackSpaceAudioController.ts` — confirmation, warning, and completion cues.

## Constraints

- TypeScript components extend `BaseScriptComponent`.
- Lens runtime uses centimeters, +X right, +Y up, and -Z forward.
- UI surfaces use SpectaclesUIKit; no collider-built imitation buttons.
- World object interactions use SIK recipes.
- All authored resources live under `Assets/`.
- No project logic is stored in generated `Cache/` content.

## Definition of done

- The project compiles with no TypeScript errors.
- The starter preset can launch a spatial workspace.
- A custom preset with custom area and item names can be created and launched.
- The workspace can be placed on a horizontal preview surface.
- At least one item can be marked packed through simulated hand interaction.
- Progress updates both the spatial area and session summary.
- Runtime logs contain no new PackSpace errors.
- The final preview is captured and visually reviewed.

## Deliberate follow-ups

- Durable preset persistence across Lens launches.
- ASR-based preset creation.
- Camera-assisted object recognition.
- Depth-aware object outlines and automatic zone confirmation.
- Reusable destination-aware preset suggestions.
