import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface PerformanceContextType {
  isPerformanceMode: boolean;
  togglePerformanceMode: () => void;
}

const PerformanceContext = createContext<PerformanceContextType | undefined>(undefined);

export const usePerformance = () => {
  const context = useContext(PerformanceContext);
  if (!context) {
    throw new Error('usePerformance must be used within a PerformanceProvider');
  }
  return context;
};

export const PerformanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isPerformanceMode, setIsPerformanceMode] = useState(() => {
    // Default to false, or read from storage
    return localStorage.getItem('crm_performance_mode') === 'true';
  });

  useEffect(() => {
    // Apply class to body
    if (isPerformanceMode) {
      document.body.classList.add('performance-mode');
    } else {
      document.body.classList.remove('performance-mode');
    }
    // Save to storage
    localStorage.setItem('crm_performance_mode', String(isPerformanceMode));
  }, [isPerformanceMode]);

  const togglePerformanceMode = () => setIsPerformanceMode(prev => !prev);

  return (
    <PerformanceContext.Provider value={{ isPerformanceMode, togglePerformanceMode }}>
      {children}
    </PerformanceContext.Provider>
  );
};
