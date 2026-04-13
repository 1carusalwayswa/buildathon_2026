# SocialSim — AI-Powered Social Network Influence Simulator

> Quantify KOL marketing campaigns with Claude-driven agent simulation and real-time network visualization.

## What It Does

SocialSim helps brands answer: **"Which influencers (KOLs) should I invest in, and how far will my message spread?"**

It simulates information propagation across social networks where each Key Opinion Leader (KOL) node is driven by a **Claude AI agent** with a three-layer Digital Twin — giving every influencer a unique, topology-informed personality that determines whether they repost, comment, or ignore a brand campaign.

## Key Innovations

### 1. Hybrid Propagation Engine
- **Normal users** → Classic IC (Independent Cascade) model with probabilistic activation
- **KOL nodes** → Claude `claude-haiku-4-5-20251001` agents that reason step-by-step before deciding to repost / comment / ignore
- KOL decisions use `ThreadPoolExecutor` for parallel API calls, reducing simulation time from ~30s → ~3s

### 2. Three-Layer Digital Twin for KOLs
Each KOL node carries a structured persona built at three levels:

| Layer | Name | When Built | How |
|-------|------|-----------|-----|
| A | Static Persona | Server startup (once) | Claude Haiku generates bio, topics, tone, brand sensitivity |
| B | Behavioral Pattern | Server startup (once) | Computed from topology: betweenness → bridge role; clustering → community loyalty |
| C | Runtime Neighbor Awareness | Each simulation step | Dynamically injected: "X% of your connections have already engaged" |

### 3. Dual Network Sources
- **Synthetic BA (Barabási–Albert) network** — 500 nodes, 15 KOLs, 5 communities, generated on demand
- **Real SNAP Twitter ego-networks** — Stanford SNAP dataset, BFS-sampled to 500 nodes, Louvain community detection, PageRank-based KOL identification

### 4. Three-Level Drill-Down UI
1. **Global view** — force-directed graph with real-time activation animation
2. **Node detail** — concentric layout centered on selected node, persona card, propagation stats
3. **Agent decision** — step-by-step Claude reasoning (Content Analysis → Brand Evaluation → Audience Match → Final Decision) + simulated post content

## Architecture

```
User selects KOLs + enters brand info
           │
           ▼
Frontend (React)                    Backend (FastAPI)
┌─────────────────┐                 ┌──────────────────────────┐
│ InvestPanel     │ GET /graph ───► │ GraphGenerator           │
│ (seed selection)│ ◄── GraphData   │ BA network + communities │
│                 │                 │                          │
│                 │ POST /simulate  │ SimulationEngine         │
│ GraphView       │ ──────────────► │ IC model (normal nodes)  │
│ (animation      │ ◄── SimResult   │ Claude API (KOL nodes)   │
│  playback)      │                 │ analytics calculation    │
│                 │                 └──────────────────────────┘
│ AnalyticsPanel  │
│ ROIRanking      │
└─────────────────┘
```

**Key design choice:** Backend pre-computes all simulation timesteps in one request; frontend handles animation playback without further API calls.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, FastAPI, Uvicorn |
| Graph algorithms | NetworkX (BA generation), python-louvain (Louvain community detection) |
| LLM | Anthropic Claude API (`claude-haiku-4-5-20251001`) |
| Frontend | React 19, TypeScript, Vite 8 |
| Visualization | react-force-graph-2d (force layout) + D3.js (concentric layout) |
| Styling | Tailwind CSS v4, custom "Signal Intelligence" design system |

## Quick Start

### Prerequisites
- Python 3.12+
- Node.js 18+
- Anthropic API key

### Backend (port 8001)

```bash
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp ../.env.example .env
# Edit .env and set your ANTHROPIC_API_KEY

uvicorn main:app --port 8001 --reload
```

Swagger docs available at `http://localhost:8001/docs`

### Frontend (port 5173)

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` — the `/api` path auto-proxies to the backend.

### (Optional) Load Real SNAP Twitter Graph

```bash
bash scripts/download_snap.sh   # Downloads ~21 MB from Stanford SNAP
# Backend auto-loads on startup (~30s with Claude community labeling)
```

Then select **SNAP** as the graph source in the UI.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/graph` | GET | Generate BA network or fetch SNAP graph; returns `graph_id` for subsequent calls |
| `/simulate` | POST | Run IC propagation + Claude KOL decisions; returns all timesteps |
| `/simulate/event` | POST | Event-based simulation with sentiment tracking |
| `/simulate/compare` | POST | Parallel multi-scenario comparison |
| `/node/{id}` | GET | 1–2 hop neighborhood details for drill-down |

