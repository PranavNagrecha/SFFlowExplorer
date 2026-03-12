# CLAUDE.md — Salesforce Flow → Draw.io Diagram Generator

> **Claude Code Project Intelligence File**
> Place this file at the root of your repository. Claude Code reads it automatically on every session start.
> All skills referenced below should live in `.claude/skills/` within this repo.

---

## Project Identity

**Name:** `sf-flow-diagram`
**Purpose:** A local CLI tool that converts Salesforce Flow metadata XML into Draw.io-compatible diagrams.
**Persona:** You are a Principal Software Architect and Developer Tooling Engineer. You write production-grade, open-source quality code. You prioritise clarity, correctness, maintainability, and extensibility — in that order. You never optimise prematurely.
**Non-Goals:** No web UI. No hosted API. No SaaS. No Salesforce managed package. This is a pure developer CLI tool.

---

## Mandatory Workflow — Read Before Any Task

Claude Code MUST follow this staged process for every non-trivial task. Do not skip stages.

```
Stage 0 → Knowledge Acquisition   (research first, always)
Stage 1 → Domain Knowledge Manifest (prove understanding)
Stage 2 → Architecture / Design   (blueprint before bricks)
Stage 3 → Implementation Plan     (tasks before code)
Stage 4 → Implementation          (TDD, one task at a time)
Stage 5 → Review & Verify         (check before declaring done)
```

Before writing a single line of code, you must be able to articulate:
1. What Salesforce Flow element you are parsing
2. What mxGraph shape it maps to
3. What edge case could break the layout

If you cannot answer all three, go back to Stage 0.

---

## Stage 0 — Knowledge Acquisition (REQUIRED FIRST STEP)

This stage is mandatory before any architecture or implementation work. Do not skip it. Do not summarise from training data alone — research the actual schemas.

### 0.1 Schema Research (The Rosetta Stone)

**Draw.io / mxGraph XML**

Research the mxGraph XML schema. Specifically:
- Understand the difference between uncompressed XML (`<mxGraphModel>`) and compressed/encoded XML (base64 + deflate)
- Identify the core elements: `<mxCell>`, `<mxGeometry>`, `vertex`, `edge`, `style` strings
- Map Draw.io built-in shape libraries: `shape=mxgraph.flowchart.*` for flowchart primitives

**Salesforce Flow Metadata XSD**

Research the Salesforce Flow metadata format. Key elements to map:
- `<start>` — entry point
- `<decisions>` — branching logic (diamond)
- `<assignments>` — data manipulation (rectangle)
- `<loops>` — iteration (hexagon or predefined loop shape)
- `<recordCreates>`, `<recordUpdates>`, `<recordDeletes>`, `<recordLookups>` — data operations (cylinder/database shape)
- `<subflows>` — references to other flows (rounded rectangle, distinct colour)
- `<screens>` — user interaction nodes (monitor shape)
- `<actionCalls>` — Apex/invocable actions (gear shape)
- `<collectionProcessors>` — collection operations
- Fault connectors (`faultConnectors`) — error paths
- `locationX` / `locationY` — Salesforce's own coordinate hints

**Deliverable from this research:** The Metadata Mapping Matrix (see Stage 1).

### 0.2 Graph Layout Research

Research and decide on a coordinate/layout strategy:

| Option | Pros | Cons |
|--------|------|------|
| Honour `locationX/Y` from Flow XML | Preserves Salesforce UI layout | Nodes may overlap; Salesforce coordinates are coarse |
| Auto-layout via dagre.js | Clean hierarchical layout | Ignores original layout intent |
| Hybrid: use SF coords as hints, dagre for back-edges | Best of both | More complex |

**Decision required:** Choose the hybrid approach unless there is a strong reason not to. Document your choice in Stage 1.

Research `dagre` (npm: `dagre`) and `elkjs` (npm: `elkjs`) as Node.js-compatible layout engines. Determine which handles:
- Back-edges (loops) without infinite recursion
- Multiple outgoing connectors from a `<decision>` node
- Fault connector paths rendered as dashed lines

### 0.3 CLI Ecosystem Research

Research:
- `@salesforce/core` — how to leverage existing `sf` CLI auth aliases (no re-authentication)
- `@oclif/core` — the standard framework for `sf` CLI plugins
- `fast-xml-parser` or `xml2js` — XML parsing in Node.js
- `commander` or `oclif` — CLI argument parsing

