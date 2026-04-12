import type { CompareResult } from '../types';

interface Props {
  result: CompareResult;
  onClose: () => void;
}

function DiffBadge({ a, b, higherIsBetter = true }: { a: number; b: number; higherIsBetter?: boolean }) {
  const diff = b - a;
  if (Math.abs(diff) < 0.001) return null;
  const positive = higherIsBetter ? diff > 0 : diff < 0;
  const sign = diff > 0 ? '+' : '';
  return (
    <span className={`text-xs ml-1 font-mono font-semibold ${positive ? 'text-neon' : 'text-risk'}`}>
      {sign}{(diff * 100).toFixed(1)}%
    </span>
  );
}

export function CompareModal({ result, onClose }: Props) {
  if (result.results.length < 2) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
        <div className="bg-surface rounded-lg p-8 text-center">
          <p className="text-mid">需要至少两个场景才能比较</p>
          <button onClick={onClose} className="btn-ghost mt-4">关闭</button>
        </div>
      </div>
    );
  }
  const [a, b] = result.results;
  const [nameA, nameB] = result.names;

  const metricRows = [
    {
      label: 'Coverage',
      valA: `${(a.analytics.coverage * 100).toFixed(1)}%`,
      valB: `${(b.analytics.coverage * 100).toFixed(1)}%`,
      diff: <DiffBadge a={a.analytics.coverage} b={b.analytics.coverage} />,
    },
    {
      label: 'Total Reached',
      valA: a.analytics.total_activated.toString(),
      valB: b.analytics.total_activated.toString(),
      diff: null,
    },
    {
      label: 'Max Depth',
      valA: a.analytics.max_depth.toString(),
      valB: b.analytics.max_depth.toString(),
      diff: null,
    },
    {
      label: 'Peak Step',
      valA: `t=${a.analytics.peak_step}`,
      valB: `t=${b.analytics.peak_step}`,
      diff: null,
    },
  ];

  const winner =
    a.analytics.coverage > b.analytics.coverage ? nameA :
    b.analytics.coverage > a.analytics.coverage ? nameB :
    null;

  return (
    <div className="fixed inset-0 bg-void/85 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-surface rounded border border-edge w-full max-w-lg shadow-2xl">
        {/* Modal header */}
        <div className="relative flex items-center justify-between px-5 py-3 border-b border-edge">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-ai/50 to-transparent" />
          <h2 className="text-fore font-bold text-xs tracking-widest uppercase">Scenario Comparison</h2>
          <button onClick={onClose} className="text-ghost hover:text-mid text-xl leading-none transition-colors">×</button>
        </div>

        <div className="p-5">
          {/* Column headers */}
          <div className="grid grid-cols-3 gap-3 mb-3 text-xs font-mono font-semibold uppercase tracking-widest">
            <div className="text-ghost">Metric</div>
            <div className="text-center text-sig">{nameA}</div>
            <div className="text-center text-ai">{nameB}</div>
          </div>

          {/* Metric rows */}
          <div className="flex flex-col gap-1.5">
            {metricRows.map((row) => (
              <div key={row.label} className="grid grid-cols-3 gap-3 bg-card border border-edge rounded px-3 py-2">
                <div className="text-dim text-xs self-center font-mono">{row.label}</div>
                <div className="text-center">
                  <span className="text-fore font-bold text-sm font-mono">{row.valA}</span>
                </div>
                <div className="text-center">
                  <span className="text-fore font-bold text-sm font-mono">{row.valB}</span>
                  {row.diff}
                </div>
              </div>
            ))}
          </div>

          {/* Community penetration */}
          <div className="mt-4">
            <div className="text-dim text-xs font-mono uppercase tracking-widest mb-2">Community Penetration</div>
            {Array.from(new Set([
              ...Object.keys(a.analytics.community_penetration),
              ...Object.keys(b.analytics.community_penetration),
            ])).map((comm) => {
              const pctA = a.analytics.community_penetration[comm] ?? 0;
              const pctB = b.analytics.community_penetration[comm] ?? 0;
              return (
                <div key={comm} className="mb-2">
                  <div className="flex justify-between text-xs font-mono mb-1">
                    <span className="text-mid capitalize">{comm}</span>
                    <span>
                      <span className="text-sig">{(pctA * 100).toFixed(0)}%</span>
                      <span className="text-ghost"> vs </span>
                      <span className="text-ai">{(pctB * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="flex gap-1 h-1.5">
                    <div className="flex-1 bg-edge rounded-full overflow-hidden">
                      <div className="bg-sig h-full rounded-full" style={{ width: `${pctA * 100}%` }} />
                    </div>
                    <div className="flex-1 bg-edge rounded-full overflow-hidden">
                      <div className="bg-ai h-full rounded-full" style={{ width: `${pctB * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendation */}
          <div className="mt-4 bg-neon/5 border border-neon/25 rounded px-4 py-3">
            <div className="text-neon text-xs font-mono font-bold uppercase tracking-widest mb-1">Recommendation</div>
            <div className="text-mid text-sm">
              {winner
                ? <><span className="text-fore font-semibold">{winner}</span> achieves higher coverage. Prefer this scenario.</>
                : 'Both scenarios achieve equal coverage.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
