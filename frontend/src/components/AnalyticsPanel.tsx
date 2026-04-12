import type { Analytics, Node } from '../types';

interface Props {
  analytics: Analytics | null;
  currentActivated: number;
  totalNodes: number;
  graphNodes: Node[];
  onNodeSelect: (nodeId: string) => void;
}

export function AnalyticsPanel({ analytics, currentActivated, totalNodes, graphNodes, onNodeSelect }: Props) {
  if (!analytics) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-fore text-xs font-bold tracking-widest uppercase flex items-center gap-2">
          <span className="text-neon">▸</span> Analytics
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {['Coverage', 'Max Depth', 'Peak Step', 'Total Reached'].map((label) => (
            <div key={label} className="bg-card border border-edge rounded p-3">
              <div className="text-dim text-xs font-mono uppercase tracking-wide">{label}</div>
              <div className="text-ghost text-xl font-bold font-mono mt-1">—</div>
            </div>
          ))}
        </div>
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
      <h3 className="text-fore text-xs font-bold tracking-widest uppercase flex items-center gap-2">
        <span className="text-neon">▸</span> Analytics
      </h3>

      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-card border border-edge rounded p-3 hover:border-edge-hi transition-colors">
            <div className="text-dim text-xs font-mono uppercase tracking-wide">{card.label}</div>
            <div className="text-fore text-xl font-bold font-mono mt-1">{card.value}</div>
            <div className="text-ghost text-xs mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-dim text-xs font-mono uppercase tracking-wide mb-2">Community Penetration</div>
        {Object.entries(analytics.community_penetration).map(([comm, pct]) => (
          <div key={comm} className="flex items-center gap-2 mb-1.5">
            <span className="text-mid text-xs capitalize w-16 font-mono">{comm}</span>
            <div className="flex-1 bg-edge rounded-full h-1.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(pct * 100).toFixed(1)}%`,
                  background: 'linear-gradient(90deg, #00d4ff, #00ff9d)',
                  boxShadow: '0 0 6px rgba(0, 212, 255, 0.4)',
                }}
              />
            </div>
            <span className="text-dim text-xs font-mono w-9 text-right">{(pct * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>

      {analytics.bottleneck_nodes.length > 0 && (
        <div>
          <div className="text-dim text-xs font-mono uppercase tracking-wide mb-1.5">Bottleneck Nodes</div>
          <div className="flex flex-wrap gap-1">
            {analytics.bottleneck_nodes.map((nodeId) => {
              const n = graphNodes.find((g) => g.id === nodeId);
              return (
                <button
                  key={nodeId}
                  onClick={() => onNodeSelect(nodeId)}
                  className="text-xs px-2 py-0.5 rounded border border-orange/30 bg-orange/10 text-orange hover:bg-orange/20 hover:border-orange/50 transition-colors font-mono"
                >
                  {n?.name ?? nodeId}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