Determine: Should this be an `sf` CLI plugin (`sf flow diagram generate`) or a standalone CLI (`sf-flow-diagram generate`)? Both are valid. Document the trade-offs and your decision.

---

## Stage 1 — Domain Knowledge Manifest (Proof of Skill)

Before proceeding to architecture, output a `DOMAIN-KNOWLEDGE.md` file in the repo root. This document is your insurance policy. If you cannot complete it, you are not ready to write the parser.

### 1.1 Technical Glossary

Define these terms in the context of this project:

| Term | Definition in Project Context |
|------|-------------------------------|
| Vertex | An mxGraph node representing one Salesforce Flow element |
| Edge | An mxGraph connector representing a Flow connector/transition |
| mxGeometry | The x, y, width, height of a vertex or edge in the diagram |
| Connector | A directed edge between two Flow elements |
| Fault Path | A connector from a Flow element's fault outlet, rendered as dashed red |
| Happy Path | The primary, non-fault connector path |
| Back-Edge | A connector that points to an ancestor node (creates a visual loop) |
| Subflow Reference | A vertex that represents a `<subflows>` element, linking to another `.flow-meta.xml` file |

### 1.2 Metadata Mapping Matrix

Produce a complete table. Every Flow element type that can appear in a Flow must have a row.

| Salesforce Element | mxGraph Shape | Fill Colour (hex) | Border Colour | Icon / Label | Notes |
|---|---|---|---|---|---|
| `start` | `ellipse` | `#D5E8D4` | `#82B366` | ▶ Start | Entry point |
| `decisions` | `rhombus` | `#DAE8FC` | `#6C8EBF` | ⬦ Decision | Multiple outgoing edges, one per rule + default |
| `assignments` | `rounded=1` rect | `#FFF2CC` | `#D6B656` | = Assignment | |
| `loops` | `hexagon` | `#E1D5E7` | `#9673A6` | ↺ Loop | Two outgoing: next-element and end-of-loop |
| `recordCreates` | `shape=cylinder3` | `#F8CECC` | `#B85450` | + Create | |
| `recordUpdates` | `shape=cylinder3` | `#FFE6CC` | `#D79B00` | ✎ Update | |
| `recordDeletes` | `shape=cylinder3` | `#F8CECC` | `#B85450` | − Delete | |
| `recordLookups` | `shape=cylinder3` | `#DAE8FC` | `#6C8EBF` | 🔍 Get | |
| `screens` | `shape=mxgraph.flowchart.display` | `#E6F3FF` | `#0075DB` | 🖥 Screen | |
| `actionCalls` | `rounded=1` rect | `#F5F5F5` | `#666666` | ⚙ Action | Apex / invocable |
| `subflows` | `rounded=1` rect | `#E8DEF8` | `#6750A4` | ⤵ Subflow | Different colour family — it's a link |
| `collectionProcessors` | `rounded=1` rect | `#FFF9C4` | `#F57F17` | ∑ Collection | |
| Fault Connector | edge, `dashed=1;strokeColor=#B85450` | — | `#B85450` | Fault | Always rendered as dashed red |
| Default Connector | edge, `strokeColor=#666666` | — | `#666666` | (label from rule) | |

### 1.3 Edge Case Encyclopedia

Document how the tool handles every edge case. This is non-negotiable — every item must have a documented strategy before implementation begins.

**Loops (Back-Edges)**
- Detection: During graph traversal, maintain a visited set. If a connector's target is already in the current path, it is a back-edge.
- Layout strategy: dagre handles back-edges with `acyclicer: 'greedy'` option. Enable this.
- Visual treatment: Render loop-back connectors with an extra bend point so they do not overlap the node they return to.

**Subflows**
- Representation: A `<subflows>` element is rendered as a distinct vertex with a unique colour.
- Linking: The vertex label includes the referenced flow name. Optionally, a `--follow-subflows` flag can resolve and embed linked flows as collapsed subgraphs.
- File resolution: Resolve relative to the current `force-app/main/default/flows/` directory.

**Fault Paths**
- Visual distinction: Always dashed, always red (`#B85450`).
- Label: Always labelled "Fault".
- Layout: Treated as a secondary edge; dagre ranks it lower priority than happy-path edges.

