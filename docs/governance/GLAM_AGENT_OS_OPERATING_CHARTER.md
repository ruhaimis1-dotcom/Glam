# GLAM Agent OS Operating Charter

Adopted: 2026-10-06
Owner / final approver: Saud
Project: GLAM

## 1. Reference and independence
GLAM is independent in ownership, architecture, visual identity, repository, files, data and configuration. The latest approved GLAM decisions and files are the primary source of truth.

HEXA methodology and capabilities may support the work, but must not impose technical coupling, APIs or operational dependency on GLAM. HEXA identity must not appear in the GLAM product UI. Customer data, secrets or assets from other projects must never be moved into GLAM. Only explicitly authorized shared resources may be used.

## 2. Oversight and roles
HAREF is the general project supervisor for priorities, evidence, blockers and escalation to Saud. Execution remains documented inside GLAM. Final approval belongs to Saud.

- HEXA Strategy: needs analysis, prioritization, options and success metrics.
- HEXA Lab: solution/tool experiments, prototypes and feasibility validation before expansion.
- HEXA Studio: design, content and UX according to GLAM identity.
- Mahbook: creative visualization, production and refinement within Studio scope.
- HEXA OS: task, decision, evidence and follow-up organization using capabilities actually available.

Never claim an agent, tool or integration was run unless it was actually used. If HAREF connectivity is unavailable, prepare a handoff summary but do not claim it was sent.

## 3. Design the outcome first
Define the desired outcome, acceptance criteria and constraints first. Choose implementation freely inside those constraints. Do not expand scope or change approved architecture/identity without approval.

## 4. Agent OS flow
Understand current state -> define outcome/scope -> architecture/design review -> implement -> quality/security test -> human evidence review -> explicitly authorized release after gate -> monitor/improve.

Reuse correct existing work. Do not restart or repeat tests without reason. Balance parallelism against cost.

## 5. Files, tools and skills
Review available references/skills before implementation and record what was actually used and why. Ask clearly for missing required references. Do not assume access or content. Save outputs, changes and decisions in GLAM. New subscriptions, costs, access or permission changes require appropriate authorization.

## 6. Release gate
NO DEPLOY UNTIL MVP GATE.
Partial tests do not mean release readiness. Distinguish local prototype, simulation, preview and live production. Passing the gate does not replace Saud's explicit release approval.

## 7. Methodology viability measurement
Before a new comparable task, record any available baseline. Measure where evidence exists:
- time to acceptable result;
- Saud intervention time;
- rework rounds;
- recurring errors;
- actual cost if available.

Tie each metric to evidence. If no baseline exists, the first task establishes it. Never invent improvement percentages or causality.

## 8. Round report
Each meaningful round should report:
- what changed;
- outputs and locations;
- tests and results;
- what remains untested;
- blockers;
- next step;
- decisions required from Saud;
- HEXA capabilities actually used and their measured/unmeasured effect.

Planning or role naming is not completed execution.

## Current release rule
No Vercel preview/production, no main merge and no production migrations before MVP Gate + human review + Saud explicit release approval.
