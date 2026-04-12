export interface Node {
  id: string;
  name: string;
  type: 'kol' | 'normal';
  community: string;
  influence: number;
  activity: number;
  sentiment: number;
  followers: number;
  persona?: string;
}

export interface Edge {
  source: string;
  target: string;
  weight: number;
  type: 'follow' | 'friend';
}

export interface GraphData {
  nodes: Node[];
  edges: Edge[];
}

export interface ReasoningStep {
  step: string;
  result: string;
  passed: boolean;
}

export interface AgentDecision {
  node_id: string;
  action: 'repost' | 'comment' | 'ignore';
  reason: string;
  content: string;
  reasoning_steps: ReasoningStep[];
}

export interface SimStep {
  t: number;
  activated: string[];
  new_activated: string[];
  agent_decisions: AgentDecision[];
}

export interface NodeContribution {
  node_id: string;
  direct_reach: number;
  indirect_reach: number;
  contribution_pct: number;
}

export interface Analytics {
  coverage: number;
  max_depth: number;
  peak_step: number;
  total_activated: number;
  community_penetration: Record<string, number>;
  node_contributions: NodeContribution[];
  bottleneck_nodes: string[];
  critical_paths: string[][];
}

export interface SimResult {
  steps: SimStep[];
  analytics: Analytics;
}

export interface SimRequest {
  seed_nodes: string[];
  brand_name: string;
  brand_content: string;
  n_steps?: number;
}

export interface NodeDetailResponse {
  node: Node;
  neighbors_1hop: Node[];
  neighbors_2hop: Node[];
  edges: Edge[];
}

export interface CompareRequest {
  scenarios: SimRequest[];
  scenario_names: string[];
}

export interface CompareResult {
  results: SimResult[];
  names: string[];
}
