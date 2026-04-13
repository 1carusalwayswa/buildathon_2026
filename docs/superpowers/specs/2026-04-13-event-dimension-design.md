# Event Dimension Design

**Date:** 2026-04-13  
**Status:** Approved  

## Overview

Add an "Event" simulation mode alongside the existing "Campaign" mode. When a company-related event occurs (product recall, CEO scandal, new product launch, merger, etc.), users can observe how the social network reacts organically — who discusses it, which communities are most activated, and how sentiment evolves over time.

## Background

The current system simulates brand campaigns: a company pushes promotional content, seed KOLs are manually selected, and the IC model propagates engagement through the network. The new Event dimension inverts this: something *happens* to a company, and the community reacts spontaneously. The key differences are:

| Dimension | Campaign | Event |
|-----------|----------|-------|
| Trigger | Brand pushes content | External event occurs |
| Seed selection | Manual (user picks KOLs) | Automatic (system selects by influence + community spread) |
| Agent reactions | repost / comment / ignore | repost / comment / ignore + sentiment_score |
| Analytics focus | Coverage, penetration, ROI | Sentiment evolution, community reaction breakdown |

## Data Models

### Backend (`models.py`)

```python
class EventType(str, Enum):
    positive = "positive"   # new product launch, award
    negative = "negative"   # recall, scandal, accident
    neutral  = "neutral"    # merger, leadership change

class EventSimRequest(BaseModel):
    company_name: str
    event_description: str
    event_type: EventType
    n_steps: int = 20
    graph_id: Optional[str] = None
    n_seeds: int = 3          # number of KOLs auto-selected as seeds

class SentimentSnapshot(BaseModel):
    t: int
    overall: float            # -1.0 to 1.0
    by_community: dict[str, float]

class EventSimResult(BaseModel):
    steps: list[SimStep]              # reuses existing SimStep
    analytics: Analytics              # reuses existing Analytics
    sentiment_timeline: list[SentimentSnapshot]
    community_reactions: dict[str, dict]  # community -> {repost_pct, comment_pct, ignore_pct, avg_sentiment}
```

### Frontend (`types.ts`)

```ts
type EventType = 'positive' | 'negative' | 'neutral';

interface SentimentSnapshot {
  t: number;
  overall: number;
  by_community: Record<string, number>;
}

interface EventSimRequest {
  company_name: string;
  event_description: string;
  event_type: EventType;
  n_steps?: number;
  n_seeds?: number;
}

interface EventSimResult {
  steps: SimStep[];
  analytics: Analytics;
  sentiment_timeline: SentimentSnapshot[];
  community_reactions: Record<string, {
    repost_pct: number;
    comment_pct: number;
    ignore_pct: number;
    avg_sentiment: number;
  }>;
}
```

## Backend Architecture

### Auto-Seeding (`event_seeder.py`)

New module `backend/event_seeder.py` with `select_event_seeds(nodes, event_type, n_seeds) -> list[str]`:

1. Filter all KOL nodes
2. Rank by `influence × activity`
3. Select with community spread constraint: at most 1 seed per community to avoid clustering
4. For `event_type=negative`: downweight KOLs with `sentiment > 0.8` (optimistic personas less likely to break negative news)

### Agent Prompt Extension (`agent.py`)

Add `get_kol_event_decision()` alongside the existing `get_kol_decision()`:

- System prompt changes to: "You are a KOL who has just heard about an event involving a company. Decide whether to publicly discuss it."
- User message includes: event type, event description, community context, network sentiment
- JSON response adds `sentiment_score: float` (-1.0 to 1.0) to the existing action/reason/content/reasoning_steps fields

### Sentiment Aggregation

After each `SimStep`, aggregate `sentiment_score` values from all KOL decisions in that step:
- Compute `overall` mean across all decisions
- Compute `by_community` means grouped by KOL community
- Append as `SentimentSnapshot` to `sentiment_timeline`

After simulation ends, compute `community_reactions`: for each community, count repost/comment/ignore proportions and average sentiment across all steps.

### New Route

```
POST /simulate/event
  body: EventSimRequest
  -> select_event_seeds()
  -> run_simulation() with event prompt variant
  -> aggregate sentiment per step
  -> return EventSimResult
```

The existing `run_simulation()` core is reused; event mode is passed via a flag that routes KOL decisions to `get_kol_event_decision()` instead of `get_kol_decision()`.

## Frontend Architecture

### Mode Toggle

Add **Campaign / Event** tab toggle at the top of the left panel (where `InvestPanel` lives). Tab state is local; switching does not reload the graph.

### Event Input Panel (replaces `InvestPanel` in Event mode)

- `Company Name`: text input
- `Event Description`: textarea
- `Event Type`: segmented button group (Positive / Negative / Neutral), color-coded (green / red / gray)
- `Run Event Simulation` button

### New Result Components

**`SentimentTimeline.tsx`**  
Line chart (recharts). X-axis: time step. Y-axis: -1.0 to 1.0. One line per community (distinct colors); bold line for overall mean. Renders from `sentiment_timeline`.

**`CommunityReactionPanel.tsx`**  
Horizontal stacked bar chart. One row per community. Bars show repost/comment/ignore proportions. Below each bar: average sentiment score and participation rate. Renders from `community_reactions`.

### Reused Components

`GraphView`, `AnalyticsPanel`, `NodeDetail`, `ROIRanking` require no changes — they consume `SimStep[]` and `Analytics` which are structurally identical in both modes.

## Error Handling

- If no KOL nodes exist in the graph, return 400: "No KOL nodes available for event seeding"
- If `n_seeds` exceeds available KOLs, use all available KOLs
- If Claude fails to return `sentiment_score`, default to 0.0 (neutral) and log a warning

## Out of Scope

- Comparing event vs. campaign on the same graph (separate feature)
- Historical event replay with real data
- Event severity numeric scale (using enum is sufficient for now)
