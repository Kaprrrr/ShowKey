import createStretch from "./vendor/SignalsmithStretch.mjs";

createStretch.moduleUrl = chrome.runtime.getURL("vendor/SignalsmithStretch.mjs");
let session;

async function stop() {
  const current = session;
  session = null;
  if (!current) return;
  current.stream.getTracks().forEach(track => track.stop());
  if (current.context) await current.context.close();
}

function state() {
  if (!session) return null;
  const {tabId, page, tuning, analyser, samples} = session;
  let audible = false;
  if (analyser) {
    analyser.getFloatTimeDomainData(samples);
    audible = samples.some(sample => Math.abs(sample) > 0.0001);
  }
  return {tabId, page, tuning, audible};
}

function audioLost(current) {
  if (current !== session) return;
  void stop().finally(() => chrome.runtime.sendMessage({to: "worker", op: "ended", tabId: current.tabId}));
}

async function start({id, tabId, page, tuning}) {
  await stop();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {mandatory: {chromeMediaSource: "tab", chromeMediaSourceId: id}}, video: false
  });
  const current = {tabId, stream, page, tuning};
  session = current;
  try {
    stream.getAudioTracks()[0].onended = () => audioLost(current);
    const context = current.context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    // Chrome diverts the original sound before the pitch processor has finished loading.
    source.connect(context.destination);
    await context.resume();
    const node = current.node = await createStretch(context, {outputChannelCount: [2], channelCount: 2, channelCountMode: "explicit"});
    node.onprocessorerror = () => audioLost(current);
    await node.schedule({active: true, semitones: tuning.shift});
    const analyser = current.analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    current.samples = new Float32Array(analyser.fftSize);
    source.disconnect(context.destination);
    source.connect(node).connect(analyser).connect(context.destination);
    return state();
  } catch (error) {
    if (session === current) await stop();
    throw error;
  }
}

async function handle(message) {
  if (message.op === "state") return state();
  if (message.op === "stop") { await stop(); return null; }
  if (message.op === "start") return start(message);
  if (message.op === "tune" && session?.tabId === message.tabId) {
    await session.node.schedule({active: true, semitones: message.tuning.shift});
    Object.assign(session, {tuning: message.tuning, page: message.page});
    return state();
  }
  throw new Error("Reopen ShowKey on the tab you want to hear.");
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (sender.id !== chrome.runtime.id || message.to !== "audio") return;
  handle(message).then(value => reply({value}), error => reply({error: error.message}));
  return true;
});
