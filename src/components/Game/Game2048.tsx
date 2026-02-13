import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Trophy, RefreshCw, Power, Crown, Lock, Ban, Zap } from 'lucide-react';
import confetti from 'canvas-confetti';

interface Game2048Props {
  onClose: () => void;
  currentUserRole: string;
  currentUserId: string;
}

const SIZE = 4;
const ANIMATION_MS = 150; 

type TileObj = {
    id: number;
    val: number;
    isNew?: boolean; 
    justMerged?: boolean;
};

const getTileStyles = (value: number) => {
  const base = "font-bold rounded flex items-center justify-center select-none shadow-sm";
  const colors: {[key: number]: string} = {
    2:    'bg-[#eee4da] text-[#776e65]',
    4:    'bg-[#ede0c8] text-[#776e65]',
    8:    'bg-[#f2b179] text-white',
    16:   'bg-[#f59563] text-white',
    32:   'bg-[#f67c5f] text-white',
    64:   'bg-[#f65e3b] text-white',
    128:  'bg-[#edcf72] text-white',
    256:  'bg-[#edcc61] text-white',
    512:  'bg-[#edc850] text-white',
    1024: 'bg-[#edc53f] text-white',
    2048: 'bg-[#edc22e] text-white', 
  };
  const defaultColor = 'bg-[#3c3a32] text-white';
  return `${base} ${colors[value] || defaultColor}`;
};

