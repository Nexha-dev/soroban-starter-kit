import { describe, it, expect, beforeEach } from 'vitest';
import { contrastChecker } from '../contrastChecker';
import { complianceMonitor } from '../complianceMonitor';
import { a11yFeedbackCollector } from '../feedbackCollector';
import { accessibilityAuditor } from '../accessibilityAuditor';

describe('ContrastChecker', () => {
  it('should pass AAA for black on white', () => {
    const result = contrastChecker.check('#000000', '#ffffff');
    expect(result).not.toBeNull();
    expect(result!.passesAAA).toBe(true);
    expect(result!.ratio).toBeGreaterThanOrEqual(21);
  });

  it('should fail AA for low-contrast colors', () => {
    const result = contrastChecker.check('#aaaaaa', '#bbbbbb');
    expect(result).not.toBeNull();
    expect(result!.passesAA).toBe(false);
    expect(result!.level).toBe('fail');
  });

  it('should pass AA but not AAA for mid-contrast', () => {
    // ~4.6:1 ratio
    const result = contrastChecker.check('#595959', '#ffffff');
    expect(result).not.toBeNull();
    expect(result!.passesAA).toBe(true);
  });

  it('should return null for unparseable colors', () => {
    const result = contrastChecker.check('not-a-color', '#ffffff');
    expect(result).toBeNull();
  });

  it('should audit page and return array', () => {
    const issues = contrastChecker.auditPage();
    expect(Array.isArray(issues)).toBe(true);
  });
});

describe('ComplianceMonitor', () => {
  beforeEach(() => {
    complianceMonitor.clear();
    accessibilityAuditor.clearHistory();
  });

  it('should record audit reports', () => {
    document.body.innerHTML = '<img src="x.jpg" />';
    const report = accessibilityAuditor.audit();
    complianceMonitor.record(report);
    expect(complianceMonitor.getSnapshots().length).toBe(1);
  });

  it('should track issue registry', () => {
    document.body.innerHTML = '<img src="x.jpg" />';
    const report = accessibilityAuditor.audit();
    complianceMonitor.record(report);
    const issues = complianceMonitor.getIssues();
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0].occurrences).toBe(1);
  });

  it('should increment occurrences on repeated issues', () => {
    document.body.innerHTML = '<img src="x.jpg" />';
    complianceMonitor.record(accessibilityAuditor.audit());
    complianceMonitor.record(accessibilityAuditor.audit());
    const issues = complianceMonitor.getIssues();
    const imgIssue = issues.find(i => i.code === 'IMG_ALT');
    expect(imgIssue?.occurrences).toBe(2);
  });

  it('should mark issues as resolved when absent from audit', () => {
    document.body.innerHTML = '<img src="x.jpg" />';
    complianceMonitor.record(accessibilityAuditor.audit());

    document.body.innerHTML = '<img src="x.jpg" alt="fixed" />';
    complianceMonitor.record(accessibilityAuditor.audit());

    const all = complianceMonitor.getIssues(true);
    const imgIssue = all.find(i => i.code === 'IMG_ALT');
    expect(imgIssue?.resolved).toBe(true);
  });

  it('should return stable trend with one snapshot', () => {
    document.body.innerHTML = '';
    complianceMonitor.record(accessibilityAuditor.audit());
    const trend = complianceMonitor.getTrend();
    expect(trend.direction).toBe('stable');
  });

  it('should compute average score', () => {
    document.body.innerHTML = '';
    complianceMonitor.record(accessibilityAuditor.audit());
    expect(complianceMonitor.getAverageScore()).toBeGreaterThanOrEqual(0);
  });

  it('should return top issues sorted by occurrences', () => {
    document.body.innerHTML = '<img src="x.jpg" /><button></button>';
    complianceMonitor.record(accessibilityAuditor.audit());
    complianceMonitor.record(accessibilityAuditor.audit());
    const top = complianceMonitor.getTopIssues(3);
    expect(top.length).toBeGreaterThan(0);
    if (top.length > 1) {
      expect(top[0].occurrences).toBeGreaterThanOrEqual(top[1].occurrences);
    }
  });
});

describe('A11yFeedbackCollector', () => {
  beforeEach(() => {
    a11yFeedbackCollector.clear();
  });

  it('should submit and retrieve feedback', () => {
    a11yFeedbackCollector.submit({ category: 'contrast', severity: 'major', description: 'Text is hard to read' });
    const all = a11yFeedbackCollector.getAll();
    expect(all.length).toBe(1);
    expect(all[0].category).toBe('contrast');
  });

  it('should assign unique ids', () => {
    a11yFeedbackCollector.submit({ category: 'keyboard', severity: 'minor', description: 'A' });
    a11yFeedbackCollector.submit({ category: 'keyboard', severity: 'minor', description: 'B' });
    const all = a11yFeedbackCollector.getAll();
    expect(all[0].id).not.toBe(all[1].id);
  });

  it('should resolve feedback', () => {
    const fb = a11yFeedbackCollector.submit({ category: 'other', severity: 'minor', description: 'test' });
    a11yFeedbackCollector.resolve(fb.id);
    expect(a11yFeedbackCollector.getAll().length).toBe(0);
    expect(a11yFeedbackCollector.getAll(true).length).toBe(1);
  });

  it('should return remediation guide for known issue codes', () => {
    const guide = a11yFeedbackCollector.getRemediation('IMG_ALT');
    expect(guide).not.toBeNull();
    expect(guide!.steps.length).toBeGreaterThan(0);
    expect(guide!.wcagCriteria).toContain('WCAG');
  });

  it('should return null for unknown issue codes', () => {
    expect(a11yFeedbackCollector.getRemediation('UNKNOWN_CODE')).toBeNull();
  });

  it('should return all remediation guides', () => {
    const guides = a11yFeedbackCollector.getAllRemediations();
    expect(guides.length).toBeGreaterThan(0);
  });

  it('should summarize feedback by category', () => {
    a11yFeedbackCollector.submit({ category: 'contrast', severity: 'minor', description: 'x' });
    a11yFeedbackCollector.submit({ category: 'contrast', severity: 'minor', description: 'y' });
    a11yFeedbackCollector.submit({ category: 'keyboard', severity: 'minor', description: 'z' });
    const summary = a11yFeedbackCollector.getSummary();
    expect(summary.contrast).toBe(2);
    expect(summary.keyboard).toBe(1);
  });
});
