# SFFlowExplorer

A local CLI tool that converts **Salesforce Flow metadata XML** (`.flow-meta.xml`) into **Draw.io-compatible diagrams** (`.drawio`).

No Salesforce org connection required for local files. No SaaS. No web UI. Just a fast, offline developer tool.

---

## Features

- Converts all Salesforce Flow element types into labelled, colour-coded, correctly shaped nodes
- Renders every connector as a directed, labelled arrow
- **Fault paths** rendered as dashed red arrows
- **Back-edges** (GoTo loops) routed with waypoints to avoid overlap
- **Subflow references** rendered in a distinct purple colour family
- Automatic hierarchical layout via [dagre](https://github.com/dagrejs/dagre) — no manual rearranging needed
- Page scaling automatically adjusts for flow size (A4 / A3 / A2)
- Output is uncompressed XML — diffable, reviewable in git

---

## Node Shape Reference

| Salesforce Element | Shape | Colour |
|---|---|---|
| `start` | Ellipse | Green `#D5E8D4` |
| `decisions` | Diamond (rhombus) | Blue `#DAE8FC` |
| `assignments` | Rounded rectangle | Yellow `#FFF2CC` |
| `loops` | Hexagon | Purple `#E1D5E7` |
| `recordCreates` | Cylinder | Red `#F8CECC` |
| `recordUpdates` | Cylinder | Orange `#FFE6CC` |
| `recordDeletes` | Cylinder | Red `#F8CECC` |
| `recordLookups` | Cylinder | Blue `#DAE8FC` |
| `screens` | Display shape | Light blue `#E6F3FF` |
| `actionCalls` | Rounded rectangle | Grey `#F5F5F5` |
| `subflows` | Rounded rectangle | Purple `#E8DEF8` |
| `collectionProcessors` | Rounded rectangle | Amber `#FFF9C4` |
| Fault connector | Dashed edge | Red `#B85450` |

---

## Installation

### Option A — Use directly without installing (recommended)

```bash
# Clone the repo
git clone https://github.com/PranavNagrecha/SFFlowExplorer.git
cd SFFlowExplorer

# Install dependencies
npm install

# Build
npm run build

# Run
node dist/cli/index.js generate --file path/to/MyFlow.flow-meta.xml
```

### Option B — Install globally via npm

```bash
npm install -g sfflow-explorer
sfflow-explorer generate --file path/to/MyFlow.flow-meta.xml
```

---

## Usage

### Generate a diagram from a local file

```bash
sfflow-explorer generate --file force-app/main/default/flows/MyFlow.flow-meta.xml
```

By default, the output file is placed **in the same directory as the input file**, named `<FlowName>.drawio`.

### Specify a custom output path

```bash
sfflow-explorer generate \
  --file force-app/main/default/flows/MyFlow.flow-meta.xml \
  --output diagrams/MyFlow.drawio
```

### Options

| Flag | Short | Description | Default |
|---|---|---|---|
| `--file <path>` | `-f` | Path to the `.flow-meta.xml` file | *(required)* |
| `--output <path>` | `-o` | Output path for the `.drawio` file | Same dir as input |

---

## Opening the diagram

**Draw.io desktop app (recommended):**
```bash
open MyFlow.drawio          # macOS
start MyFlow.drawio         # Windows
xdg-open MyFlow.drawio      # Linux
```

Or open [app.diagrams.net](https://app.diagrams.net) and drag-and-drop the `.drawio` file.

---

## Example

The `examples/` directory contains a sample flow and its generated output:

```
examples/
└── lead-qualification.flow-meta.xml   # Sample Salesforce Flow metadata
```

Generate it:
```bash
sfflow-explorer generate --file examples/lead-qualification.flow-meta.xml
```

---

## Development

### Requirements

- Node.js 18+
- npm

### Setup

```bash
npm install
```

### Commands

```bash
npm run build        # Compile TypeScript → dist/
npm run dev          # Watch mode
npm test             # Run test suite (vitest)
npm run test:watch   # Watch mode tests
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit (no output, just type checking)
```

### Project structure

```
SFFlowExplorer/
├── src/
│   ├── cli/
│   │   ├── index.ts          # CLI entry point (commander)
│   │   └── generate.ts       # Pipeline orchestrator
│   ├── parser/
│   │   └── flow-parser.ts    # XML → FlowGraph (fast-xml-parser)
│   ├── layout/
│   │   └── layout-engine.ts  # Dagre layout + coordinate normalisation
│   ├── generator/
│   │   └── drawio-generator.ts  # FlowGraph → mxGraph XML
│   └── model/
│       └── flow-graph.ts     # Core type definitions
├── tests/
│   ├── fixtures/             # .flow-meta.xml test inputs
│   └── *.test.ts             # Vitest test suites
├── examples/                 # Sample flow for quick-start
└── docs/
    └── DOMAIN-KNOWLEDGE.md  # Salesforce Flow → mxGraph mapping reference
```

### Architecture

The tool uses a **pipe-and-filter** pipeline:

```
.flow-meta.xml
    │
    ▼  flow-parser       XML → FlowGraph (nodes + edges)
    │
    ▼  layout-engine     FlowGraph → positioned FlowGraph (dagre)
    │
    ▼  drawio-generator  FlowGraph → mxGraph XML string
    │
    ▼
.drawio
```

Each stage is independently testable and has its own test suite.

### Running tests

```bash
npm test
```

All 118 tests must pass before submitting a PR.

---

## Supported Flow types

- Screen Flows (`processType: Flow`)
- Auto-launched Flows (`processType: AutoLaunchedFlow`)
- Record-triggered Flows (`triggerType: RecordAfterSave`, `RecordBeforeSave`)
- Scheduled Flows
- Subflows (referenced flows rendered as purple nodes)

---

## Limitations (v0.1.0)

- No Salesforce org connection — local files only (org fetch planned for v0.2.0)
- Subflows are rendered as single nodes; they are not followed/expanded into the diagram
- No multi-page output for very large flows (50+ nodes)

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Write a failing test first (TDD — no exceptions)
4. Implement the feature
5. Run the full test suite: `npm test && npm run typecheck && npm run lint`
6. Submit a PR

---

## License

MIT — see [LICENSE](./LICENSE).
