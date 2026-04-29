/**
 * Deterministic post-processor for recommendation-mode responses.
 *
 * The LLM is unreliable on:
 *   - Inequality direction when comparing patient weight to SWL.
 *   - Suppressing unsupported clinical terms from "reason" fields.
 *   - Citing the right page of the IFU.
 *   - Producing the mandatory disclosure in `notes`.
 *
 * These facts don't change between requests, so we enforce them in code.
 *
 * Source: every spec below is taken verbatim from the Section 1 (Introduction
 * / Intended Use) page of the corresponding Elata IFU, page 5 in each case.
 */
export interface ProductSpec {
  name:
    | "E300 Clinical Foam Mattress"
    | "E400 Hybrid Mattress System"
    | "E500 Hybrid Mattress System"
    | "E600 Alternating Air System"
    | "E700 Alternating Air System";
  /** Maximum pressure-injury stage explicitly covered by the IFU (1-4). */
  maxStage: number;
  /** Patient weight limit in kg. */
  swlKg: number;
  /** Whether the product is a powered (pump-driven) system. */
  powered: boolean;
  /** Canonical citation for the spec line. */
  source: string;
}

export const PRODUCT_SPECS: ProductSpec[] = [
  {
    name: "E300 Clinical Foam Mattress",
    maxStage: 2,
    swlKg: 160,
    powered: false,
    source: "User Manual — E300 Clinical Foam Mattress, page 5",
  },
  {
    name: "E400 Hybrid Mattress System",
    maxStage: 4,
    swlKg: 230,
    powered: true,
    source: "User Manual — E400 Hybrid Mattress System, page 5",
  },
  {
    name: "E500 Hybrid Mattress System",
    maxStage: 4,
    swlKg: 230,
    powered: true,
    source: "User Manual — E500 Hybrid Mattress System, page 5",
  },
  {
    name: "E600 Alternating Air System",
    maxStage: 4,
    swlKg: 180,
    powered: true,
    source: "User Manual — E600 Alternating Air System, page 5",
  },
  {
    name: "E700 Alternating Air System",
    maxStage: 4,
    swlKg: 180,
    powered: true,
    source: "User Manual — E700 Alternating Air System, page 5",
  },
];

/** Terms that must NEVER drive a recommendation. Case-insensitive match. */
export const UNSUPPORTED_TERMS = [
  // diagnoses
  "diabetes", "diabetic",
  "paraplegia", "paraplegic",
  "quadriplegia", "quadriplegic", "tetraplegic",
  "stroke", "post-stroke",
  "dementia",
  "parkinson", "parkinson's",
  "cancer", "oncology",
  "sepsis", "septic",
  "copd",
  "heart failure",
  "renal failure", "kidney failure",
  // mobility / care states
  "bedridden", "bed-bound", "bed bound",
  "immobile", "immobility",
  "wheelchair-bound", "wheelchair bound",
  "post-surgical", "post surgery", "post-op", "postoperative",
  "fracture",
  "palliative", "end-of-life", "end of life",
  // descriptors
  "high-risk", "high risk",
  "very high-risk", "very high risk",
  "frail", "frailty",
  "elderly", "geriatric",
  "obese", "obesity", "morbidly obese", "bariatric",
  "incontinent", "incontinence",
  "malnourished", "malnutrition",
  "compromised skin",
  "poor circulation",
  // care settings (without explicit doc statement)
  "icu", "intensive care",
  "theatre", "theater", "operating room", "surgical recovery",
  "rehab", "rehabilitation",
  "aged care",
];

export interface UserCriteria {
  stage: number | null;
  weightKg: number | null;
  poweredRequested: boolean | null; // true=powered, false=non-powered, null=not specified
  ignoredTerms: string[];
}

