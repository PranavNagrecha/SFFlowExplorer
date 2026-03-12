# DOMAIN-KNOWLEDGE.md — Salesforce Flow → Draw.io Diagram Generator

> Stage 1 output. Proves understanding before any implementation begins.
> Last updated: 2026-03-12

---

## 1. Technical Glossary

| Term | Definition in Project Context |
|------|-------------------------------|
| **Vertex** | An mxGraph node (`<mxCell vertex="1">`) representing one Salesforce Flow element |
| **Edge** | An mxGraph connector (`<mxCell edge="1">`) representing a Flow connector/transition |
| **mxGeometry** | The `x`, `y`, `width`, `height` of a vertex, or `relative="1"` for an edge, in the diagram |
| **Connector** | A directed edge between two Flow elements; sourced from `<connector>`, `<faultConnector>`, `<defaultConnector>`, or `<rules[n].connector>` in the XML |
| **Fault Path** | A connector from an element's `<faultConnector>` — always rendered as dashed red (`strokeColor=#B85450`) |
| **Happy Path** | The primary, non-fault connector path — solid grey or labelled with rule name |
| **Back-Edge** | A connector whose target is an ancestor of its source in the DFS traversal tree; creates a visual cycle (loop). Detected post-construction via DFS path-stack. |
| **Subflow Reference** | A vertex representing a `<subflows>` element; rendered in the purple colour family; treated as a layout sink unless `--follow-subflows` is active |

---

## 2. Metadata Mapping Matrix

Every Salesforce Flow element type that can appear in a `.flow-meta.xml` file.

| Salesforce Element | XML Tag(s) | mxGraph Shape | Fill Colour | Border Colour | Dimensions (w×h) | Label Prefix | Notes |
|---|---|---|---|---|---|---|---|
| Start | `<start>` | `ellipse` | `#D5E8D4` | `#82B366` | 120×60 | ▶ Start | Always exactly one. No `name` attribute — use `'start'` as id. |
| Decision | `<decisions>` | `rhombus` | `#DAE8FC` | `#6C8EBF` | 200×100 | ⬦ Decision | Multiple outgoing edges: one per `<rules>` item + optional `<defaultConnector>`. Rules processed in declaration order. |
| Assignment | `<assignments>` | `rounded=1` rect | `#FFF2CC` | `#D6B656` | 200×60 | = Assignment | Always has exactly one `<connector>` (next element). |
| Loop | `<loops>` | `shape=mxgraph.flowchart.or` | `#E1D5E7` | `#9673A6` | 200×80 | ↺ Loop | Two outgoing: `nextValueConnector` (For Each) and `noMoreValuesConnector` (After Last). Back-edge detection critical here. |
| Record Create | `<recordCreates>` | `shape=cylinder3` | `#F8CECC` | `#B85450` | 200×70 | + Create | May have `<faultConnector>`. |
| Record Update | `<recordUpdates>` | `shape=cylinder3` | `#FFE6CC` | `#D79B00` | 200×70 | ✎ Update | May have `<faultConnector>`. |
| Record Delete | `<recordDeletes>` | `shape=cylinder3` | `#F8CECC` | `#B85450` | 200×70 | − Delete | May have `<faultConnector>`. |
| Record Lookup | `<recordLookups>` | `shape=cylinder3` | `#DAE8FC` | `#6C8EBF` | 200×70 | 🔍 Get | May have `<faultConnector>`. |
| Screen | `<screens>` | `shape=mxgraph.flowchart.display` | `#E6F3FF` | `#0075DB` | 200×70 | 🖥 Screen | No fault connector. Has exactly one `<connector>`. |
| Action Call | `<actionCalls>` | `rounded=1` rect | `#F5F5F5` | `#666666` | 200×60 | ⚙ Action | Apex / invocable. May have `<faultConnector>`. |
| Subflow | `<subflows>` | `rounded=1` rect | `#E8DEF8` | `#6750A4` | 200×60 | ⤵ Subflow | References another flow by `flowName`. Treated as layout sink. Purple family. |
| Collection Processor | `<collectionProcessors>` | `rounded=1` rect | `#FFF9C4` | `#F57F17` | 200×60 | ∑ Collection | `collectionProcessorType` determines subtype label. |
| End (implicit) | No element — synthesised | `ellipse` | `#F8CECC` | `#B85450` | 120×60 | ■ End | Generated when a connector points to `null` / no `targetReference`. |
| **Fault Connector** | `<faultConnector>` | edge | — | `#B85450` | — | Fault | `dashed=1;strokeColor=#B85450;fontColor=#B85450;strokeWidth=2;` |
| **Default Connector** | `<defaultConnector>` in `<decisions>` | edge | — | `#666666` | Default | Uses `defaultConnectorLabel` if present, else "Default". |
| **Rule Connector** | `<rules[n].connector>` | edge | — | `#666666` | rule.label | Label taken from `rule.label`. One per rule. |

