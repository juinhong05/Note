const assert = require("node:assert/strict");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

async function run() {
  const appUrl = pathToFileURL(`${process.cwd()}\\index.html`).href;
  const browser = await chromium.launch({ executablePath: findBrowserExecutable() });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });

  try {
    await page.addInitScript(() => {
      window.__NOTE_APP_INACTIVITY_MS__ = 1000;
    });
    await page.goto(appUrl);
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    await assertVisible(page, '[aria-label="Note list"]');
    await assertVisible(page, '[aria-label="Editor"]');
    await assertVisible(page, "text=Welcome note");
    assert.equal(await page.locator("#emptyState").count(), 0, "empty state should be removed");
    assert.equal(await page.getByRole("textbox", { name: "Note title" }).inputValue(), "Welcome note");
    assert.match(await page.locator(".note-item__date").first().textContent(), /^[A-Z][a-z]{2} \d{1,2}(, \d{4})?$/);
    await assertCenteredText(page, "#newNoteButton");

    await page.getByLabel("Create note").click();
    await page.getByLabel("Note title").fill("Project ideas");
    await page.getByRole("textbox", { name: "Note content" }).fill("Build a calm split-pane note app.");
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes("Project ideas"));

    await page.getByRole("button", { name: "Note options" }).click();
    await page.getByRole("menuitem", { name: "Pin" }).click();
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes('"pinned":true'));

    await page.getByLabel("Create note").click();
    await page.getByLabel("Note title").fill("Later note");
    await page.getByRole("textbox", { name: "Note content" }).fill("This newer note should stay below pinned notes.");
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes("Later note"));
    assert.deepEqual(await noteTitles(page), ["Project ideas", "Later note"]);
    assert.equal(await page.locator(".note-item").first().locator(".pin-symbol").isVisible(), true, "first note should show a pin symbol");

    await page.getByRole("button", { name: /Project ideas/ }).click();
    await page.reload();
    await assertVisible(page, "text=Project ideas");
    await assert.equal(await page.getByRole("textbox", { name: "Note content" }).inputValue(), "Build a calm split-pane note app.");
    assert.deepEqual(await noteTitles(page), ["Project ideas", "Later note"]);

    await page.getByRole("button", { name: "Note options" }).click();
    await page.getByRole("menuitem", { name: "Lock", exact: true }).click();
    await assertVisible(page, "text=Set a password for this note.");
    await page.getByLabel("Password").fill("secret123");
    await page.getByRole("button", { name: "Lock" }).click();
    await assertVisible(page, "text=Locked note");
    await assertVisible(page, "text=This note is hidden until you unlock it.");
    await assertHidden(page, page.getByRole("textbox", { name: "Note content" }));
    await assertHidden(page, page.getByText("Build a calm split-pane note app."));
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes('"locked":true'));
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes('"password":"secret123"'));

    await page.reload();
    await assertVisible(page, "text=Locked note");
    await assertHidden(page, page.getByRole("textbox", { name: "Note content" }));
    assert.equal(await page.locator(".note-item").first().locator(".lock-symbol").isVisible(), true, "locked note should show a lock symbol");
    await assertLockUnderDate(page);

    await page.getByPlaceholder("Search notes").fill("calm");
    await assertVisible(page, "text=No matching notes");
    await page.getByPlaceholder("Search notes").fill("Project");
    await assertVisible(page, "text=Project ideas");
    await page.getByRole("button", { name: /Project ideas/ }).click();
    await page.getByRole("button", { name: "Unlock" }).click();
    const unlockDialog = page.getByRole("dialog", { name: "Unlock note" });
    await assertVisible(page, "text=Enter the password to unlock this note.");
    await unlockDialog.getByLabel("Password").fill("wrong");
    await unlockDialog.getByRole("button", { name: "Unlock" }).click();
    await assertVisible(page, "text=Wrong password.");
    await assertVisible(page, "text=Locked note");
    await unlockDialog.getByLabel("Password").fill("secret123");
    await unlockDialog.getByRole("button", { name: "Unlock" }).click();
    await assertVisible(page, '[aria-label="Note content"]');
    await assert.equal(await page.getByRole("textbox", { name: "Note content" }).inputValue(), "Build a calm split-pane note app.");
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes('"locked":false'));
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes('"password":"secret123"'));

    await page.reload();
    await assertVisible(page, "text=Locked note");
    assert.equal(await page.locator(".note-item").first().locator(".lock-symbol").isVisible(), true, "protected note should re-lock on refresh");

    await page.getByRole("button", { name: "Unlock" }).click();
    await page.getByRole("dialog", { name: "Unlock note" }).getByLabel("Password").fill("secret123");
    await page.getByRole("dialog", { name: "Unlock note" }).getByRole("button", { name: "Unlock" }).click();
    await assertVisible(page, '[aria-label="Note content"]');
    await page.waitForTimeout(1200);
    await assertVisible(page, "text=Locked note");

    await page.getByRole("button", { name: "Unlock" }).click();
    await page.getByRole("dialog", { name: "Unlock note" }).getByLabel("Password").fill("secret123");
    await page.getByRole("dialog", { name: "Unlock note" }).getByRole("button", { name: "Unlock" }).click();
    await assertVisible(page, '[aria-label="Note content"]');

    await page.getByRole("button", { name: "Note options" }).click();
    await assertVisible(page, "text=Remove lock");
    await page.getByRole("menuitem", { name: "Lock", exact: true }).click();
    await assertVisible(page, "text=Locked note");

    await page.getByRole("button", { name: "Unlock" }).click();
    await page.getByRole("dialog", { name: "Unlock note" }).getByLabel("Password").fill("secret123");
    await page.getByRole("dialog", { name: "Unlock note" }).getByRole("button", { name: "Unlock" }).click();
    await assertVisible(page, '[aria-label="Note content"]');

    await page.getByRole("button", { name: "Note options" }).click();
    await page.getByRole("menuitem", { name: "Remove lock" }).click();
    const removeLockDialog = page.getByRole("dialog", { name: "Remove lock" });
    await assertVisible(page, "text=Enter the password to remove this note's lock.");
    await removeLockDialog.getByLabel("Password").fill("wrong");
    await removeLockDialog.getByRole("button", { name: "Remove lock" }).click();
    await assertVisible(page, "text=Wrong password.");
    await removeLockDialog.getByLabel("Password").fill("secret123");
    await removeLockDialog.getByRole("button", { name: "Remove lock" }).click();
    await page.waitForFunction(() => localStorage.getItem("split-note-app-notes")?.includes('"password":""'));

    await page.getByPlaceholder("Search notes").fill("calm");
    await assertVisible(page, "text=Project ideas");
    await page.getByPlaceholder("Search notes").fill("missing");
    await assertVisible(page, "text=No matching notes");

    await page.getByPlaceholder("Search notes").fill("");
    await page.getByRole("button", { name: /Project ideas/ }).click();
    await page.getByRole("button", { name: "Note options" }).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();
    await page.waitForFunction(() => !localStorage.getItem("split-note-app-notes")?.includes("Project ideas"));

    console.log("All note app tests passed.");
  } finally {
    await browser.close();
  }
}

