import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// ⚠️ Configuration
// Connecting to the SAME Railway server as the Trading App
const MARKET_SOCKET_URL = "wss://trading-copy-production.up.railway.app";

interface PriceUpdate {
  symbol: string;
  price: number;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  marketPrices: Record<string, number>;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  marketPrices: {},
});

export const useSocket = () => useContext(SocketContext);

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
      if (update && update.symbol && update.price) {
        setMarketPrices(prev => ({
          ...prev,
          [update.symbol]: parseFloat(update.price.toString())
        }));
      }
    });

    // 3. Cleanup
    return () => {
      newSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected, marketPrices }}>
      {children}
    </SocketContext.Provider>
  );
};
