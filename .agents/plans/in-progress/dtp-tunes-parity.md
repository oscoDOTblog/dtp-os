# dtp-tunes styling parity

dtp-os UI that mimics [dtp-tunes](../dtp-tunes) (the Bandcamp Streamer player
bar, its download/queue panels, and themed collection player) is audited here
against dtp-tunes' actual implementation:

- `web/src/app/globals.css` — design tokens + slider styles
- `web/src/components/ui/Menu.tsx` — dropdown/context menus
- `web/src/components/ui/IconButton.tsx` — round icon buttons
- `web/src/components/player/BottomPlayer.tsx` — the reference player bar

Audit date: 2026-11-27. The in-page implementation lives in
`js/inject/bandcamp/bandcamp-streamer.css` + `js/inject/bandcamp/modules/bar.js`.

## Token mapping

| dtp-tunes | dtp-os (scoped to `#dtp-player-bar`) | Notes |
|---|---|---|
| `--color-bg-elevated` `#121214` | `--bar-bg` | identical |
| `--color-bg-elevated-2` `#181819` | (unused in bar) | dtp-tunes queue *page* uses it; our floating queue keeps `--bar-bg` |
| `--color-bg-hover` `#1f1f22` | `--bar-hover` / `--bar-track` | identical |
| `--color-border-subtle` `#232326` | `--bar-border` | identical |
| `--color-fg-primary` `#f5f5f7` | `--bar-fg` | identical |
| `--color-fg-secondary` `#a3a3ab` | `--bar-muted` | identical |
| `--color-fg-muted` `#6b6b73` | `--bar-faint` | identical |
| `--color-accent` (+ hover/muted/soft) | `--dtp-accent` only | see gaps below |
| `--color-slider-fill` `#ffffff` | `--dtp-slider-fill` `#ffffff` | added in this audit; light theme flips to `#17161a` |
| light theme via `prefers-color-scheme` | `html[data-dtp-player-theme="light"]` (user toggle) | intentional: dtp-os is a persistent setting |

## Gaps found → resolution

1. **Menus had invented chrome** (uppercase header strip, rounded icon
   "tiles", accent hover on icons) that dtp-tunes menus don't have.
   → Download menu rebuilt flat per `Menu.tsx`: `rounded-lg`, `py-1`, full-width
   `px-3 py-2` rows, `gap-3`, muted inline icons brightening on row hover, hover
   fill only. Menu width 224px (~`min-w-48`).

2. **Icon buttons were always bright** (`--bar-fg`) and active toggles used a
   `color-mix` tinted background.
   → Buttons default to `--bar-muted`, brighten to `--bar-fg` on hover with the
   hover fill (fixed a latent bug: the base rule's `!important` had been
   overriding the hover styles entirely). Active toggles (shuffle / repeat /
   queue-open) are **accent color only**, with an `accent-hover` blend
   (accent mixed 70% toward white) on hover — matching `IconButton`'s
   `active && "text-accent hover:text-accent-hover"`.

3. **Sliders were filled with the accent color.**
   → Seek/volume fills now use `--dtp-slider-fill` (white on dark, `#17161a` on
   light), matching dtp-tunes' Spotify-style `--color-slider-fill`. The themed
   Bandcamp collection player's `.progress` / `.vol-amt` fills switched the
   same way.

4. **Menu font sizing** — rows now 14px (`text-sm`) titles with 11px muted
   subtitles (dtp-tunes items are single-line `text-sm`; subs are our addition
   and stay muted).

## Kept intentionally different

- **Download progress strip + spinning vinyl button** use the accent — no
  dtp-tunes equivalent exists; accent signals "live" work.
- **Play button** is the white pill (`--play-bg`/`--play-fg`), same as
  dtp-tunes' `bg-fg-primary text-bg-base` play button.
- **Accent** is set inline as `--dtp-accent` (from `bandcampStreamerPrefs`),
  not via `html[data-accent]` attributes like dtp-tunes. Only the base tone is
  carried over; `accent-hover`/`accent-soft` equivalents are derived with
  `color-mix` where needed rather than mirrored as separate tokens.
- **Light theme** is a user toggle, not `prefers-color-scheme`, since Bandcamp
  pages outlive the popup.

## Watch items

- `--bar-track` (slider rest color) matches dtp-tunes `--color-bg-hover`;
  if dtp-tunes ever moves sliders to a dedicated track token, follow it.
- If the download menu grows more entries, consider porting dtp-tunes'
  Escape-to-close and disabled `opacity-40` conventions (currently only the
  disabled state is used, on the busy download button).
- The popup tool (`css/popup.css` `.tool-progress-*`) still uses its own
  accent progress styling; it lives in the extension popup, which has its own
  design system — out of scope for this audit.
