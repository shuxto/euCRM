import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SocketProvider } from './context/SocketContext';
import { AppProvider } from './context/NotificationContext'; // 👈 NEW

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider> 
      <SocketProvider>
        <App />
      </SocketProvider>
    </AppProvider>
  </StrictMode>,
)