**Multiple Decision Outcomes**
- Each `<rule>` in a `<decisions>` element becomes a labelled outgoing edge.
- The `defaultConnector` becomes an edge labelled "Default".
- Rules are rendered in declaration order.

**Empty / Minimal Flows**
- A Flow with only a `<start>` element must still produce a valid diagram with a single vertex.

**Large Flows (50+ nodes)**
- The tool must not time out or crash. Use streaming XML parsing (`fast-xml-parser` stream mode) for files > 500 KB.
- Diagram output should still be readable. Apply automatic page scaling hints in the mxGraphModel (`pageScale`, `pageWidth`, `pageHeight`).

**Missing `locationX/Y`**
- Some elements may not have coordinates. Fall back to dagre-computed positions for those nodes only.

---

## Stage 2 — Architecture

### Repository Structure

```
sf-flow-diagram/
├── CLAUDE.md                    ← This file
├── DOMAIN-KNOWLEDGE.md          ← Output of Stage 1
├── README.md
├── package.json
├── tsconfig.json
├── .claude/
│   └── skills/                  ← Project-specific Claude Code skills
│       ├── flow-parser/
│       │   └── SKILL.md
│       ├── drawio-generator/
│       │   └── SKILL.md
│       └── layout-engine/
│           └── SKILL.md
├── src/
│   ├── cli/
│   │   └── index.ts             ← CLI entry point (oclif or commander)
│   ├── auth/
│   │   └── salesforce-auth.ts   ← sf CLI alias resolution via @salesforce/core
│   ├── fetcher/
│   │   └── flow-fetcher.ts      ← Retrieves .flow-meta.xml from org or local FS
│   ├── parser/
│   │   └── flow-parser.ts       ← XML → FlowGraph internal model
│   ├── model/
│   │   └── flow-graph.ts        ← Core data model (nodes, edges, types)
│   ├── layout/
│   │   └── layout-engine.ts     ← dagre/elk layout computation
│   ├── generator/
│   │   └── drawio-generator.ts  ← FlowGraph → Draw.io XML
│   └── utils/
│       └── xml-builder.ts       ← mxGraph XML construction helpers
├── tests/
│   ├── fixtures/                ← Sample .flow-meta.xml files (all edge cases)
│   └── *.test.ts
└── docs/
    └── mapping-matrix.md        ← Exported from DOMAIN-KNOWLEDGE.md
```

### Core Data Model

```typescript
// src/model/flow-graph.ts

export type FlowNodeType =
  | 'start' | 'decision' | 'assignment' | 'loop'
  | 'recordCreate' | 'recordUpdate' | 'recordDelete' | 'recordLookup'
  | 'screen' | 'actionCall' | 'subflow' | 'collectionProcessor' | 'end';

export interface FlowNode {
  id: string;           // Unique within the graph
  name: string;         // API name from metadata
  label: string;        // Human-readable label
  type: FlowNodeType;
  locationX: number;    // From metadata (may be 0 if absent)
  locationY: number;
  metadata: Record<string, unknown>; // Raw element for extensibility
}

export interface FlowEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;       // Rule name, "Default", "Fault", etc.
  isFault: boolean;
  isBackEdge: boolean;  // Computed during layout
}

export interface FlowGraph {
  flowName: string;
  nodes: Map<string, FlowNode>;
  edges: FlowEdge[];
}
```

### Pipeline Architecture (Pipe-and-Filter)

```
[Input: .flow-meta.xml]
        │
        ▼
┌──────────────────┐
│   flow-fetcher   │  Resolves: local file | SF org via sf CLI auth
└────────┬─────────┘
         │ raw XML string
         ▼
┌──────────────────┐
│   flow-parser    │  XML → FlowGraph (nodes + edges)
└────────┬─────────┘
         │ FlowGraph (no coordinates)
         ▼
┌──────────────────┐
│  layout-engine   │  FlowGraph → FlowGraph (with x/y coordinates)
└────────┬─────────┘
         │ FlowGraph (with coordinates)
         ▼
┌──────────────────┐
│ drawio-generator │  FlowGraph → mxGraph XML string
└────────┬─────────┘
         │ .drawio XML
         ▼
[Output: MyFlow.drawio]
```

Each stage has a single responsibility. Each can be tested independently.

---

## Stage 3 — Implementation Plan

Tasks are sized for a single subagent run (roughly 2–5 minutes each). Each task must have a failing test before the implementation is written (TDD: RED → GREEN → REFACTOR).

