import type { AgentDecision } from '../types';

interface Props {
  decision: AgentDecision;
  kolName: string;
  onClose: () => void;
}

const ACTION_STYLES: Record<string, { text: string; bg: string; border: string }> = {
  repost: { text: 'text-neon', bg: 'bg-neon/10', border: 'border-neon/40' },
  comment: { text: 'text-sig', bg: 'bg-sig/10', border: 'border-sig/40' },
  ignore: { text: 'text-risk', bg: 'bg-risk/10', border: 'border-risk/40' },
};

export function AgentDetail({ decision, kolName, onClose }: Props) {
  const actionStyle = ACTION_STYLES[decision.action] ?? ACTION_STYLES.ignore;

  return (
    <div className="bg-surface rounded border border-ai/40 flex flex-col gap-4 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-ai text-xs font-mono bg-ai/10 border border-ai/35 px-2 py-0.5 rounded">AI</span>
            <h3 className="text-fore font-bold text-sm">Agent Decision</h3>
          </div>
          <div className="text-dim text-xs font-mono">{kolName}</div>
        </div>
        <button onClick={onClose} className="text-ghost hover:text-mid text-xl leading-none transition-colors">×</button>
      </div>

      <div className="flex items-start gap-3">
        <div className={`${actionStyle.bg} border ${actionStyle.border} rounded px-3 py-1 flex-shrink-0`}>
          <span className={`font-bold uppercase text-xs font-mono tracking-widest ${actionStyle.text}`}>
            {decision.action}
          </span>
        </div>
        <p className="text-dim text-xs leading-relaxed">{decision.reason}</p>
      </div>

      <div>
        <div className="text-dim text-xs font-mono uppercase tracking-wide mb-2">Reasoning Process</div>
        <div className="flex flex-col gap-2">
          {decision.reasoning_steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2.5">
              <div
                className={`mt-0.5 w-4 h-4 rounded-full border flex items-center justify-center text-xs flex-shrink-0 font-mono ${
                  step.passed
                    ? 'bg-neon/10 border-neon/40 text-neon'
                    : 'bg-risk/10 border-risk/40 text-risk'
                }`}
              >
                {step.passed ? '✓' : '✗'}
              </div>
              <div>
                <div className="text-mid text-xs font-semibold">{step.step}</div>
                <div className="text-ghost text-xs mt-0.5">{step.result}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {decision.content && (
        <div className="bg-card border border-edge rounded p-3">
          <div className="text-dim text-xs font-mono uppercase tracking-wide mb-1.5">Simulated Post</div>
          <p className="text-fore text-xs leading-relaxed">{decision.content}</p>
        </div>
      )}
    </div>
  );
}
