"""
Circular Transaction Detection Module
Detects cycles and circular trading patterns in the transaction network.
"""

from collections import defaultdict, deque
from typing import List, Dict, Set, Tuple
import pandas as pd


def find_vendor_payment_chains(df: pd.DataFrame) -> Tuple[List[Dict], List[Dict]]:
    """
    Analyzes transaction data to find payment chains.
    Dynamically handles either the (AccountID, CounterpartyName, OutgoingAmount) schema
    or the legacy (vendor, employee, amount) schema.
    
    Args:
        df: DataFrame containing transaction records.
    
    Returns:
        Tuple of (nodes, edges)
    """
    
    if df.empty:
        return [], []
    
    nodes_data = {}
    edge_amounts = defaultdict(float)
    edge_count = defaultdict(int)
    
    # Iterate through transactions to build the directed graph
    for _, row in df.iterrows():
        # Fallbacks to support multiple schema types
        # Use getattr since row is a pandas Series, not a dict
        source = str(getattr(row, 'AccountID', getattr(row, 'vendor', '')))
        target = str(getattr(row, 'CounterpartyName', getattr(row, 'employee', '')))
        
        # We only care about transactions where money is leaving the source
        amount = float(getattr(row, 'OutgoingAmount', getattr(row, 'amount', 0.0)))
        
        # Skip invalid rows or self-loops, and ignore incoming-only rows in double-entry ledgers
        if not source or not target or source == target or amount <= 0:
            continue
            
        # Track node activity
        nodes_data[source] = nodes_data.get(source, 0) + 1
        nodes_data[target] = nodes_data.get(target, 0) + 1
        
        # Build directed edge (Source -> Target)
        key = (source, target)
        edge_amounts[key] += amount
        edge_count[key] += 1
    
    # Create the node dictionaries
    vendor_nodes = []
    for node_id, count in nodes_data.items():
        vendor_nodes.append({
            'id': node_id,
            'label': node_id,
            'type': 'account',
            'riskScore': 0.8 if count > 10 else 0.5, # Example dynamic risk score
            'totalTxns': count
        })
    
    # Create the edge dictionaries
    vendor_edges = []
    for (source, target), total_amount in edge_amounts.items():
        vendor_edges.append({
            'id': f'e-{source}-{target}',
            'source': source,
            'target': target,
            'amount': total_amount,
            'frequency': edge_count[(source, target)]
        })
    
    return vendor_nodes, vendor_edges


def detect_cycles(nodes: List[Dict], edges: List[Dict]) -> List[Dict]:
    """
    Detects all cycles in a directed graph using DFS.
    
    Args:
        nodes: List of node dictionaries with 'id' and 'label'
        edges: List of edge dictionaries with 'id', 'source', 'target', 'amount'
    
    Returns:
        List of cycle dictionaries containing cycle details.
    """
    
    if not edges:
        return []
    
    # Build adjacency list and edge mapping
    graph = defaultdict(list)  # node_id -> [(target_id, edge_id, amount)]
    edge_map = {}  # edge_id -> (source, target, amount)
    node_set = {node["id"] for node in nodes}
    
    for edge in edges:
        source = str(edge["source"])
        target = str(edge["target"])
        edge_id = edge["id"]
        amount = float(edge.get("amount", 0))
        
        if source in node_set and target in node_set:
            graph[source].append((target, edge_id, amount))
            edge_map[edge_id] = (source, target, amount)
    
    cycles = []
    visited_global = set()
    cycle_counter = [0]
    
    # DFS to find cycles
    def dfs_find_cycles(start_node: str, current: str, path: List[str], edges_in_path: List[str], amounts: List[float], visited: Set[str], depth: int = 0):
        if depth > 10:  # Limit depth to avoid infinite recursion in massive graphs
            return
            
        visited.add(current)
        
        for next_node, edge_id, amount in graph[current]:
            if next_node == start_node and len(path) >= 2:
                # Found a cycle back to start
                cycle_nodes = path
                cycle_edges = edges_in_path + [edge_id]
                cycle_amounts = amounts + [amount]
                
                # Create cycle ID from sorted nodes to avoid duplicates (e.g., A->B->C vs B->C->A)
                cycle_key = tuple(sorted(set(cycle_nodes)))
                
                # Only add unique cycles
                if cycle_key not in visited_global:
                    visited_global.add(cycle_key)
                    cycles.append({
                        "id": f"cycle-{cycle_counter[0]}",
                        "nodes": list(cycle_nodes),
                        "edgeIds": cycle_edges,
                        "totalValue": sum(abs(a) for a in cycle_amounts),
                        "loops": 1,
                        "spanMonths": 1
                    })
                    cycle_counter[0] += 1
            
            elif next_node not in visited and len(path) < 10:
                # Continue DFS
                dfs_find_cycles(
                    start_node,
                    next_node,
                    path + [next_node],
                    edges_in_path + [edge_id],
                    amounts + [amount],
                    visited.copy(),
                    depth + 1
                )
        
        visited.discard(current)
    
    # Try starting DFS from each node
    for start_node in node_set:
        dfs_find_cycles(start_node, start_node, [start_node], [], [], set())
    
    return cycles


