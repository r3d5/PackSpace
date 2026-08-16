# PackSpace

PackSpace turns real horizontal surfaces into spatial packing zones for Snap Specs. Place categories on a table, chair, sofa, or floor; stage the matching objects inside each outlined area; and mark items as collected while a compact head-locked checklist tracks overall progress.

## Why it belongs on glasses

Packing is physical, mobile, and hands-on. PackSpace keeps instructions in view without occupying either hand, while its category areas stay attached to the surfaces where objects are actually being gathered. The experience is designed for a focused 10–15 minute packing session—not as a phone interface floating in space.

## Key features

- Place multiple packing areas independently across different horizontal surfaces and heights.
- Create custom presets, categories, and item names directly in Specs.
- See each completed area immediately during sequential placement.
- Mark items manually in their spatial area or through the always-visible HUD.
- Persist custom presets, area placements, item lists, and completion state.
- Resume previous packing sessions without placing saved areas again.
- Create lists on the companion website and import them with a six-character pack code.
- Flat, high-contrast outlined UI with SnapOS holographic hover feedback.

## Built with

- Lens Studio and TypeScript
- CLAD Lens Studio tools and skills
- Spectacles Interaction Kit
- Spectacles UIKit
- World Query for horizontal-surface placement
- Persistent Storage for local presets and progress
- Internet Module for pack-code imports
- Vercel Functions and Vercel Blob for list sharing

## Architecture

- `PackSpaceMain.ts` coordinates navigation, authoring, persistence, and shared-list imports.
- `PackSpaceWorldController.ts` continuously queries surfaces and owns pinch-drag placement.
- `PackSpaceAuthoringUI.ts` renders spatial category areas and item controls.
- `PackSpaceHUD.ts` provides head-locked progress and navigation.
- `PackSpaceState.ts` owns presets, packed state, serialization, and local persistence.
- `backend/api/index.mjs` validates, stores, and retrieves shared presets.

## Run locally

1. Open `Clad_Hack_Organize.esproj` in Lens Studio.
2. Allow Lens Studio to load the included packages.
3. Open Preview using a Specs interactive environment.
4. Start the built-in preset or create a custom preset.
5. Pinch-drag on horizontal surfaces to place each category area.

The sharing API lives in `backend/`. It requires Node.js 20+, Vercel, and a configured Vercel Blob store.

```bash
cd backend
npm install
vercel dev
```

## Submission material

- [CLAD prompt and AI workflow](CLAD_AI_WORKFLOW.md)
- [Demo recording and voice-over script](DEMO_VIDEO_SCRIPT.md)
- [Submission description](SUBMISSION.md)

## Privacy and repository scope

Generated Lens Studio caches, local editor configuration, deployment state, dependencies, and private signing keys are intentionally excluded from this public repository.
