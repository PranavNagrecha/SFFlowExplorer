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

export function computeLayout(
  graph: FlowGraph,
  options: { followSubflows?: boolean } = {},
): FlowGraph {
  if (graph.nodes.size === 0) return graph;

  const g = new dagre.graphlib.Graph();

  g.setGraph({
    rankdir: 'TB',
    nodesep: 50,
    ranksep: 80,
    acyclicer: 'greedy',
    ranker: 'tight-tree',
  });

  g.setDefaultEdgeLabel(() => ({}));

  // Register nodes
  for (const node of graph.nodes.values()) {
    const { width, height } = getDimensions(node);
    g.setNode(node.id, { width, height, label: node.id });
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
  const withWaypoints = addBackEdgeWaypoints(normalised);

  return withWaypoints;
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