---

## 3. Edge Case Encyclopedia

### 3.1 Loops and Back-Edges

**What it is:** A `<loops>` element's `nextValueConnector` often points forward to the first element inside the loop body, which in turn eventually connects back to the loop node — creating a cycle in the graph.

**Detection strategy:**
- Run iterative DFS from the `start` node after all nodes and edges are built.
- Maintain a `pathStack: Set<string>`. If an edge's `targetId` is already in `pathStack`, it is a back-edge.
- Mark `edge.isBackEdge = true`. Do NOT recurse into back-edges during DFS.
- Back-edges are excluded from dagre's graph to prevent cycle issues, since `acyclicer: 'greedy'` handles them at the rank-assignment level.

**Visual treatment:**
- Back-edge connectors get two waypoints: one to the right of the source node (+60px from right edge), one to the right of the target node. This routes the connector around the diagram instead of drawing a direct reverse line.

**Failure mode if ignored:** dagre throws or produces an infinite layout loop. The diagram visually has overlapping backward arrows.

---

### 3.2 Multiple Decision Outcomes

**What it is:** A `<decisions>` element can have N `<rules>` plus a `<defaultConnector>`. Each is a separate outgoing edge.

**Strategy:**
- Iterate `decision.rules` in declaration order → one edge per rule, labelled with `rule.label`.
- If `decision.defaultConnector` exists → one additional edge labelled with `decision.defaultConnectorLabel ?? 'Default'`.
- Rule connectors are accessed at `rule.connector.targetReference`.

**Failure mode if ignored:** Only the last rule edge is captured; all others are silently dropped.

---

### 3.3 Fault Paths

**What it is:** DML elements and action calls expose a `<faultConnector>` that fires when the operation fails at runtime.

**Strategy:**
- Always check for `element.faultConnector` on: `recordCreates`, `recordUpdates`, `recordDeletes`, `recordLookups`, `actionCalls`.
- Produce a `FlowEdge` with `isFault: true`, `label: 'Fault'`.
- In the generator: apply `dashed=1;strokeColor=#B85450;fontColor=#B85450;strokeWidth=2;` style.

**Failure mode if ignored:** Fault paths are missing from the diagram, giving the developer a false picture of error-free flow execution.

---

### 3.4 Single-Element Arrays (fast-xml-parser Normalisation)

**What it is:** When a Salesforce Flow has exactly one `<decisions>` element, `fast-xml-parser` returns it as a plain object, not an array, unless `isArray` is configured.

**Strategy:**
- Configure `isArray` for all collection tags: `decisions`, `rules`, `connectors`, `assignments`, `loops`, `recordCreates`, `recordUpdates`, `recordDeletes`, `recordLookups`, `screens`, `actionCalls`, `subflows`, `collectionProcessors`, `assignmentItems`, `conditions`, `waitEvents`.
- Always use `?? []` when iterating.

**Failure mode if ignored:** `for...of` on a non-array object throws `TypeError: x is not iterable` at runtime.

---

### 3.5 Missing `locationX/Y`

**What it is:** Some Flow elements, especially `start`, may have `locationX: 0, locationY: 0` or no coordinate attributes at all.

**Strategy:**
- Extract with `Number(el.locationX ?? 0)`. Guard with `isNaN()` fallback to 0.
- In the layout engine: if `locationX > 0 && locationY > 0`, use Salesforce coords as the hint. Otherwise, use dagre-computed position.
- After layout, run coordinate normalisation: shift all nodes so min(x) = 40, min(y) = 40.

**Failure mode if ignored:** All uncoordinated nodes stack at (0, 0), completely overlapping.

---

### 3.6 Subflow References

**What it is:** A `<subflows>` element references another flow by `flowName`. It is a vertex in the current diagram but represents external logic.

**Strategy:**
- Render as a purple rounded rectangle with the referenced flow name in the label.
- Treat as a layout sink: no outgoing edges in the dagre graph (unless `--follow-subflows` is active).
- File resolution (if following): look in `force-app/main/default/flows/<flowName>.flow-meta.xml` relative to the input file's directory.

**Failure mode if ignored:** dagre tries to route through subflow nodes and distorts the layout rank structure.

---

### 3.7 Empty / Minimal Flows

**What it is:** A Flow with only a `<start>` element and nothing else.

**Strategy:**
- Parser must still produce a valid `FlowGraph` with exactly one node (`start`) and zero edges.
- Generator must produce valid mxGraphModel XML with one vertex cell.
- Layout engine normalises a single node to (40, 40).

---

### 3.8 Large Flows (50+ nodes)

**What it is:** Enterprise flows can have 50–150 elements.

