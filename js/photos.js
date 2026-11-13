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
  var DECODE_TIMEOUT_MS = 20000;

  /* HEIC/HEIF is the iPhone photo format. Safari reads it; Chrome, Firefox and
   * Edge do not. (iPad and iPhone Safari convert to JPEG when picking anyway.) */
  function isHeic(file) {
    return /^image\/hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
  }

  function fail(reason) {
    var e = new Error(reason);
    e.reason = reason;
    return e;
  }

  function decode(file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      var done = false;
      var timer = setTimeout(function () {
        if (done) return;
        done = true;
        img.src = '';
        URL.revokeObjectURL(url);
        reject(fail('timeout'));
      }, DECODE_TIMEOUT_MS);
      img.onload = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ img: img, url: url });
      };
      img.onerror = function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        reject(fail(isHeic(file) ? 'heic' : 'unreadable'));
      };
      img.src = url;
    });
  }

  function toBlobUrl(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(URL.createObjectURL(blob));
        else reject(fail('unreadable'));
      }, 'image/jpeg', QUALITY);
    });
  }

  function context(canvas) {
    var g = canvas.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    return g;
  }

  /* log is optional: a function(message) used by the ?debug diagnostics. */
  async function process(file, log) {
    log = log || function () {};
    var t0 = Date.now();
    log('file "' + file.name + '" type=' + (file.type || '(none)') + ' size=' + file.size +
      ' bytes modified=' + (file.lastModified ? new Date(file.lastModified).toISOString() : '(none)'));
    if (!file.size) log('  WARNING: file is empty (0 bytes)');
    var decoded;
    try {
      decoded = await decode(file);
    } catch (e) {
      log('  decode FAILED (' + (e.reason || e.message) + ') after ' + (Date.now() - t0) + ' ms');
      throw e;
    }
    var img = decoded.img;
    try {
      var w = img.naturalWidth;
      var h = img.naturalHeight;
      log('  decoded ' + w + 'x' + h + ' in ' + (Date.now() - t0) + ' ms');
      if (!w || !h) throw fail('unreadable');

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

      log('  OK: large ' + lw + 'x' + lh + ', tile ' + ts + 'x' + ts + ', total ' + (Date.now() - t0) + ' ms');
      return { tile: tileUrl, large: largeUrl };
    } catch (e) {
      log('  processing FAILED: ' + (e.reason || (e.name + ': ' + e.message)));
      throw e;
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
