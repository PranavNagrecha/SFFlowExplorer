---
name: layout-engine
description: >
  Use this skill for ANY task involving node positioning, coordinate computation, edge routing,
  or layout algorithms. Triggers include: computing x/y coordinates for FlowGraph nodes,
  integrating dagre, handling back-edges visually, normalising coordinates, and routing
  fault connectors. Use this skill whenever the user mentions "layout", "positioning",
  "overlap", "coordinates", or when nodes are stacking at (0,0).
---

# Layout Engine Skill

## Purpose

Compute x/y coordinates for all `FlowNode` objects in a `FlowGraph`, using a hybrid approach
that respects Salesforce's `locationX/Y` hints where available and falls back to dagre
auto-layout for the rest. Every layout implementation task must follow this skill.

---

## Library Choice

Use **dagre** (`npm install dagre @types/dagre`).

Do NOT use elkjs — it requires a Java subprocess and is too heavy for a CLI tool.
Do NOT use D3-dag — it lacks orthogonal edge routing needed for flowcharts.
Do NOT attempt manual grid layout — it will produce overlapping nodes.

---

## dagre Initialisation

```typescript
import dagre from 'dagre';

export function computeLayout(graph: FlowGraph): FlowGraph {
  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: 'TB',      // Top to Bottom (standard flowchart direction)
    nodesep: 50,        // Horizontal gap between nodes in the same rank
    ranksep: 80,        // Vertical gap between ranks
    acyclicer: 'greedy', // REQUIRED: handles back-edges from loops
    ranker: 'tight-tree', // Best for tree-like flowcharts
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Register nodes
  for (const node of graph.nodes.values()) {
    const { width, height } = NODE_DIMENSIONS[node.type];
    g.setNode(node.id, { width, height, label: node.id });
  }

  // Register edges (skip back-edges during layout — dagre's acyclicer handles them)
  for (const edge of graph.edges) {
    if (!edge.isBackEdge) {
      g.setEdge(edge.sourceId, edge.targetId);
    }
  }

  dagre.layout(g);

  // Apply computed positions back to nodes
  const updatedNodes = new Map(graph.nodes);
  for (const [id, node] of updatedNodes) {
    const dagreNode = g.node(id);
    if (dagreNode) {
      // Hybrid strategy: use SF coords if meaningful, else use dagre
      const useSfCoords = node.locationX > 0 && node.locationY > 0;
      updatedNodes.set(id, {
        ...node,
        locationX: useSfCoords ? node.locationX : dagreNode.x - dagreNode.width / 2,
        locationY: useSfCoords ? node.locationY : dagreNode.y - dagreNode.height / 2,
      });
    }
  }

  return { ...graph, nodes: updatedNodes };
}
```

---

## Coordinate Normalisation (Always Apply)

After dagre runs, normalise so the top-left node is at (40, 40) with a 40px margin.
This ensures the diagram doesn't start at negative coordinates or far off-screen.

```typescript
function normaliseCoordinates(graph: FlowGraph): FlowGraph {
  const nodes = [...graph.nodes.values()];
  if (nodes.length === 0) return graph;

  const minX = Math.min(...nodes.map(n => n.locationX));
  const minY = Math.min(...nodes.map(n => n.locationY));
  const offsetX = 40 - minX;
  const offsetY = 40 - minY;

  const updatedNodes = new Map<string, FlowNode>();
  for (const [id, node] of graph.nodes) {
    updatedNodes.set(id, {
      ...node,
      locationX: node.locationX + offsetX,
      locationY: node.locationY + offsetY,
    });
  }

  return { ...graph, nodes: updatedNodes };
}
```

---

## Back-Edge Routing (Visual Loop Connectors)

Back-edges (where `isBackEdge === true`) need waypoints so they don't draw a straight
line backwards through the diagram. Add a waypoint to the right of the source node.

In the Draw.io XML, back-edge `mxCell` elements need an `Array` geometry child:

```xml
<mxCell id="loop__back" ... edge="1" source="loopNode" target="assignNode" parent="1">
  <mxGeometry relative="1" as="geometry">
    <Array as="points">
      <mxPoint x="${sourceX + sourceWidth + 60}" y="${sourceCenterY}" />
      <mxPoint x="${sourceX + sourceWidth + 60}" y="${targetCenterY}" />
    </Array>
  </mxGeometry>
</mxCell>
```

