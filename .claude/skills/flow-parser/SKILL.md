---
name: flow-parser
description: >
  Use this skill for ANY task involving reading, parsing, or transforming Salesforce Flow XML
  (.flow-meta.xml files) into the internal FlowGraph model. Triggers include: parsing Flow elements,
  extracting connectors, detecting back-edges, handling fault paths, normalising Salesforce metadata
  into graph nodes and edges. Use this skill even if the user just says "parse the flow" or
  "read the XML" — it contains critical normalisation rules that prevent silent data loss.
---

# Flow Parser Skill

## Purpose

Parse Salesforce Flow XML (`.flow-meta.xml`) into the internal `FlowGraph` model
(defined in `src/model/flow-graph.ts`). Every parser implementation task must follow
this skill's rules.

---

## Parser Configuration (fast-xml-parser)

Always initialise with these options — do not deviate:

```typescript
import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true,
  isArray: (tagName) => [
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
  ].includes(tagName),
});
```

The `isArray` config is critical. Salesforce produces single-element arrays as plain objects.
Without this, iterating over a single `<decisions>` element throws a "not iterable" error.

---

## Element Extraction Rules

### Start Node

```typescript
// <start> is always a single element, never an array
const start = flow.Flow.start;
const startNode: FlowNode = {
  id: 'start',
  name: 'start',
  label: 'Start',
  type: 'start',
  locationX: Number(start.locationX ?? 0),
  locationY: Number(start.locationY ?? 0),
  metadata: start,
};
```

### Decisions

```typescript
for (const decision of flow.Flow.decisions ?? []) {
  // One node per decision
  const node: FlowNode = { id: decision.name, name: decision.name, label: decision.label, type: 'decision', ... };

  // One edge per rule (in order)
  for (const rule of decision.rules ?? []) {
    edges.push({
      id: `${decision.name}__${rule.name}`,
      sourceId: decision.name,
      targetId: rule.connector.targetReference,
      label: rule.label,
      isFault: false,
      isBackEdge: false, // computed later
    });
  }

  // Default connector
  if (decision.defaultConnector) {
    edges.push({
      id: `${decision.name}__default`,
      sourceId: decision.name,
      targetId: decision.defaultConnector.targetReference,
      label: decision.defaultConnectorLabel ?? 'Default',
      isFault: false,
      isBackEdge: false,
    });
  }
}
```

### Loops

Loops have two outgoing connectors:
- `nextValueConnector` → processes next iteration element
- `noMoreValuesConnector` → exits the loop

```typescript
edges.push({
  id: `${loop.name}__next`,
  sourceId: loop.name,
  targetId: loop.nextValueConnector.targetReference,
  label: 'For Each',
  isFault: false,
  isBackEdge: false,
});
edges.push({
  id: `${loop.name}__done`,
  sourceId: loop.name,
  targetId: loop.noMoreValuesConnector.targetReference,
  label: 'After Last',
  isFault: false,
  isBackEdge: false,
});
```

### Fault Connectors

All DML elements (`recordCreates`, `recordUpdates`, `recordDeletes`, `recordLookups`, `actionCalls`)
may have a `<faultConnector>`. Always check for it:

```typescript
if (element.faultConnector) {
  edges.push({
    id: `${element.name}__fault`,
    sourceId: element.name,
    targetId: element.faultConnector.targetReference,
    label: 'Fault',
    isFault: true,
    isBackEdge: false,
  });
}
```

---

## Back-Edge Detection

Run this AFTER all nodes and edges are built. Uses iterative DFS to avoid stack overflow on large flows.

```typescript
function detectBackEdges(graph: FlowGraph): void {
  const visited = new Set<string>();
  const pathStack = new Set<string>();

  function dfs(nodeId: string): void {
    visited.add(nodeId);
    pathStack.add(nodeId);

    const outgoing = graph.edges.filter(e => e.sourceId === nodeId);
    for (const edge of outgoing) {
      if (!visited.has(edge.targetId)) {
        dfs(edge.targetId);
      } else if (pathStack.has(edge.targetId)) {
        edge.isBackEdge = true; // mutate in place
      }
    }

    pathStack.delete(nodeId);
  }

  dfs('start');
}
```

---

## Coordinate Extraction

```typescript
function extractCoords(element: unknown): { locationX: number; locationY: number } {
  const el = element as Record<string, unknown>;
  const x = Number(el['locationX'] ?? 0);
  const y = Number(el['locationY'] ?? 0);
  return {
    locationX: isNaN(x) ? 0 : x,
    locationY: isNaN(y) ? 0 : y,
  };
}
```

Never throw on missing coordinates. Return `{ locationX: 0, locationY: 0 }` and let the
layout engine handle placement.

---

## Test Fixtures Required

Every parser task must have a corresponding `.flow-meta.xml` fixture in `tests/fixtures/`.
Minimum fixture set:

- `simple-linear.flow-meta.xml` — start + 2 assignments + screen, no branches
- `decision-with-rules.flow-meta.xml` — 3 rules + default connector
- `loop-with-subflow.flow-meta.xml` — loop containing a subflow reference
- `fault-path.flow-meta.xml` — record update with fault connector
- `large-flow.flow-meta.xml` — 25+ nodes (generated or real)

---

## Definition of Done (Parser)

- [ ] All elements in the Metadata Mapping Matrix have a corresponding parser branch
- [ ] `isArray` config prevents single-element object errors
- [ ] Fault connectors are always flagged `isFault: true`
- [ ] Back-edge detection runs after graph construction, not during
- [ ] Zero TypeScript `any` types in parser code
- [ ] All fixture flows parse without throwing
