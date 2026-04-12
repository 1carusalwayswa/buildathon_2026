import type { GraphData, SimRequest, SimResult, NodeDetailResponse, CompareRequest, CompareResult } from '../types';

const BASE = '/api';

export async function fetchGraph(params?: {
  n_nodes?: number;
  n_kol?: number;
  m_edges?: number;
  n_communities?: number;
}): Promise<GraphData> {
  const query = new URLSearchParams(
    Object.fromEntries(
      Object.entries(params ?? {}).map(([k, v]) => [k, String(v)])
    )
  ).toString();
  const res = await fetch(`${BASE}/graph${query ? '?' + query : ''}`);
  if (!res.ok) throw new Error(`/graph failed: ${res.statusText}`);
  return res.json();
}

export async function runSimulation(req: SimRequest): Promise<SimResult> {
  const res = await fetch(`${BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`/simulate failed: ${res.statusText}`);
  return res.json();
}

export async function fetchNodeDetail(nodeId: string): Promise<NodeDetailResponse> {
  const res = await fetch(`${BASE}/node/${nodeId}`);
  if (!res.ok) throw new Error(`/node/${nodeId} failed: ${res.statusText}`);
  return res.json();
}

export async function compareSimulations(req: CompareRequest): Promise<CompareResult> {
  const res = await fetch(`${BASE}/simulate/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`/simulate/compare failed: ${res.statusText}`);
  return res.json();
}
