"use strict";

const WIDTH = 10;
const HEIGHT = 20;
const HIGH_SCORE_KEY = "tetris-afterdark-highscore";
const TYPES = ["I", "J", "L", "O", "S", "T", "Z"];

const SHAPES = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
};

const COLORS = {
  I: "cyan", J: "blue", L: "orange", O: "yellow",
  S: "green", T: "purple", Z: "red",
};

const elements = {
  board: document.querySelector("#board"),
  boardWrap: document.querySelector("#board-wrap"),
  overlay: document.querySelector("#overlay"),
  overlayTitle: document.querySelector("#overlay-title"),
  overlaySubtitle: document.querySelector("#overlay-subtitle"),
  score: document.querySelector("#score"),
  highScore: document.querySelector("#high-score"),
  level: document.querySelector("#level"),
  lines: document.querySelector("#lines"),
  holdPanel: document.querySelector("#hold-panel"),
  holdPreview: document.querySelector("#hold-preview"),
  nextPreviews: document.querySelector("#next-previews"),
  newGame: document.querySelector("#new-game"),
  pauseLabel: document.querySelector("#pause-label"),
  clearCallout: document.querySelector("#clear-callout"),
  liveStatus: document.querySelector("#live-status"),
};

const boardCells = Array.from({ length: WIDTH * HEIGHT }, () => {
  const cell = document.createElement("span");
  cell.className = "board-cell";
  cell.setAttribute("role", "gridcell");
  cell.setAttribute("aria-hidden", "true");
  elements.board.append(cell);
  return cell;
});

const game = {
  board: emptyBoard(),
  active: null,
  queue: [],
  held: null,
  canHold: true,
  score: 0,
  lines: 0,
  highScore: Number.parseInt(localStorage.getItem(HIGH_SCORE_KEY) || "0", 10) || 0,
  status: "idle",
  timer: null,
};

function emptyBoard() {
  return Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(null));
}

function shuffledBag() {
  const bag = [...TYPES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [bag[index], bag[swap]] = [bag[swap], bag[index]];
  }
  return bag;
}

function pullNext() {
  while (game.queue.length < 8) game.queue.push(...shuffledBag());
  return game.queue.shift();
}

function spawn(type) {
  return { type, x: 3, y: -1, rotation: 0 };
}

function cellsFor(piece) {
  if (piece.type === "O") return SHAPES.O;
  const size = piece.type === "I" ? 4 : 3;
  let points = SHAPES[piece.type].map(([x, y]) => [x, y]);
  for (let turn = 0; turn < piece.rotation % 4; turn += 1) {
    points = points.map(([x, y]) => [size - 1 - y, x]);
  }
  return points;
}

function collides(piece, board = game.board) {
  return cellsFor(piece).some(([cellX, cellY]) => {
    const x = piece.x + cellX;
    const y = piece.y + cellY;
    return x < 0 || x >= WIDTH || y >= HEIGHT || (y >= 0 && board[y][x] !== null);
  });
}

function level() {
  return Math.floor(game.lines / 10) + 1;
}

function format(value, length = 6) {
  return String(value).padStart(length, "0");
}

function saveScore(nextScore) {
  game.score = nextScore;
  game.highScore = Math.max(game.highScore, nextScore);
  localStorage.setItem(HIGH_SCORE_KEY, String(game.highScore));
}

function startGame() {
  stopTimer();
  game.board = emptyBoard();
  game.queue = [...shuffledBag(), ...shuffledBag()];
  game.active = spawn(pullNext());
  game.held = null;
  game.canHold = true;
  game.score = 0;
  game.lines = 0;
  game.status = "running";
  elements.liveStatus.textContent = "New game started";
  render();
  startTimer();
  requestAnimationFrame(() => elements.boardWrap.focus());
}

function finishGame() {
  stopTimer();
  saveScore(game.score);
  game.active = null;
  game.status = "gameover";
  elements.liveStatus.textContent = `Game over. Score ${game.score}`;
  render();
}

