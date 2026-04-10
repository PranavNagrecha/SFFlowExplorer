import { XMLParser } from 'fast-xml-parser';
import type { FlowGraph, FlowNode, FlowEdge, FlowVariable } from '../model/flow-graph.js';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  isArray: (tagName: string): boolean =>
    [
      'decisions',
      'rules',
      'connectors',
      'assignments',
      'loops',
      'recordCreates',
      'recordUpdates',
      'recordDeletes',
      'recordLookups',
      'screens',
      'actionCalls',
      'subflows',
      'collectionProcessors',
      'assignmentItems',
      'conditions',
      'waitEvents',
      'variables',
      'waits',
      'customErrors',
      'customErrorMessages',
      'transforms',
      'transformValues',
      'transformValueActions',
    ].includes(tagName),
});

function extractCoords(element: Record<string, unknown>): {
  locationX: number;
  locationY: number;
} {
  const x = Number(element['locationX'] ?? 0);
  const y = Number(element['locationY'] ?? 0);
  return {
    locationX: isNaN(x) ? 0 : x,
    locationY: isNaN(y) ? 0 : y,
  };
}

function makeEdgeId(source: string, suffix: string): string {
  return `${source}__${suffix}`;
}

export function parseFlow(xml: string, flowName: string): FlowGraph {
  const parsed = parser.parse(xml) as Record<string, unknown>;
  const flow = (parsed['Flow'] ?? parsed) as Record<string, unknown>;

  const nodes = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  // --- Start node ---
  const startRaw = flow['start'] as Record<string, unknown> | undefined;
  if (startRaw !== undefined) {
    const coords = extractCoords(startRaw);
    nodes.set('start', {
      id: 'start',
      name: 'start',
      label: 'Start',
      type: 'start',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: startRaw,
    });

    const connector = startRaw['connector'] as
      | Record<string, unknown>
      | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId('start', 'connector'),
          sourceId: 'start',
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Assignments ---
  const assignments = (flow['assignments'] as Record<string, unknown>[] | undefined) ?? [];
  for (const assignment of assignments) {
    const name = String(assignment['name'] ?? '');
    const label = String(assignment['label'] ?? name);
    const coords = extractCoords(assignment);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'assignment',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: assignment,
    });

    const connector = assignment['connector'] as
      | Record<string, unknown>
      | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'connector'),
          sourceId: name,
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }

    const faultConnector = assignment['faultConnector'] as
      | Record<string, unknown>
      | undefined;
    if (faultConnector !== undefined) {
      const target = String(faultConnector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'fault'),
          sourceId: name,
          targetId: target,
          label: 'Fault',
          isFault: true,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Screens ---
  const screens = (flow['screens'] as Record<string, unknown>[] | undefined) ?? [];
  for (const screen of screens) {
    const name = String(screen['name'] ?? '');
    const label = String(screen['label'] ?? name);
    const coords = extractCoords(screen);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'screen',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: screen,
    });

    const connector = screen['connector'] as
      | Record<string, unknown>
      | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'connector'),
          sourceId: name,
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Decisions ---
  const decisions = (flow['decisions'] as Record<string, unknown>[] | undefined) ?? [];
  for (const decision of decisions) {
    const name = String(decision['name'] ?? '');
    const label = String(decision['label'] ?? name);
    const coords = extractCoords(decision);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'decision',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: decision,
    });

    const rules = (decision['rules'] as Record<string, unknown>[] | undefined) ?? [];
    for (const rule of rules) {
      const ruleConnector = rule['connector'] as
        | Record<string, unknown>
        | undefined;
      if (ruleConnector !== undefined) {
        const target = String(ruleConnector['targetReference'] ?? '');
        const ruleName = String(rule['name'] ?? '');
        const ruleLabel = String(rule['label'] ?? ruleName);
        if (target) {
          edges.push({
            id: makeEdgeId(name, ruleName),
            sourceId: name,
            targetId: target,
            label: ruleLabel,
            isFault: false,
            isBackEdge: false,
          });
        }
      }
    }

    const defaultConnector = decision['defaultConnector'] as
      | Record<string, unknown>
      | undefined;
    if (defaultConnector !== undefined) {
      const target = String(defaultConnector['targetReference'] ?? '');
      const defaultLabel = String(
        decision['defaultConnectorLabel'] ?? 'Default',
      );
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'default'),
          sourceId: name,
          targetId: target,
          label: defaultLabel,
          isFault: false,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Loops ---
  const loops = (flow['loops'] as Record<string, unknown>[] | undefined) ?? [];
  for (const loop of loops) {
    const name = String(loop['name'] ?? '');
    const label = String(loop['label'] ?? name);
    const coords = extractCoords(loop);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'loop',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: loop,
    });

    const nextConnector = loop['nextValueConnector'] as
      | Record<string, unknown>
      | undefined;
    if (nextConnector !== undefined) {
      const target = String(nextConnector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'next'),
          sourceId: name,
          targetId: target,
          label: 'For Each',
          isFault: false,
          isBackEdge: false,
        });
      }
    }

    const doneConnector = loop['noMoreValuesConnector'] as
      | Record<string, unknown>
      | undefined;
    if (doneConnector !== undefined) {
      const target = String(doneConnector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'done'),
          sourceId: name,
          targetId: target,
          label: 'After Last',
          isFault: false,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Record Creates ---
  parseRecordElements(
    (flow['recordCreates'] as Record<string, unknown>[] | undefined) ?? [],
    'recordCreate',
    nodes,
    edges,
  );

  // --- Record Updates ---
  parseRecordElements(
    (flow['recordUpdates'] as Record<string, unknown>[] | undefined) ?? [],
    'recordUpdate',
    nodes,
    edges,
  );

  // --- Record Deletes ---
  parseRecordElements(
    (flow['recordDeletes'] as Record<string, unknown>[] | undefined) ?? [],
    'recordDelete',
    nodes,
    edges,
  );

  // --- Record Lookups ---
  parseRecordElements(
    (flow['recordLookups'] as Record<string, unknown>[] | undefined) ?? [],
    'recordLookup',
    nodes,
    edges,
  );

  // --- Action Calls ---
  parseRecordElements(
    (flow['actionCalls'] as Record<string, unknown>[] | undefined) ?? [],
    'actionCall',
    nodes,
    edges,
  );

  // --- Subflows ---
  const subflows = (flow['subflows'] as Record<string, unknown>[] | undefined) ?? [];
  for (const subflow of subflows) {
    const name = String(subflow['name'] ?? '');
    const flowNameRef = String(subflow['flowName'] ?? name);
    const label = `${flowNameRef}`;
    const coords = extractCoords(subflow);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'subflow',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: subflow,
    });

    const connector = subflow['connector'] as
      | Record<string, unknown>
      | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'connector'),
          sourceId: name,
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Collection Processors ---
  const collectionProcessors = (flow['collectionProcessors'] as Record<string, unknown>[] | undefined) ?? [];
  for (const cp of collectionProcessors) {
    const name = String(cp['name'] ?? '');
    const label = String(cp['label'] ?? name);
    const coords = extractCoords(cp);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'collectionProcessor',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: cp,
    });

    const connector = cp['connector'] as Record<string, unknown> | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'connector'),
          sourceId: name,
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Waits (analogous to decisions: waitEvents[] like rules[]) ---
  const waits = (flow['waits'] as Record<string, unknown>[] | undefined) ?? [];
  for (const wait of waits) {
    const name = String(wait['name'] ?? '');
    const label = String(wait['label'] ?? name);
    const coords = extractCoords(wait);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'wait',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: wait,
    });

    const waitEvts = (wait['waitEvents'] as Record<string, unknown>[] | undefined) ?? [];
    for (const evt of waitEvts) {
      const evtConnector = evt['connector'] as Record<string, unknown> | undefined;
      if (evtConnector !== undefined) {
        const target = String(evtConnector['targetReference'] ?? '');
        const evtLabel = String(evt['label'] ?? '');
        if (target) {
          const edge: FlowEdge = {
            id: makeEdgeId(name, evtLabel || target),
            sourceId: name,
            targetId: target,
            isFault: false,
            isBackEdge: false,
          };
          if (evtLabel) {
            edge.label = evtLabel;
          }
          edges.push(edge);
        }
      }
    }

    const defaultConnector = wait['defaultConnector'] as Record<string, unknown> | undefined;
    if (defaultConnector !== undefined) {
      const target = String(defaultConnector['targetReference'] ?? '');
      const defaultLabel = String(wait['defaultConnectorLabel'] ?? 'Default');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'default'),
          sourceId: name,
          targetId: target,
          label: defaultLabel,
          isFault: false,
          isBackEdge: false,
        });
      }
    }

    const faultConnector = wait['faultConnector'] as Record<string, unknown> | undefined;
    if (faultConnector !== undefined) {
      const target = String(faultConnector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'fault'),
          sourceId: name,
          targetId: target,
          label: 'Fault',
          isFault: true,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Custom Errors ---
  const customErrors = (flow['customErrors'] as Record<string, unknown>[] | undefined) ?? [];
  for (const ce of customErrors) {
    const name = String(ce['name'] ?? '');
    const label = String(ce['label'] ?? name);
    const coords = extractCoords(ce);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'customError',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: ce,
    });

    const connector = ce['connector'] as Record<string, unknown> | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'connector'),
          sourceId: name,
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }

    const faultConnector = ce['faultConnector'] as Record<string, unknown> | undefined;
    if (faultConnector !== undefined) {
      const target = String(faultConnector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'fault'),
          sourceId: name,
          targetId: target,
          label: 'Fault',
          isFault: true,
          isBackEdge: false,
        });
      }
    }
  }

  // --- Transforms ---
  const transforms = (flow['transforms'] as Record<string, unknown>[] | undefined) ?? [];
  for (const tf of transforms) {
    const name = String(tf['name'] ?? '');
    const label = String(tf['label'] ?? name);
    const coords = extractCoords(tf);

    nodes.set(name, {
      id: name,
      name,
      label,
      type: 'transform',
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: tf,
    });

    const connector = tf['connector'] as Record<string, unknown> | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'connector'),
          sourceId: name,
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }
    // No faultConnector for transforms — operates on in-memory data only
  }

  // --- Variables ---
  const variablesRaw = (flow['variables'] as Record<string, unknown>[] | undefined) ?? [];
  const variables: FlowVariable[] = variablesRaw.map((v) => ({
    name: String(v['name'] ?? ''),
    dataType: String(v['dataType'] ?? ''),
    isInput: v['isInput'] === true || v['isInput'] === 'true',
    isOutput: v['isOutput'] === true || v['isOutput'] === 'true',
    isCollection: v['isCollection'] === true || v['isCollection'] === 'true',
  }));

  // --- Synthesise End nodes for terminal nodes (no outgoing edges) ---
  synthesiseEndNodes(nodes, edges);

  // --- Back-edge detection (post-construction DFS) ---
  detectBackEdges({ flowName, nodes, edges });

  return { flowName, nodes, edges, variables };
}

