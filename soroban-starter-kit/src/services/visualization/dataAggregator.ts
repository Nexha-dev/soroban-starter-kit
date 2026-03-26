import { DataPoint } from './types';

export class DataAggregator {
  static aggregate(data: DataPoint[], interval: number): DataPoint[] {
    if (data.length === 0) return [];

    const grouped: Record<number, DataPoint[]> = {};
    data.forEach(point => {
      const bucket = Math.floor(point.timestamp / interval) * interval;
      if (!grouped[bucket]) grouped[bucket] = [];
      grouped[bucket].push(point);
    });

    return Object.entries(grouped).map(([bucket, points]) => ({
      timestamp: parseInt(bucket),
      value: points.reduce((sum, p) => sum + p.value, 0) / points.length,
      label: points[0].label,
    }));
  }

  static downsample(data: DataPoint[], maxPoints: number): DataPoint[] {
    if (data.length <= maxPoints) return data;

    const bucketSize = Math.ceil(data.length / maxPoints);
    const result: DataPoint[] = [];

    for (let i = 0; i < data.length; i += bucketSize) {
      const bucket = data.slice(i, i + bucketSize);
      const avgValue = bucket.reduce((sum, p) => sum + p.value, 0) / bucket.length;
      result.push({
        timestamp: bucket[0].timestamp,
        value: avgValue,
        label: bucket[0].label,
      });
    }

    return result;
  }

  static calculateStats(data: DataPoint[]) {
    if (data.length === 0) return { min: 0, max: 0, avg: 0, latest: 0 };

    const values = data.map(p => p.value);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      latest: values[values.length - 1],
    };
  }
}
