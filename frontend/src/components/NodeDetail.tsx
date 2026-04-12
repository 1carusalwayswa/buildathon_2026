import type { Node, Analytics, AgentDecision } from '../types';

interface Props {
  node: Node | null;
  analytics: Analytics | null;
  agentDecision: AgentDecision | null;
  onViewAgentDetail: () => void;
  onClose: () => void;
}

export function NodeDetail({ node, analytics, agentDecision, onViewAgentDetail, onClose }: Props) {
  if (!node) return null;

  const contribution = analytics?.node_contributions.find((nc) => nc.node_id === node.id);
  const isBottleneck = analytics?.bottleneck_nodes.includes(node.id);

  return (
    <div className="bg-surface rounded border border-edge flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-fore font-bold text-sm">{node.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`text-xs px-2 py-0.5 rounded border font-mono ${
                node.type === 'kol'
                  ? 'bg-gold/10 text-gold border-gold/35'
                  : 'bg-sig/10 text-sig border-sig/35'
              }`}
            >
              {node.type.toUpperCase()}
            </span>
            <span className="text-dim text-xs capitalize">{node.community}</span>
            {isBottleneck && (
              <span className="text-orange text-xs font-mono">⚡ Bottleneck</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="text-ghost hover:text-mid text-xl leading-none transition-colors">×</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Influence', value: (node.influence * 100).toFixed(0) + '%' },
          { label: 'Activity', value: (node.activity * 100).toFixed(0) + '%' },
          { label: 'Sentiment', value: (node.sentiment * 100).toFixed(0) + '%' },
        ].map((attr) => (
          <div key={attr.label} className="bg-card border border-edge rounded p-2 text-center">
            <div className="text-dim text-xs font-mono uppercase tracking-wide">{attr.label}</div>
            <div className="text-fore text-sm font-bold font-mono mt-0.5">{attr.value}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-dim font-mono">
        <span className="text-fore font-semibold">{node.followers.toLocaleString()}</span> followers
      </div>

      {contribution && (
        <div className="bg-card border border-edge rounded p-3">
          <div className="text-dim text-xs font-mono uppercase tracking-wide mb-2">Propagation Stats</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-fore font-bold text-sm font-mono">{contribution.direct_reach}</div>
              <div className="text-ghost text-xs">Direct</div>
            </div>
            <div>
              <div className="text-fore font-bold text-sm font-mono">{contribution.indirect_reach}</div>
              <div className="text-ghost text-xs">Indirect</div>
            </div>
            <div>
              <div className="text-neon font-bold text-sm font-mono text-neon-glow">
                {(contribution.contribution_pct * 100).toFixed(1)}%
              </div>
              <div className="text-ghost text-xs">Contribution</div>
            </div>
          </div>
        </div>
      )}

      {node.type === 'kol' && node.persona && (
        <div className="bg-card border border-edge rounded p-3">
          <div className="text-dim text-xs font-mono uppercase tracking-wide mb-1">Persona</div>
          <p className="text-mid text-xs leading-relaxed">{node.persona}</p>
        </div>
      )}

      {node.type === 'kol' && agentDecision && (
        <button
          onClick={onViewAgentDetail}
          className="btn-ai w-full py-2 text-xs font-bold tracking-widest"
        >
          VIEW AGENT DECISION →
        </button>
      )}
    </div>
  );
}
