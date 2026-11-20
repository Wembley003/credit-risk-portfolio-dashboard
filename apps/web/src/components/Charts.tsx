import { expectedLoss, formatMillionsMxn } from '@credit-risk/core';
import type { MonthPoint, Segment } from '@credit-risk/core';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DPD_BUCKETS, DPD_LABELS } from '@credit-risk/core';

const SEGMENT_COLORS = ['#2563eb', '#0891b2', '#059669', '#d97706', '#7c3aed'];
const BUCKET_COLORS: Record<string, string> = {
  '0': '#059669',
  '1-29': '#84cc16',
  '30-59': '#eab308',
  '60-89': '#f97316',
  '90+': '#dc2626',
};

interface MonthlyTrendProps {
  monthly: MonthPoint[];
}

export function MonthlyTrend({ monthly }: MonthlyTrendProps) {
  const data = monthly.map((m) => ({
    mes: m.label,
    'Pérdida esperada (MXN M)': Math.round(m.expectedLoss / 1_000_000),
    'Morosidad 30+ (%)': Number((m.delinquencyRate * 100).toFixed(2)),
  }));
  return (
    <div className="chart-card">
      <h3>Evolución mensual: pérdida esperada y morosidad</h3>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis
              yAxisId="el"
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => `$${v} M`}
            />
            <YAxis
              yAxisId="mor"
              orientation="right"
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              formatter={(value, name) => {
                const label = String(name);
                return label.includes('Morosidad')
                  ? [`${value}%`, label]
                  : [`$${value} M`, label];
              }}
            />
            <Legend />
            <Line
              yAxisId="el"
              type="monotone"
              dataKey="Pérdida esperada (MXN M)"
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
            />
            <Line
              yAxisId="mor"
              type="monotone"
              dataKey="Morosidad 30+ (%)"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface SegmentElProps {
  segments: Segment[];
}

export function SegmentExpectedLoss({ segments }: SegmentElProps) {
  const data = segments.map((s) => ({
    segmento: s.name,
    'Pérdida esperada (MXN M)': Math.round(expectedLoss(s) / 1_000_000),
    'Exposición (MXN M)': Math.round(s.exposure / 1_000_000),
  }));
  return (
    <div className="chart-card">
      <h3>Pérdida esperada por segmento</h3>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${v} M`} />
            <YAxis type="category" dataKey="segmento" width={130} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value) => [`$${value} M`, 'Pérdida esperada']} />
            <Bar dataKey="Pérdida esperada (MXN M)" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={SEGMENT_COLORS[i % SEGMENT_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function BucketDistribution({ segments }: SegmentElProps) {
  const data = segments.map((s) => ({
    segmento: s.name,
    ...Object.fromEntries(
      DPD_BUCKETS.map((b) => [DPD_LABELS[b], Math.round(s.bucketExposure[b] / 1_000_000)]),
    ),
  }));
  return (
    <div className="chart-card">
      <h3>Distribución de la exposición por bucket de morosidad (MXN M)</h3>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="segmento" tick={{ fontSize: 12 }} interval={0} angle={-18} textAnchor="end" height={64} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: number) => `$${v} M`} />
            <Tooltip formatter={(value, name) => [`$${value} M`, String(name)]} />
            <Legend />
            {DPD_BUCKETS.map((b) => (
              <Bar key={b} dataKey={DPD_LABELS[b]} stackId="buckets" fill={BUCKET_COLORS[b]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-note">
        Exposición total por segmento: {segments.map((s) => `${s.name} ${formatMillionsMxn(s.exposure)}`).join(' · ')}
      </p>
    </div>
  );
}