Compute waypoints in the layout engine and attach them to `FlowEdge`:

```typescript
export interface FlowEdge {
  // ... existing fields ...
  waypoints?: Array<{ x: number; y: number }>; // added by layout engine for back-edges
}
```

---

## Subflow Node Treatment

Subflow nodes are treated as sinks during layout — they have no outgoing edges
in the standard layout pass (unless `--follow-subflows` flag is active).

This prevents dagre from trying to route through a subflow node as if it were
a pass-through, which would distort the layout.

```typescript
// When building dagre graph, skip outgoing edges from subflow nodes
// unless --followSubflows is true
for (const edge of graph.edges) {
  const sourceNode = graph.nodes.get(edge.sourceId);
  if (sourceNode?.type === 'subflow' && !options.followSubflows) continue;
  if (!edge.isBackEdge) {
    g.setEdge(edge.sourceId, edge.targetId);
  }
}
```

---

## Layout Quality Tests

The layout engine must pass these assertions in `tests/layout-engine.test.ts`:

```typescript
// No two nodes overlap
function assertNoOverlap(graph: FlowGraph): void {
  const nodes = [...graph.nodes.values()];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const { width: aw, height: ah } = NODE_DIMENSIONS[a.type];
      const { width: bw, height: bh } = NODE_DIMENSIONS[b.type];
      const overlapX = a.locationX < b.locationX + bw && a.locationX + aw > b.locationX;
      const overlapY = a.locationY < b.locationY + bh && a.locationY + ah > b.locationY;
      expect(overlapX && overlapY).toBe(false);
    }
  }
}

// All nodes have positive coordinates
function assertPositiveCoordinates(graph: FlowGraph): void {
  for (const node of graph.nodes.values()) {
    expect(node.locationX).toBeGreaterThanOrEqual(0);
    expect(node.locationY).toBeGreaterThanOrEqual(0);
  }
}
```

---

## Definition of Done (Layout Engine)

- [ ] No two nodes overlap after layout (assertNoOverlap passes)
- [ ] All coordinates are positive after normalisation
- [ ] Back-edges produce waypoints that route visually around the diagram
- [ ] Flows with no `locationX/Y` data lay out cleanly via dagre
- [ ] Flows with Salesforce `locationX/Y` preserve those positions for nodes that have them
- [ ] Layout completes in < 500ms for a 50-node flow
- [ ] No infinite loops or stack overflows on graphs containing cycles

---

## Post-Processing Pipeline Order

After `dagre.layout(g)` runs, apply passes in this exact order. Changing the order breaks coordinate assumptions downstream.

1. `normaliseCoordinates()` — shift all nodes so min(x,y) = 40
2. `equaliseSiblingSpacing()` — fan-out X equalisation (horizontal only, Y unchanged)
3. `segregateFaultNodes()` — push fault-only nodes rightward
4. `addBackEdgeWaypoints()` — compute waypoints using final positions

**Never reorder these.** Waypoints must be last because they read `node.locationX/Y` — if those change after waypoints are set, connectors route to the wrong places.

---

## Fault-Only Node Detection

A node is fault-only if every incoming edge targeting it has `isFault=true`. Nodes with zero incoming edges (only `start` qualifies) are never fault-only.

```typescript
export function identifyFaultOnlyNodes(graph: FlowGraph): Set<string> {
  const faultOnly = new Set<string>();
  for (const nodeId of graph.nodes.keys()) {
    const incoming = graph.edges.filter((e) => e.targetId === nodeId);
    if (incoming.length === 0) continue; // start node — skip
    if (incoming.every((e) => e.isFault)) faultOnly.add(nodeId);
  }
  return faultOnly;
}
```

Segregation: after normalisation, find `maxNonFaultRight = max(locationX + width)` across all non-fault nodes, then set fault-only node `locationX = maxNonFaultRight + 120`.

---

## Fan-Out Detection

A node is a fan-out source if it has 2+ outgoing non-fault, non-back-edge connections whose targets share approximately the same Y coordinate (within 20px of each other after dagre runs).

```typescript
export function detectFanOutGroups(graph: FlowGraph): Map<string, string[]> {
  // For each node, collect outgoing non-fault non-back targets
  // If 2+ targets exist and their Y coords are within 20px → fan-out group
}
```

Equalisation: sort siblings by current X, compute even spacing (`nodesep=60`), center the group around the parent's centerX, clamp all X ≥ 40.
