# SocialSim 开发者文档

## 1. 项目概述

SocialSim 是一个**社交网络影响力传播模拟器**，面向企业营销决策场景。

**解决的问题**：品牌在社交媒体投放 KOL 营销时，难以量化评估"选哪些 KOL、传播效果最好"。SocialSim 通过生成合成社交网络、运行信息传播模拟，直观展示不同 KOL 组合的传播覆盖率和 ROI 差异。

**核心价值**：

- 在 500 节点 BA 无标度网络上模拟真实社交传播动态
- KOL 节点接入 Claude API，以 AI 角色扮演方式决策"转发/评论/忽略"
- 支持多方案对比，输出覆盖率、社区渗透率、传播路径等量化指标

---

## 2. 技术栈

| 层级 | 技术 |
|------|------|
| 后端框架 | Python 3.12, FastAPI |
| 网络算法 | NetworkX（BA 图生成、社区划分） |
| LLM | Anthropic Claude API（`claude-haiku-4-5-20251001`） |
| 前端框架 | React 18, TypeScript, Vite |
| 图可视化 | react-force-graph-2d（力导向） + D3.js（同心圆布局） |
| 样式 | Tailwind CSS |
| 通信 | REST API，前端通过 `/api` 代理到后端 |

---

## 3. 快速启动

### 环境要求

- Python 3.12+
- Node.js 18+
- Anthropic API Key

### 后端启动

```bash
cd /Users/lyon/socialsim-backend/socialsim/backend

python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

export ANTHROPIC_API_KEY="sk-ant-..."
uvicorn main:app --port 8001 --reload
```

后端运行在 `http://localhost:8001`，Swagger 文档：`http://localhost:8001/docs`

### 前端启动

```bash
cd /Users/lyon/socialsim-frontend/socialsim/frontend

npm install
npm run dev
```

前端运行在 `http://localhost:5173`，`/api` 路径自动代理到 `http://localhost:8001`。

---

## 4. 架构概览

### 混合驱动模式

后端**预计算**完整模拟结果（所有时间步），一次性返回给前端。前端负责**动画回放**和交互，不参与模拟计算。

```
用户操作（选 KOL + 填写品牌信息）
       │
       ▼
前端 (React)                         后端 (FastAPI)
┌─────────────────┐                  ┌──────────────────────┐
│ InvestPanel     │ GET /graph ──→   │ GraphGenerator       │
│ (选种子节点)    │ ←── GraphData    │ BA 网络 + 社区划分   │
│                 │                  │                      │
│                 │ POST /simulate → │ SimulationEngine     │
│ GraphView       │ ←── SimResult    │ IC 模型（普通节点）  │
│ (动画回放)      │                  │ Claude API（KOL节点）│
│                 │                  │ analytics 计算       │
│ AnalyticsPanel  │                  └──────────────────────┘
│ (指标展示)      │
└─────────────────┘
```

### 请求流程

1. 用户点击 **Load Graph** → `GET /graph` → 后端生成 BA 网络，缓存在内存中，返回节点/边数据
2. 用户选择 KOL 种子节点，填写品牌信息，点击 **Run Simulation** → `POST /simulate`
3. 后端运行 IC 模型，对每个被激活的 KOL 节点调用 Claude API，返回所有时间步数据 + 分析指标
4. 前端收到 `SimResult`，通过时间轴播放器逐步回放节点激活动画
5. 用户点击节点 → `GET /node/{id}` → 获取邻居详情，进入 Layer 2/3 下钻视图

---

## 5. API 接口

### GET `/graph`

生成并返回网络图数据。后端缓存最近一次生成的图，供后续模拟使用。

**查询参数**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `n_nodes` | int | 500 | 节点总数 |
| `n_kol` | int | 15 | KOL 数量（度数最高的节点） |
| `m_edges` | int | 3 | BA 模型每步连边数 |
| `n_communities` | int | 5 | 社区数量 |

**返回** `GraphData`：包含 `nodes[]` 和 `edges[]`

---

### POST `/simulate`

运行信息传播模拟。需先调用 `GET /graph` 初始化网络。

**请求体**

```json
{
  "seed_nodes": ["n_1", "n_5"],
  "brand_name": "TechBrand X",
  "brand_content": "革命性的 AI 助手，重新定义生产力",
  "n_steps": 20
}
```

**返回** `SimResult`：

```json
{
  "steps": [
    {
      "t": 0,
      "activated": ["n_1", "n_5"],
      "new_activated": ["n_1", "n_5"],
      "agent_decisions": []
    },
    {
      "t": 1,
      "activated": ["n_1", "n_5", "n_12"],
      "new_activated": ["n_12"],
      "agent_decisions": [{ "node_id": "n_12", "action": "repost", ... }]
    }
  ],
  "analytics": { ... }
}
```

---

### GET `/node/{node_id}`

