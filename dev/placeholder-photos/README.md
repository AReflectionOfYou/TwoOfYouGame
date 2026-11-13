# Placeholder photos: development and testing only

These 12 generated images exist only to test the game without using real
photos. They are not part of the game, are not cached by the service worker,
and should not ship as content.

They come in three shapes (landscape, portrait, square) so you can check the
centre-crop for tiles and the uncropped view in the match reveal.

To use them, serve the repo folder over http and open the game with `?dev`
in the URL, for example `http://localhost:8000/?dev`. A
**Load placeholder photos (dev)** button then appears on the photo screen.
You can also pick them by hand with **Add photos**.

Regenerate them with `python3 tools/generate_assets.py` (needs Pillow).
