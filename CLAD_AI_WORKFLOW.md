# PackSpace — CLAD AI-Assisted Development Transcript

## Project summary

PackSpace is a spatial packing assistant for Snap Specs. Users place category areas on real horizontal surfaces, add the items that belong in each area, and mark items as collected while packing. A screen-space checklist remains visible throughout the experience. Users can also create custom presets and import lists shared by friends through a six-character code.

This document is a curated transcript of the prompts and AI-assisted workflow used to design and build PackSpace with Codex and the Lens Studio CLAD toolkit. Prompts have been lightly edited for spelling and brevity while preserving their meaning.

## Tools used

- Codex for product planning, implementation, debugging, and deployment
- Lens Studio CLAD tools for inspecting and modifying the Lens Studio project
- CLAD Lens Studio skills for Specs UI, interaction, world-query placement, persistence, networking, preview verification, and debugging
- Lens Studio Preview for visual and interaction testing
- Vercel Functions and Vercel Blob for shared-list storage

## AI-assisted workflow

### 1. Understanding the challenge and choosing a spatial idea

**Prompt**

> Fully understand the hackathon instructions, how to work with CLAD, and help me as I am using it for the first time. Give me best practices and a quick deep dive.

**Prompt**

> I want something useful that makes sense to use on glasses for 10–15 minutes. Let’s leverage spatial features. It should not be a mobile productivity screen floating in the air.

**AI-assisted outcome**

We refined the concept into PackSpace: a utility that turns physical surfaces into organized packing zones. The spatial layout is the core interaction, while screen-space UI is reserved for status and navigation.

### 2. Defining custom presets

**Prompt**

> Allow users to create their own presets. A user should be able to create custom pack areas and custom item names. Add this feature to the specification, then proceed to development.

**Prompt**

> First input the preset name. Then the user adds a category, names it, and places its rectangle on a horizontal surface. Inside each category area, a plus button lets the user add item names using text or voice.

**AI-assisted outcome**

CLAD helped implement a state model containing presets, categories, items, completion states, and spatial placement data. The custom-preset flow was separated from the main launcher to keep the experience linear.

### 3. Building and refining spatial category areas

**Prompt**

> Category areas should be square frame areas where users put objects. Items are marked manually after they are placed.

**Prompt**

> Skip the canvas step. Let users place category areas wherever they want on a horizontal surface. Place them one after another, not all at once.

**Prompt**

> After an area is placed, it should immediately become visible. Do not wait until all areas are finished.

**AI-assisted outcome**

The experience was changed from a single predefined canvas to sequential category placement using real-world surface queries. Each completed area renders immediately and becomes part of the active workspace.

### 4. Iterating on category UI and readability

**Prompt**

> The category name and plus button are missing. The plus button should be clearly visible and easy to select.

**Prompt**

> Put the list inside the category square to avoid overlaps when two areas are close together. Move the plus button to the top-right corner.

**Prompt**

> Move the title higher. Align the plus button on the same height as the title. Move the item list toward the top of the category area.

**Prompt**

> Enlarge all text by 20–30 percent because it is not clearly readable.

**AI-assisted outcome**

CLAD preview inspection and repeated visual checks were used to adjust hierarchy, type scale, title placement, list placement, button position, and interaction targets. Lists were moved inside their category bounds so nearby areas could not overlap one another.

### 5. Fixing interaction and rendering bugs

**Prompt**

> The UI moves when I come close and becomes attached to the cursor. The spatial panels should not be movable.

**Prompt**

> When I tap an item, all UI jitters as if it is being refreshed. Fix this.

**Prompt**

> When an item is selected, two checkmarks appear. Keep only one checkmark instead of the circle.

**Prompt**

> There is a layering and Z-order issue that creates blinking artifacts.

**AI-assisted outcome**

The interaction configuration was revised so workspace panels remained anchored instead of behaving like draggable UI. Item updates were changed to update existing controls rather than rebuilding the whole interface. Duplicate selected-state visuals were removed, and render depth/order was adjusted to eliminate z-fighting.

### 6. Screen-space checklist and navigation

