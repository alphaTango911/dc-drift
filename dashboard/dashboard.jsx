import { useState } from "react";

// Findings from the 2026-03-14 dual-layer verification run (Billing Plans /
// "Upgrade Your Plan"). Structural findings derive from failed checks in the
// code-level audit; the visual layer compares the Figma frame against the
// implementation screenshot. See .dc-drift/rules.md for the scoring model.
const MOCK_FINDINGS = [
  { id: 1,  category: "Component Variant", severity: "HIGH",   confidence: 0.94, layer: "structural", element: "Missing Primary CTA States", design: "Button: default / hover / disabled states per tokens", implemented: "Only default state implemented", description: "Hover and disabled states absent on primary CTA. Accessibility and conversion risk." },
  { id: 2,  category: "Missing Element",   severity: "HIGH",   confidence: 0.92, layer: "structural", element: "Payment Form Validation States", design: "Inline error + success validation states", implemented: "No validation states rendered", description: "Card form ships without validation feedback — critical for a payment flow." },
  { id: 3,  category: "Alignment",         severity: "HIGH",   confidence: 0.96, layer: "structural", element: "Responsive Breakpoint Failures", design: "Two-column layout collapses below 768px", implemented: "Layout breaks between 640–768px", description: "Sidebar overlaps main column at tablet widths. Invisible in a desktop screenshot." },
  { id: 4,  category: "Spacing",           severity: "MEDIUM", confidence: 0.88, layer: "structural", element: "Inconsistent Spacing Tokens", design: "space.6 — 24px card padding", implemented: "Mixed hardcoded 16 / 20 / 24px", description: "Spacing values hardcoded instead of token-driven; future token debt." },
  { id: 5,  category: "Typography",        severity: "MEDIUM", confidence: 0.85, layer: "structural", element: "Typography Weight Mismatch", design: "type.heading — 24px / 700", implemented: "24px / 600", description: "Section headings one weight step below spec." },
  { id: 6,  category: "Component Variant", severity: "MEDIUM", confidence: 0.83, layer: "structural", element: "Card Component Shadow Variance", design: "shadow.sm token", implemented: "Custom rgba() shadow", description: "Plan cards bypass the elevation token." },
  { id: 7,  category: "Alignment",         severity: "MEDIUM", confidence: 0.81, layer: "structural", element: "Icon Alignment Issues", design: "Icons on 4px baseline grid", implemented: "1–3px vertical offsets", description: "Feature-list icons drift off the baseline grid." },
  { id: 8,  category: "Missing Element",   severity: "MEDIUM", confidence: 0.79, layer: "structural", element: "Loading State Implementation", design: "Skeleton loading state on plan fetch", implemented: "No loading state", description: "Plans render empty during fetch; skeleton specified in design." },
  { id: 9,  category: "Spacing",           severity: "LOW",    confidence: 0.77, layer: "structural", element: "Micro-spacing Variation", design: "Consistent 8px gaps in summary rows", implemented: "6–9px drift", description: "Sub-threshold spacing drift (≤4px) across order summary." },
  { id: 10, category: "Component Variant", severity: "LOW",    confidence: 0.76, layer: "structural", element: "Border Radius Consistency", design: "radius.md — 8px", implemented: "6px on two cards", description: "Radius one step below token on Pro and Enterprise cards." },
  { id: 11, category: "Component Variant", severity: "LOW",    confidence: 0.63, layer: "structural", element: "Success Message Animation", design: "150ms ease-out transition", implemented: "Instant swap (approx)", description: "Transition timing unverifiable from static analysis. Flagged for designer review.", flagged: true },
  { id: 12, category: "Missing Element",   severity: "LOW",    confidence: 0.80, layer: "structural", element: "Focus Ring Implementation", design: "focus.ring token on all inputs", implemented: "Browser default outline", description: "Payment inputs use UA default focus instead of the token." },
  { id: 13, category: "Component Variant", severity: "LOW",    confidence: 0.91, layer: "visual",     element: "Popular Badge Position", design: "Badge breaks card top boundary, centered", implemented: "Badge inside card padding", description: "Deliberate pricing-UI emphasis pattern lost in implementation. ~15 min fix." },
];

const HIGH_COUNT = MOCK_FINDINGS.filter(f => f.severity === "HIGH").length;
const MED_COUNT  = MOCK_FINDINGS.filter(f => f.severity === "MEDIUM").length;
const LOW_COUNT  = MOCK_FINDINGS.filter(f => f.severity === "LOW").length;

// Scoring model V2 — see .dc-drift/rules.md.
// Structural layer: percentage of structural checks passed (this run: 72/100).
// Visual layer: flat penalties on visual-layer findings (100 − 5 × 1 LOW = 95).
// Combined: min(structural, visual) — a screen that looks right but is built
// wrong should not ship.
const STRUCTURAL_SCORE = 72;
const VISUAL_SCORE = 100 - MOCK_FINDINGS
  .filter(f => f.layer === "visual" && !f.flagged)
  .reduce((sum, f) => sum + ({ HIGH: 20, MEDIUM: 10, LOW: 5 }[f.severity]), 0);
