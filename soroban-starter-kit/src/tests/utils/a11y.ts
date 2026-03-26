import React from 'react';
import { render } from '@testing-library/react';
import axe from 'axe-core';

/**
 * Assert a component has no axe accessibility violations.
 */
export async function expectNoA11yViolations(ui: React.ReactElement): Promise<void> {
  const { container } = render(ui);
  const results = await axe.run(container);
  if (results.violations.length > 0) {
    const messages = results.violations.map(v => `[${v.impact}] ${v.id}: ${v.description}`).join('\n');
    throw new Error(`Accessibility violations found:\n${messages}`);
  }
}
