import { useRef, useCallback, useEffect, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { GraphData } from '../types';

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

export function GraphView({
  graphData,
  activatedSet,
  newActivated,
  selectedNodeId,
  onNodeClick,
  isPlaying,
  bottleneckSet,
}: Props) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const newSet = new Set(newActivated);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ width, height });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const graphForce = graphData
    ? {
        nodes: graphData.nodes.map((n) => ({ ...n, val: n.influence * 5 })),
        links: graphData.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight })),
      }
    : { nodes: [], links: [] };

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
        ctx.lineWidth = 2;
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

  return (
    <div ref={containerRef} className="w-full h-full bg-gray-900 overflow-hidden">
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
    </div>
  );
}
