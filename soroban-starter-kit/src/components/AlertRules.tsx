import React, { useState, useEffect } from 'react';
import { AlertRule } from '../services/notifications/types';
import { notificationManager } from '../services/notifications';

interface AlertRulesProps {
  onRuleAdded?: (rule: AlertRule) => void;
}

export function AlertRules({ onRuleAdded }: AlertRulesProps): JSX.Element {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    field: '',
    operator: 'equals' as const,
    value: '',
    priority: 'high' as const,
  });

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    const loaded = await notificationManager.getRules();
    setRules(loaded);
  };

  const handleAddRule = async () => {
    if (!formData.name || !formData.field || !formData.value) return;

    const rule: AlertRule = {
      id: `rule_${Date.now()}`,
      name: formData.name,
      condition: {
        field: formData.field,
        operator: formData.operator,
        value: formData.value,
      },
      action: {
        channels: ['in-app', 'push'],
        priority: formData.priority,
        category: 'alert',
      },
      enabled: true,
      createdAt: Date.now(),
    };

    await notificationManager.saveRule(rule);
    setRules([...rules, rule]);
    setFormData({ name: '', field: '', operator: 'equals', value: '', priority: 'high' });
    setShowForm(false);
    onRuleAdded?.(rule);
  };

  const handleDeleteRule = async (id: string) => {
    await notificationManager.deleteRule(id);
    setRules(rules.filter(r => r.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Alert Rules</h3>
        <button
          onClick={() => setShowForm(!showForm)}
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
          {showForm ? '✕' : '+ Add Rule'}
        </button>
      </div>

      {showForm && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', backgroundColor: 'var(--color-bg-primary)', borderRadius: '4px' }}>
          <input
            type="text"
            placeholder="Rule name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12px' }}
          />
          <input
            type="text"
            placeholder="Field name"
            value={formData.field}
            onChange={(e) => setFormData({ ...formData, field: e.target.value })}
            style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12px' }}
          />
          <select
            value={formData.operator}
            onChange={(e) => setFormData({ ...formData, operator: e.target.value as any })}
            style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12px' }}
          >
            <option value="equals">Equals</option>
            <option value="greater">Greater Than</option>
            <option value="less">Less Than</option>
            <option value="contains">Contains</option>
          </select>
          <input
            type="text"
            placeholder="Value"
            value={formData.value}
            onChange={(e) => setFormData({ ...formData, value: e.target.value })}
            style={{ padding: '6px', borderRadius: '4px', border: '1px solid var(--color-border)', fontSize: '12px' }}
          />
          <button
            onClick={handleAddRule}
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
            Create Rule
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '300px', overflowY: 'auto' }}>
        {rules.map(rule => (
          <div
            key={rule.id}
            style={{
              padding: '8px',
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: '4px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '12px',
            }}
          >
            <div>
              <div style={{ fontWeight: 600 }}>{rule.name}</div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '11px' }}>
                {rule.condition.field} {rule.condition.operator} {String(rule.condition.value)}
              </div>
            </div>
            <button
              onClick={() => handleDeleteRule(rule.id)}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--color-error)',
                border: 'none',
                color: 'white',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
