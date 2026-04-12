import type { GraphData, SimRequest, SimResult, CompareResult } from '../types';

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

// 工具函数：带超时的 fetch（不导出，内部使用）
function fetchWithTimeout(url: string, options: RequestInit & { timeoutMs?: number } = {}) {
  const { timeoutMs = 30000, signal: externalSignal, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (externalSignal) {
    externalSignal.addEventListener('abort', () => controller.abort());
  }

  return fetch(url, { ...rest, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
}

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
  const res = await fetchWithTimeout(`${BASE}/graph${query ? '?' + query : ''}`, { timeoutMs: 15000 });
  if (!res.ok) throw new Error(`/graph failed: ${res.statusText}`);
  return res.json() as Promise<GraphData>;
}

export async function runSimulation(req: SimRequest, signal?: AbortSignal): Promise<SimResult> {
  const res = await fetchWithTimeout(`${BASE}/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    timeoutMs: 90000,
    signal,
  });
  if (!res.ok) throw new Error(`/simulate failed: ${res.statusText}`);
  return res.json() as Promise<SimResult>;
}
