# Architecture Node Tree Mindmap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the architecture workbench so architecture nodes can be expanded and selected through a grouped tree while the current node is visualized as a lightweight mindmap-style relationship graph.

**Architecture:** Keep the existing bottom output workflow intact, but replace the flat left navigation with grouped tree navigation and add a relationship-focused node graph beside the detail panel. Drive both views from shared pure data helpers so grouping, searching, and graph ring derivation stay testable and stable.

**Tech Stack:** Next.js 14, React 18, plain JavaScript, Tailwind CSS, Node built-in test runner

---

### Task 1: Extend node metadata for grouping and search

**Files:**
- Modify: `/Users/zhuyx/code/justime-agent/architecture_workbench/src/data/node-overrides.json`
- Modify: `/Users/zhuyx/code/justime-agent/.claude/scripts/extract-project-nodes.mjs`

- [ ] Add curated `group` and `aliases` metadata for the known high-signal nodes in `node-overrides.json`.
- [ ] Preserve optional override fields such as `group` and `aliases` when the extractor merges generated nodes into `nodes.js`.
- [ ] Re-run the extractor so runtime node data includes the new metadata.

### Task 2: Add pure helpers for grouped tree and relationship graph

**Files:**
- Create: `/Users/zhuyx/code/justime-agent/architecture_workbench/src/lib/node-graph.js`
- Create: `/Users/zhuyx/code/justime-agent/architecture_workbench/tests/node-graph.test.mjs`

- [ ] Write failing tests for node grouping, search filtering, and relationship graph derivation.
- [ ] Implement the smallest helper API needed by the UI:
  - grouped tree sections
  - searchable node matching
  - primary node graph rings
  - related-node highlighting
- [ ] Re-run the test target until green.

### Task 3: Replace flat node list with grouped expandable navigation

**Files:**
- Modify: `/Users/zhuyx/code/justime-agent/architecture_workbench/src/components/node-map.js`
- Modify: `/Users/zhuyx/code/justime-agent/architecture_workbench/app/page.js`

- [ ] Convert the left sidebar into grouped expandable sections.
- [ ] Keep search in the sidebar and make it work against node names, summaries, and aliases.
- [ ] Keep primary-node selection explicit and stable when a user changes sections or search terms.

### Task 4: Add a lightweight mindmap-style relationship graph

**Files:**
- Create: `/Users/zhuyx/code/justime-agent/architecture_workbench/src/components/node-graph.js`
- Modify: `/Users/zhuyx/code/justime-agent/architecture_workbench/src/components/node-details.js`
- Modify: `/Users/zhuyx/code/justime-agent/architecture_workbench/app/page.js`
- Modify: `/Users/zhuyx/code/justime-agent/architecture_workbench/app/globals.css`

- [ ] Render a centered primary node with first-ring dependency nodes and second-ring candidate nodes.
- [ ] Let users click a node card to switch the primary node.
- [ ] Let users use a dedicated `+` action on graph nodes to add related nodes without forcing a primary-node switch.
- [ ] Visually highlight already-related nodes and keep the current detail panel readable under the graph.

### Task 5: Verify and document the upgraded interaction

**Files:**
- Modify: `/Users/zhuyx/code/justime-agent/architecture_workbench/README.md` only if behavior notes change

- [ ] Run `node --test tests/brief-builder.test.mjs tests/node-graph.test.mjs`.
- [ ] Run `npm run lint` if local dependencies are available.
- [ ] Open the local app and verify grouped expand/collapse, graph selection, and related-node highlighting behavior.
