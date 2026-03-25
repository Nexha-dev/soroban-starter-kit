import { useA11y } from '../context/A11yContext';
import { accessibilityAuditor } from '../services/a11y/accessibilityAuditor';
import { voiceCommandManager } from '../services/a11y/voiceCommandManager';
import { keyboardNavigationManager } from '../services/a11y/keyboardNavigationManager';
import { useState, useEffect } from 'react';

/**
 * Hook for accessibility settings
 */
export function useAccessibilitySettings() {
  const { settings, updateSettings } = useA11y();
  return { settings, updateSettings };
}

/**
 * Hook for running accessibility audit
 */
export function useAccessibilityAudit() {
  const [report, setReport] = useState<any>(null);
  const [isAuditing, setIsAuditing] = useState(false);

  const runAudit = async () => {
    setIsAuditing(true);
    const result = accessibilityAuditor.audit();
    setReport(result);
    setIsAuditing(false);
  };

  return { report, isAuditing, runAudit };
}

/**
 * Hook for voice commands
 */
export function useVoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  useEffect(() => {
    const unsubscribe = voiceCommandManager.subscribe((text) => {
      setTranscript(text);
    });

    return unsubscribe;
  }, []);

  const startListening = () => {
    voiceCommandManager.startListening();
    setIsListening(true);
  };

  const stopListening = () => {
    voiceCommandManager.stopListening();
    setIsListening(false);
  };

  return {
    isListening,
    transcript,
    startListening,
    stopListening,
    registerCommand: voiceCommandManager.registerCommand.bind(voiceCommandManager),
    isAvailable: voiceCommandManager.isAvailable(),
  };
}

/**
 * Hook for keyboard navigation
 */
export function useKeyboardNavigation() {
  const registerKeyHandler = (key: string, handler: (e: KeyboardEvent) => void) => {
    return keyboardNavigationManager.registerKeyHandler(key, handler);
  };

  const setFocus = (element: HTMLElement) => {
    keyboardNavigationManager.setFocus(element);
  };

  const enableFocusTrap = (element: HTMLElement) => {
    return keyboardNavigationManager.enableFocusTrap(element);
  };

  return { registerKeyHandler, setFocus, enableFocusTrap };
}
