import dagre from 'dagre';
import type { FlowGraph, FlowNode, FlowEdge } from '../model/flow-graph.js';

const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  start: { width: 120, height: 60 },
  decision: { width: 200, height: 100 },
  assignment: { width: 200, height: 60 },
  loop: { width: 200, height: 80 },
  recordCreate: { width: 200, height: 70 },
  recordUpdate: { width: 200, height: 70 },
  recordDelete: { width: 200, height: 70 },
  recordLookup: { width: 200, height: 70 },
  screen: { width: 200, height: 70 },
  actionCall: { width: 200, height: 60 },
  subflow: { width: 200, height: 60 },
  collectionProcessor: { width: 200, height: 60 },
  end: { width: 120, height: 60 },
};

function getDimensions(node: FlowNode): { width: number; height: number } {
  return NODE_DIMENSIONS[node.type] ?? { width: 200, height: 60 };
}

export function identifyFaultOnlyNodes(graph: FlowGraph): Set<string> {
  const faultOnlyIds = new Set<string>();

  for (const nodeId of graph.nodes.keys()) {
    const incoming = graph.edges.filter((e) => e.targetId === nodeId);
    if (incoming.length === 0) continue; // start node: no incoming, not fault-only
    if (incoming.every((e) => e.isFault)) {
      faultOnlyIds.add(nodeId);
    }
  }

  return faultOnlyIds;
}

function segregateFaultNodes(
  graph: FlowGraph,
  faultOnlyIds: Set<string>,
): FlowGraph {
  if (faultOnlyIds.size === 0) return graph;

  // Find the right edge of all non-fault-only nodes
  let maxNonFaultRight = 0;
  for (const [id, node] of graph.nodes) {
    if (faultOnlyIds.has(id)) continue;
    const { width } = getDimensions(node);
    const right = node.locationX + width;
    if (right > maxNonFaultRight) maxNonFaultRight = right;
  }

  const updatedNodes = new Map<string, FlowNode>();
  for (const [id, node] of graph.nodes) {
    if (faultOnlyIds.has(id)) {
      updatedNodes.set(id, {
        ...node,
        locationX: maxNonFaultRight + 120,
      });
    } else {
      updatedNodes.set(id, node);
    }
  }

  return { ...graph, nodes: updatedNodes };
}

export function computeLayout(
  graph: FlowGraph,
  options: { followSubflows?: boolean } = {},
): FlowGraph {
  if (graph.nodes.size === 0) return graph;

  const faultOnlyIds = identifyFaultOnlyNodes(graph);

  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: 'TB',
    nodesep: 50,
    ranksep: 80,
    acyclicer: 'greedy',
    ranker: 'tight-tree',
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Register nodes — fault-only nodes get rank: 'sink' hint
  for (const node of graph.nodes.values()) {
    const { width, height } = getDimensions(node);
    const nodeAttrs: Record<string, unknown> = { width, height, label: node.id };
    if (faultOnlyIds.has(node.id)) {
      nodeAttrs['rank'] = 'sink';
    }
    g.setNode(node.id, nodeAttrs);
  }

  // Register edges — skip back-edges and optionally skip subflow outgoing
  for (const edge of graph.edges) {
    if (edge.isBackEdge) continue;
    const sourceNode = graph.nodes.get(edge.sourceId);
    if (
      sourceNode?.type === 'subflow' &&
      options.followSubflows !== true
    ) {
      continue;
    }
    // Only add edges between nodes that exist in the graph
    if (graph.nodes.has(edge.sourceId) && graph.nodes.has(edge.targetId)) {
      g.setEdge(edge.sourceId, edge.targetId);
    }
  }

  dagre.layout(g);

  // Always use dagre-computed positions. Salesforce locationX/Y are preserved in
  // `metadata` for reference but are too coarse for layout (nodes spaced at 126px
  // while node width is 200px, causing guaranteed overlaps on sibling branches).
  const updatedNodes = new Map<string, FlowNode>();
  for (const [id, node] of graph.nodes) {
    const dagreNode = g.node(id);

    if (dagreNode !== undefined) {
      updatedNodes.set(id, {
        ...node,
        locationX: dagreNode.x - dagreNode.width / 2,
        locationY: dagreNode.y - dagreNode.height / 2,
      });
    } else {
      updatedNodes.set(id, node);
    }
  }

  const withCoords: FlowGraph = { ...graph, nodes: updatedNodes };
  const normalised = normaliseCoordinates(withCoords);
  const segregated = segregateFaultNodes(normalised, faultOnlyIds);
  const fanOutGroups = detectFanOutGroups(segregated);
  const equalised = equaliseSiblingSpacing(segregated, fanOutGroups);
  const withWaypoints = addBackEdgeWaypoints(equalised);

  return withWaypoints;
}