function parseRecordElements(
  elements: Record<string, unknown>[],
  type:
    | 'recordCreate'
    | 'recordUpdate'
    | 'recordDelete'
    | 'recordLookup'
    | 'actionCall',
  nodes: Map<string, import('../model/flow-graph.js').FlowNode>,
  edges: FlowEdge[],
): void {
  for (const element of elements) {
    const name = String(element['name'] ?? '');
    const label = String(element['label'] ?? name);
    const coords = extractCoords(element);

    nodes.set(name, {
      id: name,
      name,
      label,
      type,
      locationX: coords.locationX,
      locationY: coords.locationY,
      metadata: element,
    });

    const connector = element['connector'] as
      | Record<string, unknown>
      | undefined;
    if (connector !== undefined) {
      const target = String(connector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'connector'),
          sourceId: name,
          targetId: target,
          isFault: false,
          isBackEdge: false,
        });
      }
    }

    const faultConnector = element['faultConnector'] as
      | Record<string, unknown>
      | undefined;
    if (faultConnector !== undefined) {
      const target = String(faultConnector['targetReference'] ?? '');
      if (target) {
        edges.push({
          id: makeEdgeId(name, 'fault'),
          sourceId: name,
          targetId: target,
          label: 'Fault',
          isFault: true,
          isBackEdge: false,
        });
      }
    }
  }
}