function lockPiece(piece, dropBonus = 0) {
  const merged = game.board.map((row) => [...row]);
  let toppedOut = false;

  cellsFor(piece).forEach(([cellX, cellY]) => {
    const x = piece.x + cellX;
    const y = piece.y + cellY;
    if (y < 0) toppedOut = true;
    else merged[y][x] = piece.type;
  });

  if (toppedOut) {
    game.board = merged;
    saveScore(game.score + dropBonus);
    finishGame();
    return;
  }

  const remaining = merged.filter((row) => row.some((cell) => cell === null));
  const cleared = HEIGHT - remaining.length;
  game.board = [
    ...Array.from({ length: cleared }, () => Array(WIDTH).fill(null)),
    ...remaining,
  ];

  const points = [0, 100, 300, 500, 800][cleared] * level();
  saveScore(game.score + dropBonus + points);
  game.lines += cleared;
  game.canHold = true;
  game.active = spawn(pullNext());

  if (cleared > 0) showClear(cleared);
  if (collides(game.active)) {
    finishGame();
    return;
  }

  render();
  startTimer();
}

function stepDown(reward = false) {
  if (game.status !== "running" || !game.active) return;
  const moved = { ...game.active, y: game.active.y + 1 };
  if (collides(moved)) lockPiece(game.active);
  else {
    game.active = moved;
    if (reward) saveScore(game.score + 1);
    render();
  }
}

function move(direction) {
  if (game.status !== "running" || !game.active) return;
  const moved = { ...game.active, x: game.active.x + direction };
  if (!collides(moved)) {
    game.active = moved;
    render();
  }
}

function rotate() {
  if (game.status !== "running" || !game.active || game.active.type === "O") return;
  const rotated = { ...game.active, rotation: (game.active.rotation + 1) % 4 };
  const candidate = [0, -1, 1, -2, 2]
    .map((kick) => ({ ...rotated, x: rotated.x + kick }))
    .find((piece) => !collides(piece));
  if (candidate) {
    game.active = candidate;
    render();
  }
}

function hardDrop() {
  if (game.status !== "running" || !game.active) return;
  let landing = { ...game.active };
  let distance = 0;
  while (!collides({ ...landing, y: landing.y + 1 })) {
    landing.y += 1;
    distance += 1;
  }
  lockPiece(landing, distance * 2);
}

function holdPiece() {
  if (game.status !== "running" || !game.active || !game.canHold) return;
  const currentType = game.active.type;
  const nextType = game.held || pullNext();
  game.held = currentType;
  game.active = spawn(nextType);
  game.canHold = false;
  if (collides(game.active)) finishGame();
  else render();
}

function togglePause() {
  if (game.status === "running") {
    game.status = "paused";
    stopTimer();
    elements.liveStatus.textContent = "Game paused";
  } else if (game.status === "paused") {
    game.status = "running";
    startTimer();
    elements.liveStatus.textContent = "Game resumed";
  } else return;
  render();
  requestAnimationFrame(() => elements.boardWrap.focus());
}

function stopTimer() {
  if (game.timer) clearInterval(game.timer);
  game.timer = null;
}

function startTimer() {
  stopTimer();
  if (game.status !== "running") return;
  const delay = Math.max(95, 900 - (level() - 1) * 72);
  game.timer = setInterval(() => stepDown(false), delay);
}

function showClear(count) {
  elements.clearCallout.textContent = count === 4 ? "Tetris!" : `${count} line${count > 1 ? "s" : ""}`;
  elements.clearCallout.hidden = false;
  elements.board.classList.remove("is-clearing");
  void elements.board.offsetWidth;
  elements.board.classList.add("is-clearing");
  setTimeout(() => {
    elements.clearCallout.hidden = true;
    elements.board.classList.remove("is-clearing");
  }, 430);
}

function renderMini(container, type) {
  container.replaceChildren();
  container.className = `mini-grid${type ? "" : " mini-grid-empty"}`;
  container.setAttribute("aria-label", type ? `${type} piece` : "Empty hold slot");
  const occupied = type ? new Set(SHAPES[type].map(([x, y]) => y * 4 + x)) : new Set();
  for (let index = 0; index < 8; index += 1) {
    const cell = document.createElement("span");
    cell.className = occupied.has(index) ? `mini-cell block-${COLORS[type]}` : "mini-cell";
    container.append(cell);
  }
}

