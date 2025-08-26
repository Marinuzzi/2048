import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// =============== 2048 minimal (JS puro, zero dipendenze) ===============
const SIZE = 4;
const START_TILES = 2;
let _id = 0;
const uid = () => `t_${_id++}`;
const emptyGrid = () => Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => null));
const cloneGrid = (g) => g.map(row => row.map(cell => (cell ? { ...cell } : null)));
const within = (r, c) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
const getEmptyCells = (grid) => {
  const cells = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (!grid[r][c]) cells.push({ r, c });
  return cells;
};
const placeRandomTile = (grid) => {
  const empties = getEmptyCells(grid);
  if (empties.length === 0) return grid;
  const spot = empties[Math.floor(Math.random() * empties.length)];
  const value = Math.random() < 0.9 ? 2 : 4;
  const tile = { id: uid(), r: spot.r, c: spot.c, value, justSpawned: true, justMerged: false };
  const next = cloneGrid(grid);
  next[spot.r][spot.c] = tile;
  return next;
};
const canMove = (grid) => {
  if (getEmptyCells(grid).length > 0) return true;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const t = grid[r][c]; if (!t) continue;
      const right = c + 1 < SIZE ? grid[r][c + 1] : null;
      const down = r + 1 < SIZE ? grid[r + 1][c] : null;
      if ((right && right.value === t.value) || (down && down.value === t.value)) return true;
    }
  }
  return false;
};
const vector = (dir) => (dir === 'left' ? { dr:0, dc:-1 } :
                         dir === 'right' ? { dr:0, dc:1 } :
                         dir === 'up' ? { dr:-1, dc:0 } : { dr:1, dc:0 });
const traverseOrder = (dir) => {
  const rows = [...Array(SIZE).keys()], cols = [...Array(SIZE).keys()];
  if (dir === 'right') cols.reverse();
  if (dir === 'down') rows.reverse();
  return { rows, cols };
};
const moveGrid = (grid, dir) => {
  const { dr, dc } = vector(dir);
  const { rows, cols } = traverseOrder(dir);
  let moved = false, scoreGained = 0;
  const next = cloneGrid(grid).map(row => row.map(cell => (cell ? { ...cell, justMerged:false, justSpawned:false } : null)));
  for (const r of rows) for (const c of cols) {
    const tile = next[r][c]; if (!tile) continue;
    let nr = r, nc = c;
    while (true) {
      const pr = nr + dr, pc = nc + dc;
      if (!within(pr, pc)) break;
      const target = next[pr][pc];
      if (target === null) { nr = pr; nc = pc; continue; }
      if (target && target.value === tile.value && !target.justMerged && !tile.justMerged) {
        const mergedValue = tile.value * 2;
        const merged = { id: uid(), r: pr, c: pc, value: mergedValue, justMerged:true, justSpawned:false };
        next[r][c] = null; next[pr][pc] = merged; moved = true; scoreGained += mergedValue;
      }
      break;
    }
    if (next[r][c] && (nr !== r || nc !== c)) {
      const moving = next[r][c]; moving.r = nr; moving.c = nc;
      next[nr][nc] = moving; next[r][c] = null; moved = true;
    }
  }
  return { next, moved, scoreGained };
};
const colorFor = (v) => {
  const map = {2:'#fef3c7',4:'#fde68a',8:'#fdba74',16:'#fb923c',32:'#f97316',64:'#ea580c',128:'#facc15',256:'#eab308',512:'#ca8a04',1024:'#84cc16',2048:'#10b981'};
  return map[v] || '#059669';
};

