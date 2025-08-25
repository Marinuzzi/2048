import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Trophy, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Info } from "lucide-react";

/**
 * 2048 in React (single-file component)
 * - Tailwind CSS for styling
 * - Framer Motion for smooth tile animations
 * - Keyboard (← → ↑ ↓ / WASD) + touch swipe support
 * - Score + Best score (localStorage)
 * - Pretty, modern UI
 *
 * Drop this component into any React app. It assumes Tailwind is configured.
 * Default export <Game2048 /> renders a full-page experience; use <Game2048 embed /> to fit in a container.
 */

// Board config
const SIZE = 4; // 4x4
const START_TILES = 2;
const TILE_COLORS: {
  2: "bg-amber-100 text-amber-800",
  4: "bg-amber-200 text-amber-800",
  8: "bg-orange-300 text-white",
  16: "bg-orange-400 text-white",
  32: "bg-orange-500 text-white",
  64: "bg-orange-600 text-white",
  128: "bg-yellow-400 text-white",
  256: "bg-yellow-500 text-white",
  512: "bg-yellow-600 text-white",
  1024: "bg-lime-500 text-white",
  2048: "bg-emerald-500 text-white",
};

// Utilities
const rnd = (n: number) => Math.floor(Math.random() * n);
const key = (r: number, c: number) => `${r}-${c}`;

// Tile model
interface Tile {
  id: string; // unique for animation identity
  r: number; // row 0..3
  c: number; // col 0..3
  value: number;
  mergedFrom?: [Tile, Tile];
  justMerged?: boolean;
  justSpawned?: boolean;
}

// Create an empty board
function emptyGrid(): (Tile | null)[][] {
  return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
}

function cloneGrid(grid: (Tile | null)[][]): (Tile | null)[][] {
  return grid.map(row => row.map(cell => (cell ? { ...cell } : null)));
}

function getEmptyCells(grid: (Tile | null)[][]): { r: number; c: number }[] {
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!grid[r][c]) cells.push({ r, c });
    }
  }
  return cells;
}

function placeRandomTile(grid: (Tile | null)[][]): (Tile | null)[][] {
  const empties = getEmptyCells(grid);
  if (empties.length === 0) return grid;
  const spot = empties[rnd(empties.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile: Tile = {
    id: crypto.randomUUID(),
    r: spot.r,
    c: spot.c,
    value,
    justSpawned: true,
  };
  const next = cloneGrid(grid);
  next[spot.r][spot.c] = tile;
  return next;
}

function canMove(grid: (Tile | null)[][]): boolean {
  if (getEmptyCells(grid).length > 0) return true;
  // Check merges
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c];
      if (!t) continue;
      const right = c + 1 < SIZE ? grid[r][c + 1] : null;
      const down = r + 1 < SIZE ? grid[r + 1][c] : null;
      if ((right && right.value === t.value) || (down && down.value === t.value)) return true;
    }
  }
  return false;
}

// Movement logic
type Dir = "left" | "right" | "up" | "down";

function traverseOrder(dir: Dir) {
  const rows = [...Array(SIZE).keys()];
  const cols = [...Array(SIZE).keys()];
  if (dir === "right") cols.reverse();
  if (dir === "down") rows.reverse();
  return { rows, cols };
}

function vector(dir: Dir) {
  switch (dir) {
    case "left":
      return { dr: 0, dc: -1 };
    case "right":
      return { dr: 0, dc: 1 };
    case "up":
      return { dr: -1, dc: 0 };
    case "down":
      return { dr: 1, dc: 0 };
  }
}

function within(r: number, c: number) {
  return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
}

function moveGrid(grid: (Tile | null)[][], dir: Dir) {
  const { dr, dc } = vector(dir);
  const { rows, cols } = traverseOrder(dir);
  let moved = false;
  let scoreGained = 0;
  const next = cloneGrid(grid).map(row => row.map(cell => (cell ? { ...cell, justMerged: false, justSpawned: false } : null)));

  for (const r of rows) {
    for (const c of cols) {
      const tile = next[r][c];
      if (!tile) continue;
      let nr = r;
      let nc = c;
      // move until blocked
      while (true) {
        const pr = nr + dr;
        const pc = nc + dc;
        if (!within(pr, pc)) break;
        const target = next[pr][pc];
        if (target === null) {
          nr = pr;
          nc = pc;
          continue;
        }
        // merge
        if (target && target.value === tile.value && !target.justMerged && !tile.justMerged) {
          // consume both into target position
          const mergedValue = tile.value * 2;
          const merged: Tile = {
            id: crypto.randomUUID(),
            r: pr,
            c: pc,
            value: mergedValue,
            mergedFrom: [tile, target],
            justMerged: true,
          };
          next[r][c] = null;
          next[pr][pc] = merged;
          moved = true;
          scoreGained += mergedValue;
        }
        break;
      }
      // if new cell differs, move
      if (next[r][c] && (nr !== r || nc !== c)) {
        const moving = next[r][c]!;
        moving.r = nr;
        moving.c = nc;
        next[nr][nc] = moving;
        next[r][c] = null;
        moved = true;
      }
    }
  }

  return { next, moved, scoreGained } as const;
}

