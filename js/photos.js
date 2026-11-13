/* Two of You: photo processing.
 * Each picked file is decoded once and turned into two in-memory JPEGs:
 *   large: the uncropped photo, longest side at most LARGE px (match reveal)
 *   tile:  a centre-cropped square, at most TILE px (game tiles)
 * Photos never leave the device. Both images are blob URLs that live only for
 * the session; release() frees them. */
(function () {
  'use strict';

  var TILE = 512;
  var LARGE = 1024;
  var QUALITY = 0.86;

  function decode(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read image'));
      };
      img.src = url;
    });
  }

  function toBlobUrl(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(URL.createObjectURL(blob));
        else reject(new Error('Could not encode image'));
      }, 'image/jpeg', QUALITY);
    });
  }

  function context(canvas) {
    var g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    return g;
  }

  async function process(file) {
    var decoded = await decode(file);
    var img = decoded.img;
    try {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      if (!w || !h) throw new Error('Empty image');

      // Large, uncropped.
      var scale = Math.min(1, LARGE / Math.max(w, h));
      var lw = Math.max(1, Math.round(w * scale));
      var lh = Math.max(1, Math.round(h * scale));
      var large = document.createElement('canvas');
      large.width = lw;
      large.height = lh;
      context(large).drawImage(img, 0, 0, lw, lh);
      var largeUrl = await toBlobUrl(large);

      // Square tile, centre-cropped from the large version (a smaller source
      // gives a cleaner downscale and keeps memory low).
      var side = Math.min(lw, lh);
      var ts = Math.min(TILE, side);
      var tile = document.createElement('canvas');
      tile.width = ts;
      tile.height = ts;
      context(tile).drawImage(large, (lw - side) / 2, (lh - side) / 2, side, side, 0, 0, ts, ts);
      var tileUrl = await toBlobUrl(tile);

      // Free canvas memory promptly (matters on iOS).
      large.width = large.height = 0;
      tile.width = tile.height = 0;

      return { tile: tileUrl, large: largeUrl };
    } finally {
      URL.revokeObjectURL(decoded.url);
    }
  }

  function release(photo) {
    if (!photo) return;
    URL.revokeObjectURL(photo.tile);
    URL.revokeObjectURL(photo.large);
  }

  window.TOYPhotos = { process: process, release: release };
})();
