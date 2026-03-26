import React, { useState, useEffect } from 'react';
import { NavItem } from '../services/navigation/types';
import { navigationManager } from '../services/navigation';

interface ResponsiveNavProps {
  items: NavItem[];
  onItemClick?: (item: NavItem) => void;
  customizable?: boolean;
}

export function ResponsiveNav({ items, onItemClick, customizable = true }: ResponsiveNavProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [customOrder, setCustomOrder] = useState<string[]>(items.map(i => i.id));

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleItemClick = async (item: NavItem) => {
    await navigationManager.recordAnalytics(item.id, 'click');
    onItemClick?.(item);
    item.onClick?.();
    if (isMobile) setIsOpen(false);
  };

  const toggleExpand = (itemId: string) => {
    const updated = new Set(expandedItems);
    updated.has(itemId) ? updated.delete(itemId) : updated.add(itemId);
    setExpandedItems(updated);
  };

  const handleKeyDown = (e: React.KeyboardEvent, item: NavItem) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleItemClick(item);
    }
    if (e.key === 'ArrowDown' && item.children) {
      e.preventDefault();
      toggleExpand(item.id);
    }
  };

  const sortedItems = customOrder
    .map(id => items.find(i => i.id === id))
    .filter(Boolean) as NavItem[];

  const renderItem = (item: NavItem, depth = 0) => (
    <div key={item.id} style={{ marginLeft: `${depth * 16}px` }}>
      <div
        onClick={() => handleItemClick(item)}
        onKeyDown={(e) => handleKeyDown(e, item)}
        role="button"
        tabIndex={0}
        style={{
          padding: '10px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderRadius: '4px',
          transition: 'background-color var(--transition-fast)',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-bg-tertiary)')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {item.icon && <span>{item.icon}</span>}
          <span>{item.label}</span>
          {item.badge && (
            <span style={{
              backgroundColor: 'var(--color-highlight)',
              color: 'white',
              borderRadius: '12px',
              padding: '2px 6px',
              fontSize: '12px',
              fontWeight: 600,
            }}>
              {item.badge}
            </span>
          )}
        </span>
        {item.children && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              toggleExpand(item.id);
            }}
            style={{ fontSize: '12px' }}
          >
            {expandedItems.has(item.id) ? '−' : '+'}
          </span>
        )}
      </div>

      {item.children && expandedItems.has(item.id) && (
        <div style={{ marginTop: '4px' }}>
          {item.children.map(child => renderItem(child, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <nav style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      backgroundColor: 'var(--color-bg-secondary)',
      borderRight: '1px solid var(--color-border)',
    }}>
      {/* Mobile Toggle */}
      {isMobile && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: '12px',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            fontSize: '20px',
            textAlign: 'left',
          }}
        >
          ☰
        </button>
      )}

      {/* Menu Items */}
      <div style={{
        display: isMobile && !isOpen ? 'none' : 'flex',
        flexDirection: 'column',
        gap: '4px',
        padding: '12px',
        overflowY: 'auto',
        flex: 1,
      }}>
        {sortedItems.map(item => renderItem(item))}
      </div>

      {/* Customization Footer */}
      {customizable && !isMobile && (
        <div style={{
          padding: '12px',
          borderTop: '1px solid var(--color-border)',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          textAlign: 'center',
        }}>
          Drag to reorder
        </div>
      )}
    </nav>
  );
}
