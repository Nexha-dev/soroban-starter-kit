import React, { useState, useEffect } from 'react';
import { DashboardLayout, DashboardWidget } from '../services/visualization/types';
import { visualizationManager } from '../services/visualization';
import { Chart } from './Chart';

interface DashboardProps {
  layout?: DashboardLayout;
  onSave?: (layout: DashboardLayout) => void;
}

export function Dashboard({ layout, onSave }: DashboardProps): JSX.Element {
  const [widgets, setWidgets] = useState<DashboardWidget[]>(layout?.widgets || []);
  const [dashboardName, setDashboardName] = useState(layout?.name || 'My Dashboard');
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = async () => {
    const newLayout: DashboardLayout = {
      id: layout?.id || `dashboard_${Date.now()}`,
      name: dashboardName,
      widgets,
      createdAt: layout?.createdAt || Date.now(),
    };
    await visualizationManager.saveDashboard(newLayout);
    onSave?.(newLayout);
    setIsEditing(false);
  };

  const handleRemoveWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  const handleAddWidget = () => {
    const newWidget: DashboardWidget = {
      id: `widget_${Date.now()}`,
      title: 'New Chart',
      chartConfig: {
        type: 'line',
        title: 'New Chart',
        dataKey: 'data',
      },
      data: [],
    };
    setWidgets([...widgets, newWidget]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px',
        backgroundColor: 'var(--color-bg-secondary)',
        borderRadius: '4px',
      }}>
        {isEditing ? (
          <input
            type="text"
            value={dashboardName}
            onChange={(e) => setDashboardName(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              color: 'var(--color-text-primary)',
              borderRadius: '4px',
              flex: 1,
            }}
          />
        ) : (
          <h2 style={{ margin: 0 }}>{dashboardName}</h2>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-success)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--color-error)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--color-accent)',
                border: 'none',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Widgets Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(600px, 1fr))',
        gap: '16px',
      }}>
        {widgets.map(widget => (
          <div
            key={widget.id}
            style={{
              padding: '16px',
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: '4px',
              border: '1px solid var(--color-border)',
              position: 'relative',
            }}
          >
            {isEditing && (
              <button
                onClick={() => handleRemoveWidget(widget.id)}
                style={{
                  position: 'absolute',
                  top: '8px',
                  right: '8px',
                  padding: '4px 8px',
                  backgroundColor: 'var(--color-error)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '12px',
                }}
              >
                ✕
              </button>
            )}
            <Chart config={widget.chartConfig} data={widget.data} />
          </div>
        ))}
      </div>

      {/* Add Widget Button */}
      {isEditing && (
        <button
          onClick={handleAddWidget}
          style={{
            padding: '12px',
            backgroundColor: 'var(--color-accent)',
            border: 'none',
            color: 'white',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          + Add Widget
        </button>
      )}
    </div>
  );
}
