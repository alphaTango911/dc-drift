# DC Drift — Verification Rules

## Overview

This file defines the complete verification logic for DC Drift.
It is the source of truth for how design–code drift is detected, classified, and scored.

---

## Verification Categories

The system must check all six categories on every run:

| # | Category | Description |
|---|----------|-------------|
| 1 | Color tokens | Are the correct design tokens used for all color values? |
| 2 | Spacing / layout | Do padding, margin, and gap values match design specs? |
| 3 | Typography | Are the correct font size, weight, line-height, and family used? |
| 4 | Component variants | Is the correct component variant/state rendered? |
| 5 | Missing elements | Are all required UI elements present? |
| 6 | Alignment | Are elements positioned correctly within their containers? |

---

## Severity Classification

### HIGH — blocks release
Issues that directly affect usability, brand trust, or conversion.

- Incorrect CTA button color (wrong token or hardcoded override)
- Missing component state (e.g. disabled, error, loading state absent)
- Broken layout structure (elements outside container, overflow, collapse)
- Incorrect critical text (wrong label, truncated copy, missing required text)
- Wrong primary action element (wrong component type entirely)

### MEDIUM — requires fix before release
Issues that degrade visual quality without breaking core functionality.

- Spacing mismatch above threshold (>4px difference from spec)
- Typography scale mismatch (wrong size step or weight)
- Incorrect component variant (e.g. filled vs outlined, primary vs secondary)
- Color token used from wrong semantic category
- Icon size mismatch (>2px from spec)

### LOW — flag for designer review
Subtle inconsistencies that may require designer judgment.

- Small alignment offsets (≤4px)
- Subtle spacing drift (≤4px difference)
- Minor visual inconsistencies (e.g. border-radius off by 1 step)
- Non-critical animation or transition differences

---

## Scoring Model

### V1 (single layer) — flat penalties
```
Drift Score = 100 − (20 × High) − (10 × Medium) − (5 × Low)
```
Minimum score is 0. Used when a single findings set represents the whole
verification (e.g. the baseline run, which scored 100−120−30−5 → 0).

### V2 (dual layer) — layer-appropriate models
V1's limitation: flat penalties measure *what was found*, not *what was
verified*. A structural audit runs a known set of checks, so its natural
score is coverage-based; a visual comparison produces findings, so its
natural score is penalty-based.

**Structural layer — check-based adherence:**
```
Structural Score = (checks passed / checks run) × 100
```
Every run executes a fixed check suite derived from the design tokens and
component spec. Worked example (the documented 72/100 run):

| Category | Checks run | Passed | Adherence |
|---|---|---|---|
| Color tokens | 20 | 18 | 90% |
| Typography | 20 | 15 | 75% |
| Spacing | 25 | 17 | 68% |
| Components / states | 25 | 18 | 72% |
| Interaction states | 10 | 4 | 40% |
| **Total** | **100** | **72** | **72/100** |

Failed checks cluster into findings (28 failed checks → 12 structural
findings in that run), each carrying severity and confidence per the rules
below.

**Visual layer — flat penalties (V1 formula) on visual findings:**
```
Visual Score = 100 − (20 × High) − (10 × Medium) − (5 × Low)
```
(Documented run: one LOW finding → 100 − 5 = 95.)

**Combined:**
```
Drift Score = min(Structural, Visual)
```
`min`, not average — a product that scores 95 visually but 72 structurally
should not ship, because structural failures (missing states, broken
breakpoints, token debt) are latent defects that surface in production.
The gap between the two layers is reported as **divergence** (Δ); a large
Δ means one analysis layer is blind to what the other sees.

### Score Interpretation (both models)

| Score | Status | Meaning |
|-------|--------|---------|
| 100 | ✅ Perfect | Implementation matches approved design exactly |
| 80–99 | 🟡 Minor drift | Small issues, safe to release with low risk |
| 60–79 | 🟠 Moderate drift | Noticeable issues, review required before release |
| < 60 | 🔴 Major drift | Significant design violations, do not release |

## Confidence Thresholds

Every detected issue must include a confidence score (0.00–1.00).

| Confidence | Action |
|------------|--------|
| 0.90–1.00 | Auto-classify — include in report |
| 0.75–0.89 | Auto-classify — include in report |
| 0.50–0.74 | Flag for human review — include with ⚠️ marker |
| < 0.50 | Ignore — do not include in report |

This prevents noisy reports from uncertain detections.

---

## Spacing Threshold Policy

- Differences of **≤ 4px** → LOW severity
- Differences of **> 4px and ≤ 8px** → MEDIUM severity
- Differences of **> 8px** → HIGH severity (if structural) or MEDIUM (if decorative)

---

## Token Verification Rules

When checking color tokens:
1. Identify the semantic role of the element (CTA, background, text, border, etc.)
2. Check if the correct semantic token is applied (not a raw hex value)
3. Check if the token resolves to the correct value in the current theme
4. Flag hardcoded hex values that should use tokens as MEDIUM severity

---

## Report Outputs

Three reports are generated from the same findings set:

### PM Report
- Drift Score (prominent)
- Release readiness recommendation (Go / Hold / Review)
- Count of issues by severity
- Business risk summary (1–2 sentences)

### Engineer Report
- Checklist of issues to fix
- Expected token or component value for each issue
- File or component reference where possible
- Issues ordered by severity (HIGH first)

### Designer Report
- Full issue list with category labels
- Severity classification per issue
- Confidence score per issue
- Visual context description
- Issues flagged for review marked clearly

---

## Workflow Triggers

DC Drift should run at these points in the development lifecycle:

- **Manual command** — developer runs verification on demand
- **Pull request review** — automatic check before merging UI changes
- **Pre-release QA** — gate before staging → production promotion
- **Nightly verification** — scheduled run across all tracked screens

---

## Source of Truth Policy

- The approved Figma frame is always the source of truth
- Implementation must match the frame at the approved viewport
- Design system tokens defined in the Figma file take precedence over local overrides
- Any frame update must be explicitly re-approved before DC Drift uses the new version
