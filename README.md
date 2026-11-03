# Eldoria: The Last Bastion

Browser-based pixel-art dark-fantasy RPG built with **Phaser 3.90**, plain JavaScript (no build step), HTML5 Canvas and IndexedDB.

## Run locally
```bash
python3 -m http.server 8000   # or: npx serve
# open http://localhost:8000
```
## Deploy on GitHub Pages
Push to GitHub, then Settings → Pages → Deploy from branch → `main` / root.

## Features
Town hub with clickable buildings and day/night clock · random & timed events · 5 hero classes (level, skills, promotion, equipment) ·
free-position Formation (no overlap, auto-arrange, 3 presets) · real-time auto battle with tactical commands, manual skills/ultimates, tactical pause, boss telegraphs ·
5 dungeons × 4 stages (no stamina) · crafting & upgrades · manual save slots (IndexedDB, overwrite warning, no autosave).

## Controls
Space pause · 1–5 skills · Shift+1–5 ultimates · A/H/G/S/R commands · click enemy to focus · drag heroes in Formation · Esc closes panels.

## Structure
`src/core` config/state/audio · `src/data` classes, items, enemies, dungeons, events, quests · `src/characters` · `src/inventory` · `src/equipment` ·
`src/formation` · `src/town` · `src/dungeon` · `src/combat` · `src/ai` · `src/save` · `src/ui` · `src/scenes` (+`panels`) · `src/assets` (procedural art)

## Art note
All sprites, tiles, icons and UI frames are **placeholder art generated in code** (`src/assets`), laid out as frame sheets
(`idle0-1, walk0-3, atk0-2, hurt, dead`). To use real art, register textures under the same keys (`hero_<class>`, `mon_<shape>_<palette>`, `b_<building>`, `i_*`, `ui_*`).
