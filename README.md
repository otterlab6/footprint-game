# Footprint Game (Web)

Guess the Pokémon from its footprint — the **Sentry Duty** minigame from Pokémon Mystery Dungeon: Explorers of Time/Darkness/Sky, in your browser, with an online leaderboard.

A web port (HTML5 Canvas + vanilla JS) of [KierranFalloon/FootprintGame](https://github.com/KierranFalloon/FootprintGame) (Python/pygame).

## Modes

- **Ranked** — 3 lives. A wrong pick or running out of time (30 s) costs a life and reveals the answer. Score = footprints identified; ties go to the faster total time. Submit a nickname to the online leaderboard at the end.
- **Practice** — endless, like the original: wrong picks let you try again until the timer runs out. Lifetime accuracy is kept in the browser.

Controls: mouse / touch, keys `1`–`4` (top-left → top-right → bottom-left → bottom-right), `Esc` for the menu. English by default; Korean and Japanese (official Pokémon names in each language) follow the browser language or the language picker. The language is locked while a game is in progress.

## Run / deploy

No build step — it's static files.

- **Local**: open `index.html`, or `python3 -m http.server` → http://localhost:8000
- **GitHub Pages**: Settings → Pages → Deploy from a branch → `main` / `(root)`

Pokémon sprites and footprints are loaded at runtime from GitHub (raw.githubusercontent.com), so an internet connection is required.

## Leaderboard backend (Supabase)

- `js/config.js` — project URL + **publishable** key (safe to expose; never put a secret/service_role key here)
- `supabase/schema.sql` — table, row-level security and the `submit_score` function

The database only allows reading scores and calling `submit_score()`, which validates the nickname (1–16 chars), checks the score/time are plausible, rate-limits bursts and returns the rank. It's a nickname leaderboard without accounts, so a determined player could still forge a score — remove bad rows from the Supabase Table Editor if needed.

## Changes from the original

- Pokémon names (EN/KO/JA, #1–#898) are bundled in `js/pokemon-data.js` instead of calling PokeAPI; the next round is preloaded.
- The answer always has a visible footprint, and decoys never share the answer's footprint shape (the original could produce unwinnable rounds — ~24% of species have blank footprints).
- No duplicate Pokémon in a round; ranked mode and online leaderboard added.

## Structure

```
index.html            layout, menus, game-over / leaderboard panels
js/game.js            game logic + rendering (1920×1080 logical canvas, scaled to fit)
js/leaderboard.js     tiny Supabase REST client
js/config.js          Supabase URL + publishable key
js/pokemon-data.js    names (EN/KO/JA) + footprint shape groups
assets/               images, sounds, fonts from the original repo + Galmuri font
supabase/schema.sql   leaderboard schema
```

## Credits / license

- Original game code & assets: [KierranFalloon/FootprintGame](https://github.com/KierranFalloon/FootprintGame) — MIT, © 2023 Kierran Falloon (`LICENSE.md`)
- Footprint sprites: [KierranFalloon/FootprintAPI](https://github.com/KierranFalloon/FootprintAPI) (Gen I–V: Veekun, Gen VI–VIII: Wolf @ PokeCommunity)
- Pokémon sprites & name data: [PokeAPI](https://pokeapi.co/)
- Korean/Japanese pixel font: [Galmuri](https://github.com/quiple/galmuri) — SIL Open Font License 1.1 (`assets/fonts/Galmuri-OFL.md`)

This project is not affiliated with Nintendo or The Pokémon Company. Pokémon and Pokémon character names are trademarks of Nintendo; Pokémon sprites are © The Pokémon Company.
