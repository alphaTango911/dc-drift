# n8n Workflow — Automated Pipeline (Path B)

The exported n8n workflow JSON goes here.

**Before committing the export:**
1. Open the JSON and search for `figd_`, `sk-ant`, `Bearer`, `apiKey`, and any
   Google OAuth credential blocks — n8n exports can embed credential *names*
   safely, but HTTP Request nodes sometimes carry inline headers. Replace any
   inline secret with `<SET_IN_N8N_CREDENTIALS>`.
2. Re-import the sanitized JSON into a clean n8n instance to confirm it loads.

Pipeline: Form/PR trigger -> Figma API -> Code node (extract ~500 bytes of
structured design data from 5.6MB JSON) -> parallel structural + visual
analysis (Claude) -> cross-layer merge -> Drift Score -> Google Docs report,
Slack notification, Jira tickets for HIGH findings.