### Task List

```
[ ] T01 — Repo scaffold: package.json, tsconfig, eslint, vitest, directory structure
[ ] T02 — FlowGraph model: define types, write type tests
[ ] T03 — flow-parser: parse <start> element → FlowNode
[ ] T04 — flow-parser: parse <decisions> → FlowNode + FlowEdges (rules + default)
[ ] T05 — flow-parser: parse <assignments>
[ ] T06 — flow-parser: parse <loops> (two outgoing edges)
[ ] T07 — flow-parser: parse all <record*> elements
[ ] T08 — flow-parser: parse <screens>
[ ] T09 — flow-parser: parse <actionCalls>
[ ] T10 — flow-parser: parse <subflows>
[ ] T11 — flow-parser: parse <collectionProcessors>
[ ] T12 — flow-parser: detect and flag fault connectors
[ ] T13 — flow-parser: detect back-edges (loop detection)
[ ] T14 — layout-engine: integrate dagre, honour locationX/Y where present
[ ] T15 — layout-engine: back-edge routing (bend points)
[ ] T16 — drawio-generator: mxGraphModel XML skeleton
[ ] T17 — drawio-generator: vertex rendering per Metadata Mapping Matrix
[ ] T18 — drawio-generator: edge rendering (normal + fault + back-edge)
[ ] T19 — drawio-generator: page scaling for large flows
[ ] T20 — cli: `generate` command with `--file` and `--output` flags
[ ] T21 — auth: sf CLI alias resolution via @salesforce/core
[ ] T22 — fetcher: retrieve flow from Salesforce org by API name
[ ] T23 — cli: `generate` command with `--org` and `--flow-name` flags
[ ] T24 — Integration test: full pipeline with fixture flows (simple, complex, loop, subflow)
[ ] T25 — README: installation, usage, examples
```

---

## Stage 4 — Implementation Rules

### Test-Driven Development (Mandatory)

For every task:
1. Write the failing test first (`vitest`)
2. Run it — watch it fail (RED)
3. Write the minimum code to pass
4. Run it — watch it pass (GREEN)
5. Refactor if needed
6. Commit

If you write implementation code before a test exists, delete it and start again.

### Code Standards

- Language: TypeScript (strict mode)
- Runtime: Node.js 18+
- Testing: `vitest`
- Linting: `eslint` + `@typescript-eslint`
- XML parsing: `fast-xml-parser` (not `xml2js` — better performance on large files)
- CLI framework: `oclif` (aligns with sf CLI plugin patterns) or `commander` (simpler for standalone)
- Layout: `dagre` (npm: `dagre`) with `@types/dagre`

### Commit Conventions

```
feat(parser): add decision node parsing (T04)
test(parser): add decision edge case tests
fix(layout): handle back-edge with no locationX/Y
```

### Never

- Never write code without a failing test first
- Never use `any` in TypeScript (use `unknown` + type guards)
- Never hardcode file paths
- Never skip the layout stage and pass `(0, 0)` for all coordinates
- Never build a web UI, API endpoint, or SaaS feature

---

## Stage 5 — Verification Checklist

Before marking any task complete, verify:

```
[ ] All tests pass (vitest run)
[ ] TypeScript compiles with no errors (tsc --noEmit)
[ ] ESLint passes (eslint src/)
[ ] The .drawio output file opens in draw.io without errors
[ ] The diagram is readable (no overlapping nodes, no invisible text)
[ ] Fault paths are visually distinct (dashed, red)
[ ] Subflow nodes are visually distinct (purple family)
[ ] Back-edges are routed without overlapping their source node
[ ] Large flow fixture (20+ nodes) does not time out or crash
```

---

## Project-Specific Skills

The following Claude Code skills live in `.claude/skills/` and activate automatically for relevant tasks. Read the appropriate skill before starting any task in its domain.

### `flow-parser` Skill

**Triggers:** Any task involving parsing, reading, or transforming Salesforce Flow XML.