export default function App() {
  const [grid, setGrid] = useState(() => { let g = emptyGrid(); for (let i=0;i<START_TILES;i++) g = placeRandomTile(g); return g; });
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => parseInt(localStorage.getItem('best-2048') || '0', 10));
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const containerRef = useRef(null);

  const tiles = useMemo(() => {
    const t = []; grid.forEach(row => row.forEach(cell => cell && t.push(cell))); return t;
  }, [grid]);

  useEffect(() => { if (tiles.some(t => t.value >= 2048) && !won) setWon(true); if (!canMove(grid)) setLost(true); }, [grid, tiles, won]);

  const reset = useCallback(() => {
    let g = emptyGrid(); for (let i=0;i<START_TILES;i++) g = placeRandomTile(g);
    setGrid(g); setScore(0); setWon(false); setLost(false);
  }, []);

  const doMove = useCallback((dir) => {
    if (lost) return;
    const { next, moved, scoreGained } = moveGrid(grid, dir);
    if (!moved) return;
    const withNew = placeRandomTile(next);
    setGrid(withNew);
    const newScore = score + scoreGained; setScore(newScore);
    if (newScore > best) { setBest(newScore); localStorage.setItem('best-2048', String(newScore)); }
  }, [grid, score, best, lost]);

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down', a:'left', d:'right', w:'up', s:'down' };
      const dir = map[e.key];
      if (dir) { e.preventDefault(); doMove(dir); }
      if ((e.key==='r'||e.key==='R') && (e.metaKey||e.ctrlKey)) { e.preventDefault(); reset(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doMove, reset]);

  // Touch
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    let startX=0, startY=0, touching=false; const threshold=30;
    const onStart = (e) => { touching=true; startX=e.touches[0].clientX; startY=e.touches[0].clientY; };
    const onMove = (e) => { if (!touching) return; const dx=e.touches[0].clientX-startX; const dy=e.touches[0].clientY-startY; if (Math.abs(dx)>Math.abs(dy)) e.preventDefault(); };
    const onEnd = (e) => { if (!touching) return; const dx=e.changedTouches[0].clientX-startX; const dy=e.changedTouches[0].clientY-startY; touching=false;
      if (Math.max(Math.abs(dx), Math.abs(dy))<threshold) return;
      const dir = Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'); doMove(dir);
    };
    el.addEventListener('touchstart', onStart, { passive:false });
    el.addEventListener('touchmove', onMove, { passive:false });
    el.addEventListener('touchend', onEnd, { passive:false });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchmove', onMove); el.removeEventListener('touchend', onEnd); };
  }, [doMove]);

  // layout helpers
  const tileSize = 78, gap = 10;
  const boardPx = tileSize * SIZE + gap * (SIZE - 1);
  const pos = (r, c) => ({ transform: `translate(${c * (tileSize + gap)}px, ${r * (tileSize + gap)}px)` });

  return (
    <div className="root">
      <div className="wrap">
        <header className="head">
          <h1>2048</h1>
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', color: '#776e65', fontStyle: 'italic' }}>
            by Francesco Marinuzzi, Ph.D.
          </p>
          <div className="stats">
            <div className="box"><div className="label">Punteggio</div><div className="val">{score}</div></div>
            <div className="box"><div className="label">Record</div><div className="val">{best}</div></div>
            <button className="btn" onClick={reset}>Nuova</button>
          </div>
        </header>

        <div className="board" style={{ width: boardPx, height: boardPx }} ref={containerRef}>
          <div className="bggrid">
            {Array.from({ length: SIZE * SIZE }).map((_, i) => <div key={i} className="bgcell" />)}
          </div>
          <div className="tiles">
            {tiles.map(t => (
              <div key={t.id} className="tile" style={{ ...pos(t.r, t.c), width: tileSize, height: tileSize, background: colorFor(t.value) }}>
                <span>{t.value}</span>
              </div>
            ))}
          </div>

          {(won || lost) && (
            <div className="overlay">
              <div className="overlay-card">
                <div className="title">{won ? '2048!' : 'Partita finita'}</div>
                <div className="subtitle">{won ? 'Hai vinto! Continua o ricomincia.' : 'Niente più mosse. Ritenta!'}</div>
                <div className="actions">
                  {won && <button className="btn" onClick={() => setWon(false)}>Continua</button>}
                  <button className="btn" onClick={reset}>Ricomincia</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <p className="hint">Usa Frecce o WASD. Tip: ⌘/Ctrl + R per ricominciare.</p>
      </div>
    </div>
  );
}