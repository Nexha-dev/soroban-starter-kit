import React, { useState, useRef, useEffect } from 'react';
import { DataPoint, ChartConfig } from '../services/visualization/types';
import { DataAggregator } from '../services/visualization/dataAggregator';
import { visualizationManager } from '../services/visualization';

interface ChartProps {
  config: ChartConfig;
  data: DataPoint[];
  onZoom?: (range: [number, number]) => void;
  onPan?: (offset: number) => void;
  onExport?: () => void;
}

export function Chart({ config, data, onZoom, onPan, onExport }: ChartProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);

  const stats = DataAggregator.calculateStats(data);
  const displayData = DataAggregator.downsample(data, 100);

  useEffect(() => {
    drawChart();
  }, [displayData, zoomLevel, panOffset]);

  const drawChart = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 40;

    ctx.fillStyle = 'var(--color-bg-primary)';
    ctx.fillRect(0, 0, width, height);

    if (displayData.length === 0) return;

    const chartWidth = width - 2 * padding;
    const chartHeight = height - 2 * padding;
    const minValue = stats.min;
    const maxValue = stats.max;
    const range = maxValue - minValue || 1;

    // Draw axes
    ctx.strokeStyle = 'var(--color-border)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, height - padding);
    ctx.lineTo(width - padding, height - padding);
    ctx.stroke();

    // Draw data
    ctx.strokeStyle = config.color || 'var(--color-highlight)';
    ctx.lineWidth = 2;
    ctx.beginPath();

    displayData.forEach((point, index) => {
      const x = padding + (index / (displayData.length - 1)) * chartWidth * zoomLevel + panOffset;
      const y = height - padding - ((point.value - minValue) / range) * chartHeight;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw labels
    ctx.fillStyle = 'var(--color-text-secondary)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(config.title, width / 2, 20);
  };

  const handleWheel = async (e: React.WheelEvent) => {
    e.preventDefault();
    const newZoom = Math.max(1, zoomLevel + (e.deltaY > 0 ? -0.1 : 0.1));
    setZoomLevel(newZoom);
    await visualizationManager.recordAnalytics(config.dataKey, 'zoom');
    onZoom?.([0, newZoom]);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const delta = e.clientX - dragStart;
    setPanOffset(panOffset + delta);
    setDragStart(e.clientX);
  };

  const handleMouseUp = async () => {
    setIsDragging(false);
    await visualizationManager.recordAnalytics(config.dataKey, 'pan');
    onPan?.(panOffset);
  };

  const handleExport = async () => {
    const csv = displayData.map(p => `${p.timestamp},${p.value}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${config.title}.csv`;
    a.click();
    await visualizationManager.recordAnalytics(config.dataKey, 'export');
    onExport?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
          Min: {stats.min.toFixed(2)} | Max: {stats.max.toFixed(2)} | Avg: {stats.avg.toFixed(2)}
        </div>
        <button
          onClick={handleExport}
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
          Export
        </button>
      </div>

      <canvas
        ref={canvasRef}
        width={600}
        height={300}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          cursor: isDragging ? 'grabbing' : 'grab',
          backgroundColor: 'var(--color-bg-secondary)',
        }}
      />
    </div>
  );
}
