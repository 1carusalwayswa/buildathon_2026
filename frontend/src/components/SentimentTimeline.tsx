import { useMemo } from 'react';
import type { SentimentSnapshot } from '../types';

interface Props {
  timeline: SentimentSnapshot[];
}

const COMMUNITY_COLORS = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

export function SentimentTimeline({ timeline }: Props) {
  const W = 280, H = 140, PAD = { top: 12, right: 8, bottom: 24, left: 32 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const communities = useMemo(() => {
    const set = new Set<string>();
    timeline.forEach(s => Object.keys(s.by_community).forEach(c => set.add(c)));
    return Array.from(set).sort();
  }, [timeline]);

  const tMax = timeline.length > 0 ? Math.max(...timeline.map(s => s.t)) : 1;

  const xScale = (t: number) => (t / tMax) * innerW;
  const yScale = (v: number) => ((1 - v) / 2) * innerH; // -1..1 → innerH..0

  const makePath = (values: number[], ts: number[]) => {
    if (values.length === 0) return '';
    return values.map((v, i) =>
      `${i === 0 ? 'M' : 'L'} ${xScale(ts[i]).toFixed(1)} ${yScale(v).toFixed(1)}`
    ).join(' ');
  };

  const overallTs = timeline.map(s => s.t);
  const overallVs = timeline.map(s => s.overall);

  const communityPaths = communities.map((c, ci) => {
    const pts = timeline.filter(s => c in s.by_community);
    return {
      community: c,
      color: COMMUNITY_COLORS[ci % COMMUNITY_COLORS.length],
      path: makePath(pts.map(s => s.by_community[c]), pts.map(s => s.t)),
    };
  });

  // Y-axis ticks: -1, 0, +1
  const yTicks = [-1, 0, 1];

  if (timeline.length === 0) {
    return <div className="text-ghost text-xs font-mono text-center py-4">No sentiment data</div>;
  }

  return (
    <div className="flex flex-col gap-2">
      <svg width={W} height={H} className="overflow-visible">
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {/* Grid lines */}
          {yTicks.map(tick => (
            <g key={tick}>
              <line
                x1={0} y1={yScale(tick)} x2={innerW} y2={yScale(tick)}
                stroke={tick === 0 ? '#4b5563' : '#1f2937'}
                strokeWidth={tick === 0 ? 1 : 0.5}
                strokeDasharray={tick === 0 ? '' : '3,3'}
              />
              <text x={-4} y={yScale(tick)} textAnchor="end" dominantBaseline="middle"
                className="fill-ghost" style={{ fontSize: 9, fontFamily: 'monospace' }}>
                {tick > 0 ? `+${tick}` : tick}
              </text>
            </g>
          ))}

          {/* Community lines (thin) */}
          {communityPaths.map(({ community, color, path }) => (
            path && <path key={community} d={path} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.6} />
          ))}

          {/* Overall line (bold) */}
          <path
            d={makePath(overallVs, overallTs)}
            fill="none" stroke="#a78bfa" strokeWidth={2}
          />

          {/* X-axis */}
          <line x1={0} y1={innerH} x2={innerW} y2={innerH} stroke="#374151" strokeWidth={0.5} />
          <text x={0} y={innerH + 10} textAnchor="start"
            className="fill-ghost" style={{ fontSize: 9, fontFamily: 'monospace' }}>t=0</text>
          <text x={innerW} y={innerH + 10} textAnchor="end"
            className="fill-ghost" style={{ fontSize: 9, fontFamily: 'monospace' }}>t={tMax}</text>
        </g>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-violet-400" />
          <span className="text-[9px] font-mono text-dim">Overall</span>
        </div>
        {communityPaths.map(({ community, color }) => (
          <div key={community} className="flex items-center gap-1">
            <div className="w-3 h-0.5" style={{ backgroundColor: color, opacity: 0.7 }} />
            <span className="text-[9px] font-mono text-ghost">{community}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
