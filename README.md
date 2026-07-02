<p align="center">
  <img src="docs/logo.png" alt="AgentOppa" width="170">
</p>

<h1 align="center">AgentOppa</h1>

<p align="center">
  A plugin that <b>builds your own harness framework</b> —<br>
  one that runs identically across Claude Code and Codex, on any OS.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Claude_Code_+_Codex-plugin-138A7B" alt="Claude Code + Codex">
  <img src="https://img.shields.io/badge/Windows_·_macOS_·_Linux-supported-1AAE9C" alt="Cross-OS">
  <img src="https://img.shields.io/badge/version-0.2.3-DFA436" alt="version 0.2.3">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License">
</p>

<p align="center">
  <a href="README_KO.md">한국어</a> | <b>English</b>
</p>

> **Harness** = the scaffolding that keeps an AI agent doing the job *properly, all the way through*.
> **Harness framework** = those scaffolds bundled so you can reuse them across projects.

---

## At a glance

AgentOppa **doesn't run things — it builds them.** It's not a tool that executes a workflow; it's a tool that *builds the workflow (harness) you'll run*. Think compiler or `create-react-app` — a **Maker**, not a runtime framework like React.

> It interviews you **one question at a time** to pin down what you want, then assembles **your own harness framework** that runs identically across Claude Code and Codex, on any OS. It ships no content of its own — you build your own harness.

---

## The problem it solves

Building a harness framework by hand, three things trip you up:

| | Problem | AgentOppa |
|---|---|---|
| **Standards** | Each part (skills, hooks, memory, agents) has many rules to follow | Follows them by default while assembling |
| **Tools** | You build and sync a Claude Code version and a Codex version separately | Both at once |
| **OS** | Windows / macOS / Linux each need rework | Same result everywhere |

---

## What it builds — two layers

AgentOppa (the Maker) **ships nothing.** You use it to build a *reusable framework* (Core), and many projects **point at** it to use it.

```text
your-project/
├── .agentoppa/        ← Core layer = reusable framework (you build & own it · portable)
│                         phase flow + gates + shared skills/hooks + slots (what varies per project)
├── .harness/          ← Project layer = this project's implementation & bindings
│                         config.yaml (which Core + slot → implementation) + impl modules
├── CLAUDE.md·AGENTS.md ← import the Core's rules (behavior guards survive even without the plugin)
└── .claude/·.codex/   ← thin pointers (point at the Core to load it · not copies)
```

| Layer | What | Where |
|---|---|---|
| **Maker** | AgentOppa itself — the factory that *builds* harnesses | this plugin |
| **Core** | the *reusable framework* you build. Bakes in no project values, so it travels anywhere | `.agentoppa/` |
| **Project** | *this* project's implementation. Fills the Core's slots with this project's choices | `.harness/` |

> **The reuse trick = "don't bake values in."** A Core leaves project values (like `test runner`) as **slots** instead of hardcoding them, reading them from `.harness/` at run time. So one Core works as-is on web, mobile, or go.

---

## Key features

| Feature | Meaning |
|---|---|
| **Cross-tool** | Same quality on both Claude Code and Codex |
| **Cross-OS** | Same result on Windows / macOS / Linux (helpers use Node built-ins only, zero deps) |
| **Reusable** | Build a Core once; many projects point at it. Fix it once, it propagates |
| **No runtime engine** | State between phases = *committed documents*. No resident runner → resume, parallelism, cross-tool come for free |
| **self-harden** | Each correction is frozen into a permanent guard, so it gets sharper with use |
| **Self-sufficient** | A project only needs to install the Core; it sets itself up (works without AgentOppa) |

---

## Install

