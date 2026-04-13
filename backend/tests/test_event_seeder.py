import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from event_seeder import select_event_seeds

def _make_nodes(specs):
    """specs: list of (id, type, community, influence, activity, sentiment)"""
    return [
        {"id": s[0], "type": s[1], "community": s[2],
         "influence": s[3], "activity": s[4], "sentiment": s[5],
         "name": s[0], "followers": 100}
        for s in specs
    ]


def test_returns_kols_only():
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
        ("normal1", "normal", "A", 0.9, 0.9, 0.5),
    ])
    seeds = select_event_seeds(nodes, "positive", n_seeds=2)
    assert "normal1" not in seeds
    assert "kol1" in seeds


def test_respects_n_seeds():
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
        ("kol2", "kol", "B", 0.8, 0.8, 0.5),
        ("kol3", "kol", "C", 0.7, 0.7, 0.5),
    ])
    seeds = select_event_seeds(nodes, "positive", n_seeds=2)
    assert len(seeds) == 2


def test_community_spread():
    # With 3 KOLs in same community and 1 in different, n_seeds=2 should pick
    # at most 1 from community A
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
        ("kol2", "kol", "A", 0.85, 0.85, 0.5),
        ("kol3", "kol", "A", 0.8, 0.8, 0.5),
        ("kol4", "kol", "B", 0.7, 0.7, 0.5),
    ])
    seeds = select_event_seeds(nodes, "neutral", n_seeds=2)
    assert len(seeds) == 2
    communities = [n["community"] for n in nodes if n["id"] in seeds]
    assert len(set(communities)) == 2  # must span 2 communities


def test_negative_event_downweights_optimists():
    # kol1 has high sentiment (optimist), kol2 has low sentiment
    # For negative events, kol2 should be preferred
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.95, 0.95, 0.95),  # very optimistic
        ("kol2", "kol", "B", 0.90, 0.90, 0.20),  # pessimistic
    ])
    seeds = select_event_seeds(nodes, "negative", n_seeds=1)
    assert seeds == ["kol2"]


def test_n_seeds_exceeds_kols_returns_all():
    nodes = _make_nodes([
        ("kol1", "kol", "A", 0.9, 0.9, 0.5),
    ])
    seeds = select_event_seeds(nodes, "positive", n_seeds=5)
    assert seeds == ["kol1"]