### POST `/simulate` — Request Body

```json
{
  "seed_nodes": ["n_1", "n_5"],
  "brand_name": "TechBrand X",
  "brand_content": "Revolutionary AI assistant redefining productivity",
  "n_steps": 20,
  "graph_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Simulation Result — Analytics Fields

| Field | Description |
|-------|-------------|
| `coverage` | Final activation rate (activated / total nodes) |
| `community_penetration` | Per-community penetration rate |
| `node_contributions` | Direct/indirect reach and contribution % per seed node |
| `bottleneck_nodes` | Nodes contributing >15% of total spread |
| `critical_paths` | Longest propagation path per seed (up to 6 hops) |

## KOL Decision Prompt (Claude Input Example)

```
- Name: Alex Chen
- Bio: Tech industry connector bridging enterprise and startup ecosystems...
- Topics: professional networking, tech innovation
- Tone: professional
- Brand sensitivity: 0.72

Behaviour pattern:
- Bridge role (cross-community sharer): True
- Community loyal: False
- Engagement bias: high

Brand Campaign:
- Brand: TechBrand X
- Content: Revolutionary AI assistant...
- Network sentiment: 0.65

Network context:
- 4/12 of your connections (33%) have already engaged with this content.
```

**Output:**
```json
{
  "action": "repost",
  "reason": "Content aligns with audience interests and high engagement bias",
  "content": "Just tried TechBrand X — the productivity gains are real...",
  "reasoning_steps": [
    {"step": "Content Analysis", "result": "High relevance", "passed": true},
    {"step": "Brand Evaluation", "result": "Neutral-positive reputation", "passed": true},
    {"step": "Audience Match", "result": "72% overlap", "passed": true},
    {"step": "Final Decision", "result": "Repost", "passed": true}
  ]
}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes | Claude API key for KOL agent decisions |
| `VITE_API_BASE` | No | Frontend API base path, defaults to `/api` |

## Project Structure

```
buildathon_2026/
├── backend/
│   ├── main.py          # FastAPI routes + SNAP preload lifespan
│   ├── models.py        # Pydantic data models
│   ├── graph.py         # BA network generation, community detection
│   ├── snap_loader.py   # SNAP Twitter graph loading + BFS sampling
│   ├── twin_builder.py  # Digital Twin: Layer A (Claude) + Layer B (topology)
│   ├── simulation.py    # IC propagation engine + Layer C injection
│   ├── agent.py         # Claude API KOL decisions (parallel + JSON parsing)
│   ├── analytics.py     # Coverage, penetration, critical path metrics
│   ├── event_seeder.py  # Event-based simulation seed selection
│   └── requirements.txt
├── frontend/src/
│   ├── App.tsx                      # Global state management
│   ├── components/
│   │   ├── GraphView.tsx            # Canvas: force-directed + concentric layouts
│   │   ├── SimulationPlayer.tsx     # Timeline playback controls
│   │   ├── InvestPanel.tsx          # KOL selection + brand input
│   │   ├── AnalyticsPanel.tsx       # Metrics display
│   │   ├── ROIRanking.tsx           # Per-KOL ROI ranking
│   │   ├── NodeDetail.tsx           # Layer 2 drill-down
│   │   ├── AgentDetail.tsx          # Layer 3 agent reasoning view
│   │   ├── CompareModal.tsx         # Side-by-side scenario comparison
│   │   ├── SentimentTimeline.tsx    # Event simulation sentiment chart
│   │   └── CommunityReactionPanel.tsx  # Stacked bar community reactions
│   └── index.css                    # Signal Intelligence design tokens
├── data/snap/           # SNAP .edges files (download separately, not in git)
├── scripts/
│   └── download_snap.sh # One-click SNAP Twitter ego-net downloader
└── docs/
    ├── README.md        # Detailed developer documentation (Chinese)
    └── design.md        # Original design specification
```

## Running Tests

```bash
cd backend
pytest tests/
```
