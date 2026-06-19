(function () {
  const storageKey = "split-note-app-notes";
  const inactivityMs = window.__NOTE_APP_INACTIVITY_MS__ || 10 * 60 * 1000;
  const initialNotes = [
    {
      id: crypto.randomUUID(),
      title: "Welcome note",
      body: "Create a note on the left, then write on the right. Your notes are saved in this browser.",
      locked: false,
      password: "",
      pinned: false,
      updatedAt: Date.now()
    }
  ];

  const elements = {
    newButton: document.getElementById("newNoteButton"),
    deleteButton: document.getElementById("deleteNoteButton"),
    lockedDeleteButton: document.getElementById("lockedDeleteNoteButton"),
    lockButton: document.getElementById("lockNoteButton"),
    unlockButton: document.getElementById("unlockNoteButton"),
    removeLockButton: document.getElementById("removeLockButton"),
    pinButton: document.getElementById("pinNoteButton"),
    lockedPinButton: document.getElementById("lockedPinNoteButton"),
    optionsButton: document.getElementById("optionsButton"),
    lockedOptionsButton: document.getElementById("lockedOptionsButton"),
    optionsMenu: document.getElementById("optionsMenu"),
    lockedOptionsMenu: document.getElementById("lockedOptionsMenu"),
    passwordDialog: document.getElementById("passwordDialog"),
    passwordForm: document.getElementById("passwordForm"),
    passwordDialogTitle: document.getElementById("passwordDialogTitle"),
    passwordDialogText: document.getElementById("passwordDialogText"),
    passwordInput: document.getElementById("passwordInput"),
    passwordError: document.getElementById("passwordError"),
    confirmPasswordButton: document.getElementById("confirmPasswordButton"),
    cancelPasswordButton: document.getElementById("cancelPasswordButton"),
    list: document.getElementById("noteList"),
    count: document.getElementById("noteCount"),
    search: document.getElementById("searchInput"),
    title: document.getElementById("noteTitle"),
    body: document.getElementById("noteBody"),
    saveStatus: document.getElementById("saveStatus"),
    unlockedEditor: document.getElementById("unlockedEditor"),
    lockedPanel: document.getElementById("lockedPanel"),
    editorPanel: document.getElementById("editorPanel")
  };

  let notes = sortNotes(loadNotes());
  let activeId = notes[0]?.id || null;
  let saveTimer = 0;
  let inactivityTimer = 0;

  function loadNotes() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      return Array.isArray(saved) ? saved.map(normalizeNote) : initialNotes;
    } catch {
      return initialNotes;
    }
  }

  function normalizeNote(note) {
    return {
      id: note.id || crypto.randomUUID(),
      title: note.title || "Untitled note",
      body: note.body || "",
      password: note.password || "",
      locked: Boolean(note.locked || note.password),
      pinned: Boolean(note.pinned),
      updatedAt: note.updatedAt || Date.now()
    };
  }

  function persist() {
    localStorage.setItem(storageKey, JSON.stringify(notes));
    elements.saveStatus.textContent = "Saved";
  }

  function schedulePersist() {
    elements.saveStatus.textContent = "Saving...";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persist, 150);
  }

  function getActiveNote() {
    return notes.find((note) => note.id === activeId) || null;
  }

  function createNote() {
    const note = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      body: "",
      locked: false,
      password: "",
      pinned: false,
      updatedAt: Date.now()
    };

    notes = sortNotes([note, ...notes]);
    activeId = note.id;
    persist();
    render();
    elements.title.focus();
    elements.title.select();
  }

  function deleteActiveNote() {
    if (!activeId) return;

    const activeIndex = notes.findIndex((note) => note.id === activeId);
    notes = notes.filter((note) => note.id !== activeId);
    activeId = notes[Math.max(0, activeIndex - 1)]?.id || notes[0]?.id || null;
    closeOptionsMenus();
    persist();
    render();
  }

  function updateActiveNote(field, value) {
    const note = getActiveNote();
    if (!note || note.locked) return;

    note[field] = value;
    note.updatedAt = Date.now();
    notes = sortNotes([note, ...notes.filter((item) => item.id !== note.id)]);
    activeId = note.id;
    schedulePersist();
    renderList();
  }

  function sortNotes(noteList) {
    return [...noteList].sort((first, second) => {
      if (first.pinned !== second.pinned) return first.pinned ? -1 : 1;
      return second.updatedAt - first.updatedAt;
    });
  }

  function noteMatchesSearch(note, query) {
    const text = `${note.title} ${note.locked ? "" : note.body}`.toLowerCase();
    return text.includes(query.toLowerCase());
  }

  function formatPreview(note) {
    if (note.locked) return "Locked";
    return note.body.trim() || "No content yet";
  }

  function formatEditedDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: sameYear ? undefined : "numeric"
    });
  }

  function setActiveNoteLock(locked, password, shouldTouch = true) {
    const note = getActiveNote();
    if (!note) return;

    note.locked = locked;
    if (password !== undefined) {
      note.password = password;
    }
    if (shouldTouch) {
      note.updatedAt = Date.now();
    }
    notes = sortNotes(notes);
    closeOptionsMenus();
    persist();
    render();
  }

  function lockIdleProtectedNotes() {
    let changed = false;

    notes.forEach((note) => {
      if (note.password && !note.locked) {
        note.locked = true;
        changed = true;
      }
    });

    if (!changed) return;

    closeOptionsMenus();
    persist();
    render();
  }

  function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(lockIdleProtectedNotes, inactivityMs);
  }

  function openPasswordDialog(mode) {
    const note = getActiveNote();
    if (!note) return;

    if (mode === "lock" && note.password) {
      setActiveNoteLock(true);
      return;
    }

    closeOptionsMenus();
    elements.passwordForm.dataset.mode = mode;
    const copy = {
      lock: {
        title: "Lock note",
        text: "Set a password for this note.",
        action: "Lock"
      },
      unlock: {
        title: "Unlock note",
        text: "Enter the password to unlock this note.",
        action: "Unlock"
      },
      remove: {
        title: "Remove lock",
        text: "Enter the password to remove this note's lock.",
        action: "Remove lock"
      }
    };

    elements.passwordDialogTitle.textContent = copy[mode].title;
    elements.passwordDialogText.textContent = copy[mode].text;
    elements.confirmPasswordButton.textContent = copy[mode].action;
    elements.passwordInput.value = "";
    elements.passwordError.hidden = true;
    elements.passwordError.textContent = "";
    elements.passwordDialog.showModal();
    elements.passwordInput.focus();
  }

  function closePasswordDialog() {
    elements.passwordDialog.close();
    elements.passwordInput.value = "";
    elements.passwordError.hidden = true;
  }

  function submitPassword(event) {
    event.preventDefault();

    const note = getActiveNote();
    const password = elements.passwordInput.value;
    const mode = elements.passwordForm.dataset.mode;

    if (!note) return;

    if (!password) {
      showPasswordError("Password is required.");
      return;
    }

    if (mode === "lock") {
      closePasswordDialog();
      setActiveNoteLock(true, password);
      return;
    }

    if (password !== note.password) {
      showPasswordError("Wrong password.");
      return;
    }

    closePasswordDialog();
    if (mode === "remove") {
      setActiveNoteLock(false, "");
      return;
    }

    setActiveNoteLock(false);
  }

  function showPasswordError(message) {
    elements.passwordError.textContent = message;
    elements.passwordError.hidden = false;
    elements.passwordInput.select();
  }

  function toggleActiveNotePin() {
    const note = getActiveNote();
    if (!note) return;

    note.pinned = !note.pinned;
    note.updatedAt = Date.now();
    notes = sortNotes(notes);
    closeOptionsMenus();
    persist();
    render();
  }

  function toggleOptionsMenu(menu, button) {
    const shouldOpen = menu.hidden;
    closeOptionsMenus();
    menu.hidden = !shouldOpen;
    button.setAttribute("aria-expanded", String(shouldOpen));
  }

  function closeOptionsMenus() {
    elements.optionsMenu.hidden = true;
    elements.lockedOptionsMenu.hidden = true;
    elements.optionsButton.setAttribute("aria-expanded", "false");
    elements.lockedOptionsButton.setAttribute("aria-expanded", "false");
  }

  function renderList() {
    const query = elements.search.value.trim();
    const visibleNotes = notes.filter((note) => noteMatchesSearch(note, query));

    elements.count.textContent = `${notes.length} ${notes.length === 1 ? "note" : "notes"}`;
    elements.list.innerHTML = "";

    if (visibleNotes.length === 0) {
      const emptyItem = document.createElement("li");
      emptyItem.className = "note-item";
      emptyItem.textContent = query ? "No matching notes" : "No notes yet";
      elements.list.append(emptyItem);
      return;
    }

    visibleNotes.forEach((note) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      const title = document.createElement("span");
      const titleMain = document.createElement("span");
      const titleText = document.createElement("span");
      const meta = document.createElement("span");
      const editedDate = document.createElement("span");
      const preview = document.createElement("span");

      button.type = "button";
      button.className = "note-item";
      button.setAttribute("aria-current", note.id === activeId ? "true" : "false");
      button.addEventListener("click", () => {
        activeId = note.id;
        render();
      });

      title.className = "note-item__title";
      titleMain.className = "note-item__title-main";
      titleText.textContent = note.title.trim() || "Untitled note";
      titleMain.append(titleText);

      if (note.pinned) {
        const pin = document.createElement("span");
        pin.className = "pin-symbol";
        pin.setAttribute("aria-label", "Pinned");
        pin.textContent = "\uD83D\uDCCC";
        titleMain.prepend(pin);
      }

      meta.className = "note-item__meta";
      editedDate.className = "note-item__date";
      editedDate.textContent = formatEditedDate(note.updatedAt);
      editedDate.setAttribute("aria-label", `Last edited ${editedDate.textContent}`);
      meta.append(editedDate);

      if (note.locked) {
        const lock = document.createElement("span");
        lock.className = "lock-symbol";
        lock.setAttribute("aria-label", "Locked");
        lock.textContent = "\uD83D\uDD12";
        meta.append(lock);
      }

      title.append(titleMain, meta);

      preview.className = "note-item__preview";
      preview.textContent = formatPreview(note);

      button.append(title, preview);
      item.append(button);
      elements.list.append(item);
    });
  }

  function renderEditor() {
    const note = getActiveNote();
    const hasNote = Boolean(note);

    elements.editorPanel.hidden = !hasNote;

    if (!note) return;

    elements.unlockedEditor.hidden = note.locked;
    elements.lockedPanel.hidden = !note.locked;
    elements.pinButton.textContent = note.pinned ? "Unpin" : "Pin";
    elements.lockedPinButton.textContent = note.pinned ? "Unpin" : "Pin";
    elements.lockButton.textContent = note.password ? "Lock" : "Lock";
    elements.removeLockButton.hidden = !note.password;

    if (note.locked) {
      elements.title.value = "";
      elements.body.value = "";
      return;
    }

    if (document.activeElement !== elements.title) {
      elements.title.value = note.title;
    }

    if (document.activeElement !== elements.body) {
      elements.body.value = note.body;
    }
  }

  function render() {
    renderList();
    renderEditor();
  }

  elements.newButton.addEventListener("click", createNote);
  elements.deleteButton.addEventListener("click", deleteActiveNote);
  elements.lockedDeleteButton.addEventListener("click", deleteActiveNote);
  elements.lockButton.addEventListener("click", () => openPasswordDialog("lock"));
  elements.unlockButton.addEventListener("click", () => openPasswordDialog("unlock"));
  elements.removeLockButton.addEventListener("click", () => openPasswordDialog("remove"));
  elements.pinButton.addEventListener("click", toggleActiveNotePin);
  elements.lockedPinButton.addEventListener("click", toggleActiveNotePin);
  elements.optionsButton.addEventListener("click", () => toggleOptionsMenu(elements.optionsMenu, elements.optionsButton));
  elements.lockedOptionsButton.addEventListener("click", () => toggleOptionsMenu(elements.lockedOptionsMenu, elements.lockedOptionsButton));
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".options") && !event.target.closest(".locked-panel__top")) {
      closeOptionsMenus();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeOptionsMenus();
  });
  ["click", "input", "keydown", "pointermove"].forEach((eventName) => {
    document.addEventListener(eventName, resetInactivityTimer, { passive: true });
  });
  elements.passwordForm.addEventListener("submit", submitPassword);
  elements.cancelPasswordButton.addEventListener("click", closePasswordDialog);
  elements.search.addEventListener("input", renderList);
  elements.title.addEventListener("input", (event) => updateActiveNote("title", event.target.value));
  elements.body.addEventListener("input", (event) => updateActiveNote("body", event.target.value));

  render();
  persist();
  resetInactivityTimer();
})();
