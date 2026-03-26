import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserPreferences, PreferenceUpdatePayload } from '../services/preferences/types';
import { preferencesManager } from '../services/preferences';

interface PreferenceContextType {
  preferences: UserPreferences | null;
  loading: boolean;
  error: string | null;
  updatePreferences: (updates: PreferenceUpdatePayload) => Promise<UserPreferences>;
  createBackup: (notes?: string) => Promise<any>;
  restoreFromBackup: (backupId: string) => Promise<UserPreferences>;
  exportPreferences: () => Promise<string>;
  importPreferences: (jsonData: string) => Promise<UserPreferences>;
  getBackups: () => Promise<any[]>;
  deleteBackup: (backupId: string) => Promise<void>;
  linkDevice: (deviceInfo: { name: string; type: 'web' | 'mobile' | 'desktop' }) => Promise<string>;
  unlinkDevice: (deviceId: string) => Promise<void>;
  getAnalytics: (limit?: number) => Promise<any[]>;
}

const PreferenceContext = createContext<PreferenceContextType | undefined>(undefined);

interface PreferenceProviderProps {
  userId: string;
  children: ReactNode;
}

export function PreferenceProvider({ userId, children }: PreferenceProviderProps) {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializePreferences();
  }, [userId]);

  const initializePreferences = async () => {
    try {
      setLoading(true);
      await preferencesManager.init();

      let prefs = await preferencesManager.getPreferences(userId);
      if (!prefs) {
        // Create default preferences for new user
        prefs = await preferencesManager.savePreferences(userId, {});
      }

      setPreferences(prefs);
      setError(null);

      // Subscribe to updates
      const unsubscribe = preferencesManager.subscribe(`preferences:${userId}`, (updated: UserPreferences) => {
        setPreferences(updated);
      });

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize preferences');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  const updatePreferences = async (updates: PreferenceUpdatePayload): Promise<UserPreferences> => {
    try {
      const updated = await preferencesManager.savePreferences(userId, updates);
      setPreferences(updated);
      return updated;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update preferences';
      setError(errorMsg);
      throw err;
    }
  };

  const createBackup = async (notes?: string) => {
    try {
      const backup = await preferencesManager.createBackup(userId, notes);
      return backup;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create backup';
      setError(errorMsg);
      throw err;
    }
  };

  const restoreFromBackup = async (backupId: string): Promise<UserPreferences> => {
    try {
      const restored = await preferencesManager.restoreFromBackup(userId, backupId);
      setPreferences(restored);
      return restored;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to restore backup';
      setError(errorMsg);
      throw err;
    }
  };

  const exportPreferences = async (): Promise<string> => {
    try {
      return await preferencesManager.exportPreferences(userId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to export preferences';
      setError(errorMsg);
      throw err;
    }
  };

  const importPreferences = async (jsonData: string): Promise<UserPreferences> => {
    try {
      const imported = await preferencesManager.importPreferences(userId, jsonData);
      setPreferences(imported);
      return imported;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import preferences';
      setError(errorMsg);
      throw err;
    }
  };

  const getBackups = async () => {
    try {
      return await preferencesManager.getBackups(userId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get backups';
      setError(errorMsg);
      throw err;
    }
  };

  const deleteBackup = async (backupId: string): Promise<void> => {
    try {
      await preferencesManager.deleteBackup(userId, backupId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete backup';
      setError(errorMsg);
      throw err;
    }
  };

  const linkDevice = async (deviceInfo: { name: string; type: 'web' | 'mobile' | 'desktop' }): Promise<string> => {
    try {
      return await preferencesManager.linkDevice(userId, deviceInfo);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to link device';
      setError(errorMsg);
      throw err;
    }
  };

  const unlinkDevice = async (deviceId: string): Promise<void> => {
    try {
      await preferencesManager.unlinkDevice(userId, deviceId);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to unlink device';
      setError(errorMsg);
      throw err;
    }
  };

  const getAnalytics = async (limit?: number) => {
    try {
      return await preferencesManager.getAnalytics(userId, limit);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to get analytics';
      setError(errorMsg);
      throw err;
    }
  };

  const value: PreferenceContextType = {
    preferences,
    loading,
    error,
    updatePreferences,
    createBackup,
    restoreFromBackup,
    exportPreferences,
    importPreferences,
    getBackups,
    deleteBackup,
    linkDevice,
    unlinkDevice,
    getAnalytics,
  };

  return <PreferenceContext.Provider value={value}>{children}</PreferenceContext.Provider>;
}

export function usePreferences(): PreferenceContextType {
  const context = useContext(PreferenceContext);
  if (!context) {
    throw new Error('usePreferences must be used within a PreferenceProvider');
  }
  return context;
}
