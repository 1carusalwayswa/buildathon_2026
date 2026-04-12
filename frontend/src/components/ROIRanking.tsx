import type { Analytics, GraphData } from '../types';

interface Props {
  analytics: Analytics | null;
  graphData: GraphData | null;
}

export function ROIRanking({ analytics, graphData }: Props) {
  if (!analytics || !graphData) {
    return <div className="text-gray-500 text-sm">Run a simulation to see ROI ranking.</div>;
  }

  const nodeMap = Object.fromEntries(graphData.nodes.map((n) => [n.id, n]));
  const sorted = [...analytics.node_contributions].sort((a, b) => b.contribution_pct - a.contribution_pct);

  return (
    <div>
      <h3 className="text-white font-semibold text-sm uppercase tracking-wide mb-2">ROI Ranking</h3>
      <div className="flex flex-col gap-1">
        {sorted.map((nc, idx) => {
          const node = nodeMap[nc.node_id];
          return (
            <div key={nc.node_id} className="bg-gray-700 rounded px-3 py-2 flex items-center gap-2">
              <span className="text-gray-500 text-xs w-4">#{idx + 1}</span>
              <div className="flex-1">
                <div className="text-white text-xs font-medium">{node?.name ?? nc.node_id}</div>
                <div className="text-gray-400 text-xs">
                  Direct: {nc.direct_reach} · Indirect: {nc.indirect_reach}
                </div>
              </div>
              <span className="text-green-400 text-sm font-bold">
                {(nc.contribution_pct * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
