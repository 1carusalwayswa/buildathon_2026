# SocialSim — 社交网络影响力模拟器

## 概述

为企业提供社交网络影响力分析和传播模拟的可视化工具。用户可以在模拟的社交网络中选择 KOL 节点进行"投放"，观察信息传播过程，对比不同投放方案的 ROI。

**核心价值**：回答"选哪些 KOL 投放，传播效率最高？"

## 技术栈

- **后端**: Python 3.12, FastAPI
- **前端**: React 18, TypeScript, Vite
- **图可视化**: react-force-graph (力导向图) + D3.js (同心圆布局)
- **LLM**: Claude API (KOL Agent 决策)
- **通信**: REST API (后端预计算，前端回放)

## 架构：混合驱动

后端预计算完整模拟结果（所有时间步），一次性返回给前端，前端负责动画回放和交互。

```
前端 (React)                         后端 (FastAPI)
┌─────────────┐  GET /graph          ┌──────────────────┐
│ GraphView   │ ──────────────────→  │ GraphGenerator   │
│ SimPlayer   │                      │ (BA网络生成)      │
│ Analytics   │  POST /simulate      │                  │
│ InvestPanel │ ──────────────────→  │ SimulationEngine │
│             │ ←──────────────────  │ (规则 + LLM)     │
│             │   SimResult[]        │                  │
└─────────────┘                      └──────────────────┘
```

## 数据模型

### Node（节点 = 人）

```json
{
  "id": "n_042",
  "name": "张三",
  "type": "kol | normal",
  "community": "tech",
  "influence": 0.85,
  "activity": 0.7,
  "sentiment": 0.6,
  "followers": 12400,
  "persona": "科技博主，关注AI和消费电子..."  // KOL 专属
}
```

### Edge（边 = 关系）

```json
{
  "source": "n_042",
  "target": "n_108",
  "weight": 0.6,
  "type": "follow | friend"
}
```

### 网络生成

使用 Barabási-Albert 无标度网络模型，参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| n_nodes | 500 | 总节点数 |
| n_kol | 15 | KOL 数量（度数最高的节点） |
| m_edges | 3 | BA 模型每步连接数 |
| n_communities | 5 | 社区数量 |

节点属性（influence, activity, sentiment）随机生成，KOL 节点的 influence 偏高。社区通过 modularity-based 分区算法划分。

## 模拟引擎

### 普通节点 — 规则引擎 (Independent Cascade 变体)

每个时间步，已激活节点尝试激活邻居：

```
P(激活) = weight × influence × activity × sentiment
```

- 已激活节点只尝试一次激活每个邻居
- 新激活节点在下一时间步参与传播
- 无新激活时模拟结束

### KOL 节点 — LLM Agent

当传播到达 KOL 节点时，调用 Claude API：

**输入**: KOL persona + 品牌推广内容 + 当前网络舆论上下文

**输出**:
- `action`: repost（转发）| comment（评论）| ignore（忽略）
- `reason`: 决策理由
- `content`: 模拟生成的帖子内容
- `reasoning_steps`: 逐步推理过程（内容分析 → 品牌评估 → 受众匹配 → 决策）

**传播影响**:
- 转发：对每个邻居以 `P = weight × 0.9` 概率激活
- 评论：对每个邻居以 `P = weight × 0.4` 概率激活
- 忽略：不传播