**Strategy:**
- Use `fast-xml-parser` (not `xml2js`) — it is significantly faster on large files.
- Layout engine uses dagre which is O(V+E) — completes in < 500ms for 50 nodes.
- Generator adjusts page dimensions: ≤20 nodes → A4, ≤40 → A3, >40 → A2 + `pageScale="0.75"`.

---

### 3.9 Special Characters in Labels

**What it is:** Flow element labels or API names may contain `&`, `<`, `>`, `"`, `'`.

**Strategy:**
- Always run `escapeXml()` on every value attribute in generated XML.
- `escapeXml` replaces: `&→&amp;`, `<→&lt;`, `>→&gt;`, `"→&quot;`, `'→&apos;`.

---

## 4. Architecture Decisions

### ADR-001: Uncompressed XML output
**Decision:** Output raw `mxGraphModel` XML, never base64-compressed format.
**Reason:** Compressed output is a binary blob — not diffable in git, not debuggable without Draw.io.

### ADR-002: dagre over elkjs
**Decision:** Use `dagre@0.8.x` with `@types/dagre`.
**Reason:** Smaller bundle, simpler Node.js API, no Java subprocess dependency. Adequate for hierarchical flowchart layout. `acyclicer: 'greedy'` handles cycles from loops.

### ADR-003: Standalone CLI over sf plugin
**Decision:** Build as a standalone `commander`-based CLI (`sfflow-explorer generate`).
**Reason:** Faster to ship, zero `sf` CLI version dependency. Can be wrapped as an `sf` plugin in Phase 2.

### ADR-004: fast-xml-parser over xml2js
**Decision:** Use `fast-xml-parser` with `isArray` configuration.
**Reason:** 3–5× faster on large XML files; `isArray` callback eliminates single-object vs array normalisation bugs.

### ADR-005: Hybrid coordinate strategy
**Decision:** Use Salesforce `locationX/Y` as hints when non-zero; fall back to dagre for nodes without coordinates.
**Reason:** Preserves the flow author's intended layout intent while guaranteeing clean placement for all nodes.

---

## 5. Three Mandatory Questions — All Element Types

Before writing the parser for each element, I must answer:

| Element | What is it? | mxGraph shape | Edge case that breaks layout |
|---|---|---|---|
| `start` | Entry point | ellipse | No `name` field — must synthesise id `'start'` |
| `decisions` | Branching | rhombus | Multiple rules + default → N+1 edges; single rule without `isArray` config throws |
| `assignments` | Data manipulation | rounded rect | None significant; always exactly one outgoing connector |
| `loops` | Collection iteration | hexagon (flowchart.or) | Back-edge from loop body back to loop node; must be detected and routed separately |
| `recordCreates` | DML insert | cylinder3 | Fault connector may be absent — always guard with `if (el.faultConnector)` |
| `recordUpdates` | DML update | cylinder3 | Same as recordCreates |
| `recordDeletes` | DML delete | cylinder3 | Same as recordCreates |
| `recordLookups` | SOQL query | cylinder3 | Same as recordCreates |
| `screens` | User interaction | flowchart.display | No fault connector; must not attempt to read `faultConnector` |
| `actionCalls` | Apex / invocable | rounded rect | Fault connector may exist; `actionType` distinguishes Apex from invocable |
| `subflows` | Nested flow ref | rounded rect (purple) | Layout sink — no outgoing edges unless `--follow-subflows`; referenced file may not exist |
| `collectionProcessors` | Collection ops | rounded rect | `collectionProcessorType` field determines label; may be missing |
| End (synthesised) | Terminal node | ellipse (red) | Generated from connectors pointing to absent nodes — must be idempotent (one end node) |

---

## 6. Pipeline Summary

```
.flow-meta.xml
  → flow-fetcher    (local file or SF org via @salesforce/core)
  → flow-parser     (XML → FlowGraph, no coords)
  → layout-engine   (FlowGraph + dagre → FlowGraph with x/y)
  → drawio-generator (FlowGraph → mxGraph XML string)
  → .drawio file
```

Each stage is independently testable. Each has a dedicated SKILL.md.

---

## 7. Test Fixture Requirements

| Fixture File | Purpose |
|---|---|
| `simple-linear.flow-meta.xml` | start → assignment → assignment → screen (no branches) |
| `decision-with-rules.flow-meta.xml` | decision with 3 rules + default |
| `loop-with-subflow.flow-meta.xml` | loop containing a subflow reference (back-edge case) |
| `fault-path.flow-meta.xml` | recordUpdate with faultConnector |
| `large-flow.flow-meta.xml` | 25+ nodes (auto-generated) |

---

*DOMAIN-KNOWLEDGE.md is the Stage 1 output. Architecture proceeds from here.*