const DRIFT_SCORE = Math.min(STRUCTURAL_SCORE, VISUAL_SCORE);

const SEV_CONFIG = {
  HIGH:   { color: "#ef4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.2)" },
  MEDIUM: { color: "#f97316", bg: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.2)" },
  LOW:    { color: "#eab308", bg: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.2)" },
};

const CAT_ICONS = {
  "Color Token": "◈",
  "Spacing": "⊞",
  "Typography": "Aa",
  "Component Variant": "⬡",
  "Alignment": "⊟",
  "Missing Element": "⊘",
};

function ScoreRing({ score }) {
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f97316" : "#ef4444";
  const label = score >= 80 ? "Minor Drift" : score >= 60 ? "Moderate Drift" : "Major Drift";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <svg width="130" height="130" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="65" cy="65" r={radius} fill="none" stroke="#1e2028" strokeWidth="10" />
        <circle
          cx="65" cy="65" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease, stroke 0.3s" }}
        />
        <text
          x="65" y="65"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#fff"
          fontSize="26"
          fontFamily="'DM Mono', monospace"
          fontWeight="500"
          style={{ transform: "rotate(90deg)", transformOrigin: "65px 65px" }}
        >{score}</text>
        <text
          x="65" y="82"
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#64748b"
          fontSize="9"
          fontFamily="Inter, sans-serif"
          style={{ transform: "rotate(90deg)", transformOrigin: "65px 65px", letterSpacing: "1px", textTransform: "uppercase" }}
        >/100</text>
      </svg>
      <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color, letterSpacing: 2, textTransform: "uppercase" }}>{label}</div>
    </div>
  );
}

