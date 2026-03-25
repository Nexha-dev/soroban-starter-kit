import React, { useState, useEffect } from 'react';
import { NavItem } from '../services/navigation/types';
import { navigationManager } from '../services/navigation';

interface ContextualNavProps {
  context: string;
  items: NavItem[];
  onItemClick?: (item: NavItem) => void;
}

export function ContextualNav({ context, items, onItemClick }: ContextualNavProps): JSX.Element {
  const [analytics, setAnalytics] = useState<Record<string, number>>({});

  useEffect(() => {
    const loadAnalytics = async () => {
      const data = await navigationManager.getAnalytics(1000);
      const counts: Record<string, number> = {};
      data.forEach(a => {
        counts[a.itemId] = (counts[a.itemId] || 0) + 1;
      });
      setAnalytics(counts);
    };
    loadAnalytics();
  }, []);

  const sortedItems = [...items].sort((a, b) => {
    const aCount = analytics[a.id] || 0;
    const bCount = analytics[b.id] || 0;
    return bCount - aCount;
  });

  const handleClick = async (item: NavItem) => {
    await navigationManager.recordAnalytics(item.id, 'click');
    onItemClick?.(item);
    item.onClick?.();
  };

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '12px',
      backgroundColor: 'var(--color-bg-secondary)',
      borderRadius: '4px',
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: '12px',
        color: 'var(--color-text-muted)',
        alignSelf: 'center',
        marginRight: '8px',
      }}>
        {context}:
      </span>
      {sortedItems.map(item => (
        <button
          key={item.id}
          onClick={() => handleClick(item)}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            color: 'var(--color-text-primary)',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            transition: 'all var(--transition-fast)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-accent)';
            e.currentTarget.style.borderColor = 'var(--color-highlight)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)';
            e.currentTarget.style.borderColor = 'var(--color-border)';
          }}
        >
          {item.icon && <span>{item.icon} </span>}
          {item.label}
        </button>
      ))}
    </div>
  );
}
