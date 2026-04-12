import { useState } from 'react';
import type { GraphData, SimRequest } from '../types';

interface Props {
  graphData: GraphData | null;
  selectedSeeds: string[];
  onSeedsChange: (seeds: string[]) => void;
  onRunSimulation: (req: SimRequest) => void;
  isLoading: boolean;
}

export function InvestPanel({ graphData, selectedSeeds, onSeedsChange, onRunSimulation, isLoading }: Props) {
  const [brandName, setBrandName] = useState('');
  const [brandContent, setBrandContent] = useState('');

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
    onRunSimulation({ seed_nodes: selectedSeeds, brand_name: brandName, brand_content: brandContent, n_steps: 20 });
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-white font-semibold text-sm uppercase tracking-wide">Campaign Setup</h3>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">Brand Name</label>
        <input
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="e.g. TechBrand X"
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
        />
      </div>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">Campaign Message</label>
        <textarea
          value={brandContent}
          onChange={(e) => setBrandContent(e.target.value)}
          placeholder="Describe your campaign content..."
          rows={3}
          className="w-full bg-gray-700 text-white rounded px-3 py-2 text-sm border border-gray-600 focus:border-blue-500 outline-none resize-none"
        />
      </div>

      <div>
        <label className="text-gray-400 text-xs mb-1 block">Select KOL Seeds ({selectedSeeds.length} selected)</label>
        <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
          {kols.map((kol) => (
            <button
              key={kol.id}
              onClick={() => toggleSeed(kol.id)}
              className={`text-left px-3 py-1.5 rounded text-xs flex items-center gap-2 transition-colors ${
                selectedSeeds.includes(kol.id)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span className="font-medium">{kol.name}</span>
              <span className="text-gray-400">· {kol.community}</span>
              <span className="ml-auto text-gray-400">{(kol.influence * 100).toFixed(0)}% influence</span>
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleRun}
        disabled={selectedSeeds.length === 0 || !brandName || !brandContent || isLoading}
        className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white rounded px-4 py-2 text-sm font-semibold transition-colors"
      >
        {isLoading ? 'Simulating...' : 'Run Simulation'}
      </button>
    </div>
  );
}
