import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SocketProvider } from './context/SocketContext';
import { AppProvider } from './context/NotificationContext'; 
import { PerformanceProvider } from './context/PerformanceContext'; // 👈 NEW

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PerformanceProvider>
      <AppProvider> 
        <SocketProvider>
          <App />
        </SocketProvider>
      </AppProvider>
    </PerformanceProvider>
  </StrictMode>,
)
