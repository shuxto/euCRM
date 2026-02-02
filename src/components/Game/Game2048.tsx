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

export default function Game2048({ onClose, currentUserRole, currentUserId }: Game2048Props) {
  // Game State
  const [grid, setGrid] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  
  // System State
  const [loading, setLoading] = useState(true);
  const [gameStatus, setGameStatus] = useState<'on' | 'off'>('on');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [myBest, setMyBest] = useState(0);
  const [dailyPlays, setDailyPlays] = useState(0);
  
  // UI State
  const [showResetConfirm, setShowResetConfirm] = useState(false); // <--- New Custom Popup State

  const isAdminOrManager = ['admin', 'manager'].includes(currentUserRole);
  const hasInitialized = useRef(false);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // 1. Load everything
    fetchSystemInfo();
    
    // 2. Realtime Listener
    const channel = supabase.channel('game_settings')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crm_settings' }, 
      (payload) => {
        if (payload.new.key === 'game_status') {
            setGameStatus(payload.new.value);
        }
        if (payload.new.key === 'last_global_reset') {
            handleGlobalResetSignal(payload.new.value);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // --- 2. GLOBAL RESET LOGIC (ROBUST) ---
  const handleGlobalResetSignal = (resetTimestamp: string) => {
     const lastAck = localStorage.getItem('crm_2048_last_reset_ack');
     
     // If the DB timestamp is newer than what we last acknowledged
     if (!lastAck || parseInt(resetTimestamp) > parseInt(lastAck)) {
         console.log("Creating new day...");
         
         const today = new Date().toISOString().split('T')[0];
         const key = `crm_2048_${currentUserId}_${today}`;
         
         // 1. Reset Local Storage
         localStorage.setItem(key, '0');
         setDailyPlays(0);
         
         // 2. Acknowledge this reset so we don't do it twice
         localStorage.setItem('crm_2048_last_reset_ack', resetTimestamp);
         
         window.dispatchEvent(new CustomEvent('crm-toast', { 
            detail: { message: 'Daily Limits Reset! GLHF!', type: 'success' } 
         }));
     }
  };

  const triggerGlobalReset = async () => {
      // Send the signal to DB
      const timestamp = Date.now().toString();
      await supabase.from('crm_settings').upsert({ key: 'last_global_reset', value: timestamp });
      setShowResetConfirm(false); // Close modal
      
      // Also reset for ME immediately
      handleGlobalResetSignal(timestamp);
  };

  // --- 3. SUPABASE FETCHING ---
  const fetchSystemInfo = async () => {
    setLoading(true);
    
    // 1. Get Settings (Status AND Reset Timestamp)
    const { data: settings } = await supabase.from('crm_settings').select('*').in('key', ['game_status', 'last_global_reset']);
    
    if (settings) {
        settings.forEach(s => {
            if (s.key === 'game_status') setGameStatus(s.value);
            if (s.key === 'last_global_reset') handleGlobalResetSignal(s.value); // Check reset on load!
        });
    }

    // 2. Calculate Local Limit AFTER checking reset
    const today = new Date().toISOString().split('T')[0];
    const key = `crm_2048_${currentUserId}_${today}`;
    const played = parseInt(localStorage.getItem(key) || '0');
    setDailyPlays(played);
    
    // 3. Load Game State or Start New
    loadSavedGame(played);

    // 4. Leaderboard
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
      
      const myScores = await supabase.from('crm_game_scores').select('score').eq('user_id', currentUserId).order('score', { ascending: false }).limit(1).single();
      if (myScores.data) setMyBest(myScores.data.score);
    }
    setLoading(false);
  };

  // --- 4. GAME ENGINE ---

  const persistState = (currentGrid: number[][], currentScore: number) => {
    const state = { grid: currentGrid, score: currentScore, gameOver: false };
    localStorage.setItem(`crm_2048_state_${currentUserId}`, JSON.stringify(state));
  };

  const clearSavedState = () => {
    localStorage.removeItem(`crm_2048_state_${currentUserId}`);
  };

  const loadSavedGame = (currentPlayed: number) => {
    const saved = localStorage.getItem(`crm_2048_state_${currentUserId}`);
    
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            setGrid(parsed.grid);
            setScore(parsed.score);
            setGameOver(false);
            return; 
        } catch (e) {
            console.error("Save file corrupted");
        }
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

    const newGrid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(0));
    addRandomTile(newGrid);
    addRandomTile(newGrid);
    setGrid(newGrid);
    setScore(0);
    setGameOver(false);
    
    persistState(newGrid, 0);
  };

  const addRandomTile = (currentGrid: number[][]) => {
    const emptyCells = [];
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (currentGrid[r][c] === 0) emptyCells.push({ r, c });
      }
    }
    if (emptyCells.length === 0) return;
    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
    currentGrid[r][c] = Math.random() < 0.9 ? 2 : 4;
  };

  const move = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (gameOver) return;
    if (gameStatus === 'off' && !isAdminOrManager) return;

    let moved = false;
    let newGrid = [...grid.map(row => [...row])];
    let addedScore = 0;

    const rotate = (matrix: number[][]) => matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
    
    if (direction === 'right') newGrid = newGrid.map(row => row.reverse());
    if (direction === 'up') newGrid = rotate(rotate(rotate(newGrid)));
    if (direction === 'down') newGrid = rotate(newGrid);

    for (let r = 0; r < SIZE; r++) {
      let row = newGrid[r].filter(val => val !== 0);
      for (let i = 0; i < row.length - 1; i++) {
        if (row[i] === row[i + 1]) {
          row[i] *= 2;
          addedScore += row[i];
          row[i + 1] = 0;
        }
      }
      row = row.filter(val => val !== 0);
      while (row.length < SIZE) row.push(0);
      
      if (JSON.stringify(newGrid[r]) !== JSON.stringify(row)) moved = true;
      newGrid[r] = row;
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
        clearSavedState();
      }
    }
  }, [grid, gameOver, gameStatus, score]);

  const canMove = (checkGrid: number[][]) => {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (checkGrid[r][c] === 0) return true;
        if (c < SIZE - 1 && checkGrid[r][c] === checkGrid[r][c + 1]) return true;
        if (r < SIZE - 1 && checkGrid[r][c] === checkGrid[r + 1][c]) return true;
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
        detail: { message: `Game System Turned ${newStatus.toUpperCase()}`, type: newStatus === 'on' ? 'success' : 'error' } 
    }));
  };

  const saveScore = async (finalScore: number) => {
    // 1. Minimum Score Check
    if (finalScore < 20) return;

    // 2. "BEST SCORE ONLY" Logic
    // If this score is NOT higher than my existing best, THROW IT AWAY.
    if (finalScore <= myBest) {
        console.log("Score not high enough to save.");
        return; 
    }

    // 3. It's a New Record! Save it.
    setMyBest(finalScore); // Update local state immediately
    fireConfetti(); // Celebrate!
    
    // 4. Update Database
    await supabase.from('crm_game_scores').insert({ user_id: currentUserId, score: finalScore });
    
    // 5. Refresh Leaderboard
    setTimeout(fetchSystemInfo, 1000); 
  };

  const fireConfetti = () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, zIndex: 99999 });
  };

  const getTileColor = (value: number) => {
    const colors: {[key: number]: string} = {
      2: 'bg-slate-700 text-white', 4: 'bg-slate-600 text-white',
      8: 'bg-orange-500 text-white', 16: 'bg-orange-600 text-white',
      32: 'bg-red-500 text-white', 64: 'bg-red-600 text-white',
      128: 'bg-yellow-500 text-white shadow-[0_0_15px_rgba(234,179,8,0.5)]',
      256: 'bg-yellow-600 text-white shadow-[0_0_15px_rgba(202,138,4,0.6)]',
      512: 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.6)]',
      1024: 'bg-green-600 text-white shadow-[0_0_20px_rgba(22,163,74,0.7)]',
      2048: 'bg-blue-600 text-white shadow-[0_0_30px_rgba(37,99,235,0.8)] animate-pulse'
    };
    return colors[value] || 'bg-slate-800';
  };

  const handleClose = () => {
    if (score > 0 && !gameOver) {
        persistState(grid, score);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-100 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-crm-bg w-full max-w-5xl rounded-3xl border border-blue-500/20 shadow-2xl overflow-hidden flex flex-col md:flex-row h-150 relative">
        
        {/* --- CUSTOM CONFIRM MODAL (Reset Limits) --- */}
        {showResetConfirm && (
            <div className="absolute inset-0 z-200 bg-black/80 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-200 rounded-3xl">
                <div className="bg-slate-800 border border-yellow-500/50 p-6 rounded-2xl max-w-md w-full text-center shadow-2xl">
                    <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Zap size={32} className="text-yellow-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Reset All Daily Limits?</h3>
                    <p className="text-sm text-gray-400 mb-6">
                        This will grant <b>10 more plays</b> to every agent in the CRM immediately. Are you sure?
                    </p>
                    <div className="flex gap-3 justify-center">
                        <button 
                            onClick={() => setShowResetConfirm(false)}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={triggerGlobalReset}
                            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg font-bold shadow-lg shadow-yellow-900/20 transition cursor-pointer flex items-center gap-2"
                        >
                            <Zap size={16} /> Yes, Reset Everyone
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- LEFT: GAME AREA --- */}
        <div className="flex-1 p-8 flex flex-col relative">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-4xl font-black text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-purple-500">2048</h2>
                    <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">Championship Edition</p>
                </div>
                <div className="flex items-center gap-3">
                    {/* ADMIN TOOLS */}
                    {isAdminOrManager && (
                        <>
                            <button 
                                onClick={toggleGameSystem}
                                className={`p-3 rounded-xl border transition flex items-center gap-2 cursor-pointer ${gameStatus === 'on' ? 'bg-green-500/10 border-green-500/30 text-green-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}
                                title={gameStatus === 'on' ? 'Turn Game OFF' : 'Turn Game ON'}
                            >
                                <Power size={18} />
                            </button>
                            
                            <button 
                                onClick={() => setShowResetConfirm(true)}
                                className="p-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition cursor-pointer"
                                title="RESET LIMITS FOR EVERYONE"
                            >
                                <Zap size={18} />
                            </button>
                        </>
                    )}
                    
                    {/* SCORE BOX */}
                    <div className="bg-slate-800 px-4 py-2 rounded-xl border border-white/10 text-center">
                        <div className="text-[10px] text-gray-400 font-bold uppercase">Score</div>
                        <div className="text-xl font-bold text-white">{score}</div>
                    </div>

                    <button onClick={handleClose} className="p-3 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition cursor-pointer">
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* GAME BOARD CONTAINER */}
            <div className="flex-1 flex items-center justify-center relative">
                
                {/* STATUS OVERLAYS */}
                {gameStatus === 'off' && !isAdminOrManager && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 rounded-xl backdrop-blur-md">
                        <Lock size={48} className="text-red-500 mb-4" />
                        <h3 className="text-2xl font-bold text-white">Game Locked</h3>
                        <p className="text-gray-400">Administrators have paused the tournament.</p>
                    </div>
                )}

                {dailyPlays >= 10 && !isAdminOrManager && !gameOver && (
                    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 rounded-xl backdrop-blur-md">
                        <Ban size={48} className="text-orange-500 mb-4" />
                        <h3 className="text-2xl font-bold text-white">Daily Limit Reached</h3>
                        <p className="text-gray-400">You've played your 10 games for today.</p>
                        <p className="text-xs text-gray-500 mt-2">Resets at midnight</p>
                    </div>
                )}

                {gameOver && (
                     <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-slate-900/90 rounded-xl backdrop-blur-md animate-in zoom-in duration-300">
                        <h3 className="text-3xl font-black text-white mb-2">GAME OVER</h3>
                        <p className="text-gray-400 mb-6">Final Score: <span className="text-blue-400 font-bold">{score}</span></p>
                        <button 
                            onClick={() => startNewGame()}
                            className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/50 flex items-center gap-2 transition hover:scale-105 cursor-pointer"
                        >
                            <RefreshCw size={18} /> Try Again
                        </button>
                    </div>
                )}

                {/* THE GRID */}
                <div 
                    className="bg-slate-800 p-3 rounded-xl shadow-2xl relative"
                    style={{ 
                        width: '340px', height: '340px', 
                        display: 'grid', gridTemplateColumns: `repeat(${SIZE}, 1fr)`, gap: '10px' 
                    }}
                >
                    {grid.map((row, r) => (
                        row.map((val, c) => (
                            <div 
                                key={`${r}-${c}`} 
                                className={`w-full h-full rounded-lg flex items-center justify-center text-2xl font-bold transition-all duration-150 transform ${val ? 'scale-100' : 'scale-100'} ${getTileColor(val)}`}
                            >
                                {val > 0 && val}
                            </div>
                        ))
                    ))}
                </div>
            </div>

            {/* FOOTER */}
            <div className="mt-6 flex justify-between items-center text-xs text-gray-500">
                <div>Use <b>Arrow Keys</b> to move tiles</div>
                
                <div className={`font-mono px-3 py-1 rounded-full ${dailyPlays >= 10 ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    Plays Left: <b>{Math.max(0, 10 - dailyPlays)}</b> {isAdminOrManager && <span className="opacity-50">(Admin)</span>}
                </div>
            </div>
        </div>

        {/* --- RIGHT: LEADERBOARD --- */}
        <div className="w-full md:w-80 bg-slate-900/50 border-l border-white/5 p-6 flex flex-col">
            <div className="flex items-center gap-2 mb-6 text-yellow-500">
                <Trophy size={20} />
                <h3 className="font-bold text-white uppercase tracking-wider text-sm">Top Agents</h3>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                {loading ? <div className="text-center text-gray-500 py-10">Loading...</div> : leaderboard.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition">
                        <div className={`w-6 font-black text-center ${idx === 0 ? 'text-yellow-400' : idx === 1 ? 'text-gray-300' : idx === 2 ? 'text-orange-400' : 'text-gray-600'}`}>
                            {idx === 0 ? <Crown size={16} /> : idx + 1}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-slate-700 overflow-hidden flex items-center justify-center shrink-0">
                            {entry.crm_users?.avatar_url ? (
                                <img src={entry.crm_users.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                                <span className="text-xs font-bold text-gray-400">{entry.crm_users?.real_name?.substring(0,2)}</span>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-white truncate">{entry.crm_users?.real_name}</div>
                            <div className="text-[10px] text-gray-500 uppercase">{entry.crm_users?.role}</div>
                        </div>
                        <div className="text-sm font-mono font-bold text-blue-400">{entry.score}</div>
                    </div>
                ))}

                {leaderboard.length === 0 && !loading && (
                    <div className="text-center text-gray-500 py-10 text-xs">No records yet. Be the first!</div>
                )}
            </div>

            {/* MY BEST */}
            <div className="mt-6 pt-6 border-t border-white/10">
                <div className="bg-linear-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 p-4 rounded-xl flex justify-between items-center">
                    <span className="text-xs font-bold text-gray-300">My Personal Best</span>
                    <span className="text-xl font-black text-white">{myBest}</span>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
}