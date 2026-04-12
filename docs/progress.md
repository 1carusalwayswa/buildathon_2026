# SocialSim 实施进度

**日期**: 2026-04-12  
**计划文件**: `docs/superpowers/plans/2026-04-12-socialsim.md`

---

## 已完成

### 基础设施
- [x] git worktree `socialsim-backend` → branch `feature/socialsim-backend`
- [x] git worktree `socialsim-frontend` → branch `feature/socialsim-frontend`
- [x] 计划文件 `docs/superpowers/plans/2026-04-12-socialsim.md`

### Track A: 后端（已全部完成）
worktree: `/Users/lyon/socialsim-backend`  
目录: `socialsim/backend/`

- [x] **B1** `requirements.txt` + `models.py` — Pydantic 数据模型
- [x] **B2** `graph.py` — BA 无标度网络生成（networkx）
- [x] **B3** `agent.py` — Claude API KOL 决策（haiku-4-5-20251001）
- [x] **B4** `simulation.py` — IC 传播引擎
- [x] **B5** `analytics.py` — 覆盖率/社区渗透/ROI 分析
- [x] **B6** `main.py` — FastAPI 路由（/graph, /simulate, /node/{id}, /simulate/compare）

**已提交**: `feat(socialsim): backend - models, graph, agent, simulation, analytics, FastAPI`

---

## 待完成

### Track F: 前端（已全部完成）
worktree: `/Users/lyon/socialsim-frontend`  
目录: `socialsim/frontend/`

- [x] **F1** Vite React TypeScript 脚手架 + Tailwind + react-force-graph-2d
- [x] **F2** `types.ts` + `api/client.ts`
- [x] **F3** `hooks/useSimulationState.ts`
- [x] **F4** `components/GraphView.tsx`
- [x] **F5** `components/SimulationPlayer.tsx` + `InvestPanel.tsx`
- [x] **F6** `components/AnalyticsPanel.tsx` + `ROIRanking.tsx` + `NodeDetail.tsx` + `AgentDetail.tsx`
- [x] **F7** `App.tsx` 整合（三层下钻 UI）

---

## 启动方式（后端就绪后）

```bash
# 后端
cd /Users/lyon/socialsim-backend/socialsim/backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY="..."
uvicorn main:app --port 8001 --reload

# 前端（F1-F7 完成后）
cd /Users/lyon/socialsim-frontend/socialsim/frontend
npm install && npm run dev
# 访问 http://localhost:5173
```

---

## Bug 修复记录（2026-04-12 调试阶段）

### BUG-1: 右侧面板被图画布遮挡
- **文件**: `socialsim/frontend/src/components/GraphView.tsx`
- **根因**: `react-force-graph-2d` 未传 `width`/`height` 时默认用 `window.innerWidth × window.innerHeight`，canvas 铺满全屏覆盖右侧 `w-80` 面板
- **修复**: 用 `ResizeObserver` 监测容器实际尺寸，显式传给 `ForceGraph2D`

### BUG-2: KOL Agent 决策失败（JSON 解析错误）
- **文件**: `socialsim/backend/agent.py`
- **根因**: Claude 返回的 JSON 被 markdown 代码块包裹（` ```json ... ``` `），`json.loads` 在第 0 个字符（反引号）处失败，报 `Expecting value: line 1 column 1 (char 0)`
- **修复**: 在 `json.loads` 前剥离 markdown 代码块；同时改善错误日志（打印异常类型和原始响应内容）

### BUG-3: KOL 节点无法进入 Agent 决策界面
- **文件**: `socialsim/frontend/src/App.tsx`
- **根因**: `allDecisions` 只收集到 `currentStep` 的决策，播放在 step 0 时，step 1+ 的 KOL 决策未被收录，`agentDecision` 为 null，NodeDetail 中的按钮不显示
- **修复**: 改为从所有 steps 收集完整决策，不受当前播放进度限制

---

## 注意事项
- 子 agent 没有工具权限，无法并行执行 → 改为主会话直接实现
- 前端 UI 全部使用英语
- 后端端口 8001（避免与 DMS 的 8000 冲突）
- 前端 `/api` 代理到 `http://localhost:8001`
