import {notes, original, closestShift, noteAt, shortNote, signed} from "./music.js";

const ui = Object.fromEntries([...document.querySelectorAll("[id]")].map(el => [el.id, el]));
let tabId, view, lastList;
let tuning = {...original};
let busy = false;
let notice = "";
let problem = false;

async function call(op, args = {}) {
  const reply = await chrome.runtime.sendMessage({to: "worker", op, tabId, page: view?.page?.page, ...args});
  if (!reply || reply.error) throw new Error(reply?.error || "Reopen ShowKey to reconnect.");
  return reply.value;
}

function live() {
  return tabId != null && view?.state?.tabId === tabId;
}

function renderList() {
  const stamp = JSON.stringify(view.songs);
  if (lastList === stamp) return;
  lastList = stamp;
  ui.songs.replaceChildren();
  ui.empty.hidden = view.songs.length > 0;
  for (const song of view.songs) {
    const item = document.createElement("li");
    const link = document.createElement("a");
    link.textContent = song.title;
    link.href = song.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.title = "Open saved song";
    const key = document.createElement("small");
    key.textContent = song.tuning.root === null ? signed(song.tuning.shift) + " st" : shortNote(noteAt(song.tuning.root, song.tuning.shift));
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "×";
    remove.ariaLabel = "Remove " + song.title;
    remove.addEventListener("click", () => act(async () => {
      await call("remove", {url: song.url});
      notice = "Song removed from your setlist.";
    }));
    item.append(link, key, remove);
    ui.songs.append(item);
  }
}

function render() {
  const enabled = Boolean(view?.page) && !busy;
  ui.root.disabled = !enabled;
  ui.target.disabled = !enabled || tuning.root === null;
  ui.up.disabled = !enabled || tuning.shift >= 12;
  ui.down.disabled = !enabled || tuning.shift <= -12;
  ui.toggle.disabled = !enabled;
  ui.reset.disabled = !enabled || tuning.shift === 0;
  ui.save.disabled = !enabled || !view?.page?.song;
  ui.save.title = view?.page?.song ? "Remember this recording and key" : "Open the song’s own page to save it";
  ui.root.value = tuning.root ?? "";
  ui.target.value = tuning.root === null ? "" : noteAt(tuning.root, tuning.shift);
  ui.shift.textContent = signed(tuning.shift);
  ui.toggle.textContent = live() ? "Stop live audio" : view?.state ? "Move audio to this tab" : "Start live audio";
  ui.status.classList.toggle("error", problem);
  const idle = view?.page ? "Choose a shift, then start live audio." : "Open a song in a browser tab to change its key.";
  ui.status.textContent = notice || (live() ? (view.state.audible ? "Live · Tab audio detected" : "Live · Waiting for sound from this tab") : idle);
  ui.source.textContent = view?.page?.site || "Browser tab";
  ui.song.textContent = view?.page ? view.title.replace(/\s*[-–|]\s*(YouTube(?: Music)?|Spotify|Apple Music)\s*$/i, "") || view.page.site : "Open a song";
  if (view) renderList();
}

async function refresh(force = false) {
  const next = await call("view");
  if (force || next.page?.page !== view?.page?.page || next.state?.tabId !== view?.state?.tabId) {
    tuning = {...(next.state?.tabId === tabId ? next.state.tuning : next.songs.find(song => song.url === next.page?.song)?.tuning || original)};
  }
  view = next;
  render();
}

async function act(callback) {
  if (busy) return;
  busy = true;
  notice = "";
  problem = false;
  render();
  try {
    await callback();
    await refresh();
  } catch (error) {
    try { await refresh(true); } catch { /* Reloading the extension closes the old connection. */ }
    notice = error.message;
    problem = true;
  } finally {
    busy = false;
    render();
  }
}

function change(next) {
  void act(async () => {
    if (live()) await call("tune", {tuning: next});
    tuning = next;
  });
}

for (const [index, name] of notes.entries()) {
  for (const select of [ui.root, ui.target]) select.add(new Option(name, index));
}
ui.root.addEventListener("change", () => change({...tuning, root: ui.root.value === "" ? null : Number(ui.root.value)}));
ui.target.addEventListener("change", () => {
  if (ui.target.value !== "") change({...tuning, shift: closestShift(tuning.root, Number(ui.target.value))});
  else render();
});
ui.up.addEventListener("click", () => change({...tuning, shift: tuning.shift + 1}));
ui.down.addEventListener("click", () => change({...tuning, shift: tuning.shift - 1}));
ui.reset.addEventListener("click", () => change({...tuning, shift: 0}));
ui.toggle.addEventListener("click", () => act(() => call(live() ? "stop" : "start", {tuning})));
ui.save.addEventListener("click", () => act(async () => {
  await call("save", {tuning});
  notice = "Song and key saved.";
}));

try {
  const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
  tabId = tab.id;
  await refresh(true);
  setInterval(async () => {
    if (busy) return;
    const previous = view;
    try {
      const next = await call("view");
      if (busy || previous !== view) return;
      if (next.page?.page !== previous.page?.page || next.state?.tabId !== previous.state?.tabId) {
        notice = ""; problem = false;
        await refresh(true);
      } else {
        view = next;
        if (live()) tuning = {...next.state.tuning};
        render();
      }
    } catch (error) { notice = error.message; problem = true; render(); }
  }, 1000);
} catch (error) {
  notice = error.message;
  problem = true;
  render();
}