function useLocalBestScore() {
  const [best, setBest] = useState<number>(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem("best-2048") : null;
    return raw ? parseInt(raw) : 0;
  });
  useEffect(() => {
    localStorage.setItem("best-2048", String(best));
  }, [best]);
  return { best, setBest };
}

export default function Game2048({ embed = false }: { embed?: boolean }) {
  const [grid, setGrid] = useState<(Tile | null)[][]>(() => {
    let g = emptyGrid();
    for (let i = 0; i < START_TILES; i++) g = placeRandomTile(g);
    return g;
  });
  const [score, setScore] = useState(0);
  const { best, setBest } = useLocalBestScore();
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Compute derived state
  const tiles = useMemo(() => {
    const t: Tile[] = [];
    grid.forEach(row => row.forEach(cell => cell && t.push(cell)));
    return t;
  }, [grid]);

  useEffect(() => {
    if (tiles.some(t => t.value >= 2048) && !won) setWon(true);
    if (!canMove(grid)) setLost(true);
  }, [grid, tiles, won]);

  const reset = useCallback(() => {
    let g = emptyGrid();
    for (let i = 0; i < START_TILES; i++) g = placeRandomTile(g);
    setGrid(g);
    setScore(0);
    setWon(false);
    setLost(false);
  }, []);

  const spawn = useCallback((g: (Tile | null)[][]) => placeRandomTile(g), []);

  const doMove = useCallback(
    (dir: Dir) => {
      if (lost) return;
      const { next, moved, scoreGained } = moveGrid(grid, dir);
      if (!moved) return;
      const withNew = spawn(next);
      setGrid(withNew);
      const newScore = score + scoreGained;
      setScore(newScore);
      if (newScore > best) setBest(newScore);
    },
    [grid, score, best, setBest, lost, spawn]
  );

  // Keyboard controls
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const map: Record<string, Dir> = {
        ArrowLeft: "left",
        ArrowRight: "right",
        ArrowUp: "up",
        ArrowDown: "down",
        a: "left",
        d: "right",
        w: "up",
        s: "down",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        doMove(dir);
      }
      if ((e.key === "r" || e.key === "R") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [doMove, reset]);

  // Touch controls (swipe)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let startX = 0,
      startY = 0,
      touching = false;

    const threshold = 30; // px

    const onStart = (e: TouchEvent) => {
      touching = true;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (!touching) return;
      // prevent scroll if mostly horizontal
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (Math.abs(dx) > Math.abs(dy)) e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      if (!touching) return;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      touching = false;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
      doMove(dir);
    };

    el.addEventListener("touchstart", onStart, { passive: false });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: false });
    return () => {
      el.removeEventListener("touchstart", onStart as any);
      el.removeEventListener("touchmove", onMove as any);
      el.removeEventListener("touchend", onEnd as any);
    };
  }, [doMove]);

  // Layout helpers
  const tileSize = 80; // px (base); we scale via CSS for responsiveness
  const gap = 10; // px

  const positionStyle = (r: number, c: number) => ({
    transform: `translate(${c * (tileSize + gap)}px, ${r * (tileSize + gap)}px)`,
  });

  const boardPx = tileSize * SIZE + gap * (SIZE - 1);

  // UI helpers
  const niceColor = (v: number) => TILE_COLORS[v] || "bg-emerald-600 text-white";

  return (
    <div
      className={
        embed
          ? "w-full h-full"
          : "min-h-screen w-full flex items-center justify-center bg-gradient-to-b from-zinc-900 via-zinc-900 to-zinc-800 text-zinc-100"
      }
    >
      <div className="w-full max-w-[560px] p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">2048</h1>
            <p className="text-zinc-400 text-sm sm:text-base mt-1 flex items-center gap-1"><Info className="w-4 h-4"/>Unisci le tessere fino a 2048. Usa le frecce o fai swipe.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-zinc-800 rounded-xl px-3 py-2 text-right">
              <div className="text-[10px] uppercase text-zinc-400">Punteggio</div>
              <div className="text-xl font-bold">{score}</div>
            </div>
            <div className="bg-zinc-800 rounded-xl px-3 py-2 text-right">
              <div className="text-[10px] uppercase text-zinc-400 flex items-center gap-1"><Trophy className="w-3 h-3"/>Record</div>
              <div className="text-xl font-bold">{best}</div>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[.98] transition px-3 py-2 font-semibold text-zinc-900 shadow-sm"
            >
              <RefreshCw className="w-4 h-4"/>
              Nuova partita
            </button>
          </div>
        </div>

        {/* Board wrapper for responsiveness */}
        <div className="[--tile:80px] [--gap:10px] sm:[--tile:92px] sm:[--gap:12px] md:[--tile:100px] md:[--gap:12px]">
          <div className="relative mx-auto"
               style={{ width: boardPx, height: boardPx }}
               ref={containerRef}
          >
            {/* Grid background */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 gap-[var(--gap)] p-0 rounded-2xl bg-zinc-800/80 backdrop-blur-sm">
              {Array.from({ length: SIZE * SIZE }).map((_, i) => (
                <div key={i} className="rounded-xl bg-zinc-700/60" />
              ))}
            </div>

            {/* Tiles (absolute with motion) */}
            <div className="absolute inset-0" style={{ padding: 0 }}>
              <AnimatePresence>
                {tiles.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ scale: t.justSpawned ? 0 : 1 }}
                    animate={{ ...positionStyle(t.r, t.c), scale: t.justMerged ? 1.1 : 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 20 }}
                    className={`absolute rounded-xl font-extrabold flex items-center justify-center shadow-lg select-none ${niceColor(
                      t.value
                    )}`}
                    style={{ width: tileSize, height: tileSize }}
                  >
                    <span className="text-2xl sm:text-3xl">{t.value}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Overlays */}
            <AnimatePresence>
              {won && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm rounded-2xl flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="text-4xl font-black mb-2">2048!</div>
                    <div className="text-zinc-300 mb-4">Hai vinto! Continua o ricomincia.</div>
                    <div className="flex gap-2 justify-center">
                      <button
                        onClick={() => setWon(false)}
                        className="rounded-xl bg-emerald-500 text-zinc-900 px-4 py-2 font-semibold hover:bg-emerald-400"
                      >Continua</button>
                      <button
                        onClick={reset}
                        className="rounded-xl bg-zinc-800 text-zinc-100 px-4 py-2 font-semibold hover:bg-zinc-700"
                      >Nuova</button>
                    </div>
                  </div>
                </motion.div>
              )}
              {lost && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-zinc-900/70 backdrop-blur-sm rounded-2xl flex items-center justify-center"
                >
                  <div className="text-center">
                    <div className="text-3xl font-black mb-2">Partita finita</div>
                    <div className="text-zinc-300 mb-4">Niente più mosse. Ritenta, sarai più fortunato.</div>
                    <button
                      onClick={reset}
                      className="rounded-xl bg-emerald-500 text-zinc-900 px-4 py-2 font-semibold hover:bg-emerald-400"
                    >Ricomincia</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Controls hint */}
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:text-sm text-zinc-300">
          <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2"><ArrowKeys/> Muovi con frecce o WASD</div>
          <div className="flex items-center gap-2 bg-zinc-800/60 rounded-xl px-3 py-2"><SwipeIcon/> Swipe su mobile</div>
        </div>

        <div className="mt-3 text-[11px] text-zinc-500">
          Tip: ⌘/Ctrl + R per ricominciare al volo.
        </div>
      </div>
    </div>
  );
}

function ArrowKeys() {
  return (
    <div className="flex items-center gap-1 text-zinc-200">
      <kbd className="kbd"><ArrowLeft className="w-3 h-3"/></kbd>
      <kbd className="kbd"><ArrowUp className="w-3 h-3"/></kbd>
      <kbd className="kbd"><ArrowDown className="w-3 h-3"/></kbd>
      <kbd className="kbd"><ArrowRight className="w-3 h-3"/></kbd>
      <style>{`.kbd{display:inline-flex;align-items:center;justify-content:center;padding:2px 6px;border-radius:8px;background:#27272a;border:1px solid #3f3f46;}`}</style>
    </div>
  )
}

function SwipeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l2.5 2.5M16.5 16.5L19 19M5 19l2.5-2.5M16.5 7.5 19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
