"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PieceType = "I" | "J" | "L" | "O" | "S" | "T" | "Z";
type Cell = PieceType | null;
type Board = Cell[][];
type GameStatus = "idle" | "running" | "paused" | "gameover";
type Point = readonly [number, number];

type ActivePiece = {
  type: PieceType;
  x: number;
  y: number;
  rotation: number;
};

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const HIGH_SCORE_KEY = "tetris-afterdark-highscore";
const PIECES: PieceType[] = ["I", "J", "L", "O", "S", "T", "Z"];

const BASE_SHAPES: Record<PieceType, Point[]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
};

const COLOR_NAMES: Record<PieceType, string> = {
  I: "cyan",
  J: "blue",
  L: "orange",
  O: "yellow",
  S: "green",
  T: "purple",
  Z: "red",
};

function emptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array<Cell>(BOARD_WIDTH).fill(null));
}

function shuffledBag(): PieceType[] {
  const bag = [...PIECES];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
}

function pullNext(source: PieceType[]): [PieceType, PieceType[]] {
  const queue = [...source];
  while (queue.length < 8) queue.push(...shuffledBag());
  return [queue.shift() as PieceType, queue];
}

function spawnPiece(type: PieceType): ActivePiece {
  return { type, x: 3, y: -1, rotation: 0 };
}

function pieceCells(piece: ActivePiece): Point[] {
  if (piece.type === "O") return BASE_SHAPES.O;
  const size = piece.type === "I" ? 4 : 3;
  let points: Point[] = BASE_SHAPES[piece.type];
  for (let turn = 0; turn < piece.rotation % 4; turn += 1) {
    points = points.map(([x, y]) => [size - 1 - y, x] as Point);
  }
  return points;
}

function collides(piece: ActivePiece, board: Board): boolean {
  return pieceCells(piece).some(([cellX, cellY]) => {
    const x = piece.x + cellX;
    const y = piece.y + cellY;
    return x < 0 || x >= BOARD_WIDTH || y >= BOARD_HEIGHT || (y >= 0 && board[y][x] !== null);
  });
}

function MiniPiece({ type }: { type: PieceType | null }) {
  if (!type) return <div className="mini-grid mini-grid-empty" aria-label="Empty hold slot" />;
  const occupied = new Set(BASE_SHAPES[type].map(([x, y]) => y * 4 + x));
  const color = COLOR_NAMES[type];

  return (
    <div className="mini-grid" aria-label={`${type} piece`}>
      {Array.from({ length: 8 }, (_, index) => (
        <span key={index} className={occupied.has(index) ? `mini-cell block-${color}` : "mini-cell"} />
      ))}
    </div>
  );
}

function formatScore(value: number): string {
  return value.toString().padStart(6, "0");
}

