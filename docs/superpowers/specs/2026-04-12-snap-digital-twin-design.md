# SocialSim — SNAP Twitter 真实图谱 + Digital Twin 设计文档

**日期**：2026-04-12  
**状态**：已审批，待实施

---

## 1. 背景与目标

当前 SocialSim 使用 BA 合成网络（500节点）模拟社交传播。本次升级目标：

1. 接入 **SNAP Twitter ego-nets** 真实社交图数据，替换合成图
2. 基于真实节点拓扑**识别 KOL 节点**（PageRank Top 15）
3. 为每个 KOL 构建三层 **Digital Twin**，驱动更真实的 agent 决策

前端零改动，后端最小侵入。

---

## 2. 数据源

**SNAP Twitter ego-nets**（Stanford Network Analysis Project）  
- URL：https://snap.stanford.edu/data/ego-Twitter.html  
- 格式：`*.edges`（边列表）、`*.feat`（节点特征）、`*.egofeat`（ego 节点特征）  
- 存放路径：`data/snap/`  
- 下载脚本：`scripts/download_snap.sh`

---

## 3. 架构总览

```
[data/snap/*.edges]
       ↓
snap_loader.py
  ├── 解析边列表 → NetworkX 无向图
  ├── BFS 采样（上限 500 节点，自适应跳数）
  ├── Louvain 社区检测 → Claude 推断数据驱动的 community 标签
  └── PageRank KOL 识别（Top 15）
       ↓
twin_builder.py
  ├── 层 A：Claude 生成静态 persona（name/bio/topics/tone）
  ├── 层 B：拓扑推断行为倾向（engagement_bias / content_filters）
  └── 层 C：关系感知上下文（模拟时动态注入）
       ↓
_graph_cache（与合成图共用）
       ↓
/simulate → agent.py（解析新 persona JSON）→ 前端（不变）
```

---

## 4. 模块设计

### 4.1 `backend/snap_loader.py`

**职责**：将 SNAP 原始文件转换为与 `generate_graph()` 输出完全兼容的 dict。

**核心逻辑**：

```python
def load_snap_graph(
    data_dir: str = "data/snap",
    n_kol: int = 15,
    max_nodes: int = 500,
    seed: int | None = None,
) -> dict:
    ...
```

**采样策略**：
- 选取度数最高的 ego 节点作为起点
- BFS 展开，优先队列按度数排序
- 节点数命中 `max_nodes` 时停止（自动适应 1 跳或 2 跳）

**KOL 识别**：
- 计算 NetworkX `pagerank()`，取 Top `n_kol`
- PageRank 比纯度数更能反映传播影响力

**社区标签**：
- Louvain 算法检测社区（`python-louvain` 库）
- 每个社区取 Top 5 高度数节点的特征，调用 Claude 推断社区主题标签（如 "AI research"、"sports media"）
- 标签完全由数据驱动，不使用固定枚举

**输出 schema**：与 `models.py` 中 `Node` / `Edge` 完全一致，`influence` / `followers` 等字段由度数和 PageRank 线性归一化得到。

---

### 4.2 `backend/twin_builder.py`

**职责**：为 KOL 节点批量构建三层 Digital Twin，结果序列化为 JSON 写入节点 `persona` 字段。

#### 层 A — 静态画像（Static Profile）

调用 Claude API，输入节点属性，生成：
```json
{
  "name": "Jordan Wei",
  "bio": "AI researcher and tech commentator...",
  "topics": ["AI", "machine learning", "startups"],
  "tone": "analytical",
  "posting_frequency": "high",
  "brand_sensitivity": 0.6
}
```

#### 层 B — 行为倾向（Behavior Pattern）

从拓扑属性离线推断，无需 API 调用：

| 拓扑特征 | 推断行为 |
|---------|---------|
| 高介数中心性（>p75） | `bridge_role=true`，偏向转发跨社区内容 |
| 高聚类系数（>0.5） | `community_loyal=true`，对圈外广告抵触 |
| 高度数（>p90） | `engagement_bias=high`，互动频率高 |

结果写入 persona JSON 的 `behavior` 字段。

#### 层 C — 关系感知（Network Context）

**运行时动态注入**（在 `agent.py` 的 prompt 构建阶段）：
```python
# 注入内容示例
f"你的关注者网络中已有 {activated_neighbors}/{total_neighbors} 人转发了这条内容。"
f"你最近频繁互动的节点：{top_neighbors}。"
```

此层不存储，每次模拟步骤实时计算。

---

### 4.3 `backend/agent.py` 改动

**改动范围**：约 20 行

1. `persona` 字段从字符串 → JSON 解析
2. `get_kol_decision()` 的 prompt 扩展：
   - 注入层 A 的 bio/topics/tone
   - 注入层 B 的 behavior 倾向描述
   - 接收层 C 的 `activated_neighbors` 参数并注入

---

### 4.4 `backend/main.py` 改动

新增 `source` 查询参数：

```python
@app.get("/graph")
def get_graph(
    source: str = "synthetic",   # 新增：synthetic | snap
    n_nodes: int = 500,
    n_kol: int = 15,
    ...
):
    if source == "snap":
        graph_data = load_snap_graph(n_kol=n_kol, max_nodes=n_nodes, seed=seed)
    else:
        graph_data = generate_graph(...)
```

**启动预加载**：`lifespan` 事件中检测 `data/snap/` 是否存在，存在则预加载并缓存。

---

## 5. 新增文件清单

| 文件 | 说明 |
|------|------|
| `backend/snap_loader.py` | SNAP 解析、BFS 采样、Louvain 社区、PageRank KOL |
| `backend/twin_builder.py` | Digital Twin A+B+C 批量生成 |
| `data/snap/` | SNAP 原始数据目录（gitignore） |
| `scripts/download_snap.sh` | 一键下载脚本 |

**改动文件**：

| 文件 | 改动内容 |
|------|---------|
| `backend/main.py` | 新增 `source` 参数，启动预加载 |
| `backend/agent.py` | persona JSON 解析，prompt 扩展（A+B+C） |
| `backend/requirements.txt` | 新增 `python-louvain`, `networkx` 已有 |

---

## 6. 依赖新增

```txt
python-louvain==0.16
```

---

## 7. 数据流时序

```
启动时：
  download_snap.sh → data/snap/
  lifespan → snap_loader.load() → twin_builder.build_all() → _snap_graph_cache

请求时：
  GET /graph?source=snap → 从缓存返回（毫秒级）
  POST /simulate → run_simulation() → agent.get_kol_decision(persona_json, activated_neighbors)
```

---

## 8. 约束与边界

- 节点硬上限：500（可通过 `max_nodes` 参数调整）
- KOL 数量：默认 15，与现有系统一致
- 自适应跳数：BFS 自动停止，无需手动指定跳数
- 前端：零改动
- SNAP 数据不入 git（`.gitignore` 排除 `data/snap/`）
- twin_builder 批量调用 Claude API（约 15 次），建议在启动时完成，不在请求链路上
