# Wallpaper backgrounds

dtp-os can show **your own background images** on the new tab page, or keep the original **embedded site** experience. Images stay on your device only.

## Quick start

1. Open a **new tab** (the dtp-os page).
2. Click the **gear icon** (top right) to open wallpaper settings.
3. Click **Upload images** and choose JPEG, PNG, or WebP files.
4. Switch to **Wallpaper** mode to see full-screen photos.
5. Open more new tabs — each tab picks a **random** image from your library.

To return to the embedded site, choose **Embedded site** in the same panel.

## Display modes

| Mode | What you see |
|------|----------------|
| **Embedded site** (default) | Full-viewport iframe to `https://buildspace.so/home` |
| **Wallpaper** | Full-viewport cover photo from your uploads; no iframe |

Your mode choice is remembered across browser sessions.

## Shuffle behavior

In **Wallpaper** mode, every time you open a **new tab**, the extension selects one image at random from your saved set.

To change the background **on the current tab**, click the **shuffle button** (circular ⟳ icon to the left of the gear). With two or more wallpapers saved, shuffle picks a different image when possible.

## Managing wallpapers

- **Upload**: Use the upload control in the settings panel (multiple files at once supported).
- **Delete**: Click **×** on a thumbnail in the gallery grid.
- **Count**: The panel shows how many images are saved.

## Limits

| Limit | Value |
|-------|--------|
| Max file size | 5 MB per image |
| Max saved images | 50 |
| Allowed formats | JPEG, PNG, WebP |

If an upload fails, check the status message at the bottom of the settings panel.

## Privacy

- Images are stored in **IndexedDB** inside your browser profile for this extension.
- Display mode and image order are stored in **`chrome.storage.local`**.
- Nothing is uploaded to a server as part of this feature.

## Troubleshooting

- **Wallpaper mode is black** — Upload at least one image, or switch back to Embedded site.
- **Changes after reload** — After updating the extension in `chrome://extensions`, click **Reload** on dtp-os, then open a new tab.
- **Embed mode** — Wallpapers are hidden while Embedded site is active; switch to Wallpaper mode to see them.

For technical details, see [architecture.md](./architecture.md).
