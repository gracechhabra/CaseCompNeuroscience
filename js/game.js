// /**
//  * Trace — Drag-between-numbers with green path animation
//  * Tracks: reaction time per segment, wrong releases, path efficiency, cursor path (attention/eye-movement proxy)
//  */

// (function () {
//   'use strict';

//   const DOM = {
//     startScreen: document.getElementById('start-screen'),
//     gameArea: document.getElementById('game-area'),
//     boardWrap: document.getElementById('board-wrap'),
//     pathSvg: document.getElementById('path-svg'),
//     gameBoard: document.getElementById('game-board'),
//     statCurrent: document.getElementById('stat-current'),
//     statTime: document.getElementById('stat-time'),
//     statWrong: document.getElementById('stat-wrong'),
//     resultsPanel: document.getElementById('results-panel'),
//     metricsGrid: document.getElementById('metrics-grid'),
//     reactionBars: document.getElementById('reaction-bars'),
//     btnStart: document.getElementById('btn-start'),
//     btnReset: document.getElementById('btn-reset'),
//     btnPlayAgain: document.getElementById('btn-play-again'),
//   };

//   let state = {
//     size: 6,
//     count: 8,
//     positions: [],
//     nextTarget: 1,
//     wrongReleases: 0,
//     startTime: null,
//     segmentStartTime: null,
//     reactionTimes: [],
//     pathDistance: 0,       // Manhattan distance between targets (x+y only)
//     cursorPathDistance: 0, // total cursor movement during drags (attention/eye proxy)
//     dragStartPos: null,
//     isDragging: false,
//     timerId: null,
//     completedPaths: [],   // each element: array of {x,y} points (path that avoids number cells)
//   };

//   function shuffle(arr) {
//     const a = [...arr];
//     for (let i = a.length - 1; i > 0; i--) {
//       const j = Math.floor(Math.random() * (i + 1));
//       [a[i], a[j]] = [a[j], a[i]];
//     }
//     return a;
//   }

//   function initPositions(size, count) {
//     const cells = [];
//     for (let r = 0; r < size; r++) {
//       for (let c = 0; c < size; c++) cells.push({ row: r, col: c });
//     }
//     const chosen = shuffle(cells).slice(0, count);
//     return chosen.map((cell, i) => ({ num: i + 1, row: cell.row, col: cell.col }));
//   }

//   function getWrapRect() {
//     return DOM.boardWrap ? DOM.boardWrap.getBoundingClientRect() : { left: 0, top: 0, width: 400, height: 400 };
//   }

//   function wrapCoords(clientX, clientY) {
//     const r = getWrapRect();
//     return { x: clientX - r.left, y: clientY - r.top };
//   }

//   function getCellCenter(cellEl) {
//     if (!cellEl) return null;
//     const rect = cellEl.getBoundingClientRect();
//     const wrap = getWrapRect();
//     return {
//       x: rect.left + rect.width / 2 - wrap.left,
//       y: rect.top + rect.height / 2 - wrap.top
//     };
//   }

//   function updateSvgSize() {
//     if (!DOM.boardWrap || !DOM.pathSvg) return;
//     const w = DOM.boardWrap.offsetWidth;
//     const h = DOM.boardWrap.offsetHeight;
//     DOM.pathSvg.setAttribute('width', w);
//     DOM.pathSvg.setAttribute('height', h);
//     DOM.pathSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
//   }

//   function drawCompletedPaths() {
//     if (!DOM.pathSvg) return;
//     var ns = 'http://www.w3.org/2000/svg';
//     var group = DOM.pathSvg.querySelector('g.completed');
//     if (!group) {
//       group = document.createElementNS(ns, 'g');
//       group.setAttribute('class', 'completed');
//       DOM.pathSvg.appendChild(group);
//     }
//     group.innerHTML = '';
//     var strokeAttrs = { stroke: 'var(--dot-active)', 'stroke-width': '12', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' };
//     state.completedPaths.forEach(function (points) {
//       for (var i = 0; i < points.length - 1; i++) {
//         var a = points[i], b = points[i + 1];
//         var line = document.createElementNS(ns, 'line');
//         line.setAttribute('x1', a.x); line.setAttribute('y1', a.y);
//         line.setAttribute('x2', b.x); line.setAttribute('y2', b.y);
//         Object.keys(strokeAttrs).forEach(function (k) { line.setAttribute(k, strokeAttrs[k]); });
//         group.appendChild(line);
//       }
//     });
//   }