export function detectFanOutGroups(graph: FlowGraph): Map<string, string[]> {
  const groups = new Map<string, string[]>();

  for (const sourceId of graph.nodes.keys()) {
    const outgoing = graph.edges.filter(
      (e) => e.sourceId === sourceId && !e.isFault && !e.isBackEdge,
    );
    if (outgoing.length < 2) continue;

    // Check that target nodes all share approximately the same Y coordinate
    const targets = outgoing
      .map((e) => graph.nodes.get(e.targetId))
      .filter((n): n is FlowNode => n !== undefined);

    if (targets.length < 2) continue;

    const ys = targets.map((n) => n.locationY);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    if (maxY - minY <= 20) {
      groups.set(
        sourceId,
        targets.map((n) => n.id),
      );
    }
  }

  return groups;
}

function equaliseSiblingSpacing(
  graph: FlowGraph,
  fanOutGroups: Map<string, string[]>,
): FlowGraph {
  if (fanOutGroups.size === 0) return graph;

  const updatedNodes = new Map<string, FlowNode>(graph.nodes);
  const nodesep = 60;

  for (const [sourceId, siblingIds] of fanOutGroups) {
    const sourceNode = updatedNodes.get(sourceId);
    if (sourceNode === undefined) continue;

    const { width: sourceWidth } = getDimensions(sourceNode);
    const sourceCenterX = sourceNode.locationX + sourceWidth / 2;

    // Compute total width of all siblings with gaps
    const siblingWidths = siblingIds.map((id) => {
      const node = updatedNodes.get(id);
      return node !== undefined ? getDimensions(node).width : 200;
    });
    const totalWidth =
      siblingWidths.reduce((s, w) => s + w, 0) +
      (siblingIds.length - 1) * nodesep;

    // Spread symmetrically around the source center X
    let startX = sourceCenterX - totalWidth / 2;
    startX = Math.max(40, startX); // clamp to left edge

    // Sort siblings by current X to maintain left-to-right order
    const siblingNodes = siblingIds
      .map((id) => updatedNodes.get(id))
      .filter((n): n is FlowNode => n !== undefined)
      .sort((a, b) => a.locationX - b.locationX);

    let cursor = startX;
    for (const sibling of siblingNodes) {
      const { width } = getDimensions(sibling);
      updatedNodes.set(sibling.id, { ...sibling, locationX: cursor });
      cursor += width + nodesep;
    }
  }

  return { ...graph, nodes: updatedNodes };
}

function normaliseCoordinates(graph: FlowGraph): FlowGraph {
  const nodes = [...graph.nodes.values()];
  if (nodes.length === 0) return graph;

  const minX = Math.min(...nodes.map((n) => n.locationX));
  const minY = Math.min(...nodes.map((n) => n.locationY));
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

function addBackEdgeWaypoints(graph: FlowGraph): FlowGraph {
  const updatedEdges: FlowEdge[] = graph.edges.map((edge) => {
    if (!edge.isBackEdge) return edge;

    const sourceNode = graph.nodes.get(edge.sourceId);
    const targetNode = graph.nodes.get(edge.targetId);
    if (sourceNode === undefined || targetNode === undefined) return edge;

    const { width: sourceWidth, height: sourceHeight } =
      getDimensions(sourceNode);
    const { height: targetHeight } = getDimensions(targetNode);

    const sourceCenterY = sourceNode.locationY + sourceHeight / 2;
    const targetCenterY = targetNode.locationY + targetHeight / 2;
    const waypointX = sourceNode.locationX + sourceWidth + 60;

    return {
      ...edge,
      waypoints: [
        { x: waypointX, y: sourceCenterY },
        { x: waypointX, y: targetCenterY },
      ],
    };
  });

  return { ...graph, edges: updatedEdges };
}
