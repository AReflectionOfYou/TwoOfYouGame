/* Two of You: game logic and screens. */
(function () {
  'use strict';

  var DIFFICULTIES = {
    easy:   { label: 'Easy',   pairs: 6 },
    medium: { label: 'Medium', pairs: 8 },
    hard:   { label: 'Hard',   pairs: 12 }
  };
  var MAX_PLAYERS = 4;
  var NAME_MAX = 16;
  var REVEAL_MS = 2500;
  var SETTINGS_KEY = 'twoOfYou.settings.v1';
  var DEV_PLACEHOLDERS = 12;

  /* ?debug in the URL shows an on-screen log of what happens to each picked
   * photo, so problems can be diagnosed on an iPad without developer tools. */
  var debugMode = /[?&]debug\b/.test(location.search);
  var debugPanel = null;
  function debugLog(msg) {
    if (!debugMode) return;
    if (!debugPanel) {
      debugPanel = document.createElement('pre');
      debugPanel.className = 'debug-log';
      debugPanel.setAttribute('aria-label', 'Diagnostic log');
      document.body.appendChild(debugPanel);
    }
    var t = new Date().toTimeString().slice(0, 8);
    debugPanel.textContent += t + '  ' + msg + '\n';
    debugPanel.scrollTop = debugPanel.scrollHeight;
  }
  if (debugMode) {
    window.addEventListener('error', function (e) { debugLog('ERROR: ' + e.message + ' (' + e.filename + ':' + e.lineno + ')'); });
    window.addEventListener('unhandledrejection', function (e) { debugLog('UNHANDLED: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)); });
    setTimeout(function () {
      debugLog('Diagnostics on. ' + navigator.userAgent);
      debugLog('Page: ' + location.href + '  service worker controlling: ' + !!(navigator.serviceWorker && navigator.serviceWorker.controller));
    }, 0);
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function flipMs() { return reducedMotion.matches ? 0 : 430; }

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    screens: {
      setup: $('screen-setup'), photos: $('screen-photos'),
      game: $('screen-game'), end: $('screen-end')
    },
    setupNames: $('setup-names'), setupSound: $('setup-sound'),
    photosTitle: $('photos-title'), photosSub: $('photos-sub'),
    photoStatus: $('photo-status'), photoErrors: $('photo-errors'), photoTray: $('photo-tray'),
    fileInput: $('file-input'), btnStart: $('btn-start'),
    btnClear: $('btn-clear-photos'), btnDev: $('btn-dev-photos'),
    scoreStrip: $('score-strip'), boardWrap: $('board-wrap'), board: $('board'),
    turnMsg: $('turn-msg'), btnFinish: $('btn-finish-turn'),
    endTitle: $('end-title'), endSub: $('end-sub'),
    endScores: $('end-scores'), endGallery: $('end-gallery'),
    reveal: $('reveal'), revealImg: $('reveal-img'), confetti: $('confetti'),
    menu: $('menu-dialog'), menuSound: $('menu-sound'), menuNames: $('menu-names')
  };

  /* ---------------- Settings (sound, names, last choices) ---------------- */

  function loadSettings() {
    var s = {};
    try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { s = {}; }
    var names = Array.isArray(s.names) ? s.names : [];
    var out = {
      difficulty: DIFFICULTIES[s.difficulty] ? s.difficulty : 'easy',
      playerCount: Math.min(MAX_PLAYERS, Math.max(1, parseInt(s.playerCount, 10) || 1)),
      names: [],
      sound: s.sound !== false
    };
    for (var i = 0; i < MAX_PLAYERS; i++) out.names.push(String(names[i] || '').slice(0, NAME_MAX));
    return out;
  }

  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* private mode */ }
  }

  var settings = loadSettings();
  TOYAudio.setEnabled(settings.sound);

  function pairsNeeded() { return DIFFICULTIES[settings.difficulty].pairs; }
  function displayName(i) { return (settings.names[i] || '').trim() || 'Player ' + (i + 1); }

  /* ---------------- Screens ---------------- */

  var current = 'setup';
  function show(name) {
    Object.keys(el.screens).forEach(function (k) { el.screens[k].hidden = k !== name; });
    current = name;
    window.scrollTo(0, 0);
    var heading = el.screens[name].querySelector('h1, h2');
    if (heading && name !== 'game') heading.focus({ preventScroll: true });
    if (name === 'game') layoutBoard();
  }

  /* ---------------- Setup screen ---------------- */

  function renderNameFields(container, count, onChange) {
    container.innerHTML = '';
    for (var i = 0; i < count; i++) {
      var label = document.createElement('label');
      var text = document.createElement('span');
      text.textContent = 'Player ' + (i + 1);
      var input = document.createElement('input');
      input.type = 'text';
      input.maxLength = NAME_MAX;
      input.placeholder = 'Player ' + (i + 1);
      input.value = settings.names[i];
      input.autocomplete = 'off';
      input.setAttribute('autocapitalize', 'words');
      input.enterKeyHint = 'done';
      input.dataset.index = i;
      input.addEventListener('input', function (e) {
        settings.names[+e.target.dataset.index] = e.target.value.slice(0, NAME_MAX);
        saveSettings();
        if (onChange) onChange();
      });
      label.appendChild(text);
      label.appendChild(input);
      container.appendChild(label);
    }
  }

  function syncSetup() {
    document.querySelectorAll('input[name="difficulty"]').forEach(function (r) {
      r.checked = r.value === settings.difficulty;
    });
    document.querySelectorAll('input[name="players"]').forEach(function (r) {
      r.checked = +r.value === settings.playerCount;
    });
    el.setupSound.checked = settings.sound;
    renderNameFields(el.setupNames, settings.playerCount);
  }

  document.querySelectorAll('input[name="difficulty"]').forEach(function (r) {
    r.addEventListener('change', function () { settings.difficulty = r.value; saveSettings(); });
  });
  document.querySelectorAll('input[name="players"]').forEach(function (r) {
    r.addEventListener('change', function () {
      settings.playerCount = +r.value;
      saveSettings();
      renderNameFields(el.setupNames, settings.playerCount);
    });
  });

  function setSound(on) {
    settings.sound = !!on;
    saveSettings();
    TOYAudio.setEnabled(settings.sound);
    el.setupSound.checked = settings.sound;
    el.menuSound.checked = settings.sound;
    if (settings.sound) { TOYAudio.unlock(); TOYAudio.flip(); }
  }
  el.setupSound.addEventListener('change', function () { setSound(el.setupSound.checked); });
  el.menuSound.addEventListener('change', function () { setSound(el.menuSound.checked); });

  $('btn-to-photos').addEventListener('click', function () { goToPhotos(true); });

  /* ---------------- Photo picking ---------------- */

  var pool = [];      // { id, tile, large, selected }
  var nextId = 1;
  var processing = false;

  function selectedPhotos() { return pool.filter(function (p) { return p.selected; }); }

  /* Keep exactly the first N selected when possible. */
  function normalizeSelection() {
    var need = pairsNeeded();
    var count = 0;
    pool.forEach(function (p) { if (p.selected) { if (count < need) count++; else p.selected = false; } });
    pool.forEach(function (p) { if (!p.selected && count < need) { p.selected = true; count++; } });
  }

  function goToPhotos(openPicker) {
    normalizeSelection();
    renderPhotos();
    show('photos');
    // Opening the picker must happen inside the tap that brought us here.
    if (openPicker && pool.length === 0) openFilePicker();
  }

  function openFilePicker() {
    if (processing) { debugLog('Add photos ignored: still preparing earlier photos'); return; }
    debugLog('Opening photo picker (have ' + pool.length + ', need ' + pairsNeeded() + ')');
    el.fileInput.value = '';
    el.fileInput.click();
  }

  function setStatus(text, kind) {
    el.photoStatus.textContent = text;
    el.photoStatus.classList.toggle('is-ready', kind === 'ready');
    el.photoStatus.classList.toggle('is-warn', kind === 'warn');
  }

  function updatePhotoStatus(extra) {
    var need = pairsNeeded();
    var have = selectedPhotos().length;
    el.btnStart.disabled = processing || have !== need;
    el.btnClear.hidden = pool.length === 0 || processing;
    if (processing) return;
    if (extra) { setStatus(extra, 'warn'); return; }
    if (pool.length === 0) {
      setStatus('Tap “Add photos” and pick ' + need + ' photos from your library.');
    } else if (have < need) {
      var more = need - have;
      setStatus(have + ' of ' + need + ' chosen. Add ' + more + ' more photo' + (more === 1 ? '' : 's') + '.', 'warn');
    } else if (pool.length > need) {
      setStatus('Ready! ' + need + ' photos chosen. Tap a photo to swap it in or out.', 'ready');
    } else {
      setStatus('Ready! ' + need + ' photos chosen.', 'ready');
    }
  }

  function renderPhotos() {
    var need = pairsNeeded();
    var d = DIFFICULTIES[settings.difficulty];
    el.photosTitle.textContent = 'Choose ' + need + ' photos';
    el.photosSub.textContent = d.label + ' · ' + need + ' pairs · ' + (need * 2) + ' tiles';

    el.photoTray.innerHTML = '';
    var order = 0;
    pool.forEach(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb';
      b.setAttribute('aria-pressed', p.selected ? 'true' : 'false');
      b.setAttribute('aria-label', 'Photo ' + (i + 1) + (p.selected ? ', chosen' : ', not chosen'));
      var img = document.createElement('img');
      img.src = p.tile;
      img.alt = '';
      b.appendChild(img);
      if (p.selected) {
        var badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = ++order;
        b.appendChild(badge);
      }
      b.addEventListener('click', function () { togglePhoto(p); });
      el.photoTray.appendChild(b);
    });
    updatePhotoStatus();
  }

  function togglePhoto(p) {
    if (processing) return;
    var need = pairsNeeded();
    if (p.selected) {
      p.selected = false;
    } else if (selectedPhotos().length < need) {
      p.selected = true;
    } else {
      updatePhotoStatus('You already have ' + need + '. Tap a chosen photo to remove it first.');
      return;
    }
    renderPhotos();
  }

  function fileKey(f) { return [f.name, f.size, f.lastModified].join('|'); }

  async function addFiles(files) {
    if (!files.length) return;
    processing = true;
    el.btnStart.disabled = true;
    el.btnClear.hidden = true;
    var problems = { heic: [], unreadable: [], timeout: [], duplicate: [] };
    var seen = {};
    pool.forEach(function (p) { seen[p.key] = true; });
    try {
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        var key = fileKey(f);
        if (seen[key]) { debugLog('skip duplicate "' + f.name + '"'); problems.duplicate.push(f.name); continue; }
        seen[key] = true;
        setStatus('Preparing photo ' + (i + 1) + ' of ' + files.length + '…');
        try {
          var result = await TOYPhotos.process(f, debugMode ? debugLog : null);
          result.id = nextId++;
          result.key = key;
          result.selected = selectedPhotos().length < pairsNeeded();
          pool.push(result);
          renderPhotos(); // show each photo as soon as it is ready
        } catch (e) {
          (problems[e && e.reason] || problems.unreadable).push(f.name || 'unnamed photo');
        }
      }
    } finally {
      processing = false;
      renderPhotos();
      showPhotoProblems(problems);
      debugLog('Done. Pool now ' + pool.length + ', chosen ' + selectedPhotos().length + ' of ' + pairsNeeded() +
        '. Status: ' + el.photoStatus.textContent);
    }
  }

  function showPhotoProblems(problems) {
    var box = el.photoErrors;
    box.innerHTML = '';
    function add(title, names, advice) {
      if (!names.length) return;
      var p = document.createElement('p');
      var s = document.createElement('strong');
      s.textContent = title;
      p.appendChild(s);
      p.appendChild(document.createTextNode(' ' + advice));
      box.appendChild(p);
      var list = document.createElement('p');
      list.className = 'files';
      list.textContent = names.join(', ');
      box.appendChild(list);
    }
    var n = function (list) { return list.length + (list.length === 1 ? ' photo' : ' photos'); };
    add(n(problems.heic) + ' couldn’t be opened.', problems.heic,
      'They are in HEIC format (the iPhone photo format), which this browser can’t read. ' +
      'Play in Safari, or export them as JPEG first (in Photos: File → Export) and add those.');
    add(n(problems.unreadable) + ' couldn’t be opened.', problems.unreadable,
      'This browser can’t read those files. JPEG and PNG photos always work.');
    add(n(problems.timeout) + ' took too long to open.', problems.timeout,
      'Try a smaller copy of the photo, or a different one.');
    add(n(problems.duplicate) + ' already added.', problems.duplicate,
      'Each photo can only be used once, so the copies were skipped.');
    box.hidden = !box.childNodes.length;
  }

  function clearPool() {
    pool.forEach(TOYPhotos.release);
    pool = [];
    el.photoErrors.hidden = true;
    el.photoErrors.innerHTML = '';
  }

  el.fileInput.addEventListener('change', function () {
    var files = Array.prototype.slice.call(el.fileInput.files || []);
    debugLog('Picker returned ' + files.length + ' file(s)');
    // The input is cleared just before the picker next opens (openFilePicker),
    // not here, so the browser keeps the picked files alive while we read them.
    addFiles(files);
  });
  el.fileInput.addEventListener('cancel', function () { debugLog('Picker cancelled'); });
  $('btn-add-photos').addEventListener('click', openFilePicker);
  el.btnClear.addEventListener('click', function () { clearPool(); renderPhotos(); });
  $('btn-photos-back').addEventListener('click', function () { syncSetup(); show('setup'); });
  el.btnStart.addEventListener('click', function () {
    if (selectedPhotos().length === pairsNeeded()) startGame();
  });

  /* Development only: ?dev in the URL adds a button that loads the
   * placeholder images in dev/placeholder-photos/ (needs a local server). */
  if (/[?&]dev\b/.test(location.search)) {
    el.btnDev.hidden = false;
    el.btnDev.addEventListener('click', async function () {
      var files = [];
      for (var i = 1; i <= DEV_PLACEHOLDERS; i++) {
        var name = 'placeholder-' + String(i).padStart(2, '0') + '.jpg';
        try {
          var res = await fetch('dev/placeholder-photos/' + name);
          if (res.ok) files.push(new File([await res.blob()], name, { type: 'image/jpeg' }));
        } catch (e) { /* skip */ }
      }
      if (!files.length) updatePhotoStatus('Placeholder photos not found. Serve the folder over http.');
      addFiles(files);
    });
  }

  /* ---------------- Game ---------------- */

  var game = null;

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startGame() {
    var photos = selectedPhotos();
    var players = [];
    for (var i = 0; i < settings.playerCount; i++) players.push({ pairs: 0 });

    var deck = [];
    photos.forEach(function (p, idx) { deck.push(idx, idx); });
    shuffle(deck);

    game = {
      photos: photos,
      players: players,
      tiles: deck.map(function (pairId) { return { pairId: pairId, up: false, matched: false, el: null }; }),
      currentPlayer: 0,
      moves: 0,
      matched: 0,
      first: null,
      second: null,
      mismatch: false,
      locked: false,
      lastWasMatch: false
    };
    renderBoard();
    renderScore();
    renderTurn();
    show('game');
  }

  function renderBoard() {
    el.board.innerHTML = '';
    game.tiles.forEach(function (t, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tile';
      b.innerHTML =
        '<span class="tile-inner">' +
          '<span class="tile-face tile-back"></span>' +
          '<span class="tile-face tile-front"><img alt="" draggable="false"></span>' +
        '</span>';
      b.querySelector('img').src = game.photos[t.pairId].tile;
      b.addEventListener('click', function () { onTileTap(i); });
      t.el = b;
      updateTileLabel(t, i);
      el.board.appendChild(b);
    });
  }

  function updateTileLabel(t, i) {
    var state = t.matched ? 'matched, photo ' + (t.pairId + 1)
      : t.up ? 'showing photo ' + (t.pairId + 1) : 'face down';
    t.el.setAttribute('aria-label', 'Tile ' + (i + 1) + ', ' + state);
  }

  function setTile(i, up) {
    var t = game.tiles[i];
    t.up = up;
    t.el.classList.toggle('is-up', up);
    updateTileLabel(t, i);
  }

  function setLocked(locked) {
    game.locked = locked;
    el.board.classList.toggle('is-locked', locked);
  }

  function layoutBoard() {
    if (!game || current !== 'game') return;
    var w = el.boardWrap.clientWidth;
    var h = el.boardWrap.clientHeight;
    if (!w || !h) return;
    var gap = TOYLayout.gapFor(w, h);
    var grid = TOYLayout.bestGrid(game.tiles.length, w, h, gap);
    if (!grid) return;
    el.board.style.setProperty('--cols', grid.cols);
    el.board.style.setProperty('--tile-size', grid.size + 'px');
    el.board.style.setProperty('--gap', gap + 'px');
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(layoutBoard).observe(el.boardWrap);
  } else {
    window.addEventListener('resize', layoutBoard);
    window.addEventListener('orientationchange', function () { setTimeout(layoutBoard, 250); });
  }

  function onTileTap(i) {
    if (!game || game.locked) return;
    var t = game.tiles[i];
    if (t.up || t.matched) return;

    TOYAudio.flip();
    setTile(i, true);

    if (game.first === null) {
      game.first = i;
      game.lastWasMatch = false;
      renderTurn();
      return;
    }

    game.second = i;
    game.moves++;
    var a = game.tiles[game.first];
    var b = game.tiles[game.second];

    if (a.pairId === b.pairId) {
      a.matched = b.matched = true;
      game.matched++;
      game.players[game.currentPlayer].pairs++;
      setLocked(true);
      var pairIndex = a.pairId;
      var fi = game.first, si = game.second;
      game.first = game.second = null;
      game.lastWasMatch = true;
      renderScore();
      renderTurn();
      var thisGame = game;
      setTimeout(function () {
        if (game !== thisGame) return; // game was restarted or quit meanwhile
        a.el.classList.add('is-matched');
        b.el.classList.add('is-matched');
        updateTileLabel(a, fi);
        updateTileLabel(b, si);
        TOYAudio.match();
        showReveal(game.photos[pairIndex], { confetti: true, auto: true, onClose: afterMatch });
      }, flipMs() + 120);
    } else {
      game.mismatch = true;
      setLocked(true);
      renderScore();
      renderTurn();
    }
  }

  function afterMatch() {
    if (!game) return;
    if (game.matched === game.photos.length) {
      setTimeout(endGame, reducedMotion.matches ? 0 : 300);
      return;
    }
    setLocked(false);
    renderTurn();
  }

  function finishTurn() {
    if (!game || !game.mismatch) return;
    TOYAudio.flip();
    setTile(game.first, false);
    setTile(game.second, false);
    game.first = game.second = null;
    game.mismatch = false;
    game.currentPlayer = (game.currentPlayer + 1) % game.players.length;
    setLocked(false);
    renderScore();
    renderTurn();
  }
  el.btnFinish.addEventListener('click', finishTurn);

  function renderScore() {
    el.scoreStrip.innerHTML = '';
    if (game.players.length === 1) {
      el.scoreStrip.appendChild(chip(displayName(0), null, true, true));
      el.scoreStrip.appendChild(chip('Moves', game.moves, false));
      el.scoreStrip.appendChild(chip('Pairs', game.matched + ' / ' + game.photos.length, false));
      return;
    }
    game.players.forEach(function (p, i) {
      el.scoreStrip.appendChild(chip(displayName(i), p.pairs, i === game.currentPlayer));
    });
  }

  function chip(label, value, active, plain) {
    var c = document.createElement('div');
    c.className = 'chip' + (active ? ' is-active' : '') + (plain ? ' chip-plain' : '');
    if (active && game.players.length > 1) c.setAttribute('aria-current', 'true');
    var n = document.createElement('span');
    n.className = 'name';
    n.textContent = label;
    c.appendChild(n);
    if (value !== null && value !== undefined) {
      var v = document.createElement('span');
      v.className = 'count';
      v.textContent = value;
      c.appendChild(v);
    }
    return c;
  }

  function renderTurn() {
    var multi = game.players.length > 1;
    var name = displayName(game.currentPlayer);
    if (game.mismatch) {
      el.turnMsg.hidden = true;
      el.btnFinish.hidden = false;
      var next = displayName((game.currentPlayer + 1) % game.players.length);
      el.btnFinish.textContent = 'Finish turn';
      el.btnFinish.setAttribute('aria-label', multi ? 'Not a match. Finish turn; ' + next + ' is next.' : 'Not a match. Finish turn.');
      return;
    }
    el.btnFinish.hidden = true;
    el.turnMsg.hidden = false;
    var msg;
    if (game.lastWasMatch) msg = multi ? 'A match! ' + name + ' goes again.' : 'A match! Keep going.';
    else if (game.first !== null) msg = 'Now flip another tile.';
    else msg = multi ? name + ', flip two tiles.' : 'Flip two tiles to find a pair.';
    el.turnMsg.textContent = msg;
  }

  /* ---------------- Reveal overlay ---------------- */

  var revealTimer = null;
  var revealOnClose = null;
  var CONFETTI_COLORS = ['#d26a3f', '#f2b134', '#2f8a5c', '#4f7cc2', '#c05aa0', '#fff4e1'];

  function showReveal(photo, opts) {
    clearTimeout(revealTimer);
    el.revealImg.src = photo.large;
    el.confetti.innerHTML = '';
    el.reveal.hidden = false;
    revealOnClose = opts.onClose || null;
    if (opts.confetti && !reducedMotion.matches) burst();
    if (opts.auto) revealTimer = setTimeout(hideReveal, REVEAL_MS);
  }

  function hideReveal() {
    if (el.reveal.hidden) return;
    clearTimeout(revealTimer);
    el.reveal.hidden = true;
    el.confetti.innerHTML = '';
    var cb = revealOnClose;
    revealOnClose = null;
    if (cb) cb();
  }

  function burst() {
    var frag = document.createDocumentFragment();
    var spread = Math.min(window.innerWidth, window.innerHeight) * 0.55;
    for (var i = 0; i < 48; i++) {
      var p = document.createElement('i');
      var angle = Math.random() * Math.PI * 2;
      var dist = spread * (0.45 + Math.random() * 0.6);
      p.style.setProperty('--x', Math.round(Math.cos(angle) * dist) + 'px');
      p.style.setProperty('--y', Math.round(Math.sin(angle) * dist + 40) + 'px');
      p.style.setProperty('--r', Math.round(Math.random() * 720 - 360) + 'deg');
      p.style.setProperty('--d', Math.round(Math.random() * 120) + 'ms');
      p.style.setProperty('--c', CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
      if (i % 3 === 0) { p.style.width = '8px'; p.style.height = '8px'; p.style.borderRadius = '50%'; }
      frag.appendChild(p);
    }
    el.confetti.appendChild(frag);
  }

  // "click" (not pointerdown) so the tap is fully consumed by the overlay and
  // never falls through to a tile underneath.
  el.reveal.addEventListener('click', hideReveal);
  document.addEventListener('keydown', function (e) {
    if (el.reveal.hidden) return;
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      hideReveal();
    }
  });

  /* ---------------- End of game ---------------- */

  function endGame() {
    TOYAudio.finish();
    var players = game.players.map(function (p, i) { return { name: displayName(i), pairs: p.pairs }; });
    var best = Math.max.apply(null, players.map(function (p) { return p.pairs; }));
    var winners = players.filter(function (p) { return p.pairs === best; });

    if (players.length === 1) {
      el.endTitle.textContent = 'All ' + game.photos.length + ' pairs found!';
      el.endSub.textContent = 'You did it in ' + game.moves + ' moves.';
    } else if (winners.length === 1) {
      el.endTitle.textContent = winners[0].name + ' wins!';
      el.endSub.textContent = 'With ' + best + ' pair' + (best === 1 ? '' : 's') + ' out of ' + game.photos.length + '.';
    } else if (winners.length === players.length) {
      el.endTitle.textContent = 'It’s a tie!';
      el.endSub.textContent = 'Everyone found ' + best + ' pair' + (best === 1 ? '' : 's') + '.';
    } else {
      el.endTitle.textContent = 'It’s a tie!';
      el.endSub.textContent = listNames(winners.map(function (w) { return w.name; })) + ' each found ' + best + ' pairs.';
    }

    el.endScores.innerHTML = '';
    var sorted = players.slice().sort(function (a, b) { return b.pairs - a.pairs; });
    sorted.forEach(function (p) {
      var li = document.createElement('li');
      if (players.length > 1 && p.pairs === best) li.className = 'is-winner';
      var who = document.createElement('span');
      who.className = 'who';
      who.textContent = p.name;
      var score = document.createElement('span');
      score.textContent = p.pairs + (p.pairs === 1 ? ' pair' : ' pairs');
      li.appendChild(who);
      li.appendChild(score);
      el.endScores.appendChild(li);
    });
    if (players.length === 1) {
      var li = document.createElement('li');
      li.innerHTML = '<span>Total moves</span><span></span>';
      li.lastChild.textContent = game.moves;
      el.endScores.appendChild(li);
    }

    el.endGallery.innerHTML = '';
    game.photos.forEach(function (photo, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'View photo ' + (i + 1));
      var img = document.createElement('img');
      img.src = photo.tile;
      img.alt = '';
      b.appendChild(img);
      b.addEventListener('click', function () { showReveal(photo, { confetti: false, auto: false }); });
      el.endGallery.appendChild(b);
    });

    show('end');
  }

  function listNames(names) {
    if (names.length <= 2) return names.join(' and ');
    return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1];
  }

  $('btn-play-again').addEventListener('click', startGame);
  $('btn-new-photos').addEventListener('click', function () {
    game = null;
    clearPool();
    goToPhotos(true);
  });
  $('btn-change-settings').addEventListener('click', function () {
    game = null;
    syncSetup();
    show('setup');
  });

  /* ---------------- In-game menu ---------------- */

  $('btn-menu').addEventListener('click', function () {
    el.menuSound.checked = settings.sound;
    renderNameFields(el.menuNames, game ? game.players.length : settings.playerCount, function () {
      if (game) { renderScore(); renderTurn(); }
    });
    if (typeof el.menu.showModal === 'function') el.menu.showModal();
    else el.menu.setAttribute('open', '');
  });

  function closeMenu() {
    if (typeof el.menu.close === 'function') el.menu.close();
    else el.menu.removeAttribute('open');
  }
  $('btn-menu-restart').addEventListener('click', function () { closeMenu(); startGame(); });
  $('btn-menu-quit').addEventListener('click', function () {
    closeMenu();
    game = null;
    syncSetup();
    show('setup');
  });

  /* ---------------- About ---------------- */

  // Only shows and hides a dialog; it never touches settings, game state or storage.
  var about = $('about-dialog');
  function closeAbout() {
    if (typeof about.close === 'function') about.close();
    else about.removeAttribute('open');
  }
  $('btn-about').addEventListener('click', function () {
    if (typeof about.showModal === 'function') about.showModal();
    else about.setAttribute('open', '');
  });
  // Clicking the backdrop (outside the panel's content) closes it.
  about.addEventListener('click', function (e) { if (e.target === about) closeAbout(); });
  // Escape closes a native modal dialog on its own; this covers the fallback.
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && about.hasAttribute('open')) { e.preventDefault(); closeAbout(); }
  });

  /* ---------------- Boot ---------------- */

  // iOS only allows audio to start from a user gesture.
  document.addEventListener('pointerdown', function () { TOYAudio.unlock(); }, { passive: true });

  syncSetup();
  show('setup');

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline support unavailable */ });
    });
  }
})();
