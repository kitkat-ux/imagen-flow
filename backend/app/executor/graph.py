from __future__ import annotations
from dataclasses import dataclass, field
from typing import Any


@dataclass
class GraphNode:
    id: str
    type: str                 # node type, e.g. "openai.image.generate"
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class GraphEdge:
    source: str               # source node id
    source_handle: str        # source port name
    target: str               # target node id
    target_handle: str        # target port name


@dataclass
class ParsedGraph:
    nodes: dict[str, GraphNode]
    edges: list[GraphEdge]
    # adjacency: target_node_id -> list of (target_port, source_node_id, source_port)
    incoming: dict[str, list[tuple[str, str, str]]]
    # successors: source_node_id -> set of target_node_id
    successors: dict[str, set[str]]


def parse_graph(graph_json: dict) -> ParsedGraph:
    raw_nodes = graph_json.get("nodes", [])
    raw_edges = graph_json.get("edges", [])

    nodes: dict[str, GraphNode] = {}
    for n in raw_nodes:
        # Hỗ trợ format React Flow: data.nodeType chứa node type backend
        node_type = n.get("type") or (n.get("data") or {}).get("nodeType")
        params = (n.get("data") or {}).get("params", {}) or n.get("params", {})
        nodes[n["id"]] = GraphNode(id=n["id"], type=node_type, params=params)

    edges: list[GraphEdge] = []
    incoming: dict[str, list[tuple[str, str, str]]] = {nid: [] for nid in nodes}
    successors: dict[str, set[str]] = {nid: set() for nid in nodes}
    for e in raw_edges:
        edge = GraphEdge(
            source=e["source"],
            source_handle=e.get("sourceHandle") or "out",
            target=e["target"],
            target_handle=e.get("targetHandle") or "in",
        )
        edges.append(edge)
        if edge.target in incoming:
            incoming[edge.target].append((edge.target_handle, edge.source, edge.source_handle))
        if edge.source in successors:
            successors[edge.source].add(edge.target)

    return ParsedGraph(nodes=nodes, edges=edges, incoming=incoming, successors=successors)


def topological_levels(graph: ParsedGraph) -> list[list[str]]:
    """Trả về danh sách các 'level' - mỗi level chứa các node có thể chạy song song.

    Sử dụng Kahn's algorithm. Raise ValueError nếu có chu trình.
    """
    indegree: dict[str, int] = {nid: 0 for nid in graph.nodes}
    for nid, inc in graph.incoming.items():
        # đếm số node nguồn DISTINCT, không phải số port
        sources = {src for (_, src, _) in inc}
        indegree[nid] = len(sources)

    current = [nid for nid, d in indegree.items() if d == 0]
    levels: list[list[str]] = []
    visited = 0
    while current:
        levels.append(current)
        visited += len(current)
        next_level: list[str] = []
        for nid in current:
            for succ in graph.successors.get(nid, set()):
                # giảm indegree dựa trên distinct source: ta giảm 1 mỗi parent hoàn thành
                indegree[succ] -= 1
                if indegree[succ] == 0:
                    next_level.append(succ)
        current = next_level

    if visited != len(graph.nodes):
        raise ValueError("Graph có chu trình - không thể execute.")
    return levels
