# Frontend Missing Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement 6 missing frontend features: particles, KOL ring, bottleneck markers, concentric layout toggle, Layer 2 concentric, and compare modal.

**Architecture:** All changes are purely frontend. GraphView.tsx receives 3 new props (isPlaying, bottleneckSet, focusNodeId) and gains layout-switching logic. CompareModal.tsx is a new standalone component. No backend changes.

**Tech Stack:** React 18, TypeScript, react-force-graph-2d, d3 v7 (already installed)

---

## File Map

| Action | File | Change |
|--------|------|--------|
| Modify | `frontend/src/types.ts` | Add `CompareRequest`, `CompareResult` |
| Modify | `frontend/src/api/client.ts` | Add `compareSimulations()` |
| Modify | `frontend/src/components/GraphView.tsx` | Particles, rings, concentric layout, focusNodeId |
| Modify | `frontend/src/components/AnalyticsPanel.tsx` | Bottleneck nodes list |
| Modify | `frontend/src/components/InvestPanel.tsx` | Scenario saving + compare button |
| Create | `frontend/src/components/CompareModal.tsx` | 2-column compare display |
| Modify | `frontend/src/App.tsx` | Pass new props to GraphView + CompareModal state |

---

## Task 1: Types and API for Compare

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Add Compare types to types.ts**

Append to end of `frontend/src/types.ts`:

```ts
export interface CompareRequest {
  scenarios: SimRequest[];
  scenario_names: string[];
}

export interface CompareResult {
  results: SimResult[];
  names: string[];
}
```

- [ ] **Step 2: Add compareSimulations() to api/client.ts**

Append to end of `frontend/src/api/client.ts`:

```ts
export async function compareSimulations(req: CompareRequest): Promise<CompareResult> {
  const res = await fetch(`${BASE}/simulate/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`/simulate/compare failed: ${res.statusText}`);
  return res.json();
}
```

Also add `CompareRequest, CompareResult` to the import in `api/client.ts` line 1:

```ts
import type { GraphData, SimRequest, SimResult, NodeDetailResponse, CompareRequest, CompareResult } from '../types';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

Expected: no errors (or same errors as before this task)

- [ ] **Step 4: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/types.ts frontend/src/api/client.ts && git commit -m "feat: add CompareRequest/CompareResult types and compareSimulations API"
```

---

## Task 2: GraphView – Particles + New Props Wiring

Adds edge particle animation (plays only when simulation is playing), and wires the 3 new props into GraphView and App.tsx.

**Files:**
- Modify: `frontend/src/components/GraphView.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add new props to GraphView interface**

Replace the `interface Props` block in `frontend/src/components/GraphView.tsx` (lines 13–19):

```ts
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
```

- [ ] **Step 2: Destructure new props in GraphView function**

Replace the destructure line (current line 22–27):

```ts
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
```

- [ ] **Step 3: Add linkDirectionalParticles props to ForceGraph2D**

In the `<ForceGraph2D ... />` JSX (around line 120), add these 4 props after `linkWidth={0.5}`:

```tsx
linkDirectionalParticles={isPlaying ? 3 : 0}
linkDirectionalParticleSpeed={0.004}
linkDirectionalParticleWidth={2}
linkDirectionalParticleColor={() => 'rgba(74,222,128,0.8)'}
```

- [ ] **Step 4: Pass new props in App.tsx**

In `App.tsx`, derive `bottleneckSet` before the return statement (after line 41):

```ts
const bottleneckSet = useMemo(
  () => new Set<string>(simResult?.analytics.bottleneck_nodes ?? []),
  [simResult]
);
```

Add `useMemo` to the React import at line 1:
```ts
import { useState, useCallback, useMemo } from 'react';
```

Then update the `<GraphView ... />` JSX (around line 108–114) to pass the new props:

```tsx
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
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

Expected: no type errors

- [ ] **Step 6: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/GraphView.tsx frontend/src/App.tsx && git commit -m "feat: add isPlaying/bottleneckSet/focusNodeId props + particle animation"
```

---

## Task 3: GraphView – KOL Gold Ring + Bottleneck Dashed Ring

