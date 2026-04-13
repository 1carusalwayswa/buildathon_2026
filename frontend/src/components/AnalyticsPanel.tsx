import type { Analytics, Node } from '../types';

interface Props {
  analytics: Analytics | null;
  currentActivated: number;
  totalNodes: number;
  graphNodes: Node[];
  onNodeSelect: (nodeId: string) => void;
}

const CARD_TOOLTIPS: Record<string, string> = {
  'Coverage': 'Percentage of all nodes that received the message. Higher = broader reach.',
  'Max Depth': 'Furthest number of hops the message traveled from any seed node.',
  'Peak Step': 'The simulation step where the most new nodes were activated at once.',
  'Total Reached': 'Absolute count of nodes activated by the end of the simulation.',
};

function Tooltip({ text }: { text: string }) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-44 pointer-events-none
                    invisible opacity-0 group-hover:visible group-hover:opacity-100
                    transition-opacity duration-150">
      <div className="bg-[#0a1628] border border-edge-hi rounded px-2.5 py-1.5 text-[11px] text-mid leading-snug shadow-lg">
        {text}
      </div>
      <div className="w-2 h-2 bg-[#0a1628] border-b border-r border-edge-hi rotate-45 mx-auto -mt-1" />
    </div>
  );
}

export function AnalyticsPanel({ analytics, currentActivated, totalNodes, graphNodes, onNodeSelect }: Props) {
  if (!analytics) {
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          {Object.keys(CARD_TOOLTIPS).map((label) => (
            <div key={label} className="relative group bg-card border border-edge rounded p-3 cursor-default">
              <Tooltip text={CARD_TOOLTIPS[label]} />
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
      <div className="grid grid-cols-2 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="relative group bg-card border border-edge rounded p-3 hover:border-edge-hi transition-colors cursor-default overflow-visible">
            <Tooltip text={CARD_TOOLTIPS[card.label]} />
            <div className="text-dim text-xs font-mono uppercase tracking-wide">{card.label}</div>
            <div className="text-fore text-xl font-bold font-mono mt-1">{card.value}</div>
            <div className="text-ghost text-xs mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="relative group inline-flex items-center gap-1 mb-2 cursor-default">
          <div className="text-dim text-xs font-mono uppercase tracking-wide">Community Penetration</div>
          <span className="text-ghost text-[10px]">ⓘ</span>
          <div className="absolute z-50 bottom-full left-0 mb-2 w-52 pointer-events-none
                          invisible opacity-0 group-hover:visible group-hover:opacity-100
                          transition-opacity duration-150">
            <div className="bg-[#0a1628] border border-edge-hi rounded px-2.5 py-1.5 text-[11px] text-mid leading-snug shadow-lg">
              Percentage of each community's nodes that were activated. Shows which audience segments the campaign reached.
            </div>
            <div className="w-2 h-2 bg-[#0a1628] border-b border-r border-edge-hi rotate-45 ml-3 -mt-1" />
          </div>
        </div>
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
          <div className="relative group inline-flex items-center gap-1 mb-1.5 cursor-default">
            <div className="text-dim text-xs font-mono uppercase tracking-wide">Bottleneck Nodes</div>
            <span className="text-ghost text-[10px]">ⓘ</span>
            <div className="absolute z-50 bottom-full left-0 mb-2 w-52 pointer-events-none
                            invisible opacity-0 group-hover:visible group-hover:opacity-100
                            transition-opacity duration-150">
              <div className="bg-[#0a1628] border border-edge-hi rounded px-2.5 py-1.5 text-[11px] text-mid leading-snug shadow-lg">
                Nodes that bridge multiple communities. Removing them would significantly reduce information spread.
              </div>
              <div className="w-2 h-2 bg-[#0a1628] border-b border-r border-edge-hi rotate-45 ml-3 -mt-1" />
            </div>
          </div>
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
