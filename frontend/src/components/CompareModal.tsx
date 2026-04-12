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
    <span className={`text-xs ml-1 font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
      {sign}{(diff * 100).toFixed(1)}%
    </span>
  );
}

export function CompareModal({ result, onClose }: Props) {
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700">
          <h2 className="text-white font-bold text-base">Scenario Comparison</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-5">
          {/* Header row */}
          <div className="grid grid-cols-3 gap-3 mb-3 text-xs text-gray-500 font-medium uppercase tracking-wide">
            <div>Metric</div>
            <div className="text-center text-blue-400">{nameA}</div>
            <div className="text-center text-purple-400">{nameB}</div>
          </div>

          {/* Metric rows */}
          <div className="flex flex-col gap-2">
            {metricRows.map((row) => (
              <div key={row.label} className="grid grid-cols-3 gap-3 bg-gray-700/50 rounded px-3 py-2">
                <div className="text-gray-400 text-xs self-center">{row.label}</div>
                <div className="text-center">
                  <span className="text-white font-bold text-sm">{row.valA}</span>
                </div>
                <div className="text-center">
                  <span className="text-white font-bold text-sm">{row.valB}</span>
                  {row.diff}
                </div>
              </div>
            ))}
          </div>

          {/* Community penetration comparison */}
          <div className="mt-4">
            <div className="text-gray-400 text-xs mb-2">Community Penetration</div>
            {Array.from(new Set([
              ...Object.keys(a.analytics.community_penetration),
              ...Object.keys(b.analytics.community_penetration),
            ])).map((comm) => {
              const pctA = a.analytics.community_penetration[comm] ?? 0;
              const pctB = b.analytics.community_penetration[comm] ?? 0;
              return (
                <div key={comm} className="mb-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                    <span className="capitalize">{comm}</span>
                    <span>
                      <span className="text-blue-400">{(pctA * 100).toFixed(0)}%</span>
                      {' vs '}
                      <span className="text-purple-400">{(pctB * 100).toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div className="flex-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pctA * 100}%` }} />
                    </div>
                    <div className="flex-1 bg-gray-700 rounded-full overflow-hidden">
                      <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pctB * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recommendation */}
          <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3">
            <div className="text-green-400 text-xs font-semibold">Recommendation</div>
            <div className="text-gray-300 text-sm mt-0.5">
              {winner
                ? <><span className="text-white font-semibold">{winner}</span> achieves higher coverage. Prefer this scenario.</>
                : 'Both scenarios achieve equal coverage.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