function findBrowserExecutable() {
  const candidates = [
    process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe"
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function assertVisible(page, selector) {
  assert.equal(await page.locator(selector).first().isVisible(), true, `${selector} should be visible`);
}

async function assertHidden(page, locator) {
  assert.equal(await locator.first().isVisible(), false, "element should be hidden");
}

async function assertCenteredText(page, selector) {
  const alignment = await page.locator(selector).evaluate((button) => {
    const range = document.createRange();
    range.selectNodeContents(button);
    const textBox = range.getBoundingClientRect();
    const buttonBox = button.getBoundingClientRect();

    return {
      xOffset: Math.abs((textBox.left + textBox.width / 2) - (buttonBox.left + buttonBox.width / 2)),
      yOffset: Math.abs((textBox.top + textBox.height / 2) - (buttonBox.top + buttonBox.height / 2))
    };
  });

  assert.ok(alignment.xOffset <= 1, `button text should be horizontally centered: ${alignment.xOffset}`);
  assert.ok(alignment.yOffset <= 3, `button text should be vertically centered: ${alignment.yOffset}`);
}

async function noteTitles(page) {
  return page.locator(".note-item__title-main span:last-child").evaluateAll((titles) => titles.slice(0, 2).map((title) => title.textContent));
}

async function assertLockUnderDate(page) {
  const placement = await page.locator(".note-item").first().evaluate((item) => {
    const date = item.querySelector(".note-item__date").getBoundingClientRect();
    const lock = item.querySelector(".lock-symbol").getBoundingClientRect();

    return {
      isBelow: lock.top > date.bottom,
      xOffset: Math.abs((lock.left + lock.width / 2) - (date.left + date.width / 2))
    };
  });

  assert.equal(placement.isBelow, true, "lock symbol should sit below the date");
  assert.ok(placement.xOffset <= 18, `lock symbol should align with the date column: ${placement.xOffset}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
