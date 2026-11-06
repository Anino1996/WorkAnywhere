> _The Notion of AI agentic coding workflows — work from anywhere, ship from everywhere._

---

## Overview

CloudAgent Workspace is a cloud-based development environment purpose-built for agentic coding workflows. Users get a persistent, remote workspace where they can write and execute code, manage projects, and publish working prototypes — all accessible from a laptop or phone. Think of it as the intersection of Notion's collaborative living-document model, GitHub Codespaces' cloud execution, and Vercel's instant-preview publishing — with agentic workflows as the first-class primitive.

---

## Core Problem

Modern agentic coding is fragmented. Developers context-switch between local environments, version control, cloud runners, and preview deployments. There is no single space that:

- Ties code execution to a persistent, shareable workspace
- Lets you load any project state (from scratch or from VCS) and immediately be productive
- Is viewable and reviewable from a phone or laptop without additional tooling
- Makes publishing a PoC to teammates a one-click action

---

## User Journey

```
Open workspace
    → Load from VCS branch OR start fresh OR import local directory
    → Code + run in the remote environment
    → View output, diffs, and workspace state on any device
    → Publish as an API endpoint or interactive frontend PoC
    → Share with teammates for review / interaction
```

---

## Key Features

### 1. Remote Execution Environment

- Each workspace is backed by a cloud compute instance
- Run scripts, install dependencies, and execute long-running processes without touching local hardware
- Persistent state between sessions — your workspace remembers where you left off

### 2. VCS Integration

- Load a workspace by pulling a branch from:
    - **GitHub**
    - **GitLab**
    - **Azure DevOps**
- Commit, push, and create PRs without leaving the workspace

### 3. Local Directory Import

- Move a working directory from a local machine into a workspace
- Continue working seamlessly in the cloud from where you left off locally
- Bi-directional sync support (cloud → local pull-down)

### 4. Mobile + Laptop Viewing _(highest priority)_

- The workspace UI is fully responsive and optimised for both desktop and mobile
- View running output, logs, file diffs, and workspace status from a phone
- Receive notifications when long-running jobs complete

### 5. Publishing Modes

Two ways to share work with the world:

|Mode|Description|Use case|
|---|---|---|
|**API endpoint**|Expose workspace logic as a callable REST or streaming endpoint|Backend services, integrations, agent tools|
|**Frontend PoC**|Publish a live, interactive UI at a shareable URL|Demos, stakeholder reviews, user testing|

Anyone with the link can interact with the published workspace — no setup required on their end.

### 6. Team Collaboration

- Invite teammates to view or interact with a published workspace
- Commenting and annotation layer for async review
- Access control: private / team / public visibility per workspace

---

## Positioning

|Comparable|What they do well|Gap this product fills|
|---|---|---|
|Notion|Collaborative, flexible workspace as a living doc|No code execution or deployment|
|GitHub Codespaces|Cloud dev environment, VCS-native|No PoC publishing or mobile-first viewing|
|Vercel / Railway|Instant publish + shareable previews|No persistent workspace, not agentic|
|Replit|Browser-based coding + deploy|Not optimised for agentic workflows or VCS-first loading|

**CloudAgent Workspace** sits at the intersection of all four, with agentic workflows as the first-class primitive.

---

## MVP Scope (Suggested)

### Must-have (v1)

- [ ] Workspace creation (scratch + GitHub branch import)
- [ ] Remote code execution (terminal + file editor)
- [ ] Mobile-responsive workspace viewer (logs, files, status)
- [ ] One-click publish as API endpoint
- [ ] Basic access control (private / shareable link)

### Nice-to-have (v2)

- [ ] GitLab + Azure DevOps integration
- [ ] Frontend PoC publishing
- [ ] Local directory import / sync
- [ ] Team invite + commenting layer
- [ ] Workspace templates (e.g. FastAPI starter, Next.js app, LLM agent scaffold)

---

## Decisions

|Question|Decision|
|---|---|
|**Compute model**|Serverless / containerised by default. Architecture should be designed to accommodate dedicated compute as an upgrade path when needed.|
|**Agentic layer**|Primary interaction with the container is via SSH. Agents and users communicate with the workspace through SSH to the running container — keeping the interface simple and standard.|
|**SSH access UX**|Fully transparent to the user. On workspace creation or resumption, the control plane generates an SSH key-pair, injects the private key into the container, and shares the public key with the application. No user involvement required.|
|**Publishing / traffic routing**|A reverse proxy (e.g. Traefik) sits in front of all containers and is dynamically updated to route traffic to a given container port when a workspace is published. Container ports are opened and closed programmatically based on publish/unpublish actions — never exposed by default.|
|**Offline mode**|Nice-to-have, not in scope for v1.|

---

## Technical Details

### Container Orchestration

Kubernetes is the target orchestration platform for CloudAgent Workspace. Its ability to spin up isolated pods on demand makes it the right fit for a workspace model where each user session maps to a dedicated, short-lived or persistent compute unit. Key benefits:

- **Pod-per-workspace model** — each workspace runs in its own pod, giving strong isolation and predictable resource boundaries
- **Scaling** — Kubernetes handles scheduling and scaling across nodes automatically
- **Lifecycle management** — pods can be suspended, resumed, and terminated programmatically, aligning with workspace session semantics
- **Ecosystem** — integrates naturally with Traefik (already chosen for routing), persistent volume claims for workspace state, and cloud-native tooling

### MVP Consideration: Docker Compose / Swarm

For the MVP, full Kubernetes may be premature. Docker Compose or Docker Swarm are viable alternatives to get a working system faster:

- **Docker Compose** — ideal for local development and single-host MVP deployments; low operational overhead, fast iteration
- **Docker Swarm** — adds basic multi-host orchestration with minimal complexity compared to Kubernetes; a reasonable middle ground if early demand requires it

The architecture should be designed so that the container abstraction layer is Kubernetes-ready from day one, even if the MVP runs on Compose or Swarm. This avoids a painful rewrite when scaling demands a migration.

---

## Open Questions

1. **Billing** — To be determined. Likely tied to compute time and/or active workspaces.
2. **Security model** — Revisit after a working PoC exists. Traefik-based routing is the assumed foundation; blast radius limits and sandboxing policies to be defined.

---

## Summary

CloudAgent Workspace removes the friction between _having an idea_ and _showing it to someone_. A developer should be able to load a branch, iterate with an AI coding agent, and hand a live link to a teammate — all without leaving a single environment, and all visible from their phone.

For technical architecture details, see [[Architecture]].
