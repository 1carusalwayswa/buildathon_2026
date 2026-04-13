import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData } from '../types';
import * as d3 from 'd3';

const COLOR_PALETTE = ['#38bdf8', '#f472b6', '#fbbf24', '#34d399', '#a78bfa', '#fb923c', '#e879f9', '#4ade80'];

/** Build a stable community→color map from all unique community values in the graph. */
function buildCommunityColorMap(nodes: { community: string }[]): Record<string, string> {
  const unique = [...new Set(nodes.map((n) => n.community))].sort();
  return Object.fromEntries(unique.map((c, i) => [c, COLOR_PALETTE[i % COLOR_PALETTE.length]]));
}

const PARTICLE_COLOR = () => 'rgba(0,255,157,0.85)';

interface Props {
  graphData: GraphData | null;
  activatedSet: Set<string>;
  newActivated: string[];
  selectedNodeId: string | null;
  onNodeClick: (nodeId: string) => void;
  isPlaying: boolean;
  bottleneckSet: Set<string>;
  focusNodeId: string | null;
}

function computeConcentricPositions(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  centerNodeId: string,
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  // Build adjacency
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set());
  for (const e of edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  // BFS from center
  const layer = new Map<string, number>();
  const queue: string[] = [centerNodeId];
  layer.set(centerNodeId, 0);
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    const curLayer = layer.get(cur)!;
    for (const nb of (adj.get(cur) ?? [])) {
      if (!layer.has(nb)) {
        layer.set(nb, curLayer + 1);
        queue.push(nb);
      }
    }
  }
  // Disconnected nodes get a large layer number
  for (const id of nodeIds) {
    if (!layer.has(id)) layer.set(id, 999);
  }

  // Group by layer
  const groups = new Map<number, string[]>();
  for (const [id, l] of layer) {
    if (!groups.has(l)) groups.set(l, []);
    groups.get(l)!.push(id);
  }

  const cx = width / 2;
  const cy = height / 2;
  const RING = 80;
  const positions = new Map<string, { x: number; y: number }>();

  for (const [l, ids] of groups) {
    if (l === 0) {
      positions.set(centerNodeId, { x: cx, y: cy });
      continue;
    }
    const nonOuterLayers = Array.from(groups.keys()).filter(k => k < 999);
    const maxLayer = nonOuterLayers.length > 0 ? Math.max(...nonOuterLayers) : 1;
    const r = l === 999 ? (maxLayer + 1) * RING + 60 : l * RING;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
      positions.set(id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    });
  }

  return positions;
}