返回节点详情及其 1-2 跳邻居信息。

**路径参数**：`node_id` — 节点 ID，如 `n_42`

**返回** `NodeDetailResponse`：

```json
{
  "node": { ... },
  "neighbors_1hop": [ ... ],   // 最多 50 个
  "neighbors_2hop": [ ... ],   // 最多 30 个
  "edges": [ ... ]
}
```

---

### POST `/simulate/compare`

对多组 KOL 方案并行模拟，返回各方案结果及差异对比。

**请求体**

```json
{
  "scenarios": [
    { "seed_nodes": ["n_1"], "brand_name": "X", "brand_content": "..." },
    { "seed_nodes": ["n_2", "n_3"], "brand_name": "X", "brand_content": "..." }
  ],
  "scenario_names": ["方案 A", "方案 B"]
}
```

**返回** `CompareResult`：`{ "results": [SimResult, SimResult], "names": [...] }`

---

## 6. 数据模型

### Node（节点）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | str | 节点唯一 ID，格式 `n_{index}` |
| `name` | str | 随机生成的用户名 |
| `type` | str | `"kol"` 或 `"normal"` |
| `community` | str | 所属社区：tech / fashion / finance / food / sports |
| `influence` | float | 影响力 0~1，KOL 偏高（0.6~1.0） |
| `activity` | float | 活跃度 0~1 |
| `sentiment` | float | 对品牌的好感度 0~1 |
| `followers` | int | 粉丝数，KOL 为 5000~50000，普通用户为 50~2000 |
| `persona` | str? | KOL 专属人设描述，传入 Claude 作为角色背景 |

### Edge（边）

| 字段 | 类型 | 说明 |
|------|------|------|
| `source` | str | 起点节点 ID |
| `target` | str | 终点节点 ID |
| `weight` | float | 关系强度 0.2~0.9，影响传播概率 |
| `type` | str | `"follow"` 或 `"friend"` |

### Analytics（分析指标）

| 字段 | 类型 | 说明 |
|------|------|------|
| `coverage` | float | 最终覆盖率（激活节点数 / 总节点数） |
| `max_depth` | int | 最大传播深度（时间步数） |
| `peak_step` | int | 新增激活节点最多的时间步 |
| `total_activated` | int | 最终被激活的总节点数 |
| `community_penetration` | dict | 各社区渗透率，如 `{"tech": 0.92}` |
| `node_contributions` | list | 各种子节点的直接/间接触达数和贡献百分比 |
| `bottleneck_nodes` | list | 贡献率 > 15% 的关键节点 |
| `critical_paths` | list | 各种子节点的关键传播路径（最长路径，最多 6 跳） |

### NodeContribution

| 字段 | 类型 | 说明 |
|------|------|------|
| `node_id` | str | 种子节点 ID |
| `direct_reach` | int | 直接激活（t=1 时激活）的节点数 |
| `indirect_reach` | int | 间接激活（t>1）的节点数 |
| `contribution_pct` | float | 该节点贡献占总激活数的比例 |

---

## 7. 前端功能

### 三层下钻 UI

**Layer 1 — 全局总览**（默认视图）

- 左侧画布：500 节点力导向图，节点大小按 `influence`，颜色按社区
- 右上角切换按钮：力导向布局 ↔ 同心圆布局
- 模拟回放时：新激活节点变绿（深绿 = 当前步，浅绿 = 已激活），边上有粒子流动效果
- 右侧面板：投放控制（InvestPanel）+ 全局指标（AnalyticsPanel）+ ROI 排名（ROIRanking）
- 底部：时间轴播放器（播放/暂停、进度条拖拽、0.5x/1x/2x 速度）

**Layer 2 — 节点详情**（点击任意节点进入）

- 画布自动切换为同心圆布局，以选中节点为圆心
- 右侧展示节点基础信息、属性卡片（影响力/活跃度/好感度）、传播统计
- KOL 节点显示人设描述 + "View Agent Decision"按钮

**Layer 3 — Agent 决策详情**（仅 KOL 节点，点击按钮进入）

- 左侧：逐步展示 Claude 推理过程（内容分析 → 品牌评估 → 受众匹配 → 最终决策）
- 右侧：模拟生成的社交媒体帖子内容 + 传播影响摘要

面包屑导航：`Global › Node Detail › Agent Decision`，支持逐层返回。

### 已实现的视觉/交互特性

1. **节点差异化渲染**：KOL 节点带金色光晕，瓶颈节点带橙色虚线圈，选中节点白色高亮
2. **动态激活动画**：按时间步逐步点亮节点，边上绿色粒子流动
3. **双布局切换**：力导向（全局）↔ 同心圆（节点中心），切换时平滑过渡
4. **方案保存对比**：最多保存 2 个方案，弹窗对比覆盖率、渗透率等指标，附差异百分比标注
5. **ResizeObserver 响应式画布**：监测容器实际尺寸，避免 canvas 覆盖右侧面板（BUG-1 修复）
6. **全量决策收集**：从所有步骤收集 KOL 决策，不受当前播放进度限制（BUG-3 修复）

