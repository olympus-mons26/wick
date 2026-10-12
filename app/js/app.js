(function () {
  "use strict";

  const editor = document.getElementById("editor");
  const preview = document.getElementById("preview");
  const previewScroll = document.querySelector(".preview-scroll");
  const fileList = document.getElementById("file-list");
  const filenameEl = document.getElementById("filename");
  const statusEl = document.getElementById("status");
  const countsEl = document.getElementById("counts");
  const drivePathEl = document.getElementById("drive-path");
  const themeBtn = document.getElementById("theme-btn");
  const importInput = document.getElementById("import-input");
  const connectFolderBtn = document.getElementById("connect-folder-btn");
  const browserAlert = document.getElementById("browser-alert");
  const notesToggle = document.getElementById("notes-toggle");
  const shell = document.querySelector(".shell");
  const html = document.documentElement;

  const NOTES_KEY = "wick.notes.v1";
  const CONFIG_KEY = "wick.config.v1";
  const GUIDE_NAME = "Markdown-Guide.md";
  const GUIDE_VERSION = 2;
  const GUIDE_CONTENT = document.getElementById("default-markdown-guide").textContent.trim();
  const state = {
    files: [],
    current: null,
    theme: "dark",
    showNotes: true,
    dirty: false,
    storageAvailable: true,
    folderHandle: null,
    folderConnected: false,
    folderDatabase: null,
    folderWriteQueue: Promise.resolve(),
    saveTimer: null,
    previewTimer: null,
  };

  function setStatus(msg) {
    statusEl.textContent = msg;
  }

  function supportsFolderAccess() {
    return window.isSecureContext && typeof window.showDirectoryPicker === "function";
  }

  function queueFolderWrite(file) {
    const handle = state.folderHandle;
    if (!handle) return Promise.resolve();
    const write = state.folderWriteQueue.then(() => writeFolderFile(handle, file));
    state.folderWriteQueue = write.catch(() => {});
    return write;
  }

  function wordCount(text) {
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    countsEl.textContent = words + " words · " + chars + " characters";
  }

  function render() {
    preview.innerHTML = window.renderMarkdown(editor.value);
    wordCount(editor.value);
  }

  function schedulePreview() {
    cancelAnimationFrame(state.previewTimer);
    state.previewTimer = requestAnimationFrame(render);
  }

  function syncScrollAxis(source, target, axis) {
    const vertical = axis === "vertical";
    const sourceRange = vertical
      ? source.scrollHeight - source.clientHeight
      : source.scrollWidth - source.clientWidth;
    const targetRange = vertical
      ? target.scrollHeight - target.clientHeight
      : target.scrollWidth - target.clientWidth;
    if (sourceRange <= 0 || targetRange <= 0) return;

    const sourcePosition = vertical ? source.scrollTop : source.scrollLeft;
    const targetPosition = sourcePosition / sourceRange * targetRange;
    const currentTargetPosition = vertical ? target.scrollTop : target.scrollLeft;
    if (Math.abs(currentTargetPosition - targetPosition) <= 1) return;
    if (vertical) target.scrollTop = targetPosition;
    else target.scrollLeft = targetPosition;
  }

  function syncEditorScroll() {
    syncScrollAxis(editor, previewScroll, "vertical");
    const wideCodeBlocks = Array.from(previewScroll.querySelectorAll("pre"))
      .filter((block) => block.scrollWidth > block.clientWidth);
    const horizontalTargets = wideCodeBlocks.length ? wideCodeBlocks : [previewScroll];
    horizontalTargets.forEach((target) => syncScrollAxis(editor, target, "horizontal"));
  }

  function syncPreviewScroll(event) {
    syncScrollAxis(previewScroll, editor, "vertical");
    const codeBlock = event.target instanceof Element ? event.target.closest("pre") : null;
    syncScrollAxis(codeBlock || previewScroll, editor, "horizontal");
  }

  function readStored(key, fallback) {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  }

  function checkStorage() {
    try {
      localStorage.setItem("wick.storage-check", "ok");
      localStorage.removeItem("wick.storage-check");
    } catch {
      state.storageAvailable = false;
    }
  }

  function persistNotes() {
    if (!state.storageAvailable) return;
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(state.files));
    } catch (error) {
      state.storageAvailable = false;
      setStatus("Browser storage is unavailable or full. Notes will remain only until this tab closes; export a backup now. " + error.message);
    }
  }

  function persistConfig() {
    if (!state.storageAvailable) return;
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify({
        theme: state.theme,
        lastFile: state.current,
        showNotes: state.showNotes,
        guideVersion: GUIDE_VERSION,
      }));
    } catch (error) {
      state.storageAvailable = false;
      setStatus("Browser storage is unavailable or full. Export a backup now. " + error.message);
    }
  }

  function openHandleDatabase() {
    if (!("indexedDB" in window)) return Promise.reject(new Error("This browser cannot remember folder access."));
    if (state.folderDatabase) return Promise.resolve(state.folderDatabase);
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("wick-portable-storage", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("settings");
      request.onsuccess = () => {
        state.folderDatabase = request.result;
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error("Could not open browser storage for the folder permission."));
    });
  }

  async function storeFolderHandle(handle) {
    const db = await openHandleDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("settings", "readwrite");
      transaction.objectStore("settings").put(handle, "notes-folder");
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error("Could not remember the selected folder."));
      transaction.onabort = () => reject(transaction.error || new Error("Could not remember the selected folder."));
    });
  }

  async function getStoredFolderHandle() {
    const db = await openHandleDatabase();
    return new Promise((resolve, reject) => {
      const request = db.transaction("settings", "readonly").objectStore("settings").get("notes-folder");
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error("Could not restore the selected folder."));
    });
  }

  function updateFolderLabel(handle) {
    drivePathEl.textContent = "Saving to " + handle.name;
    drivePathEl.title = "Markdown notes are saved directly in the selected folder.";
    connectFolderBtn.textContent = "Change folder";
  }

  async function readFolderNotes(handle) {
    const notes = [];
    for await (const entry of handle.values()) {
      if (entry.kind !== "file" || !/\.(md|markdown|txt)$/i.test(entry.name)) continue;
      const file = await entry.getFile();
      notes.push({
        name: entry.name,
        content: await file.text(),
        bytes: file.size,
        mtime: file.lastModified,
      });
    }
    return notes;
  }

  async function writeFolderFile(handle, file) {
    let target;
    let fileExists = false;
    try {
      target = await handle.getFileHandle(file.name);
      fileExists = true;
    } catch (error) {
      if (error.name !== "NotFoundError") throw error;
      target = await handle.getFileHandle(file.name, { create: true });
    }

    if (fileExists) {
      const existing = await target.getFile();
      if (typeof file.mtime !== "number" || existing.lastModified !== file.mtime) {
        throw new FolderConflictError(file.name);
      }
    }

    const writer = await target.createWritable();
    try {
      await writer.write(file.content);
      await writer.close();
    } catch (error) {
      try {
        await writer.abort();
      } catch {
        // Preserve the original write or close error.
      }
      throw error;
    }
    file.mtime = (await target.getFile()).lastModified;
  }

  class FolderConflictError extends Error {
    constructor(name) {
      super(
        'The file "' + name + '" changed outside Wick. Your edits were not written to it. ' +
        "Reconnect the folder to preserve both versions, or export a backup before closing."
      );
      this.name = "FolderConflictError";
    }
  }

  async function loadFolder(handle, preserveConflicts = true) {
    const diskNotes = await readFolderNotes(handle);
    const olderGuide = diskNotes.find((file) =>
      file.name === GUIDE_NAME && (
        file.content.includes("## First launch and portable auto-save") ||
        file.content.includes("## The Wick editor") ||
        file.content.includes("## Taking notes to another computer") ||
        file.content.includes("Surround multiple lines with three backticks.")
      )
    );
    if (olderGuide) {
      olderGuide.content = GUIDE_CONTENT;
      olderGuide.bytes = new Blob([GUIDE_CONTENT]).size;
      await writeFolderFile(handle, olderGuide);
    }
    const diskNames = new Set(diskNotes.map((file) => file.name.toLowerCase()));
    const merged = diskNotes.slice();
    let activeName = state.current;
    for (const localFile of state.files) {
      let name = localFile.name;
      if (diskNames.has(name.toLowerCase())) {
        const diskFile = diskNotes.find((file) => file.name.toLowerCase() === name.toLowerCase());
        if (name === GUIDE_NAME || !preserveConflicts || (diskFile && diskFile.content === localFile.content)) continue;
        name = uniqueName(name, new Set([...diskNames, ...merged.map((file) => file.name.toLowerCase())]));
      }
      if (localFile.name === state.current) activeName = name;
      const copy = { ...localFile, name };
      merged.push(copy);
      diskNames.add(name.toLowerCase());
      await writeFolderFile(handle, copy);
    }
    state.folderHandle = handle;
    state.folderConnected = true;
    state.files = merged;
    state.current = merged.some((file) => file.name === activeName)
      ? activeName
      : merged.some((file) => file.name === GUIDE_NAME) ? GUIDE_NAME : activeName;
    persistNotes();
    refreshFiles();
    if (state.current && state.files.some((file) => file.name === state.current)) {
      const active = state.files.find((file) => file.name === state.current);
      editor.value = active.content;
      filenameEl.textContent = active.name;
      render();
    } else if (state.files.length) {
      state.current = state.files[0].name;
      editor.value = state.files[0].content;
      filenameEl.textContent = state.current;
      render();
    }
    state.dirty = false;
    saveConfig();
    updateFolderLabel(handle);
    setStatus("Connected to " + handle.name + ". Notes auto-save as Markdown files in that folder.");
  }

  async function connectFolder() {
      if (!supportsFolderAccess()) {
        throw new Error("Direct folder saving is not available in this browser. Use a current Chromium-based browser, or continue with Import and Export.");
      }
      let handle = state.folderConnected ? null : state.folderHandle;
      let previousSaveError = null;
      if (state.dirty) {
        try {
          await saveNow();
        } catch (error) {
          previousSaveError = error;
        }
      }
      if (handle) {
        const permission = await handle.requestPermission({ mode: "readwrite" });
        if (permission !== "granted") handle = null;
      }
      if (!handle) {
        handle = await window.showDirectoryPicker({ mode: "readwrite" });
      }
      await loadFolder(handle, true);
      let connectionStatus = "Connected to " + handle.name + ". Notes auto-save as Markdown files in that folder.";
      try {
        await storeFolderHandle(handle);
      } catch (error) {
        connectionStatus = "Connected to " + handle.name + " for this session, but the browser could not remember it. Reconnect next time. " + error.message;
      }
      if (previousSaveError) connectionStatus += " Previous save issue: " + previousSaveError.message;
      setStatus(connectionStatus);
    }

  async function restoreFolderConnection() {
    if (!supportsFolderAccess()) {
      connectFolderBtn.disabled = true;
      connectFolderBtn.title = "Direct folder saving is not supported in this browser. Use Import and Export.";
      browserAlert.hidden = false;
      setStatus("This browser cannot write directly to a folder. Use Import and Export to manage Markdown files.");
      return;
    }
    if (!("indexedDB" in window)) return;
    try {
      const handle = await getStoredFolderHandle();
      if (!handle) return;
      if (await handle.queryPermission({ mode: "readwrite" }) === "granted") {
        await loadFolder(handle, false);
      } else {
        state.folderHandle = handle;
        connectFolderBtn.textContent = "Reconnect folder";
        connectFolderBtn.title = "Click to grant Wick access to the previously selected notes folder.";
        setStatus("Click Reconnect folder to resume saving Markdown files to " + handle.name + ".");
      }
    } catch (error) {
      setStatus("Could not reconnect the notes folder. Choose it again to continue file saving. " + error.message);
    }
  }

  function safeName(name) {
    const base = String(name || "").replace(/\\/g, "/").split("/").pop().trim();
    const deviceName = base.split(".")[0].replace(/[ .]+$/g, "");
    if (
      !base ||
      base === "." ||
      base === ".." ||
      /[<>:"|?*]/.test(base) ||
      /[\u0000-\u001f]/.test(base) ||
      /[. ]$/.test(base) ||
      /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(deviceName)
    ) {
      throw new Error("Invalid note name. Choose a Windows-safe filename without a reserved device name.");
    }
    if (/\.[^.]+$/.test(base) && !/\.(md|markdown|txt)$/i.test(base)) {
      throw new Error("Notes must use the .md, .markdown, or .txt extension.");
    }
    return /\.(md|markdown|txt)$/i.test(base) ? base : base + ".md";
  }

  function uniqueName(base, names = new Set(state.files.map((f) => f.name.toLowerCase()))) {
    if (!names.has(base.toLowerCase())) return base;
    const stem = base.replace(/\.(md|markdown|txt)$/i, "");
    const extension = base.match(/\.(md|markdown|txt)$/i)[0];
    let n = 2;
    while (names.has((stem + "-" + n + extension).toLowerCase())) n += 1;
    return stem + "-" + n + extension;
  }

  function paintFiles() {
    fileList.innerHTML = "";
    state.files.forEach((file, index) => {
      const li = document.createElement("li");
      li.style.animationDelay = index * 0.03 + "s";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = file.name.replace(/\.(md|markdown|txt)$/i, "");
      btn.title = file.name;
      if (file.name === state.current) btn.classList.add("active");
      btn.addEventListener("click", () => runAsync(() => openFile(file.name)));
      li.appendChild(btn);
      fileList.appendChild(li);
    });
  }

  function refreshFiles() {
    state.files.sort((a, b) => a.name.localeCompare(b.name));
    paintFiles();
  }

  function saveConfig() {
    persistConfig();
  }

  function applyNotesVisibility() {
    shell.classList.toggle("notes-hidden", !state.showNotes);
    notesToggle.textContent = state.showNotes ? "Hide Notes" : "Show Notes";
    notesToggle.setAttribute("aria-expanded", String(state.showNotes));
  }

  async function saveNow() {
    clearTimeout(state.saveTimer);
    if (!state.current) return;
    const file = state.files.find((item) => item.name === state.current);
    if (!file) throw new Error("The current note no longer exists.");
    file.content = editor.value;
    file.bytes = new Blob([editor.value]).size;
    if (!state.folderHandle) file.mtime = Date.now();
    persistNotes();
    state.dirty = false;
    if (state.folderHandle) {
      try {
        await queueFolderWrite(file);
        persistNotes();
        setStatus("Saved to " + state.folderHandle.name + "/" + file.name);
        return;
      } catch (error) {
        state.dirty = true;
        setStatus("Could not save to the connected folder. Changes remain in browser storage; reconnect the folder and try again. " + error.message);
        throw error;
      }
    }
    setStatus(state.storageAvailable
      ? "Saved in this browser only. Choose your external drive's /notes folder for portable file auto-save."
      : "Saved for this session only. Export a backup before closing.");
  }

  function scheduleSave() {
    state.dirty = true;
    setStatus("Saving…");
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      runAsync(saveNow);
    }, 380);
  }

  async function openFile(name) {
    if (state.current === name && !state.dirty) return;
    if (state.dirty && state.current) {
      try {
        await saveNow();
      } catch (err) {
        setStatus(err.message);
        return;
      }
    }
    const file = state.files.find((item) => item.name === name);
    if (!file) throw new Error("Note not found: " + name);
    state.current = name;
    editor.value = file.content;
    filenameEl.textContent = name;
    paintFiles();
    render();
    preview.classList.remove("is-refreshing");
    void preview.offsetWidth;
    preview.classList.add("is-refreshing");
    saveConfig();
    setStatus(state.storageAvailable
      ? "Opened " + name
      : "Opened " + name + " — session only; export a backup before closing.");
  }

  async function newFile() {
    const suggested = uniqueName("Untitled.md");
    const name = window.prompt("New note name", suggested);
    if (!name) return;
    const safe = safeName(name);
    if (state.files.some((file) => file.name.toLowerCase() === safe.toLowerCase())) {
      throw new Error("A note with that name already exists.");
    }
    state.files.push({ name: safe, content: "# " + safe.replace(/\.(md|markdown|txt)$/i, "") + "\n\n", mtime: Date.now() });
    persistNotes();
    refreshFiles();
    if (state.folderHandle) {
      await queueFolderWrite(state.files.find((file) => file.name === safe));
    }
    await openFile(safe);
  }

  async function renameFile() {
    if (!state.current) return;
    const next = window.prompt("Rename note", state.current);
    if (!next || next === state.current) return;
    await saveNow();
    const safe = safeName(next);
    if (state.files.some((file) => file.name !== state.current && file.name.toLowerCase() === safe.toLowerCase())) {
      throw new Error("A note with that name already exists.");
    }
    const file = state.files.find((item) => item.name === state.current);
    if (!file) throw new Error("The current note no longer exists.");
    const oldName = file.name;
    const renamedFile = { ...file, name: safe, mtime: undefined };
    let removeError = null;
    if (state.folderHandle) {
      await writeFolderFile(state.folderHandle, renamedFile);
      try {
        await state.folderHandle.removeEntry(oldName);
      } catch (error) {
        removeError = error;
      }
    }
    file.name = safe;
    file.mtime = state.folderHandle ? renamedFile.mtime : Date.now();
    state.current = safe;
    filenameEl.textContent = safe;
    persistNotes();
    refreshFiles();
    saveConfig();
    setStatus(removeError
      ? "Renamed to " + safe + ", but could not remove the original " + oldName + ": " + removeError.message
      : "Renamed to " + safe);
  }

  async function deleteFile() {
    if (!state.current) return;
    const location = state.folderHandle ? "from the connected folder and Wick library" : "from this browser";
    if (!window.confirm("Delete " + state.current + " " + location + "?")) return;
    await saveNow();
    const gone = state.current;
    if (state.folderHandle) await state.folderHandle.removeEntry(gone);
    state.files = state.files.filter((file) => file.name !== gone);
    state.current = null;
    state.dirty = false;
    persistNotes();
    refreshFiles();
    const fallback = state.files[0];
    if (fallback) {
      await openFile(fallback.name);
    } else {
      editor.value = "";
      filenameEl.textContent = "untitled.md";
      const draft = { name: uniqueName("Untitled.md"), content: "", mtime: Date.now() };
      state.files.push(draft);
      state.current = draft.name;
      persistNotes();
      refreshFiles();
      saveConfig();
      render();
    }
    saveConfig();
    setStatus("Deleted " + gone);
  }

  function download(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function exportCurrent() {
    if (!state.current) throw new Error("There is no note to export.");
    await saveNow();
    download(state.current, editor.value, "text/markdown;charset=utf-8");
    setStatus("Downloaded " + state.current);
  }

  async function exportBackup() {
    await saveNow();
    const backup = {
      format: "wick-backup",
      version: 1,
      theme: state.theme,
      lastFile: state.current,
      files: state.files.map(({ name, content }) => ({ name, content })),
    };
    download("wick-backup.json", JSON.stringify(backup, null, 2), "application/json;charset=utf-8");
    setStatus("Downloaded backup with " + state.files.length + " note(s)");
  }

  function readFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read " + file.name));
      reader.readAsText(file);
    });
  }

  async function importFiles(files) {
    let imported = 0;
    let duplicates = 0;
    const additions = [];
    const names = new Set(state.files.map((item) => item.name.toLowerCase()));
    for (const file of files) {
      const content = await readFile(file);
      if (file.name.toLowerCase().endsWith(".json")) {
        let backup;
        try {
          backup = JSON.parse(content);
        } catch {
          throw new Error("Invalid JSON backup: " + file.name);
        }
        if (!backup || typeof backup !== "object" ||
            backup.format !== "wick-backup" || backup.version !== 1 || !Array.isArray(backup.files)) {
          throw new Error("Unsupported Wick backup: " + file.name);
        }
        for (const entry of backup.files) {
          if (!entry || typeof entry.name !== "string" || typeof entry.content !== "string") {
            throw new Error("Invalid note in backup: " + file.name);
          }
          const name = safeName(entry.name);
          let target = name;
          if (names.has(target.toLowerCase())) {
            target = uniqueName(target, names);
            duplicates += 1;
          }
          names.add(target.toLowerCase());
          additions.push({ name: target, content: entry.content, bytes: new Blob([entry.content]).size, mtime: Date.now() });
          imported += 1;
        }
      } else {
        let name = safeName(file.name);
        if (names.has(name.toLowerCase())) {
          name = uniqueName(name, names);
          duplicates += 1;
        }
        names.add(name.toLowerCase());
        additions.push({ name, content, bytes: new Blob([content]).size, mtime: Date.now() });
        imported += 1;
      }
    }
    if (imported) {
      state.files.push(...additions);
      if (state.folderHandle) {
        for (const file of additions) await queueFolderWrite(file);
      }
      persistNotes();
      refreshFiles();
      if (!state.current) await openFile(state.files[0].name);
    }
    setStatus("Imported " + imported + " note(s)" + (duplicates ? "; renamed " + duplicates + " duplicate(s)" : ""));
  }

  function run(action) {
    try {
      action();
    } catch (err) {
      setStatus(err.message);
    }
  }

  function runAsync(action) {
    action().catch((err) => setStatus(err.message));
  }

  function applyTheme(theme) {
    state.theme = theme === "light" ? "light" : "dark";
    html.dataset.theme = state.theme;
    themeBtn.title = state.theme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  }

  function wrapSelection(before, after, placeholder) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const selected = value.slice(start, end) || placeholder || "";
    editor.setRangeText(before + selected + after, start, end, "end");
    if (!value.slice(start, end) && placeholder) {
      editor.setSelectionRange(start + before.length, start + before.length + placeholder.length);
    }
    editor.focus();
    schedulePreview();
    scheduleSave();
  }

  function prefixLines(prefix) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const value = editor.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const chunk = value.slice(lineStart, end);
    const next = chunk
      .split("\n")
      .map((line) => (line.startsWith(prefix) ? line : prefix + line))
      .join("\n");
    editor.setRangeText(next, lineStart, end, "select");
    editor.focus();
    schedulePreview();
    scheduleSave();
  }

  function heading(level) {
    const start = editor.selectionStart;
    const value = editor.value;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const lineEnd = value.indexOf("\n", start);
    const end = lineEnd === -1 ? value.length : lineEnd;
    const line = value.slice(lineStart, end).replace(/^#{1,6}\s+/, "");
    editor.setRangeText("#".repeat(level) + " " + line, lineStart, end, "end");
    editor.focus();
    schedulePreview();
    scheduleSave();
  }

  const commands = {
    bold: () => wrapSelection("**", "**", "bold"),
    italic: () => wrapSelection("*", "*", "italic"),
    underline: () => wrapSelection("<u>", "</u>", "underline"),
    strike: () => wrapSelection("~~", "~~", "struck"),
    code: () => wrapSelection("`", "`", "code"),
    codeblock: () => wrapSelection("\n```\n", "\n```\n", "code here"),
    h1: () => heading(1),
    h2: () => heading(2),
    h3: () => heading(3),
    ul: () => prefixLines("- "),
    ol: () => prefixLines("1. "),
    task: () => prefixLines("- [ ] "),
    quote: () => prefixLines("> "),
    hr: () => wrapSelection("\n\n---\n\n", "", ""),
    link: () => wrapSelection("[", "](https://)", "label"),
    image: () => wrapSelection("![", "](https://)", "alt"),
    table: () =>
      wrapSelection(
        "\n| Column | Column |\n| ------ | ------ |\n| ",
        " |  |\n",
        "cell"
      ),
  };

  document.querySelectorAll(".fmt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cmd = commands[btn.dataset.cmd];
      if (cmd) cmd();
    });
  });

  editor.addEventListener("input", () => {
    schedulePreview();
    scheduleSave();
  });

  editor.addEventListener("scroll", syncEditorScroll, { passive: true });
  previewScroll.addEventListener("scroll", syncPreviewScroll, { passive: true, capture: true });

  editor.addEventListener("keydown", (event) => {
    const meta = event.metaKey || event.ctrlKey;
    if (event.key === "Tab") {
      event.preventDefault();
      wrapSelection("  ", "", "");
      return;
    }
    if (meta && event.key.toLowerCase() === "s") {
      event.preventDefault();
      runAsync(saveNow);
      return;
    }
    if (meta && event.key.toLowerCase() === "b") {
      event.preventDefault();
      commands.bold();
      return;
    }
    if (meta && event.key.toLowerCase() === "i") {
      event.preventDefault();
      commands.italic();
      return;
    }
    if (meta && event.key.toLowerCase() === "u") {
      event.preventDefault();
      commands.underline();
      return;
    }
    if (meta && event.key.toLowerCase() === "k") {
      event.preventDefault();
      commands.link();
    }
  });

  themeBtn.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
    run(saveConfig);
  });

  notesToggle.addEventListener("click", () => {
    state.showNotes = !state.showNotes;
    applyNotesVisibility();
    run(saveConfig);
  });

  document.getElementById("new-btn").addEventListener("click", () => {
    runAsync(newFile);
  });
  document.getElementById("rename-btn").addEventListener("click", () => {
    runAsync(renameFile);
  });
  document.getElementById("delete-btn").addEventListener("click", () => {
    runAsync(deleteFile);
  });
  connectFolderBtn.addEventListener("click", () => {
    connectFolder().catch((err) => {
      if (err.name !== "AbortError") setStatus(err.message);
    });
  });
  document.getElementById("dismiss-browser-alert").addEventListener("click", () => {
    browserAlert.hidden = true;
  });
  document.getElementById("import-btn").addEventListener("click", () => importInput.click());
  document.getElementById("export-btn").addEventListener("click", () => runAsync(exportCurrent));
  document.getElementById("backup-btn").addEventListener("click", () => runAsync(exportBackup));
  importInput.addEventListener("change", () => {
    importFiles(Array.from(importInput.files || []))
      .catch((err) => setStatus(err.message))
      .finally(() => {
        importInput.value = "";
      });
  });

  setTimeout(() => {
    const splash = document.getElementById("splash");
    if (splash) splash.remove();
  }, 1600);

  function boot() {
    try {
      checkStorage();
      const cfg = state.storageAvailable
        ? readStored(CONFIG_KEY, { theme: "dark", lastFile: null, showNotes: true })
        : { theme: "dark", lastFile: null, showNotes: true };
      const refreshGuide = cfg.guideVersion !== GUIDE_VERSION;
      applyTheme(cfg.theme || "dark");
      state.showNotes = cfg.showNotes !== false;
      applyNotesVisibility();
      drivePathEl.textContent = "Choose your /notes folder once for portable auto-save";
      drivePathEl.title = "Select the notes folder on your external drive and grant permission once. Wick auto-saves there as you edit.";
      state.files = state.storageAvailable ? readStored(NOTES_KEY, []) : [];
      if (!Array.isArray(state.files) || state.files.some((file) =>
        !file || typeof file.name !== "string" || typeof file.content !== "string"
      )) {
        throw new Error("Saved notes are invalid. Import a Markdown file or Wick backup to restore.");
      }
      const guide = state.files.find((file) => file.name === GUIDE_NAME);
      if (guide) {
        if (refreshGuide || guide.content.includes("## First launch and portable auto-save")) {
          guide.content = GUIDE_CONTENT;
          guide.bytes = new Blob([GUIDE_CONTENT]).size;
          guide.mtime = Date.now();
        }
      } else {
        state.files.push({
          name: GUIDE_NAME,
          content: GUIDE_CONTENT,
          bytes: new Blob([GUIDE_CONTENT]).size,
          mtime: Date.now(),
        });
      }
      persistNotes();
      refreshFiles();
      if (state.files.some((file) => file.name === GUIDE_NAME)) {
        state.current = null;
        runAsync(() => openFile(GUIDE_NAME));
      } else {
        editor.value = "# Welcome to Wick\n\nCreate a note to begin.\n";
        render();
      }
      setStatus(state.storageAvailable
        ? "Choose your external drive's /notes folder once and allow access. Wick auto-saves edits there; the browser may remember the permission."
        : "Browser storage is unavailable. Notes last only until this tab closes; export a backup before closing.");
      restoreFolderConnection();
    } catch (err) {
      applyTheme("dark");
      state.storageAvailable = false;
      const content = "# Wick could not load saved notes\n\n" + err.message +
        "\n\nUse Import to restore a Markdown file or Wick backup.\n";
      state.files = [{ name: "Recovery.md", content, mtime: Date.now() }];
      state.current = "Recovery.md";
      persistNotes();
      refreshFiles();
      filenameEl.textContent = state.current;
      editor.value = content;
      saveConfig();
      render();
      setStatus(err.message + " This recovery note is available for this session; export a backup before closing.");
    }
  }

  boot();
})();
