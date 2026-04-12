import type { Analytics } from '../types';

interface Props {
  analytics: Analytics | null;
  currentActivated: number;
  totalNodes: number;
}

export function AnalyticsPanel({ analytics, currentActivated, totalNodes }: Props) {
  if (!analytics) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {['Coverage', 'Max Depth', 'Peak Step', 'Total Reached'].map((label) => (
          <div key={label} className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs">{label}</div>
            <div className="text-gray-600 text-lg font-bold">—</div>
          </div>
        ))}
      </div>
    );
  }

  const liveProgress = totalNodes > 0 ? ((currentActivated / totalNodes) * 100).toFixed(1) : '0';

  const cards = [
    { label: 'Coverage', value: `${(analytics.coverage * 100).toFixed(1)}%`, sub: `${liveProgress}% live` },
    { label: 'Max Depth', value: analytics.max_depth, sub: 'hops' },
    { label: 'Peak Step', value: `t=${analytics.peak_step}`, sub: 'most activations' },
    { label: 'Total Reached', value: analytics.total_activated, sub: `of ${totalNodes} nodes` },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-gray-700 rounded p-3">
            <div className="text-gray-400 text-xs">{card.label}</div>
            <div className="text-white text-lg font-bold">{card.value}</div>
            <div className="text-gray-500 text-xs">{card.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-1">Community Penetration</div>
        {Object.entries(analytics.community_penetration).map(([comm, pct]) => (
          <div key={comm} className="flex items-center gap-2 mb-1">
            <span className="text-gray-300 text-xs w-16 capitalize">{comm}</span>
            <div className="flex-1 bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${(pct * 100).toFixed(1)}%` }}
              />
            </div>
            <span className="text-gray-400 text-xs w-10 text-right">{(pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