//   function updateLiveLine(x2, y2) {
//     if (!state.dragStartPos) return;
//     const x1 = state.dragStartPos.x, y1 = state.dragStartPos.y;
//     const ns = 'http://www.w3.org/2000/svg';
//     let group = DOM.pathSvg.querySelector('#path-live-group');
//     if (!group) {
//       group = document.createElementNS(ns, 'g');
//       group.setAttribute('id', 'path-live-group');
//       group.setAttribute('class', 'live');
//       var h = document.createElementNS(ns, 'line');
//       h.setAttribute('id', 'path-line-live-h');
//       h.setAttribute('class', 'live');
//       var v = document.createElementNS(ns, 'line');
//       v.setAttribute('id', 'path-line-live-v');
//       v.setAttribute('class', 'live');
//       group.appendChild(h);
//       group.appendChild(v);
//       DOM.pathSvg.appendChild(group);
//     }
//     var h = DOM.pathSvg.querySelector('#path-line-live-h');
//     var v = DOM.pathSvg.querySelector('#path-line-live-v');
//     h.setAttribute('x1', x1); h.setAttribute('y1', y1); h.setAttribute('x2', x2); h.setAttribute('y2', y1);
//     v.setAttribute('x1', x2); v.setAttribute('y1', y1); v.setAttribute('x2', x2); v.setAttribute('y2', y2);
//     group.style.display = '';
//   }

//   function hideLiveLine() {
//     const group = DOM.pathSvg.querySelector('#path-live-group');
//     if (group) group.style.display = 'none';
//   }

//   function getCellAt(clientX, clientY) {
//     const el = document.elementFromPoint(clientX, clientY);
//     if (!el) return null;
//     const cell = el.closest('.cell[data-num]');
//     return cell ? parseInt(cell.dataset.num, 10) : null;
//   }

//   function getCellElement(num) {
//     const pos = state.positions.find(p => p.num === num);
//     if (!pos) return null;
//     return getCellByRowCol(pos.row, pos.col);
//   }

//   function getCellByRowCol(row, col) {
//     if (!DOM.gameBoard) return null;
//     return DOM.gameBoard.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
//   }

//   /** BFS: Manhattan path from (r0,c0) to (r1,c1) that does not step into occupied cells. */
//   function findPathBetween(r0, c0, r1, c1, occupiedSet) {
//     const key = function (r, c) { return r + ',' + c; };
//     if (occupiedSet.has(key(r0, c0)) || occupiedSet.has(key(r1, c1))) return null;
//     const queue = [{ r: r0, c: c0, path: [{ r: r0, c: c0 }] }];
//     const seen = new Set();
//     seen.add(key(r0, c0));
//     const dirs = [{ r: 0, c: 1 }, { r: 0, c: -1 }, { r: 1, c: 0 }, { r: -1, c: 0 }];
//     while (queue.length) {
//       const cur = queue.shift();
//       if (cur.r === r1 && cur.c === c1) return cur.path;
//       for (var d = 0; d < dirs.length; d++) {
//         const nr = cur.r + dirs[d].r, nc = cur.c + dirs[d].c;
//         if (nr < 0 || nr >= state.size || nc < 0 || nc >= state.size) continue;
//         const k = key(nr, nc);
//         if (seen.has(k) || occupiedSet.has(k)) continue;
//         seen.add(k);
//         queue.push({ r: nr, c: nc, path: cur.path.concat([{ r: nr, c: nc }]) });
//       }
//     }
//     return null;
//   }

//   function getOccupiedSetExcluding(excludeNumA, excludeNumB) {
//     const key = function (r, c) { return r + ',' + c; };
//     const set = new Set();
//     state.positions.forEach(function (p) {
//       if (p.num !== excludeNumA && p.num !== excludeNumB) set.add(key(p.row, p.col));
//     });
//     return set;
//   }

//   function pathToPoints(pathRowsCols) {
//     var points = [];
//     for (var i = 0; i < pathRowsCols.length; i++) {
//       var cell = getCellByRowCol(pathRowsCols[i].r, pathRowsCols[i].c);
//       if (cell) {
//         var pt = getCellCenter(cell);
//         if (pt) points.push(pt);
//       }
//     }
//     return points;
//   }

//   function buildBoard() {
//     DOM.gameBoard.innerHTML = '';
//     DOM.pathSvg.innerHTML = '';
//     state.completedPaths = [];
//     DOM.gameBoard.className = 'game-board size-' + state.size;

//     const positionByKey = {};
//     state.positions.forEach(p => {
//       positionByKey[`${p.row}-${p.col}`] = p.num;
//     });

//     for (let r = 0; r < state.size; r++) {
//       for (let c = 0; c < state.size; c++) {
//         const cell = document.createElement('div');
//         cell.className = 'cell';
//         cell.dataset.row = r;
//         cell.dataset.col = c;
//         const num = positionByKey[`${r}-${c}`];
//         if (num !== undefined) {
//           const dot = document.createElement('div');
//           dot.className = 'dot';
//           dot.textContent = num;
//           cell.appendChild(dot);
//           cell.dataset.num = num;
//         }
//         cell.addEventListener('mousedown', onCellMouseDown);
//         DOM.gameBoard.appendChild(cell);
//       }
//     }

