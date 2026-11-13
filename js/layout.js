/* Two of You: board layout.
 * Picks the grid (columns x rows) that gives the largest square tiles in the
 * space available, so the board fits portrait, landscape, and any window size.
 * For example, 12 tiles become 3x4 in portrait and 4x3 in landscape. */
(function () {
  'use strict';

  var MAX_TILE = 300;

  function bestGrid(count, width, height, gap) {
    var best = null;
    for (var cols = 2; cols <= count / 2; cols++) {
      if (count % cols) continue;
      var rows = count / cols;
      var size = Math.floor(Math.min(
        (width - gap * (cols - 1)) / cols,
        (height - gap * (rows - 1)) / rows
      ));
      var balance = Math.abs(cols - rows);
      if (!best || size > best.size + 1 || (Math.abs(size - best.size) <= 1 && balance < best.balance)) {
        best = { cols: cols, rows: rows, size: size, balance: balance };
      }
    }
    if (best) best.size = Math.max(24, Math.min(MAX_TILE, best.size));
    return best;
  }

  function gapFor(width, height) {
    return Math.round(Math.max(6, Math.min(16, Math.min(width, height) * 0.018)));
  }

  window.TOYLayout = { bestGrid: bestGrid, gapFor: gapFor };
})();