function FindingCard({ finding, expanded, onToggle }) {
  const { color, bg, border } = SEV_CONFIG[finding.severity];
  return (
    <div
      onClick={onToggle}
      style={{
        border: `1px solid ${expanded ? border : "#1e2028"}`,
        borderRadius: 10,
        background: expanded ? bg : "#111318",
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.2s ease",
        marginBottom: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 16, minWidth: 24, textAlign: "center" }}>{CAT_ICONS[finding.category] || "◉"}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#e2e8f0" }}>{finding.element}</span>
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: 9, padding: "1px 7px", borderRadius: 4, background: color, color: "#fff", letterSpacing: 1 }}>{finding.severity}</span>
            {finding.flagged && <span style={{ fontFamily: "DM Mono, monospace", fontSize: 9, padding: "1px 7px", borderRadius: 4, border: "1px solid #1e3a5f", color: "#60a5fa", letterSpacing: 1 }}>⚠ REVIEW</span>}
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#64748b" }}>{finding.category}</span>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>{finding.description}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 64 }}>
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: finding.confidence >= 0.75 ? "#22c55e" : "#f97316" }}>{(finding.confidence * 100).toFixed(0)}%</div>
          <div style={{ fontSize: 9, color: "#334155" }}>confidence</div>
        </div>
        <div style={{ fontSize: 14, color: "#334155", marginLeft: 4 }}>{expanded ? "▲" : "▼"}</div>
      </div>

      {expanded && (
        <div style={{ marginTop: 14, borderTop: "1px solid #1e2028", paddingTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Design Spec</div>
            <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#22c55e", background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 6, padding: "6px 10px" }}>{finding.design}</div>
          </div>
          <div>
            <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Implemented</div>
            <div style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color, background: bg, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 10px" }}>{finding.implemented}</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DCDrift() {
  const [activeTab, setActiveTab] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [activeReport, setActiveReport] = useState("designer");

  const filtered = activeTab === "all"
    ? MOCK_FINDINGS
    : MOCK_FINDINGS.filter(f => f.severity === activeTab.toUpperCase());

  const releaseStatus = DRIFT_SCORE >= 80 ? { label: "GO", color: "#22c55e", bg: "rgba(34,197,94,0.1)", border: "rgba(34,197,94,0.3)" }
    : DRIFT_SCORE >= 60 ? { label: "REVIEW", color: "#f97316", bg: "rgba(249,115,22,0.1)", border: "rgba(249,115,22,0.3)" }
    : { label: "HOLD", color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)" };

  return (
    <div style={{ background: "#0a0b0f", minHeight: "100vh", color: "#e2e8f0", fontFamily: "Inter, sans-serif", padding: "0" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e2028", padding: "18px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontFamily: "Syne, sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>
            <span style={{ color: "#8b5cf6" }}>DC</span> Drift
          </div>
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#334155", letterSpacing: 2, textTransform: "uppercase", marginTop: 2 }}>Design Integrity Verification</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#64748b" }}>
            <span style={{ color: "#8b5cf6" }}>◈</span> Figma MCP · Connected
          </div>
          <div style={{ width: 1, height: 20, background: "#1e2028" }} />
          <div style={{
            fontFamily: "DM Mono, monospace", fontSize: 11, fontWeight: 600,
            padding: "5px 14px", borderRadius: 6,
            color: releaseStatus.color, background: releaseStatus.bg, border: `1px solid ${releaseStatus.border}`,
            letterSpacing: 2
          }}>
            {releaseStatus.label}
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 28px", display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, maxWidth: 1100, margin: "0 auto" }}>

        {/* LEFT PANEL */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Score card */}
          <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 12, padding: "20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <ScoreRing score={DRIFT_SCORE} />
            <div style={{ width: "100%", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[["HIGH", HIGH_COUNT, "#ef4444"], ["MED", MED_COUNT, "#f97316"], ["LOW", LOW_COUNT, "#eab308"]].map(([label, count, color]) => (
                <div key={label} style={{ textAlign: "center", background: "#0a0b0f", borderRadius: 8, padding: "8px 4px", border: "1px solid #1e2028" }}>
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 18, fontWeight: 500, color }}>{count}</div>
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "#334155", letterSpacing: 1, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Screen info */}
          <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Verification Target</div>
            {[["Screen", "Billing Plans / Upgrade Your Plan"], ["Frame", "Upgrade Your Plan (6:239)"], ["Structural", "72/100 checks passed"], ["Visual", "95/100 · Δ23 divergence"]].map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: "#64748b" }}>{k}</span>
                <span style={{ fontFamily: "DM Mono, monospace", fontSize: 11, color: "#94a3b8" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Report type selector */}
          <div style={{ background: "#111318", border: "1px solid #1e2028", borderRadius: 12, padding: "16px" }}>
            <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>Report View</div>
            {[["designer", "Designer Report"], ["engineer", "Engineer Checklist"], ["pm", "PM Summary"]].map(([id, label]) => (
              <div
                key={id}
                onClick={() => setActiveReport(id)}
                style={{
                  padding: "9px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 6, fontSize: 13,
                  background: activeReport === id ? "rgba(139,92,246,0.1)" : "transparent",
                  border: `1px solid ${activeReport === id ? "rgba(139,92,246,0.3)" : "transparent"}`,
                  color: activeReport === id ? "#a78bfa" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >{label}</div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "#111318", border: "1px solid #1e2028", borderRadius: 10, padding: 4 }}>
            {[["all", "All Issues"], ["high", "High"], ["medium", "Medium"], ["low", "Low"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                style={{
                  flex: 1, padding: "8px 0", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 12, fontFamily: "Inter, sans-serif",
                  background: activeTab === id ? "#1e2028" : "transparent",
                  color: activeTab === id ? "#e2e8f0" : "#64748b",
                  transition: "all 0.15s ease",
                }}
              >{label}{id !== "all" && <span style={{ marginLeft: 6, fontFamily: "DM Mono, monospace", fontSize: 10, color: { high: "#ef4444", medium: "#f97316", low: "#eab308" }[id] || "#64748b" }}>
                {id === "high" ? HIGH_COUNT : id === "medium" ? MED_COUNT : LOW_COUNT}
              </span>}</button>
            ))}
          </div>

          {/* Findings */}
          <div>
            {filtered.map(f => (
              <FindingCard
                key={f.id}
                finding={f}
                expanded={expanded === f.id}
                onToggle={() => setExpanded(expanded === f.id ? null : f.id)}
              />
            ))}
          </div>

          {/* Report footer */}
          {activeReport === "pm" && (
            <div style={{ marginTop: 16, background: "#111318", border: "1px solid #1e2028", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>PM Summary</div>
              <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
                Combined score <strong style={{ color: "#f97316" }}>72/100 — review required</strong>. The visual layer scored 95, but the structural audit passed only 72 of 100 checks: <strong style={{ color: "#ef4444" }}>3 HIGH</strong> findings (missing CTA states, absent payment validation, broken tablet breakpoints) are latent defects invisible in a screenshot and likely to surface in production. Resolve HIGH findings before release; 5 MEDIUM findings can follow in the next sprint.
              </div>
            </div>
          )}
          {activeReport === "engineer" && (
            <div style={{ marginTop: 16, background: "#111318", border: "1px solid #1e2028", borderRadius: 12, padding: "18px 20px" }}>
              <div style={{ fontFamily: "DM Mono, monospace", fontSize: 9, color: "#64748b", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 }}>Engineer Checklist</div>
              {MOCK_FINDINGS.filter(f => !f.flagged).map(f => (
                <div key={f.id} style={{ display: "flex", gap: 10, marginBottom: 10, padding: "10px 12px", background: "#0a0b0f", borderRadius: 8, border: "1px solid #1e2028" }}>
                  <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, padding: "2px 6px", borderRadius: 4, background: SEV_CONFIG[f.severity].bg, color: SEV_CONFIG[f.severity].color, alignSelf: "flex-start", whiteSpace: "nowrap" }}>{f.severity}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 3 }}>{f.element}</div>
                    <div style={{ fontFamily: "DM Mono, monospace", fontSize: 10, color: "#64748b" }}>Expected: <span style={{ color: "#22c55e" }}>{f.design}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