export default function Game2048({ onClose, currentUserRole, currentUserId }: Game2048Props) {
  
  // --- FIX 1: INITIALIZE WITH SAFE EMPTY GRID ---
  // This prevents the "undefined" crash on first render
  const [grid, setGrid] = useState<(TileObj | null)[][]>(
    Array(SIZE).fill(null).map(() => Array(SIZE).fill(null))
  );

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  const idCounter = useRef(0);
  const getNextId = () => { idCounter.current += 1; return idCounter.current; };

  const [loading, setLoading] = useState(true);
  const [gameStatus, setGameStatus] = useState<'on' | 'off'>('on');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myBest, setMyBest] = useState(0);
  const [dailyPlays, setDailyPlays] = useState(0);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole);
  const hasInitialized = useRef(false);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    fetchSystemInfo();
    
    const channel = supabase.channel('game_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_settings' }, 
      (payload) => {
        if (payload.new.key === 'game_status') setGameStatus(payload.new.value);
        if (payload.new.key === 'last_global_reset') handleGlobalResetSignal(payload.new.value);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- 2. GLOBAL RESET LOGIC ---
  const handleGlobalResetSignal = (resetTimestamp: string) => {
     const lastAck = localStorage.getItem('crm_2048_last_reset_ack');
     if (!lastAck || parseInt(resetTimestamp) > parseInt(lastAck)) {
         const today = new Date().toISOString().split('T')[0];
         const key = `crm_2048_${currentUserId}_${today}`;
         localStorage.setItem(key, '0');
         setDailyPlays(0);
         localStorage.setItem('crm_2048_last_reset_ack', resetTimestamp);
         window.dispatchEvent(new CustomEvent('crm-toast', { 
            detail: { message: 'Daily Limits Reset!', type: 'success' } 
         }));
     }
  };

  const triggerGlobalReset = async () => {
      const timestamp = Date.now().toString();
      await supabase.from('crm_settings').upsert({ key: 'last_global_reset', value: timestamp });
      setShowResetConfirm(false);
      handleGlobalResetSignal(timestamp);
  };

  // --- 3. DATA FETCHING ---
  const fetchSystemInfo = async () => {
    setLoading(true);
    
    const { data: settings } = await supabase.from('crm_settings').select('*').in('key', ['game_status', 'last_global_reset']);
    if (settings) {
        settings.forEach(s => {
            if (s.key === 'game_status') setGameStatus(s.value);
            if (s.key === 'last_global_reset') handleGlobalResetSignal(s.value);
        });
    }

    const today = new Date().toISOString().split('T')[0];
    const key = `crm_2048_${currentUserId}_${today}`;
    const played = parseInt(localStorage.getItem(key) || '0');
    setDailyPlays(played);
    
    loadSavedGame(played);

    const { data: scores } = await supabase
      .from('crm_game_scores')
      .select('score, user_id, crm_users(real_name, role, avatar_url)')
      .order('score', { ascending: false })
      .limit(50);

    if (scores) {
      const cleanBoard = scores
        .filter((s: any) => !['admin', 'manager'].includes(s.crm_users?.role))
        .slice(0, 10);
      setLeaderboard(cleanBoard);
      
      // 🟢 FIX: Changed .single() to .maybeSingle() to prevent 406 Error
      const myScores = await supabase.from('crm_game_scores')
        .select('score')
        .eq('user_id', currentUserId)
        .order('score', { ascending: false })
        .limit(1)
        .maybeSingle(); // <--- FIXED HERE

      if (myScores.data) setMyBest(myScores.data.score);
    }
    setLoading(false);
  };

  // --- 4. GAME LOGIC ---
  const persistState = (currentGrid: (TileObj|null)[][], currentScore: number) => {
    const state = { grid: currentGrid, score: currentScore, gameOver: false };
    localStorage.setItem(`crm_2048_state_${currentUserId}`, JSON.stringify(state));
  };

  const loadSavedGame = (currentPlayed: number) => {
    const saved = localStorage.getItem(`crm_2048_state_${currentUserId}`);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // BACKWARD COMPATIBILITY: Upgrade old number[][] grids to objects
            if (Array.isArray(parsed.grid) && Array.isArray(parsed.grid[0]) && typeof parsed.grid[0][0] === 'number') {
                const upgradedGrid = parsed.grid.map((row: number[]) => 
                    row.map((val: number) => val === 0 ? null : { id: getNextId(), val })
                );
                setGrid(upgradedGrid);
            } else {
                // Determine max ID to avoid collisions
                let maxId = 0;
                parsed.grid.forEach((row: any[]) => row.forEach((c: any) => {
                    if (c && c.id > maxId) maxId = c.id;
                }));
                idCounter.current = maxId + 1;
                setGrid(parsed.grid);
            }
            setScore(parsed.score);
            setGameOver(false);
            return; 
        } catch (e) { console.error("Save corrupted, new game"); }
    }
    startNewGame(currentPlayed);
  };

  const startNewGame = (currentPlayedCount?: number) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `crm_2048_${currentUserId}_${today}`;
    let played = currentPlayedCount !== undefined ? currentPlayedCount : parseInt(localStorage.getItem(key) || '0');

    if (gameStatus === 'off' && !isAdminOrManager) return;
    if (played >= 10 && !isAdminOrManager) {
        setDailyPlays(played);
        return;
    }

    if (!isAdminOrManager) {
        played += 1;
        localStorage.setItem(key, played.toString());
        setDailyPlays(played);
    }

    // Create fresh grid
    const newGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
    addRandomTile(newGrid);
    addRandomTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    persistState(newGrid, 0);
  };

  const addRandomTile = (currentGrid: (TileObj|null)[][]) => {
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!currentGrid[r][c]) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length === 0) return;
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    
    currentGrid[r][c] = { 
        id: getNextId(), 
        val: Math.random() < 0.9 ? 2 : 4,
        isNew: true 
    };
  };

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;
    if (gameStatus === 'off' && !isAdminOrManager) return;

    let moved = false;
    let newGrid = grid.map(row => [...row]);
    let addedScore = 0;

    const rotate = (matrix: (TileObj|null)[][]) => 
        matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());

    if (direction === 'right') newGrid = newGrid.map(row => row.reverse());
    if (direction === 'up') newGrid = rotate(rotate(rotate(newGrid)));
    if (direction === 'down') newGrid = rotate(newGrid);

    for (let r = 0; r < SIZE; r++) {
      let row = newGrid[r].filter(tile => tile !== null) as TileObj[];
      
      const newRow: (TileObj|null)[] = [];
      let skip = false;

      for (let i = 0; i < row.length; i++) {
        if (skip) { skip = false; continue; }

        if (i < row.length - 1 && row[i].val === row[i + 1].val) {
            const mergedTile = {
                id: row[i].id, 
                val: row[i].val * 2,
                justMerged: true
            };
            addedScore += mergedTile.val;
            newRow.push(mergedTile);
            skip = true;
        } else {
            newRow.push({ ...row[i], justMerged: false, isNew: false });
        }
      }

      while (newRow.length < SIZE) newRow.push(null);

      for(let c=0; c<SIZE; c++) {
          const oldT = newGrid[r][c];
          const newT = newRow[c];
          if (oldT?.id !== newT?.id || oldT?.val !== newT?.val) moved = true;
      }
      
      newGrid[r] = newRow;
    }

    if (direction === 'right') newGrid = newGrid.map(row => row.reverse());
    if (direction === 'up') newGrid = rotate(newGrid);
    if (direction === 'down') newGrid = rotate(rotate(rotate(newGrid)));

    if (moved) {
      addRandomTile(newGrid);
      setGrid(newGrid);
      const newScore = score + addedScore;
      setScore(newScore);
      persistState(newGrid, newScore);
      
      if (!canMove(newGrid)) {
        setGameOver(true);
        saveScore(newScore);
        localStorage.removeItem(`crm_2048_state_${currentUserId}`);
      }
    }
  }, [grid, gameOver, gameStatus, score]);

  const canMove = (checkGrid: (TileObj|null)[][]) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (!checkGrid[r][c]) return true;
        if (c < SIZE - 1 && checkGrid[r][c]?.val === checkGrid[r][c + 1]?.val) return true;
        if (r < SIZE - 1 && checkGrid[r][c]?.val === checkGrid[r + 1][c]?.val) return true;
      }
    }
    return false;
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      move(e.key.replace('Arrow', '').toLowerCase() as any);
    }
  }, [move]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const toggleGameSystem = async () => {
    if (!isAdminOrManager) return;
    const newStatus = gameStatus === 'on' ? 'off' : 'on';
    setGameStatus(newStatus); 
    await supabase.from('crm_settings').upsert({ key: 'game_status', value: newStatus });
    window.dispatchEvent(new CustomEvent('crm-toast', { 
        detail: { message: `Game ${newStatus.toUpperCase()}`, type: newStatus === 'on' ? 'success' : 'error' } 
    }));
  };

  const saveScore = async (finalScore: number) => {
    if (finalScore < 20) return;
    if (finalScore <= myBest) return; 

    setMyBest(finalScore); 
    fireConfetti(); 
    // This tells Supabase: "If this user exists, UPDATE their score. If not, INSERT new."
await supabase.from('crm_game_scores').upsert(
  { user_id: currentUserId, score: finalScore }, 
  { onConflict: 'user_id' }
);
    setTimeout(fetchSystemInfo, 1000); 
  };

  const fireConfetti = () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, zIndex: 99999 });
  };

  const handleClose = () => {
    if (score > 0 && !gameOver) persistState(grid, score);
    onClose();
  };

  // --- RENDER HELPERS ---
  const tilesToRender: (TileObj & { r: number; c: number })[] = [];
  
  // FIX 2: Defensive check just in case grid is somehow malformed
  if (grid && grid.length === SIZE) {
      for(let r=0; r<SIZE; r++) {
          for(let c=0; c<SIZE; c++) {
              const tile = grid[r][c];
              if(tile) {
                  tilesToRender.push({ ...tile, r, c });
              }
          }
      }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
      <div className="bg-[#1e1e1e] w-full max-w-5xl rounded-lg border border-gray-700 shadow-xl overflow-hidden flex flex-col md:flex-row h-150 relative">
        
        {/* --- CONFIRM MODAL --- */}
        {showResetConfirm && (
            <div className="absolute inset-0 z-50 bg-black/90 flex items-center justify-center p-4">
                <div className="bg-[#2d2d2d] border border-yellow-600 p-6 rounded-lg max-w-md w-full text-center">
                    <Zap size={40} className="mx-auto mb-4 text-yellow-500" />
                    <h3 className="text-xl font-bold text-white mb-2">Reset Limits?</h3>
                    <div className="flex gap-3 justify-center mt-6">
                        <button onClick={() => setShowResetConfirm(false)} className="px-4 py-2 bg-gray-600 text-white rounded font-bold">Cancel</button>
                        <button onClick={triggerGlobalReset} className="px-4 py-2 bg-yellow-600 text-white rounded font-bold">Confirm</button>
                    </div>
                </div>
            </div>
        )}

        {/* --- LEFT: GAME AREA --- */}
        <div className="flex-1 p-8 flex flex-col relative bg-[#1e1e1e]">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-4xl font-black text-white">2048</h2>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Smooth Mode</p>
                </div>
                <div className="flex items-center gap-3">
                    {isAdminOrManager && (
                        <>
                            <button onClick={toggleGameSystem} className={`p-2 rounded border ${gameStatus === 'on' ? 'bg-green-900 border-green-700 text-green-400' : 'bg-red-900 border-red-700 text-red-400'}`}>
                                <Power size={20} />
                            </button>
                            <button onClick={() => setShowResetConfirm(true)} className="p-2 rounded border border-yellow-700 bg-yellow-900 text-yellow-400">
                                <Zap size={20} />
                            </button>
                        </>
                    )}
                    <div className="bg-[#bbada0] px-4 py-2 rounded text-center min-w-25">
                        <div className="text-[10px] text-[#eee4da] font-bold uppercase">Score</div>
                        <div className="text-xl font-bold text-white">{score}</div>
                    </div>
                    <button onClick={handleClose} className="p-2 hover:bg-white/10 rounded text-gray-400 hover:text-white transition">
                        <X size={28} />
                    </button>
                </div>
            </div>

            {/* GAME BOARD */}
            <div className="flex-1 flex items-center justify-center relative">
                
                {(gameStatus === 'off' && !isAdminOrManager) && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#1e1e1e]/95">
                        <Lock size={48} className="text-red-500 mb-4" />
                        <h3 className="text-2xl font-bold text-white">Locked</h3>
                    </div>
                )}

                {(dailyPlays >= 10 && !isAdminOrManager && !gameOver) && (
                    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#1e1e1e]/95">
                        <Ban size={48} className="text-orange-500 mb-4" />
                        <h3 className="text-2xl font-bold text-white">Limit Reached</h3>
                    </div>
                )}

                {gameOver && (
                      <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#1e1e1e]/90 animate-in fade-in duration-300">
                        <h3 className="text-4xl font-black text-white mb-2">GAME OVER</h3>
                        <p className="text-gray-400 mb-6">Score: <span className="text-white font-bold">{score}</span></p>
                        <button onClick={() => startNewGame()} className="px-6 py-3 bg-[#8f7a66] hover:bg-[#7f6a56] text-white rounded font-bold flex items-center gap-2">
                            <RefreshCw size={18} /> Try Again
                        </button>
                    </div>
                )}

                {/* THE GRID CONTAINER */}
                <div 
                    className="bg-[#bbada0] p-3 rounded-lg relative select-none"
                    style={{ 
                        width: '380px', height: '380px',
                        boxSizing: 'content-box'
                    }}
                >
                    {/* BACKGROUND GRID */}
                    <div 
                        style={{ 
                            display: 'grid', 
                            gridTemplateColumns: `repeat(${SIZE}, 1fr)`, 
                            gap: '12px',
                            width: '100%', height: '100%',
                            position: 'absolute', top: 0, left: 0, padding: '12px'
                        }}
                    >
                        {Array(SIZE * SIZE).fill(0).map((_, i) => (
                            <div key={i} className="bg-[#cdc1b4] rounded w-full h-full" />
                        ))}
                    </div>

                    {/* FOREGROUND TILES */}
                    <div className="relative w-full h-full">
                        {tilesToRender.map((tile) => {
                            return (
                                <div
                                    key={tile.id} 
                                    className={`absolute transition-all ease-in-out flex items-center justify-center`}
                                    style={{
                                        top: `calc(${tile.r * 25}% + ${tile.r === 0 ? 0 : tile.r === 1 ? 0.75 : tile.r === 2 ? 1.5 : 2.25}px)`, 
                                        left: `calc(${tile.c * 25}% + ${tile.c === 0 ? 0 : tile.c === 1 ? 0.75 : tile.c === 2 ? 1.5 : 2.25}px)`,
                                        width: '23%', 
                                        height: '23%',
                                        transitionDuration: `${ANIMATION_MS}ms`,
                                        zIndex: 10
                                    }}
                                >
                                    <div className={`${getTileStyles(tile.val)} w-full h-full text-3xl shadow-lg`}>
                                        {tile.val}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
            
            <div className="mt-4 flex justify-between items-center text-xs text-gray-500">
                <div>Arrow Keys to Move</div>
                <div className="font-mono text-gray-400">
                    Plays: <b className={dailyPlays >= 10 ? 'text-red-500' : 'text-green-500'}>{Math.max(0, 10 - dailyPlays)}</b>
                </div>
            </div>
        </div>

        {/* --- RIGHT: LEADERBOARD --- */}
        <div className="w-full md:w-80 bg-[#1e1e1e] border-l border-gray-800 p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6 text-yellow-500">
                <Trophy size={20} />
                <h3 className="font-bold text-white uppercase tracking-wider text-sm">Leaders</h3>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                {loading ? <div className="text-center text-gray-600 py-4">Loading...</div> : leaderboard.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-2 rounded bg-gray-800/50 border border-gray-800">
                        <div className={`w-6 font-bold text-center ${idx < 3 ? 'text-yellow-500' : 'text-gray-600'}`}>
                            {idx === 0 ? <Crown size={14} /> : idx + 1}
                        </div>
                        <div className="w-6 h-6 rounded-full bg-gray-700 overflow-hidden flex items-center justify-center shrink-0">
                            {entry.crm_users?.avatar_url ? (
                                <img src={entry.crm_users.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-[10px] text-white">{entry.crm_users?.real_name?.substring(0,1)}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-gray-300 truncate">{entry.crm_users?.real_name}</div>
                        </div>
                        <div className="text-xs font-mono text-white">{entry.score}</div>
                    </div>
                ))}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-800">
                <div className="bg-gray-800 p-3 rounded flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-400">My Best</span>
                    <span className="text-lg font-bold text-white">{myBest}</span>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}