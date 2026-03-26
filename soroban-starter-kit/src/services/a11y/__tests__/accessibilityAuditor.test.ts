import { accessibilityAuditor } from '../accessibilityAuditor';

describe('AccessibilityAuditor', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    accessibilityAuditor.clearHistory();
  });

  describe('Image Audit', () => {
    it('should detect missing alt text', () => {
      const img = document.createElement('img');
      img.src = 'test.jpg';
      document.body.appendChild(img);

      const report = accessibilityAuditor.audit();
      expect(report.errors).toBeGreaterThan(0);
      expect(report.issues.some(i => i.code === 'IMG_ALT')).toBe(true);
    });

    it('should pass with alt text', () => {
      const img = document.createElement('img');
      img.src = 'test.jpg';
      img.alt = 'Test image';
      document.body.appendChild(img);

      const report = accessibilityAuditor.audit();
      expect(report.issues.filter(i => i.code === 'IMG_ALT').length).toBe(0);
    });
  });

  describe('Button Audit', () => {
    it('should detect unlabeled buttons', () => {
      const button = document.createElement('button');
      document.body.appendChild(button);

      const report = accessibilityAuditor.audit();
      expect(report.issues.some(i => i.code === 'BUTTON_LABEL')).toBe(true);
    });

    it('should pass with button text', () => {
      const button = document.createElement('button');
      button.textContent = 'Click me';
      document.body.appendChild(button);

      const report = accessibilityAuditor.audit();
      expect(report.issues.filter(i => i.code === 'BUTTON_LABEL').length).toBe(0);
    });
  });

  describe('Form Audit', () => {
    it('should detect unlabeled inputs', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      document.body.appendChild(input);

      const report = accessibilityAuditor.audit();
      expect(report.issues.some(i => i.code === 'FORM_LABEL')).toBe(true);
    });

    it('should pass with label', () => {
      const input = document.createElement('input');
      input.id = 'test-input';
      const label = document.createElement('label');
      label.htmlFor = 'test-input';
      label.textContent = 'Test';

      document.body.appendChild(label);
      document.body.appendChild(input);

      const report = accessibilityAuditor.audit();
      expect(report.issues.filter(i => i.code === 'FORM_LABEL').length).toBe(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate audit report', () => {
      const report = accessibilityAuditor.audit();
      expect(report.timestamp).toBeGreaterThan(0);
      expect(report.wcagLevel).toBeDefined();
      expect(report.score).toBeGreaterThanOrEqual(0);
    });

    it('should maintain audit history', () => {
      accessibilityAuditor.audit();
      accessibilityAuditor.audit();

      const history = accessibilityAuditor.getHistory();
      expect(history.length).toBe(2);
    });
  });
});