**Prompt**

> Add a list of items fixed in glasses screen space so it is always visible. It should update automatically when the user marks something as picked.

**Prompt**

> Can the Back to Main button be locked in screen space so it is always visible and easy to click?

**AI-assisted outcome**

A head-locked HUD was added for overall progress, grouped item status, and persistent navigation. Spatial category areas remain world-anchored while only the compact HUD follows the user.

### 7. Persistence and resume behavior

**Prompt**

> Make sure the list, item lists, and item states are added to persistent storage.

**Prompt**

> After I click Resume, do not force me to place the areas again. Store them persistently in the same space where I initially set them.

**Prompt**

> Put resume buttons in a scrollable area and call it “Continue where you left off.”

**AI-assisted outcome**

Preset definitions, completion states, and placement information were persisted locally. The main menu gained a scrollable resume section for saved sessions. Saved presets can continue without repeating the authoring flow when their spatial data is available.

### 8. Sharing lists with a six-character code

**Prompt**

> Let users import custom packing lists. A friend can create categories and items on a website, share a code, and I can enter it in the Specs Lens to save the list.

**Prompt**

> The code should be easy to enter: exactly six characters using numbers and letters. The list is stored on a backend and fetched by the Specs Lens.

**AI-assisted outcome**

The Lens received a six-character import interface and network client. Codes exclude visually ambiguous characters. Downloaded presets are validated before being stored locally.

### 9. Creating and deploying the backend

**Prompt**

> Create the backend. I do not have anything yet.

**Prompt**

> Let’s use Vercel instead of Railway.

**AI-assisted outcome**

Codex created and deployed a Vercel serverless API backed by Vercel Blob. Each code maps to an immutable JSON preset. The API validates preset size and content, generates collision-resistant six-character codes, and supports:

- `POST /v1/lists` — create a shared list and return its code
- `GET /v1/lists/:code` — retrieve a shared list
- `GET /health` — service health check

The production API was connected to the Lens as its default sharing service. A real create-and-retrieve test was completed before the Lens was recompiled and checked for runtime errors.

### 10. Verification loop

Throughout development, the workflow repeated the following loop:

1. Describe a specific behavior or visual issue.
2. Inspect the relevant Lens scripts and current preview state.
3. Make the smallest targeted change.
4. Recompile TypeScript in Lens Studio.
5. Refresh the Preview and collect runtime logs.
6. Review a screenshot or interaction result.
7. Refine placement, scale, interaction, or state handling based on observed behavior.

This iterative loop was especially important for spatial UI because positions and interaction comfort could not be judged from source code alone.

### 11. Final submission and visual polish

**Prompt**

> Change the design from standard Specs glass panels to a flatter style with solid white outlines.

**Prompt**

> Each category must continuously detect a new horizontal surface. One area can be on a table while another is on a floor or chair at a different height.

**Prompt**

> Prepare the public repository, a short detailed README, the CLAD prompt log, project description, and a demo-video script for submission.

**AI-assisted outcome**

The final pass introduced a high-contrast outlined visual system, persistent frame strokes, SnapOS holographic hover feedback, independent surface heights for every category, placement-session cancellation during navigation, and submission documentation. Every code change was followed by Lens Studio TypeScript compilation and refreshed runtime-log verification.

## Human direction and AI contribution

The human participant defined the product goal, evaluated the experience in Lens Studio Preview, supplied screenshots, identified usability problems, and made the final design decisions. Codex and CLAD translated that direction into technical architecture, Lens Studio scripts, spatial UI changes, debugging steps, persistent state, networking, backend implementation, deployment, and verification.

The project was not generated from one prompt. It emerged through many short design–build–test iterations, with the human continuously correcting spatial layout and interaction behavior based on direct use.

## Result

The completed prototype demonstrates an experience designed specifically for Specs:

- Real surfaces become functional packing zones.
- Categories remain anchored in physical space.
- The checklist remains visible in screen space.
- Users create their own spatial presets.
- Packing progress persists between sessions.
- Friends can share list templates using a short code.
- Individual categories can occupy different horizontal surfaces and heights.