//     updateSvgSize();
//     drawCompletedPaths();
//     updateTargetHighlight();
//   }

//   function updateTargetHighlight() {
//     DOM.gameBoard.querySelectorAll('.cell').forEach(c => {
//       c.classList.remove('target', 'filled', 'drag-target');
//       const n = parseInt(c.dataset.num, 10);
//       if (n === state.nextTarget) {
//         c.classList.add('target', 'drag-target');
//       } else if (n < state.nextTarget) {
//         c.classList.add('filled');
//       }
//     });
//     DOM.statCurrent.textContent = state.nextTarget;
//     DOM.statWrong.textContent = state.wrongReleases;
//   }

//   function startTimer() {
//     if (state.timerId) clearInterval(state.timerId);
//     state.timerId = setInterval(() => {
//       const elapsed = (Date.now() - state.startTime) / 1000;
//       DOM.statTime.textContent = elapsed.toFixed(1) + 's';
//     }, 100);
//   }

//   function stopTimer() {
//     if (state.timerId) {
//       clearInterval(state.timerId);
//       state.timerId = null;
//     }
//   }

//   function onCellMouseDown(e) {
//     if (state.isDragging) return;
//     const cell = e.currentTarget;
//     const num = cell.dataset.num ? parseInt(cell.dataset.num, 10) : null;
//     if (!num || num !== state.nextTarget) {
//       if (num) {
//         cell.classList.add('wrong');
//         state.wrongReleases++;
//         DOM.statWrong.textContent = state.wrongReleases;
//         setTimeout(() => cell.classList.remove('wrong'), 400);
//       }
//       return;
//     }
//     e.preventDefault();
//     state.isDragging = true;
//     state.segmentStartTime = Date.now();
//     state.dragStartPos = getCellCenter(cell);
//     if (DOM.boardWrap) DOM.boardWrap.classList.add('dragging');
//     DOM.gameBoard.querySelectorAll('.cell').forEach(c => c.classList.add('dragging'));

//     let lastX = e.clientX, lastY = e.clientY;

//     function onMove(ev) {
//       const pt = wrapCoords(ev.clientX, ev.clientY);
//       updateLiveLine(pt.x, pt.y);
//       const dx = ev.clientX - lastX;
//       const dy = ev.clientY - lastY;
//       state.cursorPathDistance += Math.abs(dx) + Math.abs(dy);
//       lastX = ev.clientX;
//       lastY = ev.clientY;
//     }

//     function onUp(ev) {
//       document.removeEventListener('mousemove', onMove);
//       document.removeEventListener('mouseup', onUp);
//       state.isDragging = false;
//       if (DOM.boardWrap) DOM.boardWrap.classList.remove('dragging');
//       DOM.gameBoard.querySelectorAll('.cell').forEach(c => c.classList.remove('dragging'));
//       hideLiveLine();

//       const nextNum = state.nextTarget + 1;
//       const hitNum = getCellAt(ev.clientX, ev.clientY);
//       const nextCell = getCellElement(nextNum);

//       if (hitNum === nextNum && nextCell) {
//         var startPos = state.positions.find(function (p) { return p.num === state.nextTarget; });
//         var endPos = state.positions.find(function (p) { return p.num === nextNum; });
//         var occupied = getOccupiedSetExcluding(state.nextTarget, nextNum);
//         var pathCells = findPathBetween(startPos.row, startPos.col, endPos.row, endPos.col, occupied);
//         var points;
//         if (pathCells && pathCells.length >= 2) {
//           points = pathToPoints(pathCells);
//           for (var i = 0; i < points.length - 1; i++) {
//             state.pathDistance += Math.abs(points[i + 1].x - points[i].x) + Math.abs(points[i + 1].y - points[i].y);
//           }
//         } else {
//           var endPx = getCellCenter(nextCell);
//           points = [state.dragStartPos, endPx];
//           state.pathDistance += Math.abs(endPx.x - state.dragStartPos.x) + Math.abs(endPx.y - state.dragStartPos.y);
//         }
//         state.completedPaths.push(points);
//         state.reactionTimes.push(Date.now() - state.segmentStartTime);
//         state.nextTarget = nextNum;
//         drawCompletedPaths();
//         updateTargetHighlight();

//         if (state.nextTarget >= state.positions.length) {
//           finishRound();
//         }
//       } else {
//         state.wrongReleases++;
//         DOM.statWrong.textContent = state.wrongReleases;
//       }
//       state.dragStartPos = null;
//     }

