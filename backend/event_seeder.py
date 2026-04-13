def select_event_seeds(nodes: list[dict], event_type: str, n_seeds: int = 3) -> list[str]:
    """
    Auto-select KOL seed nodes for event simulation.

    Rules:
    - Only KOL nodes are eligible
    - Ranked by influence * activity (descending)
    - At most 1 seed per community (for spread diversity)
    - For 'negative' events: downweight KOLs with sentiment > 0.8
    - If n_seeds exceeds available KOLs, return all KOLs
    """
    kols = [n for n in nodes if n["type"] == "kol"]
    if not kols:
        return []

    def score(node: dict) -> float:
        base = node["influence"] * node["activity"]
        if event_type == "negative" and node["sentiment"] > 0.8:
            base *= 0.3
        return base

    kols_sorted = sorted(kols, key=score, reverse=True)

    selected = []
    seen_communities: set[str] = set()

    for kol in kols_sorted:
        if len(selected) >= n_seeds:
            break
        community = kol["community"]
        if community not in seen_communities:
            selected.append(kol["id"])
            seen_communities.add(community)

    # If we still need more seeds (fewer communities than n_seeds),
    # fill from remaining KOLs not yet selected
    if len(selected) < min(n_seeds, len(kols)):
        remaining = [k for k in kols_sorted if k["id"] not in selected]
        for kol in remaining:
            if len(selected) >= n_seeds:
                break
            selected.append(kol["id"])

    return selected
