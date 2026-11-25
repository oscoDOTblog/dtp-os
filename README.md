# dtp-os

Manifest V3 Chromium extension: custom new-tab home plus a toolbar popup of browser tools. Forked from [buildspace-os](https://github.com/buildspace/buildspace-os), with Opera/shared-start-page fixes and a growing tool set.

No build step — load the folder unpacked. Cursor skills for UI guidance live under `.cursor/skills/` (`coss`, `coss-particles`, `frontend-design`); styling stays vanilla CSS via `css/tokens.css`.

## Features

### New tab

- **Embedded site** — Full-viewport iframe home (default: buildspace.so/home)
- **Wallpaper mode** — Local JPEG/PNG/WebP backgrounds (IndexedDB, max 50 × 5 MB)
- **Shuffle** — Random wallpaper per new tab; shuffle button re-rolls on the current tab
- **Branding** — Custom app name and rotating greetings (JSON array, or 105 built-ins)
- **Settings modal** — Gear panel for display mode, wallpapers, branding, Form Inject profiles, emoji autocomplete, and Copy Section
- **Emoji Autocomplete** — On by default: type `:smile` in page `input`/`textarea` fields for emoji suggestions (toggle in Settings)
- **Copy Section** — On by default: a floating copy button on every page, plus right-click **dtp-os → Copy this section / Copy main content / Copy whole page** (toggles and button corner in Settings)

### Toolbar tools

Click the extension icon for the tool launcher (favorites pin tools to the top):

| Tool | What it does |
|------|----------------|
| **Copy Section** | Copy a page region as Markdown or plain text; also via right-click or the in-page button |
| **Emojis** | Searchable emoji grid; click to copy |
| **YouTube Playlist** | Channel URL/`UC…` ID → uploads playlist (`UU…`); copy or open |
| **Video Downloader** | Paste a social URL; download via sway-sls Lambda + signed S3 |
| **Cloudflare Docker** | `docker run …` → insert `-d --restart unless-stopped` |
| **Currency Converter** | Live ECB rates via Frankfurter |
| **Points Conversion** | Loyalty points → USD estimate (cents-per-mile valuations) |
| **Form Inject** | Scan/fill form fields on the active tab with mock profiles & presets |
| **Twitch Ad Block** | Optional in-stream/overlay blocking on `*.twitch.tv` (vendored [vaft](https://github.com/ryanbr/TwitchAdSolutions)); check for updates |
| **VideoDL Cookies** | Push YouTube cookies from this Chrome profile to local VideoDL (`127.0.0.1:8545`); optional 6-hour auto-sync |

**Colors** is listed as coming soon.

### Other

- Opera / Chromium shared start page (`chrome://startpageshared/…`) redirected to the new-tab page
- Settings also available from the popup
- Wallpapers and settings stay on-device (`IndexedDB` / `chrome.storage.local`)

## Setup

Takes about two minutes. No coding required.

### 1. Download

Clone or download this repo and unzip if needed. The folder must contain `manifest.json`.

### 2. Turn on Developer mode

In your browser, open **Extensions** (e.g. `chrome://extensions`), then enable **Developer mode**.

### 3. Load the extension

Choose **Load unpacked** and select the `dtp-os` folder.

### 4. Open a new tab

When Chrome warns that the page was changed by the extension, **keep** the change or the new-tab override will not apply.

Click the toolbar icon to open the tool list.

## Docs

- [Architecture](docs/architecture.md) — internals, permissions, layout
- [Wallpapers](docs/wallpapers.md) — upload, shuffle, limits
- [Wishlist](docs/wishlist.md) — planned work

## Browser support

Works on Chrome, Edge, and other Chromium browsers (including Opera via the shared-start redirect). Not validated for Firefox.
