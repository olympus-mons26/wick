# Wick

**A portable Markdown editor for Mac and Windows.**

Wick is a small, standalone Markdown studio made with plain HTML, CSS, and JavaScript. It was created to fill a gap: a genuinely cross-platform editor you can carry as a folder and open without installing a runtime, application, or extension.

Wick runs in a modern browser and includes a text editor, live Markdown preview, formatting ribbon, light and dark themes, and note import/export.

> On first launch, select the `notes` folder on your USB drive and grant browser permission. Wick then auto-saves edits to ordinary Markdown files there, and reconnects automatically when the browser remembers permission. Browsers require this one-time selection; a webpage cannot silently access an external drive. If folder access is unsupported, use browser storage with Import/Export and Backup.

## Quick start

1. [Download the latest Wick ZIP](https://github.com/olympus-mons26/wick/archive/refs/heads/main.zip) or download `Wick.zip` from this repository.
2. Extract the folder.
3. On macOS, double-click `Start-Wick-onMac.command`. If macOS reports an access-privileges error, open `app/index.html` directly in a browser. If macOS displays a security warning, Control-click the launcher and choose **Open**. On Windows, double-click `Start-Wick-onWindows.bat`. You can also open `app/index.html` directly in a browser on either platform.
4. On first launch, choose **Choose /notes folder** and select the root-level `notes` folder on the USB drive (or another notes folder). Grant read/write access when prompted.
5. Create and edit notes; Wick auto-saves changes to Markdown files in the selected folder in the background without reloading the page. On future launches, Wick reconnects automatically if the browser remembers its permission; otherwise choose **Reconnect folder**.

No terminal, server, network connection, account, package manager, or Wick-specific software installation is required. Direct folder saving currently requires a secure browser context and a Chromium-based browser implementing the File System Access API. Browsers intentionally require the user to select the folder and grant access at least once; Wick cannot select an external drive or get filesystem permission silently on first load. Other browsers can still use Wick with browser storage and explicit Import/Export. If browser storage is unavailable, export a backup before closing the tab.

For a visual walkthrough, open the [Wick website](docs/index.html#install) and see the guides for setup, notes, customization, and Markdown. [`notes/Markdown-Guide.md`](notes/Markdown-Guide.md) is a Markdown syntax reference, and opens in the editor by default every time.

## Portability: what travels and what doesn't

The Wick **application files** are portable: copy the extracted folder to a USB drive or another computer and open it on macOS or Windows. Wick does not install itself on the host. The first time you open Wick, choose the root-level `notes` folder on the USB drive and grant access so that auto-save writes directly to that drive.

When connected, your **notes are ordinary `.md`, `.markdown`, and `.txt` files** in the selected folder. Auto-save writes each edit to the open note's file after a short typing pause; the page does not reload. Wick asks for folder permission; it cannot silently access disk files. On another computer, open Wick and select the same USB notes folder if asked.

In browsers that do not support direct folder access, notes are stored in that browser's local storage instead. Copying Wick to another device does not copy browser-local notes. To move those notes:

1. On the original browser, open Wick and choose **Backup** to download a `wick-backup.json` containing all notes.
2. Transfer that backup file along with the Wick folder.
3. Open Wick on the destination browser, choose **Import**, and select the backup.

Use **Export** to download just the currently open note as a regular Markdown file. If using the browser-storage fallback, browser storage can be cleared by browser settings or private browsing, so keep backups of important work.

## Using the editor

- **Choose /notes folder:** on first use, select a folder for real Markdown files and grant read/write permission. Wick remembers the folder where supported; it reconnects automatically when permission is still available, or asks you to reconnect.
- **Hide Notes / Show Notes:** collapse or restore the file list beside the editor to make more room.
- **New:** create a named Markdown note. Wick rejects filename characters and reserved device names that would break cross-platform saving. With a folder connected, Wick creates its `.md` file and auto-saves edits in the background. `Ctrl+S` / `⌘S` also saves immediately.
- **Import:** load one or more `.md`, `.markdown`, or `.txt` files, or restore a Wick JSON backup. With a folder connected, imported notes are also written into it. Duplicate names are given a numeric suffix.
- **Export:** download the open note as a Markdown text file.
- **Backup:** download every Wick note and theme/current-note settings in one JSON backup.
- **Rename:** change the current note's name. In folder mode, the file is renamed there too.
- **Delete:** permanently remove the current note, and in folder mode its file, after confirmation. Export or back it up first if you may need it again.
- **Theme:** use the sun/moon button to switch between dark and light; the choice is remembered by the browser.

The editor and preview keep their scroll positions synchronized in either direction. Wide content can scroll horizontally when both panes have overflow. On narrow screens, the editor and preview stack vertically and the notes list becomes a compact, horizontally scrollable strip.

## Customize the app

Wick has no build process. You can edit its files with any text editor:

- `app/css/app.css` controls editor layout, colors, and typography.
- `app/index.html` controls the interface content and formatting toolbar.
- `app/js/app.js` controls note management, browser storage, and editor behavior.
- `app/js/markdown.js` controls the Markdown preview renderer.

Keep a clean copy of the folder before experimenting. App-file changes don't edit notes already stored by your browser.

## Markdown basics

Markdown is plain text with lightweight formatting marks. For example:

```md
# A heading

**Bold**, *italic*, and `code`.

- A list item
- Another item

[A link](https://example.com)
```

Wick renders the preview as you type. The formatting ribbon can insert common Markdown structures for you. [`notes/Markdown-Guide.md`](notes/Markdown-Guide.md) covers Markdown syntax and opens by default whenever Wick starts.

## What is included

- **Editor and preview:** write Markdown on one side and see a live preview on the other.
- **Formatting ribbon:** headings, emphasis, lists, checklists, quotes, links, images, code, separators, and tables.
- **Import and export:** import Markdown notes, download individual notes, or back up and restore a whole library.
- **Portable app:** the app is a folder of browser files, with no app framework or build step.
- **Themes:** switch between dark and light appearance.

## How it works

Wick is implemented with plain HTML, CSS, and JavaScript. It does not use a backend: editing and Markdown rendering happen in the browser. In supported browsers, the File System Access API writes notes to the folder you explicitly choose. Wick also keeps a local browser-storage copy where available. In browsers without the API, the editor uses browser storage and import/export.

Browsers do not permit a page to freely read or write files without permission. Folder autosave therefore needs explicit user authorization and browser support; it is not available in every browser. Choose the portable notes folder once, keep it connected while editing, and reconnect if permission is revoked. Otherwise use Import, Export, and Backup.

## Project website

Open [`docs/index.html`](docs/index.html) locally to view Wick's project website. The site is also static HTML, CSS, and JavaScript and requires no build process. Its contribution section has separate issue and update actions, and the footer presents distinct credits for the primary and backup hosts.

The primary website is [wick.thedev.id](https://wick.thedev.id). The website footer has a separate thank-you for [thedev.id](https://thedev.id), which hosts it, and for [Surge](https://surge.sh), which hosts the [backup at wick.surge.sh](https://wick.surge.sh). Each credit is presented separately with a typographic host wordmark; the site does not load third-party logo images.

To publish this repository's static site with GitHub Pages instead, push the repository to GitHub, then open **Settings → Pages** and set the source to **GitHub Actions**. The included Pages workflow publishes the site and app together so the website's app and ZIP links work.

## Project links

- Source code: [github.com/olympus-mons26/wick](https://github.com/olympus-mons26/wick)
- Website author: [olympus_mons26](https://github.com/olympus-mons26)
- Primary website: [wick.thedev.id](https://wick.thedev.id) ([thedev.id](https://thedev.id))
- Backup website: [wick.surge.sh](https://wick.surge.sh) ([Surge](https://surge.sh))

## License

Wick's original source code and documentation are licensed under the Apache License 2.0.

This license does not cover third-party assets. Specifically, `docs/icons8-markdown-96.png` and `favicon.ico` remain subject to the [Icons8 Free Tier License terms](https://icons8.com) and require active attribution links back to their platform.

## Repository layout

```text
.
├── .gitignore
├── .github/
│   └── workflows/pages.yml    # Publishes the static site and editor to GitHub Pages
├── docs/                  # Project landing page and static assets
│   ├── index.html
│   ├── site.css
│   └── site.js
├── app/
│   ├── index.html         # Wick editor
│   ├── css/app.css        # Editor styles
│   └── js/
│       ├── app.js         # Editor behavior and browser storage
│       └── markdown.js    # Markdown-to-preview renderer
├── notes/                 # Portable notes folder; connect this on your drive
│   └── Markdown-Guide.md
├── Start-Wick-onWindows.bat
├── Start-Wick-onMac.command
└── Wick.zip               # Portable app bundle
```

## Contributing

Suggestions, bug reports, and updates via GitHub pull requests are appreciated. Use [GitHub Issues](https://github.com/olympus-mons26/wick/issues) to discuss a suggestion or bug, and [open a pull request](https://github.com/olympus-mons26/wick/pulls) for a change. Please keep Wick dependency-free and verify that both the editor (`app/index.html`) and website (`docs/index.html`) run directly in a browser.
