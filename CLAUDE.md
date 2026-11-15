# visaya-sales

Sales pipeline for Visaya Web Studio lives in `sales-pipeline/` (start with `sales-pipeline/playbook/RUNBOOK.md`).

**Shared memory between chats:** `sales-pipeline/playbook/STATE.md` holds the owner's decisions, the current status and the session log. Read it first (the owner can type `/visayaweb` in any new chat to load it). Before ending a session that changed anything, update STATE.md, then commit and push.

## Subagent workline (owner's choice, 2026-11-15)

The owner wants work routed to these subagents (`.claude/agents/`). When a task clearly matches one, delegate it there instead of doing it inline; quick one-step things (a single read or edit) stay inline.

| Work | Subagent | Model | Effort |
| --- | --- | --- | --- |
| Planning a feature | `feature-planner` | Opus 5.5 | high |
| Building it (scripts, backend) | `builder` | Sonnet 5.5 | medium |
| Frontend / UI (demo pages, studio page, themes) | `frontend-ui` | Opus 5.5 | medium |
| Auth and payments (logins, keys, PayPal, money records) | `auth-payments` | Opus 5.5 | xhigh |
| Searching the codebase, renames, boilerplate | `codebase-scout` | Haiku 5.5 | low |
| Tests and checks | `test-writer` | Sonnet 5.5 | low |
| A bug nobody can find | `bug-hunter` | Opus 5.5 | max |
| Security and compliance audit | `security-auditor` | Opus 5.5 | xhigh |
| Code review before committing | `code-reviewer` | Opus 5.5 | high |
| Prospect research for the bank | `prospect-researcher` | Sonnet 5.5 | medium |
| Sales copy: subject/CTA challengers, objection answers, page wording | `sales-copywriter` | Opus 5.5 | medium |

Typical feature: `feature-planner` → `builder` (or `frontend-ui` / `auth-payments`) → `test-writer` → `code-reviewer`, with `security-auditor` before anything that touches money, personal data or outbound messages. Usage limits are shared with the scheduled tasks and timed sends, so use `bug-hunter` (max) only after a normal attempt has failed.

## Rules for every agent
- Never send emails or messages, create invoices or payment links, move money, or spend anything; the owner approves those in chat.
- Never change already-queued or approved pitches (`pitches/queue.json`, `pitches/autosend.json`).
- Test pipeline changes on a temp copy of `sales-pipeline/`, never on live `data/`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
