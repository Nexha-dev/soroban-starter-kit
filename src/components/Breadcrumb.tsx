import React from 'react';
import { BreadcrumbItem } from '../services/navigation/types';

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  separator?: string;
}

export function Breadcrumb({ items, separator = '/' }: BreadcrumbProps): JSX.Element {
  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 0',
      fontSize: '14px',
      color: 'var(--color-text-secondary)',
    }}>
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 && <span style={{ color: 'var(--color-text-muted)' }}>{separator}</span>}
          {item.onClick ? (
            <button
              onClick={item.onClick}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: 'var(--color-highlight)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {item.label}
            </button>
          ) : (
            <span style={{
              color: index === items.length - 1 ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              fontWeight: index === items.length - 1 ? 600 : 400,
            }}>
              {item.label}
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
