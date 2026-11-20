import {checkedTuning, identifyTab, original} from "./music.js";

let pending = Promise.resolve();
let liveTab; // Undefined until the worker has recovered the offscreen state after waking up.

function serialize(operation) {
  const result = pending.then(operation);
  pending = result.catch(() => {});
  return result;
}

async function hasAudio() {
  return (await chrome.runtime.getContexts({contextTypes: ["OFFSCREEN_DOCUMENT"]})).length > 0;
}

async function audio(op, data = {}) {
  const reply = await chrome.runtime.sendMessage({to: "audio", op, ...data});
  if (!reply || reply.error) throw new Error(reply?.error || "The audio connection closed. Start it again.");
  return reply.value;
}

async function current() {
  const state = await hasAudio() ? await audio("state") : null;
  liveTab = state?.tabId ?? null;
  return state;
}

async function badge(tabId, text) {
  if (Number.isInteger(tabId)) await chrome.action.setBadgeText({tabId, text}).catch(() => {});
}

async function release(tabId) {
  // Closing the document also releases capture if the audio processor has stopped responding.
  if (await hasAudio()) await chrome.offscreen.closeDocument();
  liveTab = null;
  await badge(tabId, "");
}

async function library() {
  return (await chrome.storage.local.get({songs: []})).songs;
}

async function syncPage(state, page) {
  if (state.page === page.page) return state;
  const saved = (await library()).find(song => song.url === page.song);
  return audio("tune", {tabId: state.tabId, page: page.page, tuning: saved?.tuning || original});
}

async function start(tabId, page, tuning) {
  await chrome.offscreen.createDocument({
    url: "audio.html", reasons: ["USER_MEDIA"],
    justification: "Play the selected tab through a local musical pitch shifter."
  });
  let deadline;
  try {
    const id = await chrome.tabCapture.getMediaStreamId({targetTabId: tabId});
    const state = await Promise.race([
      audio("start", {id, tabId, page, tuning}),
      new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error("Audio took too long to start. Play the song and try again.")), 10000); })
    ]);
    liveTab = tabId;
    await badge(tabId, "ON");
    return state;
  } catch (error) {
    await release(tabId);
    throw error;
  } finally {
    clearTimeout(deadline);
  }
}

async function handle(message) {
  if (message.op === "ended") {
    if (!(await current())) await release(message.tabId);
    return;
  }
  if (message.op === "remove") {
    await chrome.storage.local.set({songs: (await library()).filter(song => song.url !== message.url)});
    return;
  }
  const tab = await chrome.tabs.get(message.tabId);
  const page = identifyTab(tab.url);
  let state = await current();
  if (state?.tabId === tab.id && page) state = await syncPage(state, page);
  if (message.op === "view") return {page, title: tab.title || "", state, songs: await library()};
  if (!page || page.page !== message.page) throw new Error("The song changed. Reopen ShowKey on the song you want.");
  if (message.op === "stop") {
    if (state?.tabId === tab.id) await release(tab.id);
    return;
  }
  const tuning = checkedTuning(message.tuning);
  if (message.op === "save") {
    if (!page.song) throw new Error("Open the song’s own page to save it.");
    const songs = await library();
    const title = (tab.title || page.site).replace(/\s*[-–|]\s*(YouTube(?: Music)?|Spotify|Apple Music)\s*$/i, "");
    const entry = {url: page.song, title, tuning};
    const index = songs.findIndex(song => song.url === page.song);
    if (index < 0) songs.push(entry); else songs[index] = entry;
    await chrome.storage.local.set({songs});
    return;
  }
  if (message.op === "tune" || message.op === "start") {
    if (state?.tabId === tab.id) return audio("tune", {tabId: tab.id, page: page.page, tuning});
    if (message.op === "tune") throw new Error("Start live audio on this tab first.");
    if (state || await hasAudio()) await release(state?.tabId);
    return start(tab.id, page.page, tuning);
  }
  throw new Error("Unknown control.");
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.to !== "worker") return;
  serialize(() => handle(message)).then(value => reply({value}), error => reply({error: error.message}));
  return true;
});

chrome.tabs.onUpdated.addListener((tabId, change) => {
  if (liveTab !== undefined && tabId !== liveTab) return;
  if (!change.url && change.status !== "complete" && !change.title) return;
  void serialize(async () => {
    const state = await current();
    if (state?.tabId !== tabId) return;
    const page = identifyTab((await chrome.tabs.get(tabId)).url);
    if (page) await syncPage(state, page); else await release(tabId);
  }).catch(() => {});
});

chrome.tabs.onRemoved.addListener(tabId => {
  if (liveTab !== undefined && tabId !== liveTab) return;
  void serialize(async () => {
    if ((await current())?.tabId === tabId) await release(tabId);
  }).catch(() => {});
});
