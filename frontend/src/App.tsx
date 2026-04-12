import { useState, useCallback, useMemo } from 'react';
import type { GraphData, SimResult, SimRequest, AgentDecision, CompareResult } from './types';
import { fetchGraph, runSimulation } from './api/client';
import { GraphView } from './components/GraphView';
import { SimulationPlayer } from './components/SimulationPlayer';
import { InvestPanel } from './components/InvestPanel';
import type { SavedScenario } from './components/InvestPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { ROIRanking } from './components/ROIRanking';
import { NodeDetail } from './components/NodeDetail';
import { AgentDetail } from './components/AgentDetail';
import { CompareModal } from './components/CompareModal';
import { useSimulationState } from './hooks/useSimulationState';

type Layer = 'global' | 'nodeDetail' | 'agentDetail';

export default function App() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [simResult, setSimResult] = useState<SimResult | null>(null);
  const [selectedSeeds, setSelectedSeeds] = useState<string[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [layer, setLayer] = useState<Layer>('global');
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);

  const simState = useSimulationState(simResult);

  const currentActivated = simState.activatedAtStep.size;
  const totalNodes = graphData?.nodes.length ?? 0;

  // Collect all agent decisions across entire simulation (not step-gated)
  const allDecisions: Record<string, AgentDecision> = {};
  if (simResult) {
    for (const step of simResult.steps) {
      for (const d of step.agent_decisions ?? []) {
        allDecisions[d.node_id] = d;
      }
    }
  }

  const selectedNode = graphData?.nodes.find((n) => n.id === selectedNodeId) ?? null;
  const selectedDecision = selectedNodeId ? allDecisions[selectedNodeId] ?? null : null;

  const bottleneckSet = useMemo(
    () => new Set<string>(simResult?.analytics.bottleneck_nodes ?? []),
    [simResult]
  );

  const handleLoadGraph = useCallback(async () => {
    setIsLoadingGraph(true);
    setError(null);
    try {
      const data = await fetchGraph({ n_nodes: 500, n_kol: 15, m_edges: 3, n_communities: 5 });
      setGraphData(data);
      setSimResult(null);
      setSelectedSeeds([]);
      setSelectedNodeId(null);
      setLayer('global');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoadingGraph(false);
    }
  }, []);

  const handleRunSimulation = useCallback(async (req: SimRequest) => {
    setIsSimulating(true);
    setError(null);
    try {
      const result = await runSimulation(req);
      setSimResult(result);
      simState.reset();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSimulating(false);
    }
  }, [simState]);

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setLayer('nodeDetail');
  }, []);

  const handleCompare = useCallback((scenarios: SavedScenario[]) => {
    setCompareResult({
      results: scenarios.map((s) => s.result),
      names: scenarios.map((s) => s.name),
    });
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-white font-bold text-lg">SocialSim</h1>
          <span className="text-gray-500 text-sm">Influence Network Simulator</span>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-red-400 text-xs">{error}</span>}
          <button
            onClick={handleLoadGraph}
            disabled={isLoadingGraph}
            className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded px-3 py-1.5 text-sm font-medium"
          >
            {isLoadingGraph ? 'Loading...' : graphData ? 'Reload Graph' : 'Load Graph'}
          </button>
          {graphData && (
            <span className="text-gray-500 text-xs">
              {graphData.nodes.length} nodes · {graphData.edges.length} edges
            </span>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph Canvas */}
        <div className="flex-1 relative">
          <GraphView
            graphData={graphData}
            activatedSet={simState.activatedAtStep}
            newActivated={simState.newAtStep}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            isPlaying={simState.isPlaying}
            bottleneckSet={bottleneckSet}
            focusNodeId={layer === 'nodeDetail' ? selectedNodeId : null}
          />
          {!graphData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-500 text-lg mb-2">No network loaded</div>
                <div className="text-gray-600 text-sm">Click "Load Graph" to generate a BA network</div>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col overflow-y-auto">
          <div className="p-3 flex flex-col gap-4">
            {/* Layer navigation breadcrumb */}
            {layer !== 'global' && (
              <div className="flex items-center gap-1 text-xs">
                <button onClick={() => setLayer('global')} className="text-blue-400 hover:text-blue-300">Global</button>
                {layer === 'nodeDetail' && <><span className="text-gray-600">›</span><span className="text-gray-300">Node Detail</span></>}
                {layer === 'agentDetail' && (
                  <>
                    <span className="text-gray-600">›</span>
                    <button onClick={() => setLayer('nodeDetail')} className="text-blue-400 hover:text-blue-300">Node Detail</button>
                    <span className="text-gray-600">›</span>
                    <span className="text-gray-300">Agent Decision</span>
                  </>
                )}
              </div>
            )}

            {layer === 'global' && (
              <>
                <InvestPanel
                  graphData={graphData}
                  selectedSeeds={selectedSeeds}
                  onSeedsChange={setSelectedSeeds}
                  onRunSimulation={handleRunSimulation}
                  isLoading={isSimulating}
                  lastResult={simResult}
                  onCompare={handleCompare}
                />
                <AnalyticsPanel
                  analytics={simResult?.analytics ?? null}
                  currentActivated={currentActivated}
                  totalNodes={totalNodes}
                  graphNodes={graphData?.nodes ?? []}
                  onNodeSelect={(nodeId) => { setSelectedNodeId(nodeId); setLayer('nodeDetail'); }}
                />
                <ROIRanking analytics={simResult?.analytics ?? null} graphData={graphData} />
              </>
            )}

            {layer === 'nodeDetail' && (
              <NodeDetail
                node={selectedNode}
                analytics={simResult?.analytics ?? null}
                agentDecision={selectedDecision}
                onViewAgentDetail={() => setLayer('agentDetail')}
                onClose={() => { setLayer('global'); setSelectedNodeId(null); }}
              />
            )}

            {layer === 'agentDetail' && selectedDecision && selectedNode && (
              <AgentDetail
                decision={selectedDecision}
                kolName={selectedNode.name}
                onClose={() => setLayer('nodeDetail')}
              />
            )}
          </div>
        </div>
      </div>

      {/* Bottom: Simulation Player */}
      <div className="px-4 py-2 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <SimulationPlayer state={simState} />
      </div>

      {compareResult && (
        <CompareModal result={compareResult} onClose={() => setCompareResult(null)} />
      )}
    </div>
  );
}
