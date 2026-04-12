import { useState } from 'react';
import type { GraphData, SimRequest, SimResult } from '../types';

interface SavedScenario {
  name: string;
  req: SimRequest;
  result: SimResult;
}

interface Props {
  graphData: GraphData | null;
  selectedSeeds: string[];
  onSeedsChange: (seeds: string[]) => void;
  onRunSimulation: (req: SimRequest) => void;
  isLoading: boolean;
  lastResult: SimResult | null;
  onCompare: (scenarios: SavedScenario[]) => void;
}

export type { SavedScenario };

export function InvestPanel({
  graphData,
  selectedSeeds,
  onSeedsChange,
  onRunSimulation,
  isLoading,
  lastResult,
  onCompare,
}: Props) {
  const [brandName, setBrandName] = useState('');
  const [brandContent, setBrandContent] = useState('');
  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>([]);
  const [lastReq, setLastReq] = useState<SimRequest | null>(null);

  const kols = graphData?.nodes.filter((n) => n.type === 'kol') ?? [];

  const toggleSeed = (nodeId: string) => {
    if (selectedSeeds.includes(nodeId)) {
      onSeedsChange(selectedSeeds.filter((id) => id !== nodeId));
    } else {
      onSeedsChange([...selectedSeeds, nodeId]);
    }
  };

  const handleRun = () => {
    if (selectedSeeds.length === 0 || !brandName || !brandContent) return;
    const req: SimRequest = { seed_nodes: selectedSeeds, brand_name: brandName, brand_content: brandContent, n_steps: 20 };
    setLastReq(req);
    onRunSimulation(req);
  };

  const handleSaveScenario = () => {
    if (!lastResult || !lastReq) return;
    const name = `Scenario ${savedScenarios.length + 1} (${lastReq.seed_nodes.length} KOLs)`;
    const next = [...savedScenarios, { name, req: lastReq, result: lastResult }].slice(-2);
    setSavedScenarios(next);
  };

  const canSave = lastResult && lastReq && savedScenarios.length < 2;
  const canCompare = savedScenarios.length === 2;

  const inputClass = "w-full bg-card text-fore rounded px-3 py-2 text-sm border border-edge focus:border-sig/60 focus:outline-none transition-colors placeholder:text-ghost";

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-fore text-xs font-bold tracking-widest uppercase flex items-center gap-2">
        <span className="text-sig">▸</span> Campaign Setup
      </h3>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Brand Name</label>
        <input
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="e.g. TechBrand X"
          className={inputClass}
        />
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">Campaign Message</label>
        <textarea
          value={brandContent}
          onChange={(e) => setBrandContent(e.target.value)}
          placeholder="Describe your campaign content..."
          rows={3}
          className={`${inputClass} resize-none`}
        />
      </div>

      <div>
        <label className="text-dim text-xs mb-1 block font-mono uppercase tracking-wide">
          KOL Seeds <span className="text-sig">({selectedSeeds.length} selected)</span>
        </label>
        <div className="max-h-36 overflow-y-auto flex flex-col gap-1 pr-0.5">
          {kols.map((kol) => (
            <button
              key={kol.id}
              onClick={() => toggleSeed(kol.id)}
              className={`kol-btn px-3 py-1.5 text-xs flex items-center gap-2 ${
                selectedSeeds.includes(kol.id) ? 'kol-btn-on' : 'kol-btn-off'
              }`}
            >
              <span className="font-semibold">{kol.name}</span>
              <span className="text-ghost">· {kol.community}</span>
              <span className="ml-auto font-mono opacity-70">{(kol.influence * 100).toFixed(0)}%</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={selectedSeeds.length === 0 || !brandName || !brandContent || isLoading}
        className="btn-neon w-full py-2 text-xs font-bold tracking-widest"
      >
        {isLoading ? 'SIMULATING...' : 'RUN SIMULATION'}
      </button>

      {canSave && (
        <button
          onClick={handleSaveScenario}
          className="btn-sig w-full py-1.5 text-xs font-semibold tracking-wide"
        >
          Save as Scenario {savedScenarios.length + 1}
        </button>
      )}

      {savedScenarios.length > 0 && (
        <div className="flex flex-col gap-1">
          {savedScenarios.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs font-mono">
              <span className={i === 0 ? 'text-sig' : 'text-ai'}>■</span>
              <span className="text-mid">{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {canCompare && (
        <button
          onClick={() => {
            onCompare(savedScenarios);
            setSavedScenarios([]);
          }}
          className="btn-ai w-full py-2 text-xs font-bold tracking-widest"
        >
          COMPARE SCENARIOS
        </button>
      )}
    </div>
  );
}
