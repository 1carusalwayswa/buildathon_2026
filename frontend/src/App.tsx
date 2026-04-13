import { useState, useCallback, useMemo, useRef } from 'react';
import type { GraphData, SimResult, SimRequest, AgentDecision, CompareResult } from './types';
import { fetchGraph, runSimulation, simulateEvent } from './api/client';
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
import { EventPanel } from './components/EventPanel';
import { SentimentTimeline } from './components/SentimentTimeline';
import { CommunityReactionPanel } from './components/CommunityReactionPanel';
import type { EventSimResult, EventSimRequest } from './types';

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
  const [panelWidth, setPanelWidth] = useState(320);
  const [expanded, setExpanded] = useState({ setup: true, analytics: true, roi: true });
  const [simMode, setSimMode] = useState<'campaign' | 'event'>('campaign');
  const [eventResult, setEventResult] = useState<EventSimResult | null>(null);
  const [isEventSimulating, setIsEventSimulating] = useState(false);
  const isDragging = useRef(false);

  const toggleSection = (key: keyof typeof expanded) =>
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startW = panelWidth;
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      // Dragging left = handle moves left = panel shrinks; dragging right = panel grows
      const delta = startX - ev.clientX;
      setPanelWidth(Math.min(600, Math.max(260, startW + delta)));
    };
    const onUp = () => {
      isDragging.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [panelWidth]);

  const simState = useSimulationState(simResult);
  const { reset: resetSimulation } = simState;

  const currentActivated = simState.activatedAtStep.size;
  const totalNodes = graphData?.nodes.length ?? 0;

  const allDecisions = useMemo(() => {
    const decisions: Record<string, AgentDecision> = {};
    if (simResult) {
      for (const step of simResult.steps) {
        for (const d of step.agent_decisions ?? []) {
          decisions[d.node_id] = d;
        }
      }
    }
    return decisions;
  }, [simResult]);

  const selectedNode = useMemo(
    () => graphData?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graphData, selectedNodeId]
  );
  const selectedDecision = selectedNodeId ? allDecisions[selectedNodeId] ?? null : null;

  const bottleneckSet = useMemo(
    () => new Set<string>(simResult?.analytics.bottleneck_nodes ?? []),
    [simResult]
  );

  const handleLoadGraph = useCallback(async () => {
    setIsLoadingGraph(true);
    setError(null);
    try {
      const data = await fetchGraph({ source: 'synthetic' });
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
      resetSimulation();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsSimulating(false);
    }
  }, [resetSimulation]);

  const handleRunEventSimulation = useCallback(async (req: EventSimRequest) => {
    setIsEventSimulating(true);
    setError(null);
    try {
      const result = await simulateEvent(req);
      setEventResult(result);
      setSimResult(result as any); // share step state with GraphView for activation highlights
      resetSimulation();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsEventSimulating(false);
    }
  }, [resetSimulation]);

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
    <div className="flex flex-col h-screen bg-void text-fore overflow-hidden">
      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-2 bg-surface border-b border-edge flex-shrink-0">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sig/50 to-transparent" />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-sig/10 border border-sig/35 flex items-center justify-center flex-shrink-0">
              <span className="text-sig text-xs font-bold font-mono">S</span>
            </div>
            <span className="text-fore font-bold text-sm tracking-wider">
              SOCIAL<span className="text-sig">SIM</span>
            </span>
          </div>
          <div className="w-px h-4 bg-edge-hi" />
          <span className="text-dim text-xs tracking-widest uppercase font-mono">Influence Network Simulator</span>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="text-risk text-xs bg-risk/10 border border-risk/30 rounded px-2 py-0.5">
              {error}
            </span>
          )}
          <button
            onClick={handleLoadGraph}
            disabled={isLoadingGraph}
            className="btn-sig px-3 py-1.5 text-xs font-bold tracking-widest"
          >
            {isLoadingGraph ? 'LOADING...' : graphData ? 'RELOAD GRAPH' : 'LOAD GRAPH'}
          </button>
          {graphData && (
            <span className="text-ghost text-xs font-mono">
              {graphData.nodes.length}N · {graphData.edges.length}E
            </span>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="flex flex-1 overflow-hidden">
        {/* Graph Canvas */}
        <div className="flex-1 relative overflow-hidden min-w-0">
          <GraphView
            graphData={graphData}
            activatedSet={simState.activatedAtStep}
            newActivated={simState.newAtStep}
            selectedNodeId={selectedNodeId}
            onNodeClick={handleNodeClick}
            isPlaying={simState.isPlaying}
            bottleneckSet={bottleneckSet}
            focusNodeId={null}
          />
          {!graphData && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div
                  className="w-20 h-20 mx-auto mb-5 rounded-full border border-edge-hi flex items-center justify-center"
                  style={{ background: 'radial-gradient(circle at center, rgba(0,212,255,0.06), transparent 70%)' }}
                >
                  <span className="text-sig/40 text-3xl">◎</span>
                </div>
                <div className="text-mid text-sm font-semibold mb-1 tracking-wide">No network loaded</div>
                <div className="text-ghost text-xs">
                  Click <span className="text-sig font-mono">LOAD GRAPH</span> to generate a BA network
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Resize Handle — between graph and panel */}
        <div
          onMouseDown={handleResizeStart}
          className="w-1 flex-shrink-0 cursor-col-resize bg-edge hover:bg-sig/40 transition-colors active:bg-sig/70 z-10"
        />

        {/* Right Panel */}
        <div
          className="flex-shrink-0 bg-surface flex flex-col overflow-y-auto overflow-x-hidden"
          style={{ width: panelWidth }}
        >
          <div className="flex flex-col min-w-0 w-full">
            <div className="flex flex-col">
              {/* Breadcrumb */}
              {layer !== 'global' && (
                <div className="flex items-center gap-1.5 text-xs font-mono px-3 py-2 border-b border-edge">
                  <button onClick={() => setLayer('global')} className="text-sig hover:text-sig/70 transition-colors">
                    GLOBAL
                  </button>
                  {layer === 'nodeDetail' && (
                    <>
                      <span className="text-ghost">›</span>
                      <span className="text-mid">NODE DETAIL</span>
                    </>
                  )}
                  {layer === 'agentDetail' && (
                    <>
                      <span className="text-ghost">›</span>
                      <button onClick={() => setLayer('nodeDetail')} className="text-sig hover:text-sig/70 transition-colors">
                        NODE DETAIL
                      </button>
                      <span className="text-ghost">›</span>
                      <span className="text-mid">AGENT DECISION</span>
                    </>
                  )}
                </div>
              )}

              {layer === 'global' && (
                <>
                  {/* Section: Simulation Setup */}
                  <div className="border-b border-edge">
                    <button
                      onClick={() => toggleSection('setup')}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sig text-[10px]">▶</span>
                        <span className="text-fore text-xs font-bold tracking-widest">
                          {simMode === 'campaign' ? 'CAMPAIGN SETUP' : 'EVENT SETUP'}
                        </span>
                      </div>
                      <span className="text-ghost text-xs transition-transform duration-200" style={{ transform: expanded.setup ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                    </button>
                    {expanded.setup && (
                      <div className="px-3 pb-3">
                        {/* Mode toggle */}
                        <div className="flex gap-1 mb-3">
                          {(['campaign', 'event'] as const).map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setSimMode(mode)}
                              className={`flex-1 py-1 text-[10px] font-bold tracking-widest uppercase rounded border transition-colors ${
                                simMode === mode
                                  ? 'text-sig border-sig/60 bg-sig/10'
                                  : 'text-ghost border-edge hover:border-edge-hi'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>

                        {simMode === 'campaign' ? (
                          <InvestPanel
                            graphData={graphData}
                            selectedSeeds={selectedSeeds}
                            onSeedsChange={setSelectedSeeds}
                            onRunSimulation={handleRunSimulation}
                            isLoading={isSimulating}
                            lastResult={simResult}
                            onCompare={handleCompare}
                          />
                        ) : (
                          <EventPanel
                            onRunSimulation={handleRunEventSimulation}
                            isLoading={isEventSimulating}
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* Section: Analytics */}
                  <div className="border-b border-edge">
                    <button
                      onClick={() => toggleSection('analytics')}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sig text-[10px]">▶</span>
                        <span className="text-fore text-xs font-bold tracking-widest">ANALYTICS</span>
                      </div>
                      <span className="text-ghost text-xs transition-transform duration-200" style={{ transform: expanded.analytics ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                    </button>
                    {expanded.analytics && (
                      <div className="px-3 pb-3">
                        <AnalyticsPanel
                          analytics={simResult?.analytics ?? null}
                          currentActivated={currentActivated}
                          totalNodes={totalNodes}
                          graphNodes={graphData?.nodes ?? []}
                          onNodeSelect={(nodeId) => { setSelectedNodeId(nodeId); setLayer('nodeDetail'); }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Section: ROI Ranking */}
                  <div className="border-b border-edge">
                    <button
                      onClick={() => toggleSection('roi')}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/3 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sig text-[10px]">▶</span>
                        <span className="text-fore text-xs font-bold tracking-widest">ROI RANKING</span>
                      </div>
                      <span className="text-ghost text-xs transition-transform duration-200" style={{ transform: expanded.roi ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                    </button>
                    {expanded.roi && (
                      <div className="px-3 pb-3">
                        <ROIRanking analytics={simResult?.analytics ?? null} graphData={graphData} />
                      </div>
                    )}
                  </div>

                  {/* Section: Sentiment Timeline (event mode only) */}
                  {simMode === 'event' && eventResult && (
                    <div className="border-b border-edge">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className="text-sig text-[10px]">▶</span>
                        <span className="text-fore text-xs font-bold tracking-widest">SENTIMENT TIMELINE</span>
                      </div>
                      <div className="px-3 pb-3">
                        <SentimentTimeline timeline={eventResult.sentiment_timeline} />
                      </div>
                    </div>
                  )}

                  {/* Section: Community Reactions (event mode only) */}
                  {simMode === 'event' && eventResult && (
                    <div className="border-b border-edge">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className="text-sig text-[10px]">▶</span>
                        <span className="text-fore text-xs font-bold tracking-widest">COMMUNITY REACTIONS</span>
                      </div>
                      <div className="px-3 pb-3">
                        <CommunityReactionPanel communityReactions={eventResult.community_reactions} />
                      </div>
                    </div>
                  )}
                </>
              )}

              {layer === 'nodeDetail' && (
                <div className="p-3">
                  <NodeDetail
                    node={selectedNode}
                    analytics={simResult?.analytics ?? null}
                    agentDecision={selectedDecision}
                    onViewAgentDetail={() => setLayer('agentDetail')}
                    onClose={() => { setLayer('global'); setSelectedNodeId(null); }}
                  />
                </div>
              )}

              {layer === 'agentDetail' && selectedDecision && selectedNode && (
                <div className="p-3">
                  <AgentDetail
                    decision={selectedDecision}
                    kolName={selectedNode.name}
                    onClose={() => setLayer('nodeDetail')}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: Simulation Player */}
      <div className="px-4 py-2 bg-surface border-t border-edge flex-shrink-0">
        <SimulationPlayer state={simState} />
      </div>

      {compareResult && (
        <CompareModal result={compareResult} onClose={() => setCompareResult(null)} />
      )}
    </div>
  );
}