Upgrades KOL glow from soft fill to a gold stroke ring, and adds orange dashed outer ring for bottleneck nodes.

**Files:**
- Modify: `frontend/src/components/GraphView.tsx`

- [ ] **Step 1: Replace KOL glow block in nodeCanvasObject**

Current code at lines 67–72:

```ts
// Glow for KOL
if (node.type === 'kol') {
  ctx.beginPath();
  ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
  ctx.fillStyle = isActivated ? 'rgba(34,197,94,0.3)' : 'rgba(255,215,0,0.2)';
  ctx.fill();
}
```

Replace with:

```ts
// Gold stroke ring for KOL
if (node.type === 'kol') {
  ctx.beginPath();
  ctx.arc(node.x, node.y, size + 4, 0, 2 * Math.PI);
  ctx.strokeStyle = isActivated ? 'rgba(34,197,94,0.8)' : 'rgba(251,191,36,0.85)';
  ctx.lineWidth = 2 / globalScale;
  ctx.stroke();
}
```

- [ ] **Step 2: Add bottleneck dashed ring after the selected-highlight block**

After the selected highlight block (after the `ctx.stroke()` for `isSelected`, before the main fill circle), add:

```ts
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
```

- [ ] **Step 3: Add bottleneckSet to nodeCanvasObject dependency array**

Current last line of nodeCanvasObject useCallback:
```ts
  [activatedSet, newSet, selectedNodeId, nodeColor]
```

Replace with:
```ts
  [activatedSet, newSet, selectedNodeId, nodeColor, bottleneckSet]
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 5: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/GraphView.tsx && git commit -m "feat: KOL gold stroke ring + bottleneck orange dashed ring"
```

---

## Task 4: AnalyticsPanel – Bottleneck Nodes List

Adds a "Bottleneck Nodes" section that shows node names (clickable to navigate to that node).

**Files:**
- Modify: `frontend/src/components/AnalyticsPanel.tsx`
- Modify: `frontend/src/App.tsx` (pass onNodeSelect to AnalyticsPanel)

- [ ] **Step 1: Update AnalyticsPanel Props interface**

Replace the `interface Props` block at the top of `frontend/src/components/AnalyticsPanel.tsx`:

```ts
import type { Analytics, Node } from '../types';

interface Props {
  analytics: Analytics | null;
  currentActivated: number;
  totalNodes: number;
  graphNodes: Node[];
  onNodeSelect: (nodeId: string) => void;
}
```

- [ ] **Step 2: Destructure new props**

Replace `export function AnalyticsPanel({ analytics, currentActivated, totalNodes }: Props)` with:

```ts
export function AnalyticsPanel({ analytics, currentActivated, totalNodes, graphNodes, onNodeSelect }: Props) {
```

- [ ] **Step 3: Add bottleneck section before the closing div**

In the return, after the community penetration block (before `</div>`), add:

```tsx
{analytics.bottleneck_nodes.length > 0 && (
  <div>
    <div className="text-gray-400 text-xs mb-1">Bottleneck Nodes</div>
    <div className="flex flex-wrap gap-1">
      {analytics.bottleneck_nodes.map((nodeId) => {
        const n = graphNodes.find((g) => g.id === nodeId);
        return (
          <button
            key={nodeId}
            onClick={() => onNodeSelect(nodeId)}
            className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 hover:bg-orange-500/40 transition-colors"
          >
            {n?.name ?? nodeId}
          </button>
        );
      })}
    </div>
  </div>
)}
```

- [ ] **Step 4: Update App.tsx to pass new props to AnalyticsPanel**

In `App.tsx`, replace the `<AnalyticsPanel ... />` JSX:

```tsx
<AnalyticsPanel
  analytics={simResult?.analytics ?? null}
  currentActivated={currentActivated}
  totalNodes={totalNodes}
  graphNodes={graphData?.nodes ?? []}
  onNodeSelect={(nodeId) => { setSelectedNodeId(nodeId); setLayer('nodeDetail'); }}
/>
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 6: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/AnalyticsPanel.tsx frontend/src/App.tsx && git commit -m "feat: bottleneck nodes list in AnalyticsPanel"
```

