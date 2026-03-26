import React, { useState } from 'react';
import { FilterCriteria } from '../services/search/types';

interface FilterPanelProps {
  onFilterChange: (filters: FilterCriteria) => void;
  typeOptions?: string[];
  statusOptions?: string[];
}

export function FilterPanel({
  onFilterChange,
  typeOptions = ['transfer', 'mint', 'burn', 'approve', 'escrow_fund', 'escrow_release', 'escrow_refund'],
  statusOptions = ['pending', 'syncing', 'synced', 'failed', 'conflict'],
}: FilterPanelProps): JSX.Element {
  const [filters, setFilters] = useState<FilterCriteria>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleTypeChange = (type: string) => {
    const types = filters.type || [];
    const updated = types.includes(type)
      ? types.filter(t => t !== type)
      : [...types, type];
    
    const newFilters = { ...filters, type: updated.length > 0 ? updated : undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleStatusChange = (status: string) => {
    const statuses = filters.status || [];
    const updated = statuses.includes(status)
      ? statuses.filter(s => s !== status)
      : [...statuses, status];
    
    const newFilters = { ...filters, status: updated.length > 0 ? updated : undefined };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleDateRangeChange = (start: string, end: string) => {
    const newFilters = {
      ...filters,
      dateRange: start || end ? {
        start: start ? new Date(start).getTime() : 0,
        end: end ? new Date(end).getTime() : Date.now(),
      } : undefined,
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleAmountRangeChange = (min: string, max: string) => {
    const newFilters = {
      ...filters,
      amountRange: min || max ? {
        min: parseFloat(min) || 0,
        max: parseFloat(max) || Infinity,
      } : undefined,
    };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const handleReset = () => {
    setFilters({});
    onFilterChange({});
  };

  return (
    <div className="filter-panel" style={{ padding: '12px', backgroundColor: 'var(--color-bg-secondary)', borderRadius: '4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Filters</h3>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="btn btn-secondary"
          style={{ padding: '4px 8px', fontSize: '12px' }}
        >
          {showAdvanced ? '−' : '+'}
        </button>
      </div>

      {/* Type Filter */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
          Transaction Type
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {typeOptions.map(type => (
            <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={filters.type?.includes(type) || false}
                onChange={() => handleTypeChange(type)}
              />
              {type}
            </label>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div style={{ marginBottom: '12px' }}>
        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
          Status
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {statusOptions.map(status => (
            <label key={status} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
              <input
                type="checkbox"
                checked={filters.status?.includes(status) || false}
                onChange={() => handleStatusChange(status)}
              />
              {status}
            </label>
          ))}
        </div>
      </div>

      {/* Advanced Filters */}
      {showAdvanced && (
        <>
          {/* Date Range */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Date Range
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="date"
                onChange={(e) => handleDateRangeChange(e.target.value, '')}
                style={{ flex: 1, padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
              <input
                type="date"
                onChange={(e) => handleDateRangeChange('', e.target.value)}
                style={{ flex: 1, padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
          </div>

          {/* Amount Range */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              Amount Range
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="number"
                placeholder="Min"
                onChange={(e) => handleAmountRangeChange(e.target.value, '')}
                style={{ flex: 1, padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
              <input
                type="number"
                placeholder="Max"
                onChange={(e) => handleAmountRangeChange('', e.target.value)}
                style={{ flex: 1, padding: '4px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--color-border)' }}
              />
            </div>
          </div>
        </>
      )}

      {/* Reset Button */}
      <button
        onClick={handleReset}
        className="btn btn-secondary"
        style={{ width: '100%', padding: '6px', fontSize: '12px' }}
      >
        Reset Filters
      </button>
    </div>
  );
}
