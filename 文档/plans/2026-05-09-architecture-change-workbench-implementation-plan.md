# Architecture Change Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a standalone frontend project under `/Users/zhuyx/code/jushi-agent/architecture_workbench` that lets users select an architecture node, capture change requirements, and generate structured AI-readable change briefs.

**Architecture:** Build a self-contained Next.js App Router project with local static node data, a client-side workbench page, and a lightweight API route that transforms structured briefs into three derived outputs: completed brief, spec draft, and development prompt. Keep the first version independent from the existing `jushi_agent` frontend.

**Tech Stack:** Next.js 14, React 18, plain JavaScript, Tailwind CSS, Node built-in test runner

---

### Task 1: Create the standalone project scaffold

**Files:**
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/package.json`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/next.config.mjs`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/jsconfig.json`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/postcss.config.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/tailwind.config.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/app/layout.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/app/globals.css`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/app/page.js`

- [ ] Add a minimal Next.js app shell with App Router and Tailwind
- [ ] Make the page a client-side workbench host
- [ ] Keep the project isolated from the existing `jushi_agent` app

### Task 2: Add the workbench data model and UI components

**Files:**
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/src/data/nodes.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/src/lib/brief-builder.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/src/components/node-map.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/src/components/node-details.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/src/components/change-form.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/src/components/related-nodes.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/src/components/output-panel.js`

- [ ] Define static architecture nodes with business and code mapping metadata
- [ ] Build the left navigation, center edit workbench, and bottom output area
- [ ] Generate a stable structured brief from the selected node and drafted fields

### Task 3: Add AI-action transformations and verification

**Files:**
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/app/api/optimize/route.js`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/tests/brief-builder.test.mjs`
- Create: `/Users/zhuyx/code/jushi-agent/architecture_workbench/README.md`

- [ ] Add a local API route that accepts a structured brief and a mode: `complete`, `spec`, or `prompt`
- [ ] Return deterministic text transformations that mimic model-ready outputs and can later be replaced by a real model integration
- [ ] Add a narrow node-based verification test for structured brief generation and derived action outputs
- [ ] Document how to run the standalone app

### Task 4: Run verification

**Files:**
- Modify only if required by fixes discovered during verification

- [ ] Run the narrow verification script or test target
- [ ] If dependencies are available, run the project lint command
- [ ] Report anything that could not be verified locally