---

## Task 5: GraphView – Global Concentric Layout Toggle

Adds a toggle button (top-right of canvas) to switch between force-directed and concentric layouts. In concentric mode, nodes are positioned by BFS layer using d3Force.

**Files:**
- Modify: `frontend/src/components/GraphView.tsx`

- [ ] **Step 1: Add d3 import at top of GraphView.tsx**

After line 2 (`import ForceGraph2D from 'react-force-graph-2d';`), add:

```ts
import * as d3 from 'd3';
```

- [ ] **Step 2: Add layoutMode state inside GraphView function**

After `const [dimensions, setDimensions] = useState(...)`, add:

```ts
const [layoutMode, setLayoutMode] = useState<'force' | 'concentric'>('force');
```

- [ ] **Step 3: Add computeConcentricPositions helper**

Add this pure function before the `GraphView` component definition (above `export function GraphView`):

```ts
function computeConcentricPositions(
  nodeIds: string[],
  edges: { source: string; target: string }[],
  centerNodeId: string,
  width: number,
  height: number
): Map<string, { x: number; y: number }> {
  // Build adjacency set
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
    for (const nb of adj.get(cur) ?? []) {
      if (!layer.has(nb)) {
        layer.set(nb, curLayer + 1);
        queue.push(nb);
      }
    }
  }
  // Disconnected nodes get a large layer
  for (const id of nodeIds) {
    if (!layer.has(id)) layer.set(id, 99);
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
    const r = l === 99 ? (Math.max(...groups.keys().filter(k => k < 99)) + 1) * RING + 60 : l * RING;
    ids.forEach((id, i) => {
      const angle = (2 * Math.PI * i) / ids.length - Math.PI / 2;
      positions.set(id, { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
    });
  }

  return positions;
}
```

- [ ] **Step 4: Add applyConcentricLayout and restoreForceLayout callbacks**

Inside the `GraphView` function, after the `linkColor` callback, add:

```ts
const getHighestDegreeNode = useCallback((): string => {
  if (!graphData) return '';
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
```

- [ ] **Step 5: Add toggle button overlay inside the container div**

Replace the return JSX container:

```tsx
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
      linkDirectionalParticleColor={() => 'rgba(74,222,128,0.8)'}
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
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

Expected: no errors

- [ ] **Step 7: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/GraphView.tsx && git commit -m "feat: concentric layout toggle with D3 force positioning"
```

---

## Task 6: GraphView – Layer 2 Auto-Concentric on focusNodeId

When `focusNodeId` is set (user clicked a node → Layer 2), automatically switch the graph to concentric layout centered on that node. When focusNodeId is cleared (back to global), restore previous layout.

**Files:**
- Modify: `frontend/src/components/GraphView.tsx`

- [ ] **Step 1: Add useEffect that reacts to focusNodeId changes**

After the ResizeObserver `useEffect`, add:

```ts
useEffect(() => {
  if (focusNodeId && graphData) {
    applyConcentricLayout(focusNodeId);
  } else if (!focusNodeId && layoutMode === 'force') {
    restoreForceLayout();
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [focusNodeId, graphData]);
```

