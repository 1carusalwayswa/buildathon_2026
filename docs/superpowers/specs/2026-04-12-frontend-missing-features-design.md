# SocialSim 前端缺失功能设计文档

**日期**: 2026-04-12  
**状态**: 待实现  
**参考**: `docs/design.md`

---

## 背景

前端核心流程已通，但以下 6 个功能尚未实现。本文档描述设计决策和实现方案。

---

## 功能一：KOL 节点光晕效果

**位置**: `GraphView.tsx`

使用 react-force-graph-2d 的 `nodeCanvasObject` 回调，在 KOL 节点外绘制金色实线光晕圆：

```ts
nodeCanvasObject={(node, ctx, globalScale) => {
  // KOL 节点：先画光晕
  if (node.type === 'kol') {
    ctx.beginPath();
    ctx.arc(node.x, node.y, (node.val * 0.5 + 6) / globalScale, 0, 2 * Math.PI);
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.7)';  // 金色
    ctx.lineWidth = 2 / globalScale;
    ctx.stroke();
  }
  // 普通节点绘制（填色圆）
  ctx.beginPath();
  ctx.arc(node.x, node.y, node.val * 0.5 / globalScale, 0, 2 * Math.PI);
  ctx.fillStyle = communityColor(node.community);
  ctx.fill();
}}
nodeCanvasObjectMode={() => 'replace'}
```

---

## 功能二：瓶颈节点标记

**位置**: `GraphView.tsx`（图上）+ `AnalyticsPanel.tsx`（指标面板）+ `NodeDetail.tsx`（节点详情）

### 图上标记

在 `nodeCanvasObject` 中，瓶颈节点额外绘制橙色虚线外环：

```ts
if (bottleneckSet.has(node.id)) {
  ctx.setLineDash([4 / globalScale, 2 / globalScale]);
  ctx.beginPath();
  ctx.arc(node.x, node.y, (node.val * 0.5 + 10) / globalScale, 0, 2 * Math.PI);
  ctx.strokeStyle = 'rgba(249, 115, 22, 0.8)';  // 橙色
  ctx.lineWidth = 1.5 / globalScale;
  ctx.stroke();
  ctx.setLineDash([]);
}
```

`bottleneckSet` 从 `SimulationResult.analytics.bottleneck_nodes` 派生（`Set<string>`）。

### 面板展示

`AnalyticsPanel` 新增"瓶颈节点"卡片，列出 `bottleneck_nodes` 的 id 和名称（可点击跳转节点详情）。

`NodeDetail` 右侧统计区新增"是否瓶颈"徽章（橙色 badge）。

---

## 功能三：边粒子流动动画

**位置**: `GraphView.tsx`

使用 react-force-graph-2d 内置 particle 支持，仅在模拟播放时激活：

```tsx
<ForceGraph2D
  linkDirectionalParticles={isPlaying ? 2 : 0}
  linkDirectionalParticleSpeed={0.005}
  linkDirectionalParticleWidth={2}
  linkDirectionalParticleColor={() => 'rgba(74, 222, 128, 0.7)'}
/>
```

`isPlaying` 来自 `SimulationPlayer` 的播放状态，通过 prop 或 context 传入。

---

## 功能四：同心圆布局切换

**位置**: `GraphView.tsx`

### 触发

右上角切换按钮（已有 canvas 父容器），点击 toggle `layoutMode: 'force' | 'concentric'`。

### 实现

进入同心圆模式时，根据节点的 BFS 层级（以度数最高的节点为中心）计算坐标：

```ts
function concentricPositions(nodes: Node[], edges: Edge[]): Map<string, {x:number, y:number}> {
  // 1. 找度数最高节点作为中心
  // 2. BFS 分层
  // 3. 各层节点均匀分布在半径 r = layer * 80 的圆上
  // 4. 返回 id -> {x, y} 映射
}
```

通过 d3Force 固定位置：

```ts
graphRef.current.d3Force('x', d3.forceX(d => positions.get(d.id).x).strength(1));
graphRef.current.d3Force('y', d3.forceY(d => positions.get(d.id).y).strength(1));
graphRef.current.d3ReheatSimulation();
```

退出同心圆模式时，移除自定义 force，重新 reheat 回力导向布局。

切换时有 600ms 的位置补间动画（d3 force 本身提供平滑过渡）。

---

## 功能五：Layer 2 同心圆视图

**位置**: `NodeDetail.tsx` / `GraphView.tsx`

点击节点进入 Layer 2 时，主图自动切换到同心圆布局，并以选中节点为中心（BFS 中心改为选中节点）：

- 同心圆中心 = 选中节点
- 显示 1-2 跳邻居（过滤其他节点的显示，或降低透明度）
- 退出 Layer 2 时恢复原布局模式

**Props 变更**: `GraphView` 新增 `focusNodeId?: string`，有值时用该节点作为同心圆中心。

---

## 功能六：方案对比（Compare Modal）

**位置**: `InvestPanel.tsx`（按钮） + 新增 `CompareModal.tsx`

### 触发流程

1. 用户在 InvestPanel 选好种子节点，跑完一次模拟后，切换节点选择再跑第二次
2. InvestPanel 维护 `savedScenarios: Scenario[]`（最多 2 个），每次模拟后弹出"保存此方案"按钮
3. 两个方案都保存后，"对比方案"按钮激活，点击打开 `CompareModal`

### API

调用 `POST /simulate/compare`（后端已实现）：

```ts
interface CompareRequest {
  scenarios: { seed_nodes: string[]; brand_content: string }[];
}
```

### CompareModal 内容

- 两列并排指标卡片：覆盖率、传播深度、峰值时间步、社区渗透
- 差值高亮（绿色正向 / 红色负向）
- 底部"推荐选择"文字（覆盖率更高的方案）
- 关闭按钮

---

## 实现顺序

| 优先级 | 功能 | 改动文件 | 估时 |
|--------|------|----------|------|
| 1 | 粒子流动 | `GraphView.tsx` | 10min |
| 2 | KOL 光晕 + 瓶颈标记（图上） | `GraphView.tsx` | 20min |
| 3 | 瓶颈面板展示 | `AnalyticsPanel.tsx`, `NodeDetail.tsx` | 15min |
| 4 | 同心圆切换 | `GraphView.tsx` | 40min |
| 5 | Layer 2 同心圆 | `GraphView.tsx`, `NodeDetail.tsx` | 20min |
| 6 | 方案对比 Modal | `InvestPanel.tsx`, 新建 `CompareModal.tsx` | 30min |

---

## 约束

- 不引入新的第三方库（d3 已有，react-force-graph-2d 已有）
- 同心圆布局仅用 500 节点的子图（已有限制），性能无虞
- CompareModal 直接调用已有 `/simulate/compare` 端点，无后端改动