```markdown
# flow-parser Skill

When parsing Salesforce Flow XML:

1. Use fast-xml-parser with these options:
   - ignoreAttributes: false
   - attributeNamePrefix: '@_'
   - parseAttributeValue: true
   - isArray: (tagName) => ['decisions', 'rules', 'connectors', ...].includes(tagName)

2. Always normalise to array before iterating — Salesforce XML may return a single
   object instead of an array when there is only one child element.

3. Extract locationX/locationY as numbers. Default to 0 if absent.
   Do not throw — record missing coordinates and let the layout engine handle them.

4. Build FlowEdges from connectors:
   - Each <connector> child of an element → one FlowEdge
   - <faultConnector> → FlowEdge with isFault: true
   - <defaultConnector> in a <decisions> element → FlowEdge with label: 'Default'
   - Each <rule> in a <decisions> element → FlowEdge with label: rule.label

5. Back-edge detection:
   - Run a DFS from the start node
   - Track the current path stack
   - If an edge targets a node already in the path stack, mark it isBackEdge: true
```

### `drawio-generator` Skill

**Triggers:** Any task involving generating, writing, or modifying Draw.io XML output.

```markdown
# drawio-generator Skill

When generating Draw.io XML:

1. Output format: Uncompressed mxGraphModel XML (NOT base64-compressed).
   Compressed format is binary and cannot be version-controlled meaningfully.

2. mxGraphModel root attributes:
   dx="1422" dy="762" grid="1" gridSize="10" guides="1"
   tooltips="1" connect="1" arrows="1" fold="1"
   page="1" pageScale="1" pageWidth="1169" pageHeight="827"
   math="0" shadow="0"

3. Every vertex is an mxCell with:
   - id: unique string (use FlowNode.id)
   - value: display label
   - style: from Metadata Mapping Matrix
   - vertex="1"
   - parent="1"
   - <mxGeometry x y width height as="geometry" />

4. Every edge is an mxCell with:
   - id: unique string
   - value: label (rule name, "Default", "Fault", or empty)
   - style: for fault edges add dashed=1;strokeColor=#B85450;fontColor=#B85450;
   - edge="1"
   - source: FlowNode.id of source
   - target: FlowNode.id of target
   - parent="1"

5. Standard vertex dimensions:
   - Most nodes: width=200, height=60
   - Decision (rhombus): width=200, height=100
   - Start/End (ellipse): width=120, height=60

6. Always wrap in:
   <mxGraphModel ...>
     <root>
       <mxCell id="0" />
       <mxCell id="1" parent="0" />
       [all vertices and edges here]
     </root>
   </mxGraphModel>
```

### `layout-engine` Skill

**Triggers:** Any task involving coordinate computation, node positioning, or edge routing.

```markdown
# layout-engine Skill

When computing layout:

1. Use dagre with these graph options:
   - rankdir: 'TB' (top to bottom)
   - nodesep: 50   (horizontal gap between nodes)
   - ranksep: 80   (vertical gap between ranks)
   - acyclicer: 'greedy'  (handles back-edges / loops)
   - ranker: 'tight-tree'

2. Strategy — Hybrid (Salesforce coords as hints):
   - If a node has locationX > 0 AND locationY > 0 from the Flow XML,
     use those as the dagre node position hint.
   - For nodes with missing or zero coordinates, let dagre compute freely.

3. After layout, apply a coordinate normalisation pass:
   - Find min(x) and min(y) across all nodes
   - Shift all nodes so the top-left node is at (40, 40) with 40px margin

4. Back-edge routing:
   - For edges where isBackEdge === true, add a waypoint 200px to the right
     of the source node so the loop connector bends visibly around the subgraph
   - Use mxGeometry Array of mxPoint for waypoints

5. Subflow edges:
   - Treat <subflows> nodes as sinks during layout (no outgoing edges counted
     for rank computation unless --follow-subflows flag is active)
```

---

## Frequently Needed Commands

```bash
# Run all tests
npx vitest run

# Type check
npx tsc --noEmit

# Lint
npx eslint src/

# Generate diagram from local file
node dist/cli/index.js generate --file force-app/main/default/flows/MyFlow.flow-meta.xml --output MyFlow.drawio

# Generate diagram from Salesforce org (requires sf CLI auth)
node dist/cli/index.js generate --org my-scratch-org --flow-name MyFlow --output MyFlow.drawio

# Open in Draw.io (macOS)
open MyFlow.drawio
```

---

## External References

| Resource | URL |
|----------|-----|
| mxGraph XML format reference | https://jgraph.github.io/mxgraph/docs/js-api/files/io/mxGraphMlCodec-js.html |
| Salesforce Flow Metadata API | https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_visual_workflow.htm |
| dagre layout engine | https://github.com/dagrejs/dagre |
| @salesforce/core auth | https://github.com/forcedotcom/sfdx-core |
| oclif CLI framework | https://oclif.io |
| Draw.io XML examples | https://github.com/jgraph/drawio/tree/dev/src/test/resources |