### 模拟输出格式

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
      "agent_decisions": [
        {
          "node_id": "n_12",
          "action": "repost",
          "reason": "...",
          "content": "模拟帖子...",
          "reasoning_steps": [
            { "step": "内容分析", "result": "相关性高", "pass": true },
            { "step": "品牌评估", "result": "口碑中性偏正", "pass": true },
            { "step": "受众匹配", "result": "重合度72%", "pass": true }
          ]
        }
      ]
    }
  ],
  "analytics": { "..." }
}
```

## 分析指标

```json
{
  "coverage": 0.73,
  "max_depth": 6,
  "peak_step": 3,
  "total_activated": 365,
  "community_penetration": {
    "tech": 0.92, "fashion": 0.45, "finance": 0.31,
    "food": 0.18, "sports": 0.05
  },
  "node_contributions": [
    { "node_id": "n_1", "direct_reach": 47, "indirect_reach": 95, "contribution_pct": 0.284 }
  ],
  "bottleneck_nodes": ["n_1", "n_42"],
  "critical_paths": [["n_1", "n_12", "n_78", "n_201"]]
}
```

## 前端 UI — 三层下钻

### Layer 1: 全局总览（默认视图）

- **左侧 60%**: 网络图画布
  - 力导向图 (react-force-graph)，节点大小按 influence，颜色按 community
  - KOL 节点有光晕效果
  - 右上角切换力导向/同心圆视图
  - 模拟时节点逐步"亮起"（绿色），边上有粒子流动
- **右侧 40%**: 三个面板
  - 投放控制：选择/添加种子节点，触发模拟，方案对比按钮
  - 全局指标：4 格卡片（覆盖率、传播深度、峰值时间步、社区渗透）
  - ROI 排名：各种子节点的触达效果排序
- **底部**: 时间轴播放器（播放/暂停、进度条拖拽、速度控制 0.5x/1x/2x）

### Layer 2: 节点详情（点击节点进入）

- **左侧**: 同心圆视图，以选中节点为中心，按跳数向外排列邻居
- **右侧**:
  - 节点基础信息（名称、类型、社区）
  - 属性卡片（影响力、活跃度、好感度）
  - 传播效果统计（直接触达、间接触达、贡献覆盖率、传播路径数、是否瓶颈）
  - KOL 人设展示（仅 KOL 节点）
  - "查看 Agent 决策详情"按钮 → 进入 Layer 3

### Layer 3: Agent 决策详情（仅 KOL 节点）

- **左侧**: 决策推理过程（逐步展示：内容分析 → 品牌评估 → 受众匹配 → 最终决策）
- **右侧**: 模拟生成的社交媒体帖子（含转发/评论/点赞数预测）+ 传播影响摘要

## API 接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/graph` | GET | 生成并返回网络图数据，支持 n_nodes/n_kol/m_edges/n_communities 参数 |
| `/simulate` | POST | 运行传播模拟，输入种子节点+品牌信息，返回全部时间步+分析指标 |
| `/node/{node_id}` | GET | 返回节点详情、1-2跳邻居、传播统计 |
| `/simulate/compare` | POST | 多方案对比，输入多组种子节点，返回各方案结果+差异对比 |

## 后端模块

| 文件 | 职责 |
|------|------|
| `main.py` | FastAPI 应用入口，路由注册 |
| `graph.py` | BA 网络生成、节点属性分配、社区划分 |
| `simulation.py` | IC 模型传播引擎、时间步计算 |
| `agent.py` | Claude API 调用、KOL 决策逻辑 |
| `analytics.py` | 指标计算（覆盖率、路径、瓶颈、ROI） |
| `models.py` | Pydantic 数据模型 |

## 前端组件

| 组件 | 职责 |
|------|------|
| `App.tsx` | 路由和全局状态管理 |
| `GraphView.tsx` | react-force-graph 封装，力导向+同心圆切换 |
| `SimulationPlayer.tsx` | 时间轴、播放控制、动画状态驱动 |
| `InvestPanel.tsx` | 种子节点选择、模拟触发、方案管理 |
| `AnalyticsPanel.tsx` | 指标卡片展示 |
| `NodeDetail.tsx` | Layer 2 节点详情面板 |
| `AgentDetail.tsx` | Layer 3 Agent 推理和模拟内容展示 |
| `ROIRanking.tsx` | 投放节点 ROI 排名列表 |

## 约束

- 24 小时 hackathon，优先保证核心流程可 demo
- 网络规模控制在 500 节点左右，确保浏览器流畅
- LLM Agent 调用仅限 KOL 节点（约 15 个），控制 API 成本和延迟
- 合成数据，不依赖外部数据源2