export function GraphView({
  graphData,
  activatedSet,
  newActivated,
  selectedNodeId,
  onNodeClick,
  isPlaying,
  bottleneckSet,
  focusNodeId,
}: Props) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [layoutMode, setLayoutMode] = useState<'force' | 'concentric'>('force');
  const [filterCommunities, setFilterCommunities] = useState<Set<string>>(new Set());
  const newSet = useMemo(() => new Set(newActivated), [newActivated]);

  const communityColorMap = useMemo(
    () => (graphData ? buildCommunityColorMap(graphData.nodes) : {}),
    [graphData]
  );

  const toggleFilter = useCallback((community: string) => {
    setFilterCommunities(prev => {
      const next = new Set(prev);
      if (next.has(community)) next.delete(community);
      else next.add(community);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Spread KOL nodes by giving them much stronger repulsion
  useEffect(() => {
    if (!fgRef.current || !graphData) return;
    fgRef.current.d3Force(
      'charge',
      d3.forceManyBody<any>().strength((node: any) => (node.type === 'kol' ? -400 : -60))
    );
    fgRef.current.d3ReheatSimulation();
  }, [graphData]);

  useEffect(() => {
    if (!graphData) return;
    if (focusNodeId) {
      applyConcentricLayout(focusNodeId);
      setLayoutMode('concentric');
    } else {
      restoreForceLayout();
      setLayoutMode('force');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNodeId, graphData]);

  const graphForce = useMemo(
    () =>
      graphData
        ? {
            nodes: graphData.nodes.map((n) => ({ ...n, val: n.influence * 5 })),
            links: graphData.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
          }
        : { nodes: [], links: [] },
    [graphData]
  );

  const nodeColor = useCallback(
    (node: any) => {
      const filtered = filterCommunities.size > 0 && !filterCommunities.has(node.community);
      if (filtered) return '#2a3a4a';
      if (newSet.has(node.id)) return '#00ff9d';
      if (activatedSet.has(node.id)) return '#ef4444';
      return communityColorMap[node.community] ?? '#5a7a9a';
    },
    [activatedSet, newSet, filterCommunities, communityColorMap]
  );

  const nodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const size = node.type === 'kol' ? 8 : Math.max(2, node.influence * 5);
      const isActivated = activatedSet.has(node.id);
      const isNew = newSet.has(node.id);
      const isSelected = node.id === selectedNodeId;

      // Gold stroke ring for KOL
      if (node.type === 'kol') {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
        ctx.strokeStyle = isActivated ? 'rgba(0,255,157,0.85)' : 'rgba(245,166,35,0.9)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Glow for newly activated
      if (isNew) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0,255,157,0.15)';
        ctx.fill();
      }

      // Selected highlight
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 3, 0, 2 * Math.PI);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Orange dashed ring for bottleneck nodes
      if (bottleneckSet.has(node.id)) {
        ctx.save();
        ctx.setLineDash([4 / globalScale, 2 / globalScale]);
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 8, 0, 2 * Math.PI);
        ctx.strokeStyle = 'rgba(249,115,22,0.85)';
        ctx.lineWidth = 1.5 / globalScale;
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor(node);
      ctx.fill();

      // Label for KOL
      if (node.type === 'kol' && globalScale > 0.15) {
        const label = node.name.split(' ')[0];
        ctx.font = `${10 / globalScale}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(label, node.x, node.y - size - 3);
      }
    },
    [activatedSet, newSet, selectedNodeId, nodeColor, bottleneckSet]
  );

  const linkColor = useCallback(
    (link: any) => {
      const srcActivated = activatedSet.has(link.source?.id ?? link.source);
      const tgtActivated = activatedSet.has(link.target?.id ?? link.target);
      if (srcActivated && tgtActivated) return 'rgba(0,255,157,0.35)';
      return 'rgba(0,212,255,0.18)';
    },
    [activatedSet]
  );

  const getHighestDegreeNode = useCallback((): string => {
    if (!graphData || graphData.nodes.length === 0) return '';
    const degree = new Map<string, number>();
    for (const e of graphData.edges) {
      degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
    let best = graphData.nodes[0].id;
    let bestDeg = 0;
    for (const [id, deg] of degree) {
      if (deg > bestDeg) { bestDeg = deg; best = id; }
    }
    return best;
  }, [graphData]);

  const applyConcentricLayout = useCallback((centerId: string) => {
    if (!fgRef.current || !graphData) return;
    const positions = computeConcentricPositions(
      graphData.nodes.map((n) => n.id),
      graphData.edges.map((e) => ({ source: e.source, target: e.target })),
      centerId,
      dimensions.width,
      dimensions.height
    );
    fgRef.current.d3Force('x', d3.forceX((d: any) => positions.get(d.id)?.x ?? dimensions.width / 2).strength(1));
    fgRef.current.d3Force('y', d3.forceY((d: any) => positions.get(d.id)?.y ?? dimensions.height / 2).strength(1));
    fgRef.current.d3ReheatSimulation();
  }, [graphData, dimensions]);

  const restoreForceLayout = useCallback(() => {
    if (!fgRef.current) return;
    fgRef.current.d3Force('x', null);
    fgRef.current.d3Force('y', null);
    fgRef.current.d3ReheatSimulation();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full bg-void overflow-hidden relative">
      <ForceGraph2D
        ref={fgRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={graphForce}
        nodeId="id"
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
          const size = node.type === 'kol' ? 10 : 6;
          ctx.beginPath();
          ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
          ctx.fillStyle = color;
          ctx.fill();
        }}
        linkColor={linkColor}
        linkWidth={0.5}
        linkDirectionalParticles={(link: any) => {
          if (!isPlaying) return 0;
          const srcId = link.source?.id ?? link.source;
          return activatedSet.has(srcId) ? 1 : 0;
        }}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={PARTICLE_COLOR}
        onNodeClick={(node: any) => onNodeClick(node.id)}
        backgroundColor="#040d1a"
        cooldownTicks={100}
      />
      {graphData && (
        <div className="absolute top-3 left-3 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-xs space-y-1.5 border border-white/10">
          <div className="flex items-center justify-between mb-1">
            <span className="text-white/50 font-semibold tracking-wider uppercase text-[10px]">Legend</span>
            {filterCommunities.size > 0 && (
              <button
                onClick={() => setFilterCommunities(new Set())}
                className="text-white/30 hover:text-white/60 text-[10px] ml-3 transition-colors"
              >
                clear
              </button>
            )}
          </div>
          {Object.entries(communityColorMap).map(([name, color]) => {
            const active = filterCommunities.has(name);
            const dimmed = filterCommunities.size > 0 && !active;
            return (
              <div
                key={name}
                onClick={() => toggleFilter(name)}
                className="flex items-center gap-2 cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-white/5"
                style={{ opacity: dimmed ? 0.35 : 1 }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: color as string,
                    boxShadow: active ? `0 0 6px ${color}` : 'none',
                  }}
                />
                <span className={`capitalize transition-colors ${active ? 'text-white' : 'text-white/70'}`}>{name}</span>
                {active && <span className="ml-auto text-white/40">✓</span>}
              </div>
            );
          })}
          <div className="border-t border-white/10 pt-1.5 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[#00ff9d]" />
              <span className="text-white/70">Newly Activated</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-[#ef4444]" />
              <span className="text-white/70">Affected</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-[#f5a623] flex-shrink-0" style={{ backgroundColor: 'transparent' }} />
              <span className="text-white/70">KOL Node</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full border-2 border-dashed border-[#f97316] flex-shrink-0" style={{ backgroundColor: 'transparent' }} />
              <span className="text-white/70">Bottleneck</span>
            </div>
          </div>
        </div>
      )}
      {graphData && (
        <button
          onClick={() => {
            if (layoutMode === 'force') {
              setLayoutMode('concentric');
              applyConcentricLayout(getHighestDegreeNode());
            } else {
              setLayoutMode('force');
              restoreForceLayout();
            }
          }}
          className="btn-ghost absolute top-3 right-3 text-xs px-3 py-1.5 backdrop-blur-sm"
        >
          {layoutMode === 'force' ? '◎ Concentric' : '⟳ Force'}
        </button>
      )}
    </div>
  );
}
