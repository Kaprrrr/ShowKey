export const notes = ["C", "C♯ / D♭", "D", "E♭ / D♯", "E", "F", "F♯ / G♭", "G", "A♭ / G♯", "A", "B♭ / A♯", "B"];
export const original = {root: null, shift: 0};
export const noteAt = (root, shift) => (root + shift + 12) % 12;
export const shortNote = note => notes[note].split(" / ")[0];
export const signed = shift => shift > 0 ? "+" + shift : String(shift).replace("-", "−");

export function closestShift(from, to) {
  const up = noteAt(to, -from);
  return up > 6 ? up - 12 : up;
}

export function checkedTuning({root, shift}) {
  if (!(root === null || (Number.isInteger(root) && root >= 0 && root < 12)) ||
      !Number.isInteger(shift) || Math.abs(shift) > 12) {
    throw new Error("Choose a shift within one octave.");
  }
  return {root, shift};
}

// The same performance can appear in many playlists or at different timestamps.
export function identifyTab(raw) {
  let url;
  try { url = new URL(raw); } catch { return null; }
  if (!["https:", "http:"].includes(url.protocol)) return null;
  const host = url.hostname.toLowerCase();
  let song = null;
  let site = host;
  if (["www.youtube.com", "m.youtube.com", "youtube.com", "music.youtube.com", "youtu.be"].includes(host)) {
    site = host === "music.youtube.com" ? "YouTube Music" : "YouTube";
    const id = host === "youtu.be" ? url.pathname.slice(1) :
      url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1];
    if (/^[\w-]{11}$/.test(id ?? "")) {
      song = (site === "YouTube Music" ? "https://music.youtube.com" : "https://www.youtube.com") + "/watch?v=" + id;
    }
  } else if (host === "open.spotify.com") {
    site = "Spotify";
    const id = url.pathname.match(/^\/(?:intl-[^/]+\/)?track\/([A-Za-z0-9]+)\/?$/)?.[1];
    if (id) song = "https://open.spotify.com/track/" + id;
  } else if (host === "music.apple.com") {
    site = "Apple Music";
    // Apple shares both album links with a track query and song links with an optional title.
    const storefront = url.pathname.match(/^\/([a-z]{2})\//)?.[1];
    const songId = url.pathname.match(/^\/[a-z]{2}\/song\/(?:[^/]+\/)?(\d+)\/?$/)?.[1];
    const albumTrack = url.pathname.includes("/album/") ? url.searchParams.get("i") : null;
    const id = songId || albumTrack;
    if (storefront && /^\d+$/.test(id ?? "")) song = url.origin + "/" + storefront + "/song/" + id;
  }
  return {site, song, page: song || url.origin + url.pathname + url.search};
}