---

## Compatible Skills from Community Repos

The following skills from `obra/superpowers` and `alirezarezvani/claude-skills` are compatible with this project and can be installed to enhance your Claude Code workflow:

### From obra/superpowers (40k ⭐ — Recommended)

Install via:
```
/plugin marketplace add obra/superpowers-marketplace
/plugin install superpowers@superpowers-marketplace
```

| Skill | When to Use in This Project |
|---|---|
| `brainstorming` | Before starting any new module — refine design before coding |
| `writing-plans` | Use to break T01–T25 tasks into per-session bite-sized work |
| `test-driven-development` | Mandatory for every implementation task in this project |
| `systematic-debugging` | When the Draw.io output renders incorrectly in diagrams.net |
| `requesting-code-review` | Before merging the parser or generator modules |
| `subagent-driven-development` | Run T03–T13 (parser tasks) in parallel subagents |
| `using-git-worktrees` | Work on `parser` and `generator` modules in parallel branches |

### From alirezarezvani/claude-skills (2.8k ⭐)

Install via:
```
/plugin marketplace add alirezarezvani/claude-skills
/plugin install engineering-skills@claude-code-skills
```

| Skill | When to Use in This Project |
|---|---|
| `senior-architect` | Stage 2 architecture review — validate pipeline design |
| `api-design-reviewer` | Review CLI interface design before implementation |
| `database-designer` | If you add a caching layer for retrieved Flow metadata |
| `codebase-onboarding` | Auto-generate CONTRIBUTING.md once the codebase is stable |
| `tech-debt-tracker` | Track deferred features (subflow expansion, multi-page output) |
| `ci-cd-pipeline-builder` | Generate GitHub Actions config for test + build on PR |

### Note on Skill Loading

Claude Code reads skills from `.claude/skills/` in the project root. The three project-specific skills (`flow-parser`, `drawio-generator`, `layout-engine`) defined in this CLAUDE.md should be extracted into individual SKILL.md files in that directory. Template:

```
.claude/
└── skills/
    ├── flow-parser/
    │   └── SKILL.md    ← Copy content from "flow-parser Skill" section above
    ├── drawio-generator/
    │   └── SKILL.md    ← Copy content from "drawio-generator Skill" section above
    └── layout-engine/
        └── SKILL.md    ← Copy content from "layout-engine Skill" section above
```

---

## Decision Log

Document every significant architecture decision here as you build. Format:

```
### ADR-001: Uncompressed XML output (not compressed)
Date: [date]
Decision: Output raw mxGraphModel XML, not base64-compressed format
Reason: Compressed format is a binary blob — not diffable, not reviewable in git
Trade-off: Slightly larger file size

### ADR-002: dagre over elkjs for layout
Date: [date]
Decision: Use dagre@0.8.x
Reason: Smaller bundle, simpler API, adequate for hierarchical flowchart layout
Trade-off: Less sophisticated than elk for complex orthogonal routing

### ADR-003: Standalone CLI over sf plugin
Date: [date]
Decision: Build as standalone commander-based CLI first
Reason: Faster to ship, no sf CLI version dependency. Can wrap as sf plugin later.
Trade-off: No /sf flow diagram generate UX until Phase 2
```

---

## What Success Looks Like

A developer runs:

```bash
sf-flow-diagram generate --file force-app/main/default/flows/LeadQualification.flow-meta.xml
```

And gets a `LeadQualification.drawio` file that:
- Opens in Draw.io with no errors
- Shows every Flow element as a labelled, colour-coded, correctly shaped node
- Shows every connector as a directed, labelled arrow
- Shows fault paths as dashed red arrows
- Shows subflow references in purple
- Is readable without manual rearranging for flows up to 50 nodes
- Preserves loop structures without visual overlap

That is the definition of done for v1.0.

---

*This CLAUDE.md was engineered for Claude Code. It implements the Superpowers staged-workflow methodology combined with the alirezarezvani/claude-skills domain skill pattern. All three project-local skills (flow-parser, drawio-generator, layout-engine) should be extracted to `.claude/skills/` for automatic triggering.*
