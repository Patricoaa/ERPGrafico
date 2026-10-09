## Dev server (always available)

There is one shared **remote dev server**; **no production environment exists yet**. Agents may run
commands there, but MUST first confirm the Mutagen sync is active.

- Host: `ssh pato@192.168.1.93` → `cd ERPGrafico` (`/home/pato/ERPGrafico`; Mutagen mirror, **no git**).
- App: `http://192.168.1.93` (nginx) / `http://192.168.1.93:3000` (frontend).
- Before any server command, `mutagen sync list` must show `erpgrafico-sync … Connected: Yes`.
- If down → `mutagen project start`; if it still cannot connect → **warn the user and stop**.
- Run app commands via `docker compose exec` from `~/ERPGrafico`.
- Full contract + troubleshooting: [remote-dev-server.md](docs/30-playbooks/remote-dev-server.md).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## gstack skills + graph

The full skill-routing table lives in ~/.config/opencode/AGENTS.md (invoke skills by name via the `skill` tool). The playbook at docs/30-playbooks/graph-gstack-workflow.md documents how to combine the graph with those skills.

Rules:
- For a codebase question, start with the graph (`graphify query/path/explain`) before grepping.
- Identify problems: `graphify god-nodes` + the Suggested Questions section of GRAPH_REPORT.md, then score with the `health` skill.
- Architecture challenges: derive communities/cohesion/surprising connections from the graph, then validate with `plan-eng-review`.
- Bug reports: use the `investigate` skill (root cause first, fixes never without it); use the graph for context on the failing symbol.
- Before merging: `graphify affected "X"` for blast radius, then `review` on the diff.
- Functional QA of the app: `qa` (or `qa-only` for report-only).
- Diagram any graph finding with `archify` / `diagram` when the user asks for a visual.