function synthesiseEndNodes(
  nodes: Map<string, FlowNode>,
  edges: FlowEdge[],
): void {
  const sourcesWithOutgoing = new Set(edges.map((e) => e.sourceId));

  const terminalNodeIds = [...nodes.entries()]
    .filter(([id, node]) => node.type !== 'start' && !sourcesWithOutgoing.has(id))
    .map(([id]) => id);

  for (const nodeId of terminalNodeIds) {
    const node = nodes.get(nodeId)!;

    const endId = `end__${nodeId}`;
    nodes.set(endId, {
      id: endId,
      name: endId,
      label: 'End',
      type: 'end',
      locationX: node.locationX,
      locationY: node.locationY + 120,
      metadata: {},
    });

    edges.push({
      id: makeEdgeId(nodeId, 'end'),
      sourceId: nodeId,
      targetId: endId,
      isFault: false,
      isBackEdge: false,
    });
  }
}

function detectBackEdges(graph: FlowGraph): void {
  const visited = new Set<string>();
  const pathStack = new Set<string>();

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    pathStack.add(nodeId);

    const outgoing = graph.edges.filter((e) => e.sourceId === nodeId);
    for (const edge of outgoing) {
      if (!visited.has(edge.targetId)) {
        if (graph.nodes.has(edge.targetId)) {
          dfs(edge.targetId);
        }
      } else if (pathStack.has(edge.targetId)) {
        edge.isBackEdge = true;
      }
    }

    pathStack.delete(nodeId);
  }

  if (graph.nodes.has('start')) {
    dfs('start');
  }
}