export default function Home() {
  const [board, setBoard] = useState<Board>(() => emptyBoard());
  const [active, setActive] = useState<ActivePiece | null>(null);
  const [queue, setQueue] = useState<PieceType[]>([]);
  const [held, setHeld] = useState<PieceType | null>(null);
  const [canHold, setCanHold] = useState(true);
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [clearBurst, setClearBurst] = useState(0);
  const boardRef = useRef<HTMLDivElement>(null);

  const level = Math.floor(lines / 10) + 1;
  const fallDelay = Math.max(95, 900 - (level - 1) * 72);

  useEffect(() => {
    const saved = Number.parseInt(window.localStorage.getItem(HIGH_SCORE_KEY) ?? "0", 10);
    if (Number.isFinite(saved)) setHighScore(saved);
  }, []);

  const recordScore = useCallback((value: number) => {
    setScore(value);
    setHighScore((current) => {
      const next = Math.max(current, value);
      window.localStorage.setItem(HIGH_SCORE_KEY, String(next));
      return next;
    });
  }, []);

  const startGame = useCallback(() => {
    const seed = [...shuffledBag(), ...shuffledBag()];
    const first = seed.shift() as PieceType;
    setBoard(emptyBoard());
    setActive(spawnPiece(first));
    setQueue(seed);
    setHeld(null);
    setCanHold(true);
    setScore(0);
    setLines(0);
    setClearBurst(0);
    setStatus("running");
    window.requestAnimationFrame(() => boardRef.current?.focus());
  }, []);

  const finishGame = useCallback((finalScore: number) => {
    recordScore(finalScore);
    setActive(null);
    setStatus("gameover");
  }, [recordScore]);

  const lockPiece = useCallback((piece: ActivePiece, dropBonus = 0) => {
    const merged = board.map((row) => [...row]);
    let toppedOut = false;

    pieceCells(piece).forEach(([cellX, cellY]) => {
      const x = piece.x + cellX;
      const y = piece.y + cellY;
      if (y < 0) toppedOut = true;
      else merged[y][x] = piece.type;
    });

    if (toppedOut) {
      setBoard(merged);
      finishGame(score + dropBonus);
      return;
    }

    const remaining = merged.filter((row) => row.some((cell) => cell === null));
    const cleared = BOARD_HEIGHT - remaining.length;
    const nextBoard = [...Array.from({ length: cleared }, () => Array<Cell>(BOARD_WIDTH).fill(null)), ...remaining];
    const points = [0, 100, 300, 500, 800][cleared] * level;
    const nextScore = score + dropBonus + points;
    const nextLines = lines + cleared;
    const [nextType, nextQueue] = pullNext(queue);
    const candidate = spawnPiece(nextType);

    setBoard(nextBoard);
    recordScore(nextScore);
    setLines(nextLines);
    setQueue(nextQueue);
    setCanHold(true);
    if (cleared > 0) setClearBurst(cleared);

    if (collides(candidate, nextBoard)) finishGame(nextScore);
    else setActive(candidate);
  }, [board, finishGame, level, lines, queue, recordScore, score]);

  const stepDown = useCallback((rewardSoftDrop = false) => {
    if (status !== "running" || !active) return;
    const moved = { ...active, y: active.y + 1 };
    if (collides(moved, board)) lockPiece(active);
    else {
      setActive(moved);
      if (rewardSoftDrop) recordScore(score + 1);
    }
  }, [active, board, lockPiece, recordScore, score, status]);

  const moveHorizontal = useCallback((direction: -1 | 1) => {
    if (status !== "running" || !active) return;
    const moved = { ...active, x: active.x + direction };
    if (!collides(moved, board)) setActive(moved);
  }, [active, board, status]);

  const rotate = useCallback(() => {
    if (status !== "running" || !active || active.type === "O") return;
    const rotated = { ...active, rotation: (active.rotation + 1) % 4 };
    const kicks = [0, -1, 1, -2, 2];
    const candidate = kicks.map((kick) => ({ ...rotated, x: rotated.x + kick })).find((piece) => !collides(piece, board));
    if (candidate) setActive(candidate);
  }, [active, board, status]);

  const hardDrop = useCallback(() => {
    if (status !== "running" || !active) return;
    let landing = active;
    let distance = 0;
    while (!collides({ ...landing, y: landing.y + 1 }, board)) {
      landing = { ...landing, y: landing.y + 1 };
      distance += 1;
    }
    lockPiece(landing, distance * 2);
  }, [active, board, lockPiece, status]);

  const holdPiece = useCallback(() => {
    if (status !== "running" || !active || !canHold) return;
    let candidate: ActivePiece;

    if (held) {
      candidate = spawnPiece(held);
      setHeld(active.type);
    } else {
      const [nextType, nextQueue] = pullNext(queue);
      candidate = spawnPiece(nextType);
      setHeld(active.type);
      setQueue(nextQueue);
    }

    setCanHold(false);
    if (collides(candidate, board)) finishGame(score);
    else setActive(candidate);
  }, [active, board, canHold, finishGame, held, queue, score, status]);

  const togglePause = useCallback(() => {
    setStatus((current) => current === "running" ? "paused" : current === "paused" ? "running" : current);
    window.requestAnimationFrame(() => boardRef.current?.focus());
  }, []);

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => stepDown(false), fallDelay);
    return () => window.clearInterval(timer);
  }, [fallDelay, status, stepDown]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowdown", "arrowup", " "].includes(key)) event.preventDefault();

      if ((status === "idle" || status === "gameover") && (key === "enter" || key === " ")) {
        startGame();
        return;
      }
      if (key === "p" || key === "escape") {
        togglePause();
        return;
      }
      if (status !== "running") return;

      if (key === "arrowleft") moveHorizontal(-1);
      else if (key === "arrowright") moveHorizontal(1);
      else if (key === "arrowdown") stepDown(true);
      else if (key === "arrowup" || key === "x") rotate();
      else if (key === " ") hardDrop();
      else if (key === "c" || key === "shift") holdPiece();
    };

    window.addEventListener("keydown", onKeyDown, { passive: false });
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hardDrop, holdPiece, moveHorizontal, rotate, startGame, status, stepDown, togglePause]);

  const displayedCells = useMemo(() => {
    const result: Array<{ type: PieceType; ghost: boolean } | null> = board.flat().map((cell) => cell ? { type: cell, ghost: false } : null);
    if (!active) return result;

    let ghost = active;
    while (!collides({ ...ghost, y: ghost.y + 1 }, board)) ghost = { ...ghost, y: ghost.y + 1 };

    pieceCells(ghost).forEach(([cellX, cellY]) => {
      const x = ghost.x + cellX;
      const y = ghost.y + cellY;
      if (y >= 0 && y < BOARD_HEIGHT && !result[y * BOARD_WIDTH + x]) result[y * BOARD_WIDTH + x] = { type: ghost.type, ghost: true };
    });

    pieceCells(active).forEach(([cellX, cellY]) => {
      const x = active.x + cellX;
      const y = active.y + cellY;
      if (y >= 0 && y < BOARD_HEIGHT) result[y * BOARD_WIDTH + x] = { type: active.type, ghost: false };
    });
    return result;
  }, [active, board]);

  const overlay = status === "idle"
    ? ["Ready?", "Press New Game"]
    : status === "paused"
      ? ["Paused", "Press P to continue"]
      : status === "gameover"
        ? ["Game Over", `Score ${formatScore(score)}`]
        : null;

  return (
    <main className="arcade-shell">
      <header className="topbar glass-panel">
        <div>
          <p className="eyebrow">Classic mode · Endless</p>
          <h1><span>Tetris</span> <b>//</b> Afterdark</h1>
        </div>
        <button className="neon-button" data-testid="new-game" type="button" onClick={startGame}>
          {status === "running" || status === "paused" ? "Restart" : "New Game"}
        </button>
      </header>

      <section className="game-layout" aria-label="Tetris game">
        <aside className="stats-panel glass-panel">
          <div className="stat-block"><span>Score</span><strong data-testid="score">{formatScore(score)}</strong></div>
          <div className="stat-block"><span>High</span><strong>{formatScore(highScore)}</strong></div>
          <div className="stat-row">
            <div><span>Level</span><strong>{String(level).padStart(2, "0")}</strong></div>
            <div><span>Lines</span><strong data-testid="lines">{String(lines).padStart(2, "0")}</strong></div>
          </div>
        </aside>

        <aside className={`hold-panel glass-panel ${!canHold ? "hold-used" : ""}`}>
          <span className="panel-label">Hold</span>
          <MiniPiece type={held} />
          <span className="panel-hint">C / Shift</span>
        </aside>

        <div
          className="board-wrap"
          ref={boardRef}
          tabIndex={0}
          aria-label={`Tetris board. Game is ${status}.`}
          data-testid="board-wrap"
        >
          <div
            className={`board ${clearBurst ? "is-clearing" : ""}`}
            role="grid"
            aria-label="10 by 20 Tetris board"
            onAnimationEnd={() => setClearBurst(0)}
          >
            {displayedCells.map((cell, index) => {
              const color = cell ? COLOR_NAMES[cell.type] : null;
              const className = color
                ? cell?.ghost ? `board-cell ghost ghost-${color}` : `board-cell block-${color}`
                : "board-cell";
              return <span key={index} role="gridcell" className={className} aria-hidden="true" />;
            })}
          </div>
          {overlay && (
            <div className="board-overlay" data-testid="game-overlay">
              <span>{overlay[0]}</span>
              <small>{overlay[1]}</small>
            </div>
          )}
          {clearBurst > 0 && <div className="clear-callout">{clearBurst === 4 ? "Tetris!" : `${clearBurst} line${clearBurst > 1 ? "s" : ""}`}</div>}
        </div>

        <aside className="next-panel glass-panel">
          <span className="panel-label">Next</span>
          <div className="preview-list">
            {queue.slice(0, 4).map((type, index) => <MiniPiece key={`${type}-${index}`} type={type} />)}
            {queue.length === 0 && PIECES.slice(0, 4).map((type) => <MiniPiece key={type} type={type} />)}
          </div>
        </aside>
      </section>

      <section className="controls glass-panel" aria-label="Game controls">
        <button type="button" data-testid="move-left" onClick={() => moveHorizontal(-1)} aria-label="Move left"><kbd>←</kbd><span>Move</span></button>
        <button type="button" data-testid="move-right" onClick={() => moveHorizontal(1)} aria-label="Move right"><kbd>→</kbd><span>Move</span></button>
        <button type="button" data-testid="soft-drop" onClick={() => stepDown(true)} aria-label="Soft drop"><kbd>↓</kbd><span>Soft drop</span></button>
        <button type="button" data-testid="rotate" onClick={rotate} aria-label="Rotate clockwise"><kbd>↑</kbd><span>Rotate</span></button>
        <button type="button" data-testid="hard-drop" onClick={hardDrop} aria-label="Hard drop"><kbd>Space</kbd><span>Hard drop</span></button>
        <button type="button" data-testid="hold" onClick={holdPiece} aria-label="Hold piece"><kbd>C</kbd><span>Hold</span></button>
        <button type="button" data-testid="pause" onClick={togglePause} aria-label={status === "paused" ? "Resume game" : "Pause game"}><kbd>P</kbd><span>{status === "paused" ? "Resume" : "Pause"}</span></button>
      </section>
      <p className="footer-note">Keyboard and touch ready · High score saves on this device</p>
    </main>
  );
}