Requires: **Node.js**. ([install](https://nodejs.org/en/download))

### Claude Code

```bash
# 1) Add the marketplace (a repo listing plugins)
/plugin marketplace add rhie-coder/agentoppa

# 2) Install the plugin (format: pluginName@marketplaceName)
/plugin install agentoppa@agentoppa

# 3) Apply
/reload-plugins
```

- **Update:** `/plugin marketplace update agentoppa` → `/plugin install agentoppa@agentoppa` → `/reload-plugins`
- **Remove:** `/plugin uninstall agentoppa@agentoppa`

### Codex

```bash
# Register the marketplace, then install the plugin (default = User Scope)
codex plugin marketplace add rhie-coder/agentoppa
codex plugin add agentoppa@agentoppa

# List · update · remove
codex plugin marketplace list
codex plugin marketplace upgrade
codex plugin marketplace remove rhie-coder/agentoppa
```

- `marketplace add` only *registers the marketplace* — you still run `codex plugin add` to **install the plugin** (it shows as `not installed` in `plugin list`). Codex has no hot-reload, so **restart** after installing or updating.
- **Codex has no install-scope choice (User/Project/Local) — it installs globally (`~/.codex`)**; project-only install isn't cleanly supported by codex yet.

---

## Usage

Just **describe what you want** and the matching skill turns on automatically. To call one directly, use `agentoppa:<skill>` — e.g. `/agentoppa:agent-engineer`.

```text
> Build me a dev workflow I can reuse across projects
  → agent-engineer turns on, interviews you one question at a time,
    and assembles skills/agents/hooks for both tools.
```

The full flow is five steps:

| Step | What it does |
|---|---|
| 1. Interview | Pin down intent, one question at a time (`intent-interview`) |
| 2. Design | Agree on phases, order, and slots in `config.yaml` |
| 3. Assemble | Build each phase into skills/agents/hooks (`ccc-*`) |
| 4. Package | Bundle for both Claude & Codex marketplaces (`ccc-plugin`) |
| 5. Verify | Machine-check artifact wiring and unfilled slots |

---

## Components

**① Tools that drive the flow**

| Tool | Role |
|---|---|
| `agent-engineer` | Runs the whole build — interview, assemble, package, verify |
| `intent-interview` | Interviews you one question at a time to pin down intent |
| `self-harden` | Freezes a correction into a permanent guard (validator/hook/rule) so it can't recur |

**② Tools that make the parts — `ccc-*`** (`ccc` = create-claude-codex: makes parts for both tools)

| Tool | Makes |
|---|---|
| `ccc-skills` | **Skills** — a how-to for a task, auto-invoked on a matching request (the base of every `ccc-*`) |
| `ccc-memory` | **Memory** — rules followed in every session (e.g. `AGENTS.md`) |
| `ccc-agents` | **Subagents** — a dedicated agent for a role (e.g. code review) |
| `ccc-hooks` | **Hooks** — commands that run automatically at set moments (after edit, before stop, …) |
| `ccc-plugin` | **Plugins** — bundle the parts and ship to both Claude & Codex marketplaces |

---

## Build & reuse a Core

The core flow: **build a Core once, and have many projects point at it.**

### 1. Build the Core

Decide the reusable *phase flow* (e.g. spec → tdd → review) and the *slots* (what varies per project, e.g. the test tool). `agent-engineer` runs the interview (with `intent-interview` helping inside), then builds.

```bash
node ./plugins/agentoppa/bin/build-skills.mjs <core-authoring-project>
# → reads .harness/ and compiles a reusable Core into .agentoppa/
```

### 2. Wire it to the tools (by pointer)

Have the tools *point at* the built `.agentoppa/` bundle (no copies).

```bash
claude --plugin-dir <project>/.agentoppa/plugins/<core>   # Claude (ad hoc)
# Codex: auto-detects the marketplace under <project>/.agentoppa/ → enable from the list
```

### 3. Another project reuses it — set up automatically

A new project **doesn't copy** the phases. The Core's `setup` skill lays down `.harness/config.yaml` *by itself* — **without AgentOppa.**

```yaml
core:     my-harness-workflow   # the Core to point at (phases: spec → tdd → review)
phases:   [spec, tdd, review]   # phases the Core provides
bindings: { test-runner: "npx playwright test" }   # this project's test tool (fills the slot)
```

> Projects pointing at the same Core differ by a single `bindings` line. Fix the Core once and it propagates to **every project** pointing at it.

---

## Run from this repo

To work on the AgentOppa repo itself, wire the plugin directly and use its own features like `/self-harden`.

```bash
# Claude Code (from repo root)
claude --plugin-dir ./plugins/agentoppa
#  → after editing, run /reload-plugins in-session (no restart)

# Codex — auto-detects the marketplace at the root
codex
#  → after editing, restart Codex to apply
```

---

## Learn more

- **[ARCHITECTURE.md](ARCHITECTURE.md)** — the full conceptual model (why & what)
- Detailed specs live in each tool's `SKILL.md` and `references/`

## License

[MIT](LICENSE) © 2026 MinHyung RHIE