Note: We intentionally omit `layoutMode`, `applyConcentricLayout`, `restoreForceLayout` from deps to avoid re-triggering on every rerender. The `// eslint-disable-next-line` suppresses the warning.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/GraphView.tsx && git commit -m "feat: Layer 2 auto-concentric centered on selected node"
```

---

## Task 7: CompareModal Component

New component that shows 2 scenarios side-by-side with metric diffs.

**Files:**
- Create: `frontend/src/components/CompareModal.tsx`

- [ ] **Step 1: Create CompareModal.tsx**

Create `frontend/src/components/CompareModal.tsx`:

```tsx
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

  const winner = a.analytics.coverage >= b.analytics.coverage ? nameA : nameB;

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
            {Object.keys(a.analytics.community_penetration).map((comm) => {
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
              <span className="text-white font-semibold">{winner}</span> achieves higher coverage. Prefer this scenario.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

- [ ] **Step 3: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/CompareModal.tsx && git commit -m "feat: CompareModal with side-by-side metrics and recommendation"
```

---

## Task 8: InvestPanel – Scenario Saving + Compare Trigger

Adds "Save Scenario" button after each simulation, and "Compare Scenarios" button when 2 are saved. Triggers CompareModal via App.tsx.

**Files:**
- Modify: `frontend/src/components/InvestPanel.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Update InvestPanel Props and add scenario state**

Replace the full `InvestPanel.tsx` file content:

```tsx
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
    const name = `Scenario ${savedScenarios.length + 1} (${selectedSeeds.length} KOLs)`;
    const next = [...savedScenarios, { name, req: lastReq, result: lastResult }].slice(-2);
    setSavedScenarios(next);
  };

  const canSave = lastResult && lastReq && savedScenarios.length < 2;
  const canCompare = savedScenarios.length === 2;

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

      {canSave && (
        <button
          onClick={handleSaveScenario}
          className="bg-blue-700 hover:bg-blue-600 text-white rounded px-4 py-1.5 text-sm transition-colors"
        >
          Save as Scenario {savedScenarios.length + 1}
        </button>
      )}

      {savedScenarios.length > 0 && (
        <div className="text-xs text-gray-400 flex flex-col gap-0.5">
          {savedScenarios.map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              <span className={i === 0 ? 'text-blue-400' : 'text-purple-400'}>■</span>
              <span>{s.name}</span>
            </div>
          ))}
        </div>
      )}

      {canCompare && (
        <button
          onClick={() => onCompare(savedScenarios)}
          className="bg-purple-600 hover:bg-purple-500 text-white rounded px-4 py-2 text-sm font-semibold transition-colors"
        >
          Compare Scenarios
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update App.tsx for compare flow**

Add compare state and imports in `App.tsx`:

At the top, add import:
```ts
import { CompareModal } from './components/CompareModal';
import type { SavedScenario } from './components/InvestPanel';
import { compareSimulations } from './api/client';
import type { CompareResult } from './types';
```

Add state after existing state declarations:
```ts
const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
```

Add handler:
```ts
const handleCompare = useCallback(async (scenarios: SavedScenario[]) => {
  try {
    const result = await compareSimulations({
      scenarios: scenarios.map((s) => s.req),
      scenario_names: scenarios.map((s) => s.name),
    });
    setCompareResult(result);
  } catch (e: any) {
    setError(e.message);
  }
}, []);
```

Update the `<InvestPanel ... />` JSX to pass new props:
```tsx
<InvestPanel
  graphData={graphData}
  selectedSeeds={selectedSeeds}
  onSeedsChange={setSelectedSeeds}
  onRunSimulation={handleRunSimulation}
  isLoading={isSimulating}
  lastResult={simResult}
  onCompare={handleCompare}
/>
```

Add `<CompareModal>` just before the closing `</div>` of the root element:
```tsx
{compareResult && (
  <CompareModal result={compareResult} onClose={() => setCompareResult(null)} />
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/lyon/buildathon_2026/frontend && npm run build 2>&1 | tail -5
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
cd /Users/lyon/buildathon_2026 && git add frontend/src/components/InvestPanel.tsx frontend/src/components/CompareModal.tsx frontend/src/App.tsx && git commit -m "feat: scenario saving + compare modal flow"
```

---

## Verification Checklist

After all tasks, manually verify in the browser (`npm run dev`, backend running on port 8001):

- [ ] Load graph → KOL nodes have visible gold ring
- [ ] Run simulation → edges show green particle flow while playing
- [ ] Analytics panel shows "Bottleneck Nodes" section with clickable names
- [ ] Bottleneck nodes have orange dashed ring in graph
- [ ] Click "◎ Concentric" → graph smoothly transitions to concentric layout; button changes to "⟳ Force"
- [ ] Click "⟳ Force" → graph returns to force layout
- [ ] Click any node → graph switches to concentric centered on that node
- [ ] Click "Global" breadcrumb → graph restores previous layout
- [ ] Run 2 simulations, save each → "Compare Scenarios" button appears
- [ ] Click "Compare Scenarios" → modal shows side-by-side metrics with diff highlights and recommendation