def mark_cycle_edges(edges: List[Dict], cycles: List[Dict]) -> List[Dict]:
    """
    Marks edges that are part of cycles.
    
    Args:
        edges: Original edge list
        cycles: Detected cycles
    
    Returns:
        Updated edges with 'isCycle' and 'cycleId' flags
    """
    
    cycle_edge_map = defaultdict(list)
    
    for cycle in cycles:
        for edge_id in cycle["edgeIds"]:
            cycle_edge_map[edge_id].append(cycle["id"])
    
    updated_edges = []
    for edge in edges:
        edge_copy = edge.copy()
        edge_id = edge.get("id") or f"e-{edge['source']}-{edge['target']}"
        
        if edge_id in cycle_edge_map:
            edge_copy["isCycle"] = True
            edge_copy["cycleId"] = cycle_edge_map[edge_id][0] 
        else:
            # Fallback check
            for cid in cycle_edge_map:
                if str(edge['source']) in str(cid) and str(edge['target']) in str(cid):
                    edge_copy["isCycle"] = True
                    edge_copy["cycleId"] = cycle_edge_map[cid][0]
                    break
            else:
                edge_copy["isCycle"] = False
        
        updated_edges.append(edge_copy)
    
    return updated_edges


def find_strongly_connected_components(nodes: List[Dict], edges: List[Dict]) -> List[Set[str]]:
    """
    Finds strongly connected components (cliques of circular transactions).
    Uses Tarjan's algorithm.
    
    Args:
        nodes: List of nodes
        edges: List of edges
    
    Returns:
        List of sets, each containing node IDs that form a strongly connected component
    """
    
    graph = defaultdict(list)
    node_set = {node["id"] for node in nodes}
    
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        if source in node_set and target in node_set:
            graph[source].append(target)
    
    index_counter = [0]
    stack = []
    lowlinks = {}
    index = {}
    on_stack = set()
    sccs = []
    
    def strongconnect(node: str):
        index[node] = index_counter[0]
        lowlinks[node] = index_counter[0]
        index_counter[0] += 1
        stack.append(node)
        on_stack.add(node)
        
        for successor in graph[node]:
            if successor not in index:
                strongconnect(successor)
                lowlinks[node] = min(lowlinks[node], lowlinks[successor])
            elif successor in on_stack:
                lowlinks[node] = min(lowlinks[node], index[successor])
        
        if lowlinks[node] == index[node]:
            scc = set()
            while True:
                successor = stack.pop()
                on_stack.discard(successor)
                scc.add(successor)
                if successor == node:
                    break
            
            # Only include SCCs with more than one node (actual cycles)
            if len(scc) > 1:
                sccs.append(scc)
    
    for node in node_set:
        if node not in index:
            strongconnect(node)
    
    return sccs