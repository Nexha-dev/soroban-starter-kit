import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { accessibilityManager, type A11ySettings } from '../services/a11y/accessibilityManager';

interface A11yContextType {
  settings: A11ySettings;
  updateSettings: (updates: Partial<A11ySettings>) => void;
}

const A11yContext = createContext<A11yContextType | undefined>(undefined);

interface A11yProviderProps {
  children: ReactNode;
}

export function A11yProvider({ children }: A11yProviderProps): JSX.Element {
  const [settings, setSettings] = useState<A11ySettings>(accessibilityManager.getSettings());

  useEffect(() => {
    const unsubscribe = accessibilityManager.subscribe((newSettings) => {
      setSettings(newSettings);
    });

    return unsubscribe;
  }, []);

  const updateSettings = (updates: Partial<A11ySettings>) => {
    accessibilityManager.updateSettings(updates);
  };

  return (
    <A11yContext.Provider value={{ settings, updateSettings }}>
      {children}
    </A11yContext.Provider>
  );
}

export function useA11y(): A11yContextType {
  const context = useContext(A11yContext);
  if (!context) {
    throw new Error('useA11y must be used within A11yProvider');
  }
  return context;
}

export default A11yContext;
