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
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">{node.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs px-2 py-0.5 rounded-full ${node.type === 'kol' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {node.type.toUpperCase()}
            </span>
            <span className="text-gray-400 text-xs capitalize">{node.community}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Influence', value: (node.influence * 100).toFixed(0) + '%' },
          { label: 'Activity', value: (node.activity * 100).toFixed(0) + '%' },
          { label: 'Sentiment', value: (node.sentiment * 100).toFixed(0) + '%' },
        ].map((attr) => (
          <div key={attr.label} className="bg-gray-700 rounded p-2 text-center">
            <div className="text-gray-400 text-xs">{attr.label}</div>
            <div className="text-white text-sm font-bold">{attr.value}</div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">
        <span className="font-medium text-gray-300">{node.followers.toLocaleString()}</span> followers
        {isBottleneck && <span className="ml-2 text-orange-400 font-medium">⚡ Bottleneck</span>}
      </div>

      {contribution && (
        <div className="bg-gray-700 rounded p-3">
          <div className="text-gray-400 text-xs mb-1">Propagation Stats</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-white font-bold text-sm">{contribution.direct_reach}</div>
              <div className="text-gray-500 text-xs">Direct</div>
            </div>
            <div>
              <div className="text-white font-bold text-sm">{contribution.indirect_reach}</div>
              <div className="text-gray-500 text-xs">Indirect</div>
            </div>
            <div>
              <div className="text-green-400 font-bold text-sm">{(contribution.contribution_pct * 100).toFixed(1)}%</div>
              <div className="text-gray-500 text-xs">Contribution</div>
            </div>
          </div>
        </div>
      )}

      {node.type === 'kol' && node.persona && (
        <div className="bg-gray-700 rounded p-3">
          <div className="text-gray-400 text-xs mb-1">Persona</div>
          <p className="text-gray-300 text-xs leading-relaxed">{node.persona}</p>
        </div>
      )}

      {node.type === 'kol' && agentDecision && (
        <button
          onClick={onViewAgentDetail}
          className="bg-purple-600 hover:bg-purple-500 text-white rounded px-3 py-2 text-sm font-medium"
        >
          View Agent Decision →
        </button>
      )}
    </div>
  );
}
