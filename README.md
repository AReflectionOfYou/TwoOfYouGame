# Two of You Game

A simple memory game made from pictures in your photo library. Part of the
**A Reflection of You** game set.

Pick photos from your device at the start of a game. Each photo becomes a pair
of face-down tiles. Players take turns flipping two tiles to find matching
pairs, and each match shows the full photo with a small celebration. The game
is meant to get people talking about the people and moments in the photos as
much as to be won.

- 1 to 4 players on one device, with optional names
- Easy (6 pairs), Medium (8 pairs) and Hard (12 pairs)
- Built for iPad Safari; also works on iPhone and desktop browsers
- Installs to the home screen and works offline
- Photos stay on the device. Nothing is uploaded, and nothing is saved after
  the game is closed.

> **Photo formats on a computer:** iPhone and Mac Photos pictures are often
> HEIC files. Safari reads them, but Chrome, Firefox and Edge cannot, so on a
> laptop either play in Safari or export the photos as JPEG first. On iPad and
> iPhone this never comes up, because the photo picker hands over JPEGs.

## Run it locally

There is no build step and there are no dependencies.

**Quickest:** open `index.html` in a browser. The game works, but offline
support (the service worker) is turned off for `file://` pages.

**Recommended:** serve the folder so the service worker and PWA install work:

```sh
cd TwoOfYouGame
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Any static file server works.

To try it on an iPad on the same Wi-Fi network, open
`http://<your-computer's-ip>:8000` in Safari. Note that browsers only allow
service workers on `https://` or `localhost`, so offline mode and installing
need an https host (see below).

### Testing with placeholder photos

Open <http://localhost:8000/?dev> to get a **Load placeholder photos (dev)**
button on the photo screen. It loads the generated test images in
[dev/placeholder-photos/](dev/placeholder-photos/), which are for development
only.

### Troubleshooting photo loading

Add `?debug` to the address (for example
`https://areflectionofyou.github.io/TwoOfYouGame/?debug`) to show an on-screen
log of what the photo picker returns and how each photo is processed: file
name, format, size, dimensions, timings, and any error. It works on an iPad
with no developer tools; take a screenshot of the log to share it.

## Install on an iPad as an app

The game must be served over https (for example GitHub Pages: in the repo's
**Settings → Pages**, deploy from the `main` branch root).

1. Open the game's https address in **Safari** on the iPad.
2. Tap the **Share** button, then **Add to Home Screen**.
3. Tap **Add**.

The game now opens full screen from its home-screen icon. After the first
launch it works with no internet connection.

Installed copies pick up a new version the next time they open with an
internet connection. If you add a new file to the app, also add it to the
`SHELL` list in [sw.js](sw.js) so it is available offline.

## Change the tile-back design

Every face-down tile uses one design, defined in a single file:
[css/tile-back.css](css/tile-back.css).

- **Colours or wording:** edit the variables at the top of that file
  (`--tile-back-bg`, `--tile-back-hatch`, `--tile-back-ink`,
  `--tile-back-label`).
- **Add a brand mark:** put the image in an `assets/` folder and set
  `--tile-back-image: url("../assets/brand-mark.svg");`. Set
  `--tile-back-label: none;` to hide the text if the mark replaces it.
  Add the new file to the `SHELL` list in [sw.js](sw.js) so it works offline.
- **Full redesign:** replace the `.tile-back` rules. `--tile-size` (the tile's
  width) and `--tile-radius` are available for scaling.

The app icons in [icons/](icons/) are drawn by
[tools/generate_assets.py](tools/generate_assets.py) (needs Pillow:
`python3 -m pip install Pillow`). Replace them when the final logo is ready.

## How to play

1. Choose a difficulty and the number of players, and enter names if you like.
2. Choose photos. The game tells you how many it needs. If you pick too many,
   tap photos to choose which ones to use; if too few, add more.
3. On your turn, flip two tiles.
   - **Match:** you keep the pair, see the photo, and go again.
   - **No match:** the tiles stay up so everyone can see them. Tap
     **Finish turn** to flip them back and pass to the next player.
4. When every pair is found, the game shows the winner and all the photos.
   Play again with the same photos, choose new photos, or change settings.

Sound (a soft flip and a match chime) can be turned off on the setup screen or
in the in-game menu. On iPhone and iPad it follows the silent switch.

## Project layout

```
index.html            the app (all four screens)
css/styles.css        layout and look
css/tile-back.css     the tile-back design (swap this to rebrand)
js/app.js             screens, game rules, scoring, match reveal
js/photos.js          crops and downsizes picked photos in memory
js/layout.js          picks the grid that best fits the screen
js/audio.js           synthesized sound effects
sw.js                 service worker (offline cache)
manifest.webmanifest  PWA manifest
icons/                app icons
dev/                  development-only placeholder photos
tools/                asset generator (development only)
```

## License

MIT. See [LICENSE](LICENSE).
