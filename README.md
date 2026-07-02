# Notes

A lightweight split-pane note app built with HTML, CSS, and JavaScript. The note list stays on the left while the selected note opens in the editor on the right.

## Features

- Create, edit, search, and delete notes
- Pin important notes to the top of the list
- Show the last-edited date for each note
- Protect notes with a password
- Automatically relock protected notes after 10 minutes of inactivity or a page refresh
- Save notes locally in the browser
- Responsive layout for desktop and smaller screens

## Run the App

Open `index.html` in a modern browser. No installation or build step is required.

## Data Storage

Notes are stored in the browser's `localStorage`. They remain available in the same browser on the same device, but they are not synchronized or backed up automatically. Clearing browser data will remove the notes.

## Password Protection

The lock feature hides protected note content in the interface. Passwords and note data are stored locally and are not encrypted, so this app should not be used to store highly sensitive information.

## Tests

The browser test is located at `tests/note-app.test.cjs` and uses Playwright. It covers note creation, editing, persistence, search, pinning, deletion, password locking, unlocking, relocking, and lock removal.

Run it from the project directory after Playwright is available:

```sh
node tests/note-app.test.cjs
```
