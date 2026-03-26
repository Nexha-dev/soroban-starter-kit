import { useA11y } from '../context/A11yContext';
import { accessibilityAuditor } from '../services/a11y/accessibilityAuditor';
import { voiceCommandManager } from '../services/a11y/voiceCommandManager';
import { keyboardNavigationManager } from '../services/a11y/keyboardNavigationManager';
import { complianceMonitor } from '../services/a11y/complianceMonitor';
import { a11yFeedbackCollector } from '../services/a11y/feedbackCollector';
import { contrastChecker } from '../services/a11y/contrastChecker';
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

/**
 * Hook for compliance monitoring
 */
export function useComplianceMonitor() {
  const [trend, setTrend] = useState(() => complianceMonitor.getTrend());
  const [topIssues, setTopIssues] = useState(() => complianceMonitor.getTopIssues());

  const refresh = () => {
    setTrend(complianceMonitor.getTrend());
    setTopIssues(complianceMonitor.getTopIssues());
  };

  return {
    trend,
    topIssues,
    averageScore: complianceMonitor.getAverageScore(),
    snapshots: complianceMonitor.getSnapshots(),
    allIssues: complianceMonitor.getIssues(),
    refresh,
  };
}

/**
 * Hook for contrast checking
 */
export function useContrastChecker() {
  const check = (fg: string, bg: string) => contrastChecker.check(fg, bg);
  const auditPage = () => contrastChecker.auditPage();
  return { check, auditPage };
}

/**
 * Hook for accessibility feedback
 */
export function useA11yFeedback() {
  const [feedback, setFeedback] = useState(() => a11yFeedbackCollector.getAll());

  const submit = (entry: Parameters<typeof a11yFeedbackCollector.submit>[0]) => {
    a11yFeedbackCollector.submit(entry);
    setFeedback(a11yFeedbackCollector.getAll());
  };

  const resolve = (id: string) => {
    a11yFeedbackCollector.resolve(id);
    setFeedback(a11yFeedbackCollector.getAll());
  };

  return {
    feedback,
    submit,
    resolve,
    summary: a11yFeedbackCollector.getSummary(),
    getRemediation: a11yFeedbackCollector.getRemediation.bind(a11yFeedbackCollector),
    allRemediations: a11yFeedbackCollector.getAllRemediations(),
  };
}
