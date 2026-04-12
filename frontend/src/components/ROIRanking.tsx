import type { Analytics, GraphData } from '../types';

interface Props {
  analytics: Analytics | null;
  graphData: GraphData | null;
}

export function ROIRanking({ analytics, graphData }: Props) {
  if (!analytics || !graphData) {
    return (
      <div className="flex flex-col gap-3">
        <h3 className="text-fore text-xs font-bold tracking-widest uppercase flex items-center gap-2">
          <span className="text-gold">▸</span> ROI Ranking
        </h3>
        <div className="text-ghost text-xs font-mono">Run a simulation to see ROI ranking.</div>
      </div>
    );
  }

  const nodeMap = Object.fromEntries(graphData.nodes.map((n) => [n.id, n]));
  const sorted = [...analytics.node_contributions].sort((a, b) => b.contribution_pct - a.contribution_pct);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-fore text-xs font-bold tracking-widest uppercase flex items-center gap-2">
        <span className="text-gold">▸</span> ROI Ranking
      </h3>
      <div className="flex flex-col gap-1">
        {sorted.map((nc, idx) => {
          const node = nodeMap[nc.node_id];
          return (
            <div
              key={nc.node_id}
              className="bg-card border border-edge rounded px-3 py-2 flex items-center gap-2 hover:border-edge-hi transition-colors"
            >
              <span className="text-ghost text-xs font-mono w-5 flex-shrink-0">#{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="text-fore text-xs font-semibold truncate">{node?.name ?? nc.node_id}</div>
                <div className="text-dim text-xs font-mono">
                  D:{nc.direct_reach} · I:{nc.indirect_reach}
                </div>
              </div>
              <span
                className="text-neon text-sm font-bold font-mono flex-shrink-0 text-neon-glow"
              >
                {(nc.contribution_pct * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