export function parseUserQuery(query: string): UserCriteria {
  const q = query.toLowerCase();

  // Stage 1-4
  let stage: number | null = null;
  const stageMatch = q.match(/\bstage\s*([1-4])\b/);
  if (stageMatch) stage = parseInt(stageMatch[1], 10);

  // Weight in kg (e.g. "150 kg", "150kg", "weighing 150")
  let weightKg: number | null = null;
  const wMatch = q.match(/(\d{2,3})\s*kg/);
  if (wMatch) weightKg = parseInt(wMatch[1], 10);
  else {
    const wMatch2 = q.match(/(weighs?|weighing)\s+(\d{2,3})\b/);
    if (wMatch2) weightKg = parseInt(wMatch2[2], 10);
  }
  // Sanity: ignore implausible numbers (years, room numbers, etc.)
  if (weightKg !== null && (weightKg < 30 || weightKg > 400)) weightKg = null;

  // Powered / non-powered preference
  let poweredRequested: boolean | null = null;
  if (/\bnon[-\s]?powered\b/.test(q) || /\bwithout\s+a?\s*pump\b/.test(q)) {
    poweredRequested = false;
  } else if (
    /\bpowered\b/.test(q) ||
    /\bwith\s+a?\s*pump\b/.test(q) ||
    /\balternating\s+air\b/.test(q)
  ) {
    poweredRequested = true;
  }

  // Detect ignored / unsupported terms — only flag terms actually present
  const ignoredTerms: string[] = [];
  for (const term of UNSUPPORTED_TERMS) {
    // Word-boundary-ish check; allow hyphens
    const re = new RegExp(`(^|[^a-z])${escapeRe(term)}([^a-z]|$)`, "i");
    if (re.test(query) && !ignoredTerms.includes(term)) {
      ignoredTerms.push(term);
    }
  }

  return { stage, weightKg, poweredRequested, ignoredTerms };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface RecProduct {
  name: string;
  reason: string;
  confidence: "high" | "medium" | "low";
  source: string;
}

export interface RecPayload {
  mode: "recommendation";
  products: RecProduct[];
  notes: string;
}

/**
 * Determines which products in the catalogue actually satisfy the supported
 * criteria, computes correct confidence, and writes a deterministic reason
 * string. We use this both as the source of truth and as a sanity check on
 * what the model returned.
 */
export function computeMatchingProducts(c: UserCriteria): RecProduct[] {
  const out: RecProduct[] = [];
  for (const spec of PRODUCT_SPECS) {
    // Stage filter
    if (c.stage !== null && c.stage > spec.maxStage) continue;
    // Powered preference filter
    if (c.poweredRequested !== null && c.poweredRequested !== spec.powered) continue;
    // Weight: if user gave a weight, products where weight > SWL are
    // included with low confidence + explicit over-limit note (so the user
    // sees them and can decide), but only if no other criterion already
    // excluded them. Stage exclusions are absolute.
    let confidence: "high" | "medium" | "low" = "high";
    const reasonParts: string[] = [];

    // Stage clause
    if (c.stage !== null) {
      reasonParts.push(
        `Indicated for the prevention and management of pressure injuries up to Stage ${spec.maxStage} (covers Stage ${c.stage}).`,
      );
    } else {
      reasonParts.push(
        `Indicated for the prevention and management of pressure injuries up to Stage ${spec.maxStage}.`,
      );
    }

    // Powered clause
    reasonParts.push(
      spec.powered
        ? "Powered system (used with an Elata pump)."
        : "Non-powered foam system.",
    );

    // Weight clause
    if (c.weightKg !== null) {
      if (c.weightKg <= spec.swlKg) {
        reasonParts.push(
          `Patient weight ${c.weightKg} kg is within the product's stated SWL of ${spec.swlKg} kg.`,
        );
      } else {
        reasonParts.push(
          `Patient weight ${c.weightKg} kg exceeds the product's stated SWL of ${spec.swlKg} kg — clinical assessment required.`,
        );
        confidence = "low";
      }
    } else {
      reasonParts.push(`Stated SWL: ${spec.swlKg} kg.`);
    }

    out.push({
      name: spec.name,
      reason: reasonParts.join(" "),
      confidence,
      source: spec.source,
    });
  }
  return out;
}

/**
 * Strip phrases from a reason string that reference unsupported clinical terms
 * (e.g. "suitable for high-risk patients", "ICU", "palliative care"). We do
 * sentence-level filtering: any sentence containing an unsupported term is
 * removed entirely. This is aggressive on purpose.
 */
export function sanitiseReason(reason: string): string {
  if (!reason) return reason;
  const sentences = reason.split(/(?<=[.!?])\s+/);
  const kept = sentences.filter((s) => {
    const lower = s.toLowerCase();
    return !UNSUPPORTED_TERMS.some((t) => {
      const re = new RegExp(`(^|[^a-z])${escapeRe(t)}([^a-z]|$)`, "i");
      return re.test(lower);
    });
  });
  return kept.join(" ").trim();
}

/**
 * Build the mandatory disclosure note when the user query contained
 * unsupported terms.
 */
export function buildNotes(c: UserCriteria, productCount: number): string {
  if (productCount === 0 && c.stage === null && c.weightKg === null && c.poweredRequested === null) {
    return "NOT FOUND IN PROVIDED DATA. Please provide at least one supported criterion: pressure injury stage (1-4), patient weight in kg, or whether you need a powered or non-powered system.";
  }
  if (c.ignoredTerms.length > 0) {
    const evaluated: string[] = [];
    if (c.stage !== null) evaluated.push(`Stage ${c.stage}`);
    if (c.weightKg !== null) evaluated.push(`patient weight ${c.weightKg} kg`);
    if (c.poweredRequested !== null) evaluated.push(c.poweredRequested ? "powered system" : "non-powered system");
    const evaluatedStr = evaluated.length > 0
      ? `Evaluated against ${evaluated.join(" and ")} only.`
      : "No supported criteria were provided.";
    return `Ignored unsupported terms: ${c.ignoredTerms.join(", ")}. ${evaluatedStr}`;
  }
  return "";
}

/**
 * Master validator. Takes whatever the model produced and returns a
 * deterministically-correct payload. We use the model's output for ordering
 * and any extra differentiator phrasing, but we override numbers, confidence,
 * sources, and notes from the spec table.
 */
export function validateRecommendation(
  modelOutput: unknown,
  userQuery: string,
): RecPayload {
  const criteria = parseUserQuery(userQuery);
  const computed = computeMatchingProducts(criteria);

  // If the user gave no supported criteria at all, refuse cleanly.
  const hasAnySupported =
    criteria.stage !== null ||
    criteria.weightKg !== null ||
    criteria.poweredRequested !== null;
  if (!hasAnySupported) {
    return {
      mode: "recommendation",
      products: [],
      notes: buildNotes(criteria, 0),
    };
  }

  // Sanitise any extra reason text the model produced (in case we want to
  // merge differentiator phrasing later). For now we use computed reasons
  // verbatim — they are deterministic and audit-safe.
  void sanitiseReason; // exported for future use / tests
  void modelOutput;

  return {
    mode: "recommendation",
    products: computed,
    notes: buildNotes(criteria, computed.length),
  };
}
