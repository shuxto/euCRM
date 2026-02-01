import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type OverlayMode = 'transfer' | 'ftd' | 'upsale';

interface Props {
  mode: OverlayMode;
  onComplete: () => void;
}

export default function TransferOverlay({ mode, onComplete }: Props) {
  const [pieces, setPieces] = useState<any[]>([]);

  useEffect(() => {
    // 1. CONFIGURATION
    let particlesPerBurst = 50;
    let burstCount = 1;       
    let burstDelay = 0;       
    let totalDuration = 3000; 

    if (mode === 'ftd') {
        particlesPerBurst = 80; 
        burstCount = 2;         
        burstDelay = 1000;      
        totalDuration = 5000;   
    }
    if (mode === 'upsale') {
        particlesPerBurst = 120; 
        burstCount = 4;          
        burstDelay = 800;        
        totalDuration = 7000;
    }

    // 2. DETERMINE COLORS
    let colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
    if (mode === 'ftd') colors = ['#ffd700', '#10b981', '#ffffff']; 
    if (mode === 'upsale') colors = ['#ef4444', '#8b5cf6', '#ffd700', '#000000']; 

    // 3. THE BURST FUNCTION
    const fireBurst = (burstIndex: number) => {
        const newBatch = Array.from({ length: particlesPerBurst }).map((_, i) => ({
            id: `burst-${burstIndex}-${i}-${Math.random()}`,
            left: Math.random() * 100 + '%',
            animationDuration: (Math.random() * 2 + 2) + 's',
            animationDelay: '0s', 
            backgroundColor: colors[Math.floor(Math.random() * colors.length)]
        }));
        setPieces(prev => [...prev, ...newBatch]);
    };

    // 4. TRIGGER THE BOOMS
    // We use a generic type here to handle both Number (Browser) and Timeout (Node) types safely
    const timeouts: any[] = []; // <--- FIXED: Changed to any[] to avoid conflicts
    
    for (let i = 0; i < burstCount; i++) {
        // We use window.setTimeout to ensure we get the browser behavior
        const t = window.setTimeout(() => {
            fireBurst(i);
        }, i * burstDelay); 
        timeouts.push(t);
    }

    // 5. AUTO CLOSE
    const closeTimer = window.setTimeout(() => {
      onComplete();
    }, totalDuration);

    // Cleanup
    return () => {
        timeouts.forEach(t => window.clearTimeout(t));
        window.clearTimeout(closeTimer);
    };
  }, [mode, onComplete]);

  // 6. TEXT LOGIC
  let mainText = "GOOD LUCK";
  if (mode === 'ftd') mainText = "YOU ARE AMAZING";
  if (mode === 'upsale') mainText = "U ARE A BEAST";

  return createPortal(
    <div className="fixed inset-0 z-99999 flex items-center justify-center pointer-events-none overflow-hidden bg-black/40 backdrop-blur-[2px]">
      {/* CONFETTI LAYER */}
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: p.left,
            top: '-20px',
            backgroundColor: p.backgroundColor,
            animationDuration: p.animationDuration,
            animationDelay: p.animationDelay
          }}
        />
      ))}

      {/* TEXT LAYER */}
      <div className="relative z-10 flex flex-col items-center">
        <h1 className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-linear-to-r from-yellow-400 via-orange-500 to-red-500 animate-good-luck drop-shadow-[0_0_50px_rgba(234,179,8,0.5)] text-center font-mono tracking-tighter px-4">
          {mainText}
        </h1>
      </div>
    </div>,
    document.body
  );
}