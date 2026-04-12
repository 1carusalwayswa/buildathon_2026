# SocialSim — 社交网络影响力模拟器

为企业营销决策提供 KOL 投放效果量化分析。在合成社交网络中模拟信息传播，对比不同 KOL 组合的覆盖率和 ROI。

## 快速启动

```bash
# 后端（端口 8001）
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export ANTHROPIC_API_KEY="sk-ant-..."
uvicorn main:app --port 8001 --reload

# 前端
cd frontend
npm install && npm run dev
# 访问 http://localhost:5173
```

## 核心功能

- 500 节点 BA 无标度网络，15 个 KOL 节点
- IC 模型信息传播模拟，KOL 节点由 Claude API 驱动决策
- 三层下钻 UI：全局总览 → 节点详情 → Agent 决策推理
- 方案对比：保存两个投放方案，对比覆盖率和社区渗透率

## 文档

详细开发者文档见 [docs/README.md](docs/README.md)