//     document.addEventListener('mousemove', onMove);
//     document.addEventListener('mouseup', onUp);
//     const pt = wrapCoords(e.clientX, e.clientY);
//     updateLiveLine(pt.x, pt.y);
//   }

//   function finishRound() {
//     stopTimer();
//     const totalMs = Date.now() - state.startTime;
//     showResults(totalMs);
//   }

//   function showResults(totalMs) {
//     const totalSec = (totalMs / 1000).toFixed(1);
//     const avgReaction = state.reactionTimes.length
//       ? Math.round(state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length)
//       : 0;
//     const minReaction = state.reactionTimes.length ? Math.min(...state.reactionTimes) : 0;
//     const totalSegments = state.positions.length - 1;
//     const accuracy = totalSegments + state.wrongReleases > 0
//       ? Math.round((totalSegments / (totalSegments + state.wrongReleases)) * 100)
//       : 100;
//     const pathPx = Math.round(state.pathDistance);
//     const cursorPx = Math.round(state.cursorPathDistance);

//     DOM.metricsGrid.innerHTML = `
//       <div class="metric-card">
//         <div class="value">${totalSec}s</div>
//         <div class="label">Total time</div>
//       </div>
//       <div class="metric-card">
//         <div class="value">${avgReaction} ms</div>
//         <div class="label">Avg reaction (per segment)</div>
//       </div>
//       <div class="metric-card">
//         <div class="value">${state.wrongReleases}</div>
//         <div class="label">Wrong releases</div>
//       </div>
//       <div class="metric-card">
//         <div class="value">${accuracy}%</div>
//         <div class="label">Accuracy</div>
//       </div>
//       <div class="metric-card">
//         <div class="value">${pathPx} px</div>
//         <div class="label">Path (Manhattan)</div>
//       </div>
//       <div class="metric-card">
//         <div class="value">${cursorPx} px</div>
//         <div class="label">Cursor path (attention proxy)</div>
//       </div>
//       <div class="metric-card">
//         <div class="value">${minReaction} ms</div>
//         <div class="label">Fastest reaction</div>
//       </div>
//     `;

//     const maxR = Math.max(...state.reactionTimes, 1);
//     DOM.reactionBars.innerHTML = state.reactionTimes
//       .map((t, i) => {
//         const h = Math.max(4, (t / maxR) * 100);
//         return '<div class="reaction-bar" style="height: ' + h + '%" title="Segment ' + (i + 1) + ': ' + t + ' ms"></div>';
//       })
//       .join('');

//     DOM.resultsPanel.classList.add('visible');
//     DOM.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
//   }

//   function startRound() {
//     state.positions = initPositions(state.size, state.count);
//     state.nextTarget = 1;
//     state.wrongReleases = 0;
//     state.reactionTimes = [];
//     state.pathDistance = 0;
//     state.cursorPathDistance = 0;
//     state.startTime = Date.now();
//     state.completedPaths = [];
//     DOM.resultsPanel.classList.remove('visible');
//     DOM.statTime.textContent = '0.0s';
//     buildBoard();
//     startTimer();
//     window.addEventListener('resize', updateSvgSize);
//   }

//   function showGame() {
//     DOM.startScreen.style.display = 'none';
//     DOM.gameArea.style.display = 'block';
//     startRound();
//   }

//   DOM.btnStart.addEventListener('click', () => {
//     const selected = document.querySelector('.start-screen [data-size].selected');
//     if (selected) {
//       state.size = parseInt(selected.dataset.size, 10);
//       state.count = parseInt(selected.dataset.count, 10);
//     }
//     showGame();
//   });

//   document.querySelectorAll('.start-screen [data-size]').forEach(btn => {
//     btn.addEventListener('click', () => {
//       document.querySelectorAll('.start-screen [data-size]').forEach(b => b.classList.remove('selected'));
//       btn.classList.add('selected');
//       btn.classList.remove('btn-secondary');
//       btn.classList.add('btn-primary');
//       document.querySelectorAll('.start-screen [data-size]:not(.selected)').forEach(b => {
//         b.classList.remove('btn-primary');
//         b.classList.add('btn-secondary');
//       });
//     });
//   });

//   DOM.btnReset.addEventListener('click', () => {
//     window.removeEventListener('resize', updateSvgSize);
//     startRound();
//   });
//   DOM.btnPlayAgain.addEventListener('click', () => {
//     DOM.resultsPanel.classList.remove('visible');
//     startRound();
//   });

//   const defaultBtn = document.querySelector('.start-screen [data-size="6"][data-count="8"]');
//   if (defaultBtn) {
//     defaultBtn.classList.add('selected');
//     defaultBtn.classList.remove('btn-secondary');
//     defaultBtn.classList.add('btn-primary');
//   }
// })();


