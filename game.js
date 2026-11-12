'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
  '#90a4ae', // N - tuerca (gris acero)
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // N - tuerca
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeBtn = document.getElementById('theme-toggle');

let gridColor = '#22222e';

let combo, maxCombo, started = false;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * (PIECES.length - 1)) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  combo = cleared ? combo + 1 : 0;
  if (combo > maxCombo) maxCombo = combo;
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  restartBtn.textContent = 'Reiniciar';
  showGameOverRecords();
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver || !started) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    hideRecordsUI();
    restartBtn.textContent = 'Reiniciar';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  started = true;
  combo = 0;
  maxCombo = 0;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hideRecordsUI();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) {
    if (e.code === 'Enter' && t.id === 'name-input') saveRecord();
    return;
  }
  if (!started) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

function applyTheme(theme) {
  const light = theme === 'light';
  document.documentElement.dataset.theme = theme;
  gridColor = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || gridColor;
  themeBtn.setAttribute('aria-pressed', String(light));
  themeBtn.setAttribute('aria-label', light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
  themeBtn.textContent = light ? '☾ Modo oscuro' : '☀ Modo claro';
  try { localStorage.setItem('theme', theme); } catch (e) { /* sin persistencia */ }
  if (current) draw();
  if (next) drawNext();
}

themeBtn.addEventListener('click', () => {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  themeBtn.blur();
});

let savedTheme = 'dark';
try { savedTheme = localStorage.getItem('theme') === 'light' ? 'light' : 'dark'; } catch (e) { /* sin persistencia */ }
applyTheme(savedTheme);

// ---- Records (localStorage 'tetris-records') ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const recordsEl = document.getElementById('records');
const nameEntry = document.getElementById('name-entry');
const nameInput = document.getElementById('name-input');
const saveRecordBtn = document.getElementById('save-record-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
let pendingEntry = false;
let resetArmed = false;

function loadRecords() {
  const empty = { top: [], bestCombo: 0, maxLines: 0 };
  try {
    const d = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!d || typeof d !== 'object') return empty;
    const top = (Array.isArray(d.top) ? d.top : [])
      .filter(e => e && typeof e.score === 'number')
      .map(e => ({
        name: String(e.name || '---').slice(0, 12),
        score: e.score, lines: +e.lines || 0, combo: +e.combo || 0, date: e.date || '',
      }))
      .sort((a, b) => b.score - a.score).slice(0, MAX_RECORDS);
    return { top, bestCombo: +d.bestCombo || 0, maxLines: +d.maxLines || 0 };
  } catch (e) { return empty; }
}

function storeRecords(data) {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(data)); } catch (e) { /* sin persistencia */ }
}

function qualifies(data) {
  return score > 0 && (data.top.length < MAX_RECORDS || score > data.top[data.top.length - 1].score);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function renderRecords(highlightDate) {
  const data = loadRecords();
  let html = '<h3>MEJORES PUNTUACIONES</h3>';
  if (!data.top.length) {
    html += '<p class="empty">Sin récords todavía</p>';
  } else {
    html += '<table><tr><th>#</th><th>NOMBRE</th><th>PUNTOS</th><th>LÍN</th><th>COMBO</th></tr>';
    data.top.forEach((e, i) => {
      const hl = highlightDate && e.date === highlightDate ? ' class="highlight"' : '';
      html += `<tr${hl}><td>${i + 1}</td><td>${escapeHTML(e.name)}</td><td>${e.score.toLocaleString()}</td><td>${e.lines}</td><td>${e.combo}</td></tr>`;
    });
    html += '</table>';
  }
  html += `<div class="stats"><span>Mejor combo: ${data.bestCombo}</span><span>Líneas máx.: ${data.maxLines}</span></div>`;
  recordsEl.innerHTML = html;
  resetRecordsBtn.classList.remove('hidden');
}

function hideRecordsUI() {
  recordsEl.innerHTML = '';
  nameEntry.classList.add('hidden');
  resetRecordsBtn.classList.add('hidden');
  pendingEntry = false;
}

function disarmReset() {
  resetArmed = false;
  resetRecordsBtn.textContent = 'Resetear records';
  resetRecordsBtn.classList.remove('confirm');
}

function showGameOverRecords() {
  disarmReset();
  const data = loadRecords();
  data.bestCombo = Math.max(data.bestCombo, maxCombo);
  data.maxLines = Math.max(data.maxLines, lines);
  storeRecords(data);
  renderRecords();
  pendingEntry = qualifies(data);
  nameEntry.classList.toggle('hidden', !pendingEntry);
  if (pendingEntry) { nameInput.value = ''; nameInput.focus(); }
}

function saveRecord() {
  if (!pendingEntry) return;
  pendingEntry = false;
  const data = loadRecords();
  const date = new Date().toISOString();
  data.top.push({ name: nameInput.value.trim().slice(0, 12) || 'Anónimo', score, lines, combo: maxCombo, date });
  data.top.sort((a, b) => b.score - a.score);
  data.top = data.top.slice(0, MAX_RECORDS);
  storeRecords(data);
  nameEntry.classList.add('hidden');
  renderRecords(date);
}

function showStartScreen() {
  init();
  cancelAnimationFrame(animId);
  started = false;
  disarmReset();
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  restartBtn.textContent = 'Jugar';
  renderRecords();
  overlay.classList.remove('hidden');
  draw();
}

saveRecordBtn.addEventListener('click', saveRecord);
resetRecordsBtn.addEventListener('click', () => {
  if (!resetArmed) {
    resetArmed = true;
    resetRecordsBtn.textContent = '¿Seguro?';
    resetRecordsBtn.classList.add('confirm');
    return;
  }
  try { localStorage.removeItem(RECORDS_KEY); } catch (e) { /* sin persistencia */ }
  disarmReset();
  renderRecords();
  if (pendingEntry) pendingEntry = qualifies(loadRecords());
  nameEntry.classList.toggle('hidden', !pendingEntry);
});

showStartScreen();
