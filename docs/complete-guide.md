# DC Drift — Complete Project Guide
## What We Built, How, Why, and What's Next

---

## PART 1: WHAT IS DC DRIFT?

DC Drift (Design–Code Drift) is a **design integrity verification system** that automatically checks whether a product's implemented UI still matches its approved Figma design.

### The Problem It Solves
Modern product teams design in Figma and build in code. Between design approval and shipping, small inconsistencies appear:
- Wrong color tokens (#2563EB instead of #1a73e8)
- Spacing mismatches (16px gap instead of 24px)
- Wrong font (Geist instead of Inter)
- Missing component states
- Broken layouts

Today, designers catch these manually by comparing staging to Figma — slow, inconsistent, and always late in the cycle.

### The DC Drift Solution
DC Drift introduces a **repeatable verification layer** that:
1. Fetches approved design intent from Figma
2. Reads the actual codebase
3. Compares them using structured rules
4. Produces a **Drift Score** (0–100)
5. Generates role-specific reports for PM, Engineer, and Designer

---

## PART 2: THE ARCHITECTURE

```
Figma File (Approved Design)
        ↓
Figma MCP Server (reads design context)
        ↓
Claude Code Agent (orchestrates verification)
        ↓
Codebase (implementation source)
        ↓
Comparison + Rule Engine
        ↓
Drift Score Engine
        ↓
Reports (PM / Engineer / Designer)
```

### Why This Architecture?

**Why Figma MCP instead of Figma API directly?**
Figma MCP (Model Context Protocol) is a server that makes Figma's design data available to AI agents natively. Claude Code can call it directly without writing custom API integration code. It returns structured design context — component metadata, layout, tokens — in a format AI can reason about.

**Why Claude Code instead of a regular script?**
Claude Code is an agentic coding tool. It can read files, run bash commands, call MCP servers, and reason across all of it in one session. A regular script would need to be hardcoded. Claude Code adapts to whatever it finds in the codebase.

**Why n8n for the workflow?**
n8n is a no-code automation platform. It lets us connect Figma API → Claude API → Google Docs without writing a backend. It makes the workflow visible, repeatable, and easy to demo to non-technical stakeholders.

---

## PART 3: ALL FILES WE CREATED

### Repository Structure
```
/Users/anu/dc-drift-demo/
├── .dc-drift/
│   ├── rules.md                    ← The brain of DC Drift
│   ├── verification-process.md     ← How to run verification
│   └── report-templates.md         ← PM/Engineer/Designer formats
├── app/
│   └── page.tsx                    ← Default Next.js (not modified yet)
└── dc-drift-reports/
    └── billing-plans-2026-03-13.md ← First real verification report
```

### File 1: `.dc-drift/rules.md`
**What it is:** The verification brain. Defines all rules Claude uses.
**Why it exists:** Without a rules file, Claude would make up different rules each time. This file makes verification deterministic and repeatable.
**Contents:**
- 6 verification categories: color tokens, spacing, typography, component variants, missing elements, alignment
- Severity levels: HIGH (−20pts), MEDIUM (−10pts), LOW (−5pts)
- Drift Score formula: `100 − (20×High) − (10×Medium) − (5×Low)`
- Confidence thresholds: auto-classify ≥0.75, flag for review 0.50–0.74, ignore <0.50
- Score meaning: 100=perfect, 80–99=minor, 60–79=moderate, <60=major issues

### File 2: `.dc-drift/verification-process.md`
**What it is:** The Claude Code command template.
**Why it exists:** So anyone on the team can run DC Drift with a consistent command. You paste it into Claude Code and it runs the full verification.

### File 3: `.dc-drift/report-templates.md`
**What it is:** Output format definitions for each role.
**Why it exists:** The same findings mean different things to a PM vs an engineer. This file ensures the right information reaches the right person.

### File 4: `dashboard.jsx` (React artifact)
**What it is:** A visual DC Drift dashboard showing Drift Score ring, findings cards, and the three report views.
**Why it exists:** Portfolio artifact — shows what a DC Drift UI could look like as a product.

### File 5: `architecture-diagram.html`
**What it is:** Dark-theme portfolio diagram showing the 5-layer DC Drift architecture.
**Why it exists:** Case study visual — makes reviewers immediately understand the system.

---

## PART 4: THE N8N WORKFLOW

### What n8n Is
n8n is a self-hosted workflow automation tool. We ran it locally at `http://localhost:5678`. It's like Zapier but you own it and can run complex logic.

### The Full Workflow: 6 Nodes in Sequence

```
On form submission
        ↓
Figma API (HTTP Request)
        ↓
Code in JavaScript
        ↓
Claude API (HTTP Request)
        ↓
Create a document (Google Docs)
        ↓
Update a document (Google Docs)
```

---

### Node 1: On Form Submission (Form Trigger)
**What it does:** Creates a web form at a URL where you can upload a staging screenshot.
**Why this node:** We needed a way to trigger the workflow with a screenshot input. The Form Trigger gives us a UI to upload files without writing any frontend code.
**Key settings:**
- Form Title: "Add Staging Screenshot"
- Field: "Upload staging screenshot" — Type: File
- Test URL: `http://localhost:5678/form-test/6babfbc5-c3ad-4276-896b-cae92467d7e9`

**Why Form Trigger instead of manual trigger?**
The manual trigger (the original node) can only be clicked in n8n. The Form Trigger gives you a real URL you can open in any browser and submit a screenshot — making the workflow triggerable from outside n8n.

---

### Node 2: Figma API (HTTP Request)
**What it does:** Fetches the entire Figma file structure.
**Why this node:** We need the approved design data. The Figma REST API returns all pages, frames, components, and metadata as JSON.
**Key settings:**
- Method: GET
- URL: `https://api.figma.com/v1/files/y3AVy1m6nmaxw6M0EmJ5OU`
- Header: `X-Figma-Token: <YOUR_FIGMA_TOKEN>`
- Returns: 5.6MB JSON with full file structure

**Why HTTP Request instead of a Figma node?**
n8n has a native Figma node but it's limited. The HTTP Request node gives us full control over which API endpoint we call and what data we get back.

---

### Node 3: Code in JavaScript
**What it does:** Extracts only the relevant parts of the 5.6MB Figma response.
**Why this node:** The full Figma JSON is too large to pass directly to Claude. This node extracts just the file name and page/frame structure — keeping the payload small.
**Key logic:**
```javascript
const pages = figmaData.document.children.map(page => ({
  name: page.name,
  frames: (page.children || [])
    .filter(n => n.type === 'FRAME')
    .map(f => f.name)
}));
```
**Why this approach?**
n8n's HTTP Request node can't handle dynamic JSON construction with expressions. By building the Claude request body in a Code node, we avoid all JSON serialization issues.

---

### Node 4: Claude API (HTTP Request)
**What it does:** Sends the Figma data to Claude and gets a drift analysis back.
**Why this node:** Claude is the intelligence layer. It reads the design data and generates the structured DC Drift report.
**Key settings:**
- Method: POST
- URL: `https://api.anthropic.com/v1/messages`
- Headers: `x-api-key`, `anthropic-version: 2023-06-01`
- Model: `claude-sonnet-4-20250514`
- Prompt: "You are DC Drift. Analyze this Figma design and generate a full drift report..."

**Why Claude API directly instead of using an AI node?**
n8n has AI nodes but they add abstraction layers. Using the HTTP Request node directly gives us full control over the model, prompt, and response format.

**The JSON body challenge:**
This node caused the most trouble. n8n's JSON body field doesn't support expressions that return complex objects. The solution was to build the entire request body as a JavaScript object in the Code node and pass it through. We went through many iterations:
1. Tried `{{ expressions }}` inside JSON → failed (invalid JSON)
2. Tried Expression mode → failed (object serialization issues)
3. Tried Using Fields → failed (arrays sent as objects)
4. **Solution: Build body in Code node, pass as pre-built object**

---

### Node 5: Create a Document (Google Docs)
**What it does:** Creates a new empty Google Doc in your Drive Projects folder.
**Why this node:** We need a destination for the report. Google Docs is accessible to everyone on the team and requires no extra tools to view.
**Key settings:**
- Credential: Google Docs account (OAuth2)
- Resource: Document
- Operation: Create
- Title: `DC Drift Report — Billing Plans — {{ $now.format('yyyy-MM-dd') }}`
- Folder: Projects

**The Google OAuth challenge:**
Initial setup failed because the Google Cloud project only had Google Docs API enabled, not Google Drive API. Drive API is needed to create files in folders. Fixed by enabling Drive API in Google Cloud Console and reconnecting the credential with full permissions.

---

### Node 6: Update a Document (Google Docs)
**What it does:** Writes Claude's drift report text into the newly created Google Doc.
**Why this node:** The Create node makes an empty doc. This node fills it with content.
**Key settings:**
- Doc ID: `={{ $('Create a document').item.json.id }}`
- Object: Text
- Action: Insert
- Insert Segment: Body
- Text: `={{ $('Claude API (HTTP Request)').item.json.content[0].text }}`

**The 404 challenge:**
The Update node kept returning "resource not found" when using the expression for Doc ID, but worked when the ID was pasted manually. This is a known n8n behavior — the Google Docs Update node sometimes can't resolve IDs passed via expression from the Create node in the same execution. **Workaround: Run the full workflow end-to-end rather than step-by-step.**

---

## PART 5: CLAUDE CODE SETUP

### What Claude Code Is
Claude Code is Anthropic's agentic coding tool. It runs in your terminal, can read and edit files, run bash commands, and connect to external tools via MCP servers.

### Installation
```bash
npm install -g @anthropic-ai/claude-code
cd /Users/anu/dc-drift-demo
claude
```

### Figma MCP Connection
MCP (Model Context Protocol) is a standard for connecting AI agents to external tools. Figma built an MCP server that lets Claude read your Figma files directly.

**Connection command:**
```bash
claude mcp add figma-remote-mcp --transport sse https://mcp.figma.com/mcp -s user \
  --header "X-Figma-Token: <YOUR_FIGMA_TOKEN>"
```

**Config saved to:** `/Users/anu/.claude.json`

**Why SSE transport?**
Figma's MCP server uses Server-Sent Events (SSE) for real-time streaming of design data. This is more efficient than polling for large design files.

### How Claude Code Used Figma MCP
When you ran the verification command, Claude Code:
1. Called `figma-remote-mcp → get_metadata` with your file ID
2. Received 324,507 characters of design data (saved to a temp file because it exceeded context)
3. Ran Python scripts to parse the XML and find the Billing Plans frame
4. Read your codebase files (page.tsx, globals.css)
5. Applied the DC Drift rules from `.dc-drift/rules.md`
6. Generated the full report with real Figma values

---

## PART 6: THE FIRST REAL VERIFICATION RESULT

### What Claude Code Found
- **Screen verified:** ⬆️ Upgrade Your Plan (node 6:239)
- **Drift Score: 0/100** — The screen hasn't been built yet (correct — fresh Next.js scaffold)
- **6 HIGH findings** — Missing screen, wrong font (Geist vs Inter), no color tokens, missing components
- **3 MEDIUM findings** — Missing Order Summary panel, Payment form, Popular badge
- **1 LOW finding** — Missing back navigation link

### Why Score 0 Is Actually Good for the Portfolio
A score of 0 on a fresh codebase proves the system works correctly. DC Drift detected that nothing was implemented and reported it accurately with real values from your Figma file (exact hex codes, exact px values, exact component names). This is more impressive than a fake "85/100" score.

---

## PART 7: NEXT STEPS — COMPLETE GUIDE

### Step 1: Save the Report
In your terminal (Claude Code session):
```
Save the DC Drift report you just generated to .dc-drift/reports/billing-plans-2026-03-13.md
```

### Step 2: Build the Color Token Component
This is the fastest way to improve the score. In Claude Code:
```
Create a globals.css update that adds all the color tokens from the DC Drift report:
--color-primary: #1a73e8
--color-primary-light: #e8f0fe
--color-surface: #f7f8fa
--color-text-primary: #111827
--color-text-secondary: #6b7280
--color-text-muted: #9ca3af
--color-border: #e5e7eb
--color-border-subtle: #d1d5db
--color-success: #15803d
--color-success-bg: #dcfce7

Also update the font to Inter using next/font/google.
```

This fixes findings H2 (color tokens) and H3 (typography) — removing 2 HIGH findings, improving score from 0 to 60.

### Step 3: Build One Screen Component
In Claude Code:
```
Create app/billing/upgrade/page.tsx that implements the two-column layout shell 
from the DC Drift report. Use the color tokens from globals.css. 
Include the Billing Cycle Selector component.
```

This fixes H1 (missing screen), H6 (layout), H4 (billing selector) — removing 3 more HIGH findings.

### Step 4: Run DC Drift Again
Paste the same verification command into Claude Code:
```
You are DC Drift.
Verify the Billing Plans screen against this codebase.
Use Figma MCP to fetch file y3AVy1m6nmaxw6M0EmJ5OU.
Apply rules from .dc-drift/rules.md.
Return full DC Drift report.
```

Expected new score: ~60–75/100 (from 0 to 60–75 after implementing tokens + layout + one component).

### Step 5: Screenshot Before/After
- Before: Score 0/100 (fresh scaffold)
- After: Score 60–75/100 (tokens + layout + component)
- This delta is your case study proof

---

## PART 8: WHY THIS PATH — THE DECISIONS EXPLAINED

### Why not Percy or Applitools (visual regression tools)?
Percy and Applitools compare **code to code** (one build vs another). DC Drift compares **design to code**. They solve different problems. DC Drift is upstream — it catches issues before Percy would even run.

### Why not just use Figma's own inspect tool?
Figma inspect is a passive reference tool. Engineers have to manually check values. DC Drift is active — it checks automatically and produces a report. No human comparison needed.

### Why Claude instead of a custom vision model?
Claude is multimodal and has reasoning capabilities. It doesn't just pixel-diff — it understands semantic differences ("this token is wrong even though the color looks similar") and produces structured, actionable output in natural language. A custom model would need training data and fine-tuning.

### Why MCP instead of direct API calls?
MCP is a standard protocol designed specifically for connecting AI agents to tools. Using it means DC Drift can connect to any MCP-compatible tool in the future (not just Figma). It's the architecturally correct choice for an AI-integrated workflow.

### Why n8n instead of writing a backend?
For a portfolio project, n8n lets you build a visible, demonstrable automation pipeline without writing server code. Every node is visible and explainable. In a production context, you'd replace n8n with a proper backend — but for demonstrating the concept to a FAANG interviewer, n8n shows the workflow clearly.

### Why Google Docs for output?
Google Docs is universally accessible and familiar to all stakeholders. A PM can open it without installing anything. In production, this would be Slack, Jira, Linear, or a custom dashboard — but Google Docs proves the output pipeline works.

---

## PART 9: WHAT THIS PROVES TO RECRUITERS

When a senior designer at Google, Meta, or Stripe sees DC Drift, they understand:

1. **Systems thinking** — You didn't just design a screen. You designed a workflow that spans design tools, AI agents, codebases, and stakeholder outputs.

2. **AI product design** — You know how to integrate AI meaningfully (not just "add AI to it") — as a verification layer with defined inputs, rules, scoring, and role-based outputs.

3. **Design-engineering bridge** — You understand both sides well enough to build a tool that serves both. The engineer checklist has exact token values. The designer report has exact Figma frame references.

4. **Design system governance** — DC Drift is fundamentally a design system enforcement tool. You understand that design systems fail not at creation but at implementation.

5. **Product metrics** — The Drift Score turns subjective design QA into an objective metric. That's product thinking.

---

## CREDENTIALS & CONFIG REFERENCE

| Item | Value |
|------|-------|
| Figma File ID | y3AVy1m6nmaxw6M0EmJ5OU |
| Figma Token | <YOUR_FIGMA_TOKEN> |
| n8n URL | http://localhost:5678 |
| Google account | anupamatiwari11.9@gmail.com |
| Google Cloud project | DC Drift |
| Claude Code project | /Users/anu/dc-drift-demo |
| Claude config | /Users/anu/.claude.json |

---

*Document generated: 2026-03-13 | DC Drift v1.0*
