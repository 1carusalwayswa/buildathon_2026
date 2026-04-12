import type { AgentDecision } from '../types';

interface Props {
  decision: AgentDecision;
  kolName: string;
  onClose: () => void;
}

const ACTION_COLORS = {
  repost: 'text-green-400',
  comment: 'text-blue-400',
  ignore: 'text-red-400',
};

export function AgentDetail({ decision, kolName, onClose }: Props) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-purple-700 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Agent Decision</h3>
          <div className="text-gray-400 text-xs">{kolName}</div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-gray-700 rounded px-3 py-1">
          <span className={`font-bold uppercase text-sm ${ACTION_COLORS[decision.action]}`}>
            {decision.action}
          </span>
        </div>
        <p className="text-gray-400 text-xs">{decision.reason}</p>
      </div>

      <div>
        <div className="text-gray-400 text-xs mb-2">Reasoning Process</div>
        <div className="flex flex-col gap-2">
          {decision.reasoning_steps.map((step, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <div className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${step.passed ? 'bg-green-600' : 'bg-red-600'}`}>
                {step.passed ? '✓' : '✗'}
              </div>
              <div>
                <div className="text-gray-300 text-xs font-medium">{step.step}</div>
                <div className="text-gray-500 text-xs">{step.result}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {decision.content && (
        <div className="bg-gray-700 rounded p-3">
          <div className="text-gray-400 text-xs mb-1">Simulated Post</div>
          <p className="text-gray-200 text-sm leading-relaxed">{decision.content}</p>
        </div>
      )}
    </div>
  );
}
