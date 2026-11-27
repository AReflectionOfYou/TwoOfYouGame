/* Two of You: the last game's setup, saved on this device.
 * When a game starts, its photos (the small tile and large reveal JPEGs, in
 * order) and its difficulty are saved in IndexedDB so the next visit can offer
 * "Play with previous setup". Photos never leave the device. "Start over"
 * deletes the saved photos. Every call fails quietly (private browsing, storage
 * blocked or full): the game then simply behaves as if nothing was saved. */
(function () {
  'use strict';

  var DB_NAME = 'twoOfYou';
  var STORE = 'setup';
  var KEY = 'last';

  function open() {
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('no IndexedDB')); return; }
      var req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('blocked')); };
    });
  }

  function run(mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, mode);
        var req = fn(tx.objectStore(STORE));
        tx.oncomplete = function () { db.close(); resolve(req && req.result); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      });
    });
  }

  /* photos: [{ tileBlob, largeBlob }] in game order. */
  function save(difficulty, photos) {
    var record = {
      difficulty: difficulty,
      savedAt: Date.now(),
      photos: photos.map(function (p) { return { tile: p.tileBlob, large: p.largeBlob }; })
    };
    return run('readwrite', function (s) { return s.put(record, KEY); }).catch(function () {});
  }

  /* Resolves to { difficulty, photos: [{ tile: Blob, large: Blob }] } or null. */
  function load() {
    return run('readonly', function (s) { return s.get(KEY); })
      .then(function (r) {
        if (!r || !Array.isArray(r.photos) || !r.photos.length) return null;
        var ok = r.photos.every(function (p) { return p && p.tile instanceof Blob && p.large instanceof Blob; });
        return ok ? r : null;
      })
      .catch(function () { return null; });
  }

  function clear() {
    return run('readwrite', function (s) { return s.delete(KEY); }).catch(function () {});
  }

  window.TOYStore = { save: save, load: load, clear: clear };
})();