function renderPreviews() {
  elements.nextPreviews.replaceChildren();
  const previewTypes = game.queue.length ? game.queue.slice(0, 4) : TYPES.slice(0, 4);
  previewTypes.forEach((type) => {
    const preview = document.createElement("div");
    renderMini(preview, type);
    elements.nextPreviews.append(preview);
  });
}

function renderBoard() {
  const display = game.board.flat().map((type) => type ? { type, ghost: false } : null);

  if (game.active) {
    let ghost = { ...game.active };
    while (!collides({ ...ghost, y: ghost.y + 1 })) ghost.y += 1;

    cellsFor(ghost).forEach(([cellX, cellY]) => {
      const x = ghost.x + cellX;
      const y = ghost.y + cellY;
      if (y >= 0 && y < HEIGHT && !display[y * WIDTH + x]) {
        display[y * WIDTH + x] = { type: ghost.type, ghost: true };
      }
    });

    cellsFor(game.active).forEach(([cellX, cellY]) => {
      const x = game.active.x + cellX;
      const y = game.active.y + cellY;
      if (y >= 0 && y < HEIGHT) display[y * WIDTH + x] = { type: game.active.type, ghost: false };
    });
  }

  display.forEach((entry, index) => {
    if (!entry) boardCells[index].className = "board-cell";
    else if (entry.ghost) boardCells[index].className = `board-cell ghost ghost-${COLORS[entry.type]}`;
    else boardCells[index].className = `board-cell block-${COLORS[entry.type]}`;
  });
}

function renderOverlay() {
  const copy = {
    idle: ["Ready?", "Press New Game"],
    paused: ["Paused", "Press P to continue"],
    gameover: ["Game Over", `Score ${format(game.score)}`],
  };
  if (game.status === "running") {
    elements.overlay.hidden = true;
  } else {
    elements.overlay.hidden = false;
    [elements.overlayTitle.textContent, elements.overlaySubtitle.textContent] = copy[game.status];
  }
}

function render() {
  renderBoard();
  renderMini(elements.holdPreview, game.held);
  renderPreviews();
  renderOverlay();
  elements.score.textContent = format(game.score);
  elements.highScore.textContent = format(game.highScore);
  elements.level.textContent = format(level(), 2);
  elements.lines.textContent = format(game.lines, 2);
  elements.holdPanel.classList.toggle("hold-used", !game.canHold);
  elements.newGame.textContent = ["running", "paused"].includes(game.status) ? "Restart" : "New Game";
  elements.pauseLabel.textContent = game.status === "paused" ? "Resume" : "Pause";
  document.querySelector('[data-action="pause"]').setAttribute("aria-label", game.status === "paused" ? "Resume game" : "Pause game");
  elements.boardWrap.setAttribute("aria-label", `Tetris board. Game is ${game.status}.`);
}

const actions = {
  left: () => move(-1),
  right: () => move(1),
  down: () => stepDown(true),
  rotate,
  drop: hardDrop,
  hold: holdPiece,
  pause: togglePause,
};

elements.newGame.addEventListener("click", startGame);
document.querySelectorAll("[data-action]").forEach((button) => {
  button.addEventListener("click", () => actions[button.dataset.action]());
});

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (["arrowleft", "arrowright", "arrowdown", "arrowup", " "].includes(key)) event.preventDefault();

  if (["idle", "gameover"].includes(game.status) && ["enter", " "].includes(key)) {
    startGame();
    return;
  }
  if (["p", "escape"].includes(key)) {
    togglePause();
    return;
  }
  if (game.status !== "running") return;

  if (key === "arrowleft") move(-1);
  else if (key === "arrowright") move(1);
  else if (key === "arrowdown") stepDown(true);
  else if (["arrowup", "x"].includes(key)) rotate();
  else if (key === " ") hardDrop();
  else if (["c", "shift"].includes(key)) holdPiece();
}, { passive: false });

render();