---

## 8. 模拟引擎

### 普通节点 — Independent Cascade (IC) 模型

每个时间步，上一步新激活的节点尝试激活其邻居：

```
P(激活) = edge_weight × influence × activity × sentiment
```

- 每对 `(activator, target)` 只尝试一次，避免重复激活
- 新激活的节点在**下一时间步**才参与传播（BFS 分层）
- 无新激活节点时模拟提前终止

### KOL 节点 — Claude API Agent

当普通节点的传播到达 KOL 节点时，调用 `claude-haiku-4-5-20251001` 做决策：

**输入（user message）**

```
- Community: tech
- Persona: Tech blogger focused on AI and consumer electronics...
- Brand: TechBrand X
- Content: 革命性的 AI 助手...
- Current network sentiment: 0.65
```

**输出（JSON）**

```json
{
  "action": "repost",
  "reason": "内容与受众高度匹配",
  "content": "模拟发布的帖子内容...",
  "reasoning_steps": [
    {"step": "Content Analysis", "result": "相关性高", "passed": true},
    {"step": "Brand Evaluation", "result": "口碑中性偏正", "passed": true},
    {"step": "Audience Match", "result": "重合度72%", "passed": true},
    {"step": "Final Decision", "result": "决定转发", "passed": true}
  ]
}
```

**传播影响**

| 决策 | 邻居激活概率 |
|------|-------------|
| repost（转发） | `edge_weight × 0.9` |
| comment（评论） | `edge_weight × 0.4` |
| ignore（忽略） | 不传播 |

**容错处理**：Claude 返回带 markdown 代码块的 JSON 时，自动剥离 ` ```json ` 包裹后再解析（BUG-2 修复）。API 异常时降级为 `ignore`。

---

## 9. 开发说明

### 目录结构

```
buildathon_2026/
├── backend/
│   ├── main.py          # FastAPI 路由入口
│   ├── models.py        # Pydantic 数据模型
│   ├── graph.py         # BA 网络生成、社区划分
│   ├── simulation.py    # IC 传播引擎
│   ├── agent.py         # Claude API KOL 决策
│   ├── analytics.py     # 分析指标计算
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx                      # 主应用，全局状态管理
│       ├── types.ts                     # TypeScript 类型定义
│       ├── api/client.ts                # API 请求封装
│       ├── hooks/useSimulationState.ts  # 播放状态 Hook
│       └── components/
│           ├── GraphView.tsx            # 图可视化（力导向+同心圆）
│           ├── SimulationPlayer.tsx     # 时间轴播放控制
│           ├── InvestPanel.tsx          # 投放控制面板
│           ├── AnalyticsPanel.tsx       # 分析指标展示
│           ├── ROIRanking.tsx           # ROI 排名列表
│           ├── NodeDetail.tsx           # 节点详情（Layer 2）
│           ├── AgentDetail.tsx          # Agent 决策（Layer 3）
│           └── CompareModal.tsx         # 方案对比弹窗
└── docs/
    ├── design.md        # 原始设计文档
    ├── progress.md      # 实施进度记录
    └── README.md        # 本文件
```

### 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `ANTHROPIC_API_KEY` | 是 | Claude API 密钥，用于 KOL Agent 决策 |

前端无需额外环境变量，`/api` 代理在 `vite.config.ts` 中配置，指向 `http://localhost:8001`。

### 常见问题

**Q: 图画布遮挡右侧面板**

`react-force-graph-2d` 未传 `width`/`height` 时默认使用 `window.innerWidth × window.innerHeight`，canvas 铺满全屏。

修复：在 `GraphView.tsx` 中用 `ResizeObserver` 监测容器尺寸，显式传给 `ForceGraph2D`。

---

**Q: KOL Agent 决策报 JSON 解析错误**

Claude 有时返回 ` ```json ... ``` ` 包裹的响应，`json.loads` 在第一个反引号处失败。

修复：`agent.py` 中在 `json.loads` 前检测并剥离 markdown 代码块。

---

**Q: KOL 节点点击后无法进入 Agent 决策界面**

`allDecisions` 仅收集当前播放步的决策，而 KOL 决策通常在 step 1+ 才出现，播放在 step 0 时为空。

修复：`App.tsx` 改为从所有 `steps` 遍历收集完整决策，不受当前播放进度限制。

---

**Q: 后端端口选择**

使用 8001 而非 8000，避免与本地其他服务（如 DMS）冲突。

---

**Q: LLM 调用成本控制**

Agent 决策仅在 KOL 节点（约 15 个）被激活时触发，且每个 KOL 在整次模拟中只决策一次（`agent_decision_map` 缓存）。
