import { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData } from '../types';
import * as d3 from 'd3';

const COMMUNITY_COLORS: Record<string, string> = {
  tech: '#3b82f6',
  fashion: '#ec4899',
  finance: '#f59e0b',
  food: '#10b981',
  sports: '#8b5cf6',
};

const PARTICLE_COLOR = () => 'rgba(74,222,128,0.8)';

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
  const newSet = useMemo(() => new Set(newActivated), [newActivated]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

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
      if (newSet.has(node.id)) return '#22c55e';
      if (activatedSet.has(node.id)) return '#86efac';
      return COMMUNITY_COLORS[node.community] ?? '#6b7280';
    },
    [activatedSet, newSet]
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
        ctx.strokeStyle = isActivated ? 'rgba(34,197,94,0.8)' : 'rgba(251,191,36,0.85)';
        ctx.lineWidth = 2 / globalScale;
        ctx.stroke();
      }

      // Glow for newly activated
      if (isNew) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, size + 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(34,197,94,0.2)';
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
      if (node.type === 'kol' && globalScale > 0.8) {
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
      if (srcActivated && tgtActivated) return 'rgba(34,197,94,0.4)';
      return 'rgba(255,255,255,0.05)';
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
    <div ref={containerRef} className="w-full h-full bg-gray-900 overflow-hidden relative">
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
        linkDirectionalParticles={isPlaying ? 3 : 0}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={2}
        linkDirectionalParticleColor={PARTICLE_COLOR}
        onNodeClick={(node: any) => onNodeClick(node.id)}
        backgroundColor="#111827"
        cooldownTicks={100}
      />
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
          className="absolute top-3 right-3 bg-gray-800/90 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1.5 rounded border border-gray-600 backdrop-blur-sm transition-colors"
        >
          {layoutMode === 'force' ? '◎ Concentric' : '⟳ Force'}
        </button>
      )}
    </div>
  );
}