/**
 * Trace — Drag-between-numbers with path-blocking mechanics
 * Each completed path blocks future paths from crossing it (like LinkedIn Queens)
 */



/**
 * Trace — Drag-between-numbers with path-blocking mechanics
 * Each completed path blocks future paths from crossing it (like LinkedIn Queens)
 */

(function () {
  'use strict';

  const DOM = {
    startScreen: document.getElementById('start-screen'),
    gameArea: document.getElementById('game-area'),
    boardWrap: document.getElementById('board-wrap'),
    pathSvg: document.getElementById('path-svg'),
    gameBoard: document.getElementById('game-board'),
    statCurrent: document.getElementById('stat-current'),
    statTime: document.getElementById('stat-time'),
    statWrong: document.getElementById('stat-wrong'),
    resultsPanel: document.getElementById('results-panel'),
    metricsGrid: document.getElementById('metrics-grid'),
    reactionBars: document.getElementById('reaction-bars'),
    btnStart: document.getElementById('btn-start'),
    btnReset: document.getElementById('btn-reset'),
    btnPlayAgain: document.getElementById('btn-play-again'),
  };

  let state = {
    size: 6,
    count: 8,
    positions: [],
    nextTarget: 1,
    wrongReleases: 0,
    startTime: null,
    segmentStartTime: null,
    reactionTimes: [],
    pathDistance: 0,
    cursorPathDistance: 0,
    dragStartPos: null,
    isDragging: false,
    timerId: null,
    completedPaths: [],
    blockedEdges: new Set(), // stores "r1,c1-r2,c2" for blocked edges
    currentValidPath: null,
  };

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function initPositions(size, count) {
    const cells = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) cells.push({ row: r, col: c });
    }
    const chosen = shuffle(cells).slice(0, count);
    return chosen.map((cell, i) => ({ num: i + 1, row: cell.row, col: cell.col }));
  }

  function getWrapRect() {
    return DOM.boardWrap ? DOM.boardWrap.getBoundingClientRect() : { left: 0, top: 0, width: 400, height: 400 };
  }

  function wrapCoords(clientX, clientY) {
    const r = getWrapRect();
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function getCellCenter(cellEl) {
    if (!cellEl) return null;
    const rect = cellEl.getBoundingClientRect();
    const wrap = getWrapRect();
    return {
      x: rect.left + rect.width / 2 - wrap.left,
      y: rect.top + rect.height / 2 - wrap.top
    };
  }

  function updateSvgSize() {
    if (!DOM.boardWrap || !DOM.pathSvg) return;
    const w = DOM.boardWrap.offsetWidth;
    const h = DOM.boardWrap.offsetHeight;
    DOM.pathSvg.setAttribute('width', w);
    DOM.pathSvg.setAttribute('height', h);
    DOM.pathSvg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
  }

  function edgeKey(r1, c1, r2, c2) {
    // Normalize edge representation (smaller coord first)
    if (r1 > r2 || (r1 === r2 && c1 > c2)) {
      return r2 + ',' + c2 + '-' + r1 + ',' + c1;
    }
    return r1 + ',' + c1 + '-' + r2 + ',' + c2;
  }

  function blockEdgesFromPath(pathCells) {
    // Block all edges along the path
    for (let i = 0; i < pathCells.length - 1; i++) {
      const a = pathCells[i], b = pathCells[i + 1];
      state.blockedEdges.add(edgeKey(a.r, a.c, b.r, b.c));
    }
  }

  function isEdgeBlocked(r1, c1, r2, c2) {
    return state.blockedEdges.has(edgeKey(r1, c1, r2, c2));
  }

  function drawCompletedPaths() {
    if (!DOM.pathSvg) return;
    const ns = 'http://www.w3.org/2000/svg';
    let group = DOM.pathSvg.querySelector('g.completed');
    if (!group) {
      group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'completed');
      DOM.pathSvg.appendChild(group);
    }
    group.innerHTML = '';
    
    state.completedPaths.forEach(function (points) {
      if (points.length < 2) return;
      
      const path = document.createElementNS(ns, 'polyline');
      const pointsStr = points.map(p => `${p.x},${p.y}`).join(' ');
      path.setAttribute('points', pointsStr);
      path.setAttribute('stroke', 'var(--dot-active)');
      path.setAttribute('stroke-width', '12');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('fill', 'none');
      group.appendChild(path);
    });
  }

  function drawLivePath(pathPoints) {
    if (!DOM.pathSvg || !pathPoints || pathPoints.length < 2) return;
    const ns = 'http://www.w3.org/2000/svg';
    let group = DOM.pathSvg.querySelector('g.live');
    if (!group) {
      group = document.createElementNS(ns, 'g');
      group.setAttribute('class', 'live');
      DOM.pathSvg.appendChild(group);
    }
    group.innerHTML = '';
    
    // Draw smooth path following cursor
    const path = document.createElementNS(ns, 'polyline');
    const points = pathPoints.map(p => `${p.x},${p.y}`).join(' ');
    path.setAttribute('points', points);
    path.setAttribute('stroke', '#4CAF50');
    path.setAttribute('stroke-width', '8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('opacity', '0.7');
    group.appendChild(path);
  }

  function hideLivePath() {
    const group = DOM.pathSvg.querySelector('g.live');
    if (group) group.innerHTML = '';
  }

  function getCellAt(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const cell = el.closest('.cell[data-num]');
    return cell ? parseInt(cell.dataset.num, 10) : null;
  }

  function getCellElement(num) {
    const pos = state.positions.find(p => p.num === num);
    if (!pos) return null;
    return getCellByRowCol(pos.row, pos.col);
  }

  function getCellByRowCol(row, col) {
    if (!DOM.gameBoard) return null;
    return DOM.gameBoard.querySelector('[data-row="' + row + '"][data-col="' + col + '"]');
  }

  function getRowColFromPoint(clientX, clientY) {
    const el = document.elementFromPoint(clientX, clientY);
    if (!el) return null;
    const cell = el.closest('.cell[data-row][data-col]');
    if (!cell) return null;
    return {
      r: parseInt(cell.dataset.row, 10),
      c: parseInt(cell.dataset.col, 10)
    };
  }

  /** BFS: Find Manhattan path that doesn't cross blocked edges or occupied cells */
  function findPathBetween(r0, c0, r1, c1, occupiedSet) {
    const key = (r, c) => r + ',' + c;
    
    // Can't start or end in occupied cell
    if (occupiedSet.has(key(r0, c0)) || occupiedSet.has(key(r1, c1))) return null;
    
    const queue = [{ r: r0, c: c0, path: [{ r: r0, c: c0 }] }];
    const seen = new Set([key(r0, c0)]);
    const dirs = [
      { r: 0, c: 1 },  // right
      { r: 0, c: -1 }, // left
      { r: 1, c: 0 },  // down
      { r: -1, c: 0 }  // up
    ];
    
    while (queue.length) {
      const cur = queue.shift();
      
      if (cur.r === r1 && cur.c === c1) {
        return cur.path;
      }
      
      for (const dir of dirs) {
        const nr = cur.r + dir.r;
        const nc = cur.c + dir.c;
        
        // Check bounds
        if (nr < 0 || nr >= state.size || nc < 0 || nc >= state.size) continue;
        
        const k = key(nr, nc);
        
        // Check if already visited
        if (seen.has(k)) continue;
        
        // Check if edge is blocked by previous paths
        if (isEdgeBlocked(cur.r, cur.c, nr, nc)) continue;
        
        // Check if cell is occupied (but allow target cell)
        if (occupiedSet.has(k) && !(nr === r1 && nc === c1)) continue;
        
        seen.add(k);
        queue.push({ 
          r: nr, 
          c: nc, 
          path: cur.path.concat([{ r: nr, c: nc }]) 
        });
      }
    }
    
    return null; // No valid path found
  }

  function getOccupiedSetExcluding(excludeNumA, excludeNumB) {
    const key = (r, c) => r + ',' + c;
    const set = new Set();
    state.positions.forEach(p => {
      if (p.num !== excludeNumA && p.num !== excludeNumB) {
        set.add(key(p.row, p.col));
      }
    });
    return set;
  }

  function pathToPoints(pathRowsCols) {
    const points = [];
    for (const cell of pathRowsCols) {
      const cellEl = getCellByRowCol(cell.r, cell.c);
      if (cellEl) {
        const pt = getCellCenter(cellEl);
        if (pt) points.push(pt);
      }
    }
    return points;
  }

  function buildBoard() {
    DOM.gameBoard.innerHTML = '';
    DOM.pathSvg.innerHTML = '';
    state.completedPaths = [];
    state.blockedEdges.clear();
    DOM.gameBoard.className = 'game-board size-' + state.size;

    const positionByKey = {};
    state.positions.forEach(p => {
      positionByKey[`${p.row}-${p.col}`] = p.num;
    });

    for (let r = 0; r < state.size; r++) {
      for (let c = 0; c < state.size; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.dataset.row = r;
        cell.dataset.col = c;
        const num = positionByKey[`${r}-${c}`];
        if (num !== undefined) {
          const dot = document.createElement('div');
          dot.className = 'dot';
          dot.textContent = num;
          cell.appendChild(dot);
          cell.dataset.num = num;
        }
        cell.addEventListener('mousedown', onCellMouseDown);
        DOM.gameBoard.appendChild(cell);
      }
    }

    updateSvgSize();
    drawCompletedPaths();
    updateTargetHighlight();
  }

  function updateTargetHighlight() {
    DOM.gameBoard.querySelectorAll('.cell').forEach(c => {
      c.classList.remove('target', 'filled', 'drag-target');
      const n = parseInt(c.dataset.num, 10);
      if (n === state.nextTarget) {
        c.classList.add('target', 'drag-target');
      } else if (n < state.nextTarget) {
        c.classList.add('filled');
      }
    });
    DOM.statCurrent.textContent = state.nextTarget;
    DOM.statWrong.textContent = state.wrongReleases;
  }

  function startTimer() {
    if (state.timerId) clearInterval(state.timerId);
    state.timerId = setInterval(() => {
      const elapsed = (Date.now() - state.startTime) / 1000;
      DOM.statTime.textContent = elapsed.toFixed(1) + 's';
    }, 100);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function onCellMouseDown(e) {
    if (state.isDragging) return;
    const cell = e.currentTarget;
    const num = cell.dataset.num ? parseInt(cell.dataset.num, 10) : null;
    
    // Must start on the correct target
    if (!num || num !== state.nextTarget) {
      if (num) {
        cell.classList.add('wrong');
        state.wrongReleases++;
        DOM.statWrong.textContent = state.wrongReleases;
        setTimeout(() => cell.classList.remove('wrong'), 400);
      }
      return;
    }
    
    e.preventDefault();
    state.isDragging = true;
    state.segmentStartTime = Date.now();
    state.dragStartPos = getCellCenter(cell);
    if (DOM.boardWrap) DOM.boardWrap.classList.add('dragging');
    DOM.gameBoard.querySelectorAll('.cell').forEach(c => c.classList.add('dragging'));

    let lastX = e.clientX, lastY = e.clientY;
    const currentPath = [{ ...state.dragStartPos }]; // Track actual cursor path
    let lastCell = { r: parseInt(cell.dataset.row), c: parseInt(cell.dataset.col) };
    let crossedBlockedEdge = false;

    function onMove(ev) {
      const dx = ev.clientX - lastX;
      const dy = ev.clientY - lastY;
      state.cursorPathDistance += Math.abs(dx) + Math.abs(dy);
      lastX = ev.clientX;
      lastY = ev.clientY;

      // Add current cursor position to path
      const pt = wrapCoords(ev.clientX, ev.clientY);
      currentPath.push({ x: pt.x, y: pt.y });
      
      // Draw the live path as user drags
      drawLivePath(currentPath);

      // Check if cursor crossed into a new cell
      const currentCellPos = getRowColFromPoint(ev.clientX, ev.clientY);
      if (currentCellPos && (currentCellPos.r !== lastCell.r || currentCellPos.c !== lastCell.c)) {
        // Check if this edge movement crosses a blocked edge
        if (isEdgeBlocked(lastCell.r, lastCell.c, currentCellPos.r, currentCellPos.c)) {
          crossedBlockedEdge = true;
        }
        lastCell = currentCellPos;
      }
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      state.isDragging = false;
      if (DOM.boardWrap) DOM.boardWrap.classList.remove('dragging');
      DOM.gameBoard.querySelectorAll('.cell').forEach(c => c.classList.remove('dragging'));

      const nextNum = state.nextTarget + 1;
      const hitNum = getCellAt(ev.clientX, ev.clientY);
      const nextCell = getCellElement(nextNum);

      // Check if released on correct target and didn't cross blocked paths
      if (hitNum === nextNum && nextCell && !crossedBlockedEdge) {
        // Valid connection!
        const startPos = state.positions.find(p => p.num === state.nextTarget);
        const endPos = state.positions.find(p => p.num === nextNum);
        
        // Simplify path to Manhattan route for blocking
        const occupied = getOccupiedSetExcluding(state.nextTarget, nextNum);
        const pathCells = findPathBetween(startPos.row, startPos.col, endPos.row, endPos.col, occupied);
        
        if (pathCells && pathCells.length >= 2) {
          // Block edges along Manhattan path
          blockEdgesFromPath(pathCells);
          
          // Save the actual drawn path for display
          state.completedPaths.push(currentPath);
          
          // Calculate distance from actual path
          for (let i = 0; i < currentPath.length - 1; i++) {
            state.pathDistance += Math.abs(currentPath[i + 1].x - currentPath[i].x) + 
                                  Math.abs(currentPath[i + 1].y - currentPath[i].y);
          }
        } else {
          // No valid Manhattan path exists
          state.wrongReleases++;
          DOM.statWrong.textContent = state.wrongReleases;
          hideLivePath();
          state.dragStartPos = null;
          return;
        }
        
        state.reactionTimes.push(Date.now() - state.segmentStartTime);
        state.nextTarget = nextNum;
        
        hideLivePath();
        drawCompletedPaths();
        updateTargetHighlight();

        if (state.nextTarget > state.positions.length) {
          finishRound();
        }
      } else {
        // Wrong release or crossed blocked path
        state.wrongReleases++;
        DOM.statWrong.textContent = state.wrongReleases;
        hideLivePath();
      }
      
      state.dragStartPos = null;
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function finishRound() {
    stopTimer();
    const totalMs = Date.now() - state.startTime;
    showResults(totalMs);
  }

  function showResults(totalMs) {
    const totalSec = (totalMs / 1000).toFixed(1);
    const avgReaction = state.reactionTimes.length
      ? Math.round(state.reactionTimes.reduce((a, b) => a + b, 0) / state.reactionTimes.length)
      : 0;
    const minReaction = state.reactionTimes.length ? Math.min(...state.reactionTimes) : 0;
    const totalSegments = state.positions.length - 1;
    const accuracy = totalSegments + state.wrongReleases > 0
      ? Math.round((totalSegments / (totalSegments + state.wrongReleases)) * 100)
      : 100;
    const pathPx = Math.round(state.pathDistance);
    const cursorPx = Math.round(state.cursorPathDistance);

    DOM.metricsGrid.innerHTML = `
      <div class="metric-card">
        <div class="value">${totalSec}s</div>
        <div class="label">Total time</div>
      </div>
      <div class="metric-card">
        <div class="value">${avgReaction} ms</div>
        <div class="label">Avg reaction (per segment)</div>
      </div>
      <div class="metric-card">
        <div class="value">${state.wrongReleases}</div>
        <div class="label">Wrong releases</div>
      </div>
      <div class="metric-card">
        <div class="value">${accuracy}%</div>
        <div class="label">Accuracy</div>
      </div>
      <div class="metric-card">
        <div class="value">${pathPx} px</div>
        <div class="label">Path (Manhattan)</div>
      </div>
      <div class="metric-card">
        <div class="value">${cursorPx} px</div>
        <div class="label">Cursor path (attention proxy)</div>
      </div>
      <div class="metric-card">
        <div class="value">${minReaction} ms</div>
        <div class="label">Fastest reaction</div>
      </div>
    `;

    const maxR = Math.max(...state.reactionTimes, 1);
    DOM.reactionBars.innerHTML = state.reactionTimes
      .map((t, i) => {
        const h = Math.max(4, (t / maxR) * 100);
        return '<div class="reaction-bar" style="height: ' + h + '%" title="Segment ' + (i + 1) + ': ' + t + ' ms"></div>';
      })
      .join('');

    DOM.resultsPanel.classList.add('visible');
    DOM.resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function startRound() {
    state.positions = initPositions(state.size, state.count);
    state.nextTarget = 1;
    state.wrongReleases = 0;
    state.reactionTimes = [];
    state.pathDistance = 0;
    state.cursorPathDistance = 0;
    state.startTime = Date.now();
    state.completedPaths = [];
    state.blockedEdges.clear();
    DOM.resultsPanel.classList.remove('visible');
    DOM.statTime.textContent = '0.0s';
    buildBoard();
    startTimer();
    window.addEventListener('resize', updateSvgSize);
  }

  function showGame() {
    DOM.startScreen.style.display = 'none';
    DOM.gameArea.style.display = 'block';
    startRound();
  }

  DOM.btnStart.addEventListener('click', () => {
    const selected = document.querySelector('.start-screen [data-size].selected');
    if (selected) {
      state.size = parseInt(selected.dataset.size, 10);
      state.count = parseInt(selected.dataset.count, 10);
    }
    showGame();
  });

  document.querySelectorAll('.start-screen [data-size]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.start-screen [data-size]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      btn.classList.remove('btn-secondary');
      btn.classList.add('btn-primary');
      document.querySelectorAll('.start-screen [data-size]:not(.selected)').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
    });
  });

  DOM.btnReset.addEventListener('click', () => {
    window.removeEventListener('resize', updateSvgSize);
    startRound();
  });
  
  DOM.btnPlayAgain.addEventListener('click', () => {
    DOM.resultsPanel.classList.remove('visible');
    startRound();
  });

  const defaultBtn = document.querySelector('.start-screen [data-size="6"][data-count="8"]');
  if (defaultBtn) {
    defaultBtn.classList.add('selected');
    defaultBtn.classList.remove('btn-secondary');
    defaultBtn.classList.add('btn-primary');
  }
})();