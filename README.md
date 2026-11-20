# ShowKey

ShowKey shifts the sound from a browser tab while the video keeps its original timing.

**[Download ShowKey for Chrome](https://github.com/Kaprrrr/ShowKey/releases/latest/download/ShowKey-Chrome.zip)** · [Release notes](https://github.com/Kaprrrr/ShowKey/releases/latest)

## Try the GitHub release in desktop Chrome

The ZIP is a free, manually installed build for people testing ShowKey.
Extract it into a folder you plan to keep.

1. Open `chrome://extensions` in desktop Chrome 116 or later.
2. Turn on **Developer mode**, click **Load unpacked**, and choose the extracted folder containing `manifest.json`.
3. Open Chrome’s Extensions menu and pin **ShowKey**.

## Rehearse a song

1. Play the recording on YouTube and open ShowKey.
2. Choose the **Recording key** and **Show key**.
   If you don’t know the recording's key, use the **−** and **+** controls by ear.
3. Click **Start live audio**.
   You can change the shift while the video plays and close the popup while practicing.
4. Click **Save song** to remember the recording and its settings.
   Open a saved song from **Your setlist**, play it, and start live audio on its tab.
5. Click **Stop live audio** to restore normal playback.

The key menus use root notes.
A minor to G minor and A major to G major both use a shift of minus two half steps.
The menus choose the shortest shift.
The step controls cover an octave in either direction.
To update a test installation, replace its files with those from the new release, then click **Reload** for ShowKey in Chrome’s extensions page.
When the active YouTube tab moves to a different video, it uses that song’s saved tuning or zero.

## Other web players

YouTube playback and Apple Music song previews worked in our desktop Chrome tests.
To try a full Apple Music song, sign in at [music.apple.com](https://music.apple.com) in desktop Chrome, play a track in that tab, then click **Start live audio** in ShowKey.
The native Apple Music app plays outside the tab.
Full Apple Music subscription tracks remain unverified.
The signed-out Spotify web player produced no audible output in testing.
For web players, select the browser as the playback device.
If a protected stream goes silent, **Stop live audio** returns playback to the site.
Open an individual song page to save a track link.

## Audio and storage

ShowKey processes one tab locally and stores saved links, titles, and tunings in your browser profile.
Pitch processing adds a short delay to the sound.
The pitch engine is [Signalsmith Stretch 1.3.2](https://github.com/Signalsmith-Audio/signalsmith-stretch).
The bundled module and third-party license notices are in `vendor/`.

[Privacy policy](https://github.com/Kaprrrr/ShowKey/blob/main/PRIVACY.md) · [Report an issue](https://github.com/Kaprrrr/ShowKey/issues)
