import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// ⚠️ Configuration
const MARKET_SOCKET_URL = "wss://trading-copy-production.up.railway.app";

interface PriceUpdate {
  symbol: string;
  price: number;
}

// 1. Stable Connection Context
interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

// 2. Volatile Market Data Context
interface MarketDataContextType {
  marketPrices: Record<string, number>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

const MarketDataContext = createContext<MarketDataContextType>({
  marketPrices: {},
});

export const useSocket = () => useContext(SocketContext);
export const useMarketData = () => useContext(MarketDataContext);

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [marketPrices, setMarketPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    // 1. Initialize Single Connection
    const newSocket = io(MARKET_SOCKET_URL, {
      transports: ['websocket', 'polling'], // Matches CRM constraints
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);

    // 2. Setup Listeners
    newSocket.on('connect', () => {
      console.log("✅ [CRM Socket] Connected to Market Feed");
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log("❌ [CRM Socket] Disconnected");
      setIsConnected(false);
    });

    newSocket.on('price_update', (update: PriceUpdate) => {
      // FIX: Check for undefined specifically to allow 0 as a valid price
      if (update && update.symbol && update.price !== undefined) {
        setMarketPrices(prev => {
           // Optimization: Only create new object if value actually changed
           // This is macro-optimization since we still setState on every tick,
           // but the CONTEXT consumption is now split.
           return {
             ...prev,
             [update.symbol]: parseFloat(update.price.toString())
           };
        });
      }
    });

    // 3. Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Memoize the stable context value
  const socketValue = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  // Market data is volatile, so it updates frequently
  // But now only components using useMarketData will re-render
  const marketValue = useMemo(() => ({ marketPrices }), [marketPrices]);

  return (
    <SocketContext.Provider value={socketValue}>
      <MarketDataContext.Provider value={marketValue}>
        {children}
      </MarketDataContext.Provider>
    </SocketContext.Provider>
  );
};
