# Elata Support Chatbot

An AI support assistant for Enable Lifecare's **Elata® pressure care system** (E300 foam, E400/E500 hybrid, E600/E700 alternating air mattresses and pumps).

Live URL:(https://elata-support-chatbot.vercel.app/)
Repo: _add yours after pushing_

---

## What it does

Clinicians and carers using Elata equipment have routine questions every day — alarm meanings, how to switch modes, setup steps, what to do in a power outage, weight limits, contraindications. Today those go through phone and email support. This chatbot turns the official Elata user manuals, brochures, and pressure mapping reports into a 10-second answer, available anywhere, anytime.

It is **strictly grounded** in the supplied Elata documents. If a question is outside those documents, the bot says so and points the user to Enable Lifecare on **1300 370 370**. It is not a clinical decision-making tool.

## Architecture: hybrid by design

The bot routes each query down one of two paths. This was a deliberate choice: numbers and product specs are deterministic and shouldn't be delegated to a stochastic model.

```
                    User question
                         ↓
              ┌──────────┴──────────┐
              │  Recommendation     │
              │  intent detected?   │
              │  (stage / kg /      │
              │  powered / etc.)    │
              └──────────┬──────────┘
                  ┌──────┴──────┐
                yes              no
                  │              │
                  ↓              ↓
        ┌─────────────────┐  ┌────────────────────┐
        │  Deterministic  │  │  Retrieval + LLM   │
        │  validator      │  │  (gpt-4o-mini)     │
        │  (lib/          │  │  with strict       │
        │  validator.ts)  │  │  system prompt     │
        └────────┬────────┘  └─────────┬──────────┘
                 │                     │
                 ↓                     ↓
         Product cards JSON     Informational JSON
         (~50 ms, $0)           (~3–5 s, ~$0.0003)
```

### Path 1 — Deterministic recommendation engine

Triggered when the user asks "which product" and supplies at least one supported criterion (pressure injury stage, weight in kg, powered/non-powered preference). The validator:

1. Parses the user query for supported criteria and detects unsupported clinical terms (diagnoses, mobility states, generic risk descriptors, care settings).
2. Filters a hardcoded product spec table — the spec table is verified against the IFU Section 1 page of each model.
3. Computes correct confidence based on the actual numbers: stage support, weight ≤ SWL, powered match.
4. Generates a deterministic reason string for each matching product, in a fixed format that cannot flip an inequality.
5. Builds a mandatory disclosure note listing any unsupported terms that were ignored.

No LLM is involved. The result is instant, free, and arithmetically guaranteed.

This path was added after testing showed `gpt-4o-mini` repeatedly flipping the inequality in *"patient weight 150 kg ≤ SWL 180 kg"* under three different prompt iterations. Numbers belong in code.

### Path 2 — Retrieval-augmented LLM

Triggered for everything else: alarms, modes, setup, CPR, cleaning, troubleshooting, product comparison, greetings.

```
User question → keyword + IDF retrieval over the KB (224 chunks, 12 docs)
              → top 6 chunks injected as SOURCES into the prompt
              → gpt-4o-mini (JSON mode, temperature 0.1, strict system prompt)
              → typed JSON response with cited document + page numbers
```

The system prompt forbids out-of-document answers, requires citations, and falls back to *"I don't have that in the Elata documentation… please contact Enable Lifecare on 1300 370 370"* for anything it can't cover.

## Two response modes

Both paths return the same JSON shape, distinguished by `mode`:

**`mode: "recommendation"`** — product cards with confidence badges and source citations.

```json
{
  "mode": "recommendation",
  "products": [
    {
      "name": "E600 Alternating Air System",
      "reason": "Indicated for the prevention and management of pressure injuries up to Stage 4 (covers Stage 3). Powered system (used with an Elata pump). Patient weight 150 kg is within the product's stated SWL of 180 kg.",
      "confidence": "high",
      "source": "User Manual — E600 Alternating Air System, page 5"
    }
  ],
  "notes": "Ignored unsupported terms: immobile, high-risk. Evaluated against Stage 3 and patient weight 150 kg only."
}
```

**`mode: "informational"`** — chat bubble with citation chips.

```json
{
  "mode": "informational",
  "answer": "The transport function lets the pump run on internal battery during patient moves. To activate it…",
  "sources": [{ "label": "User Manual — E600 Alternating Air System", "page": 11 }],
  "notes": ""
}
```

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | One repo for UI + API; zero-config Vercel deploy |
| Language | TypeScript | Catches prompt/data-shape mistakes early; spec table is type-safe |
| Styling | Tailwind CSS | Fast, restrained clinical UI |
| AI | OpenAI `gpt-4o-mini` | Cheap (~$0.15 per 1M input tokens); fits the $5 assessment budget; only used for informational queries |
| Recommendations | Hardcoded validator | Deterministic, instant, free, audit-safe |
| Hosting | Vercel (free tier) | Free, fast, native Next.js, custom URLs |
| Storage | Bundled JSON | No DB needed for static product docs |

## Topics it handles

The brief required ≥5. The chatbot covers:

1. **Product selection** — which Elata model(s) fit a given patient (deterministic via validator)
2. **Alerts and alarms** — pump alarms and indicators (IFU §5.3)
3. **Operating modes** — alternating, CLP, max inflation, comfort settings (IFU §2.3, §4.3)
4. **Setup and installation** — unpacking, install, initial inflation, recommended linen (IFU §3, §4.1)
5. **Power outage, transport, and CPR** — pump behaviour on power loss, transport function, CPR release (IFU §4.4–§4.5)
6. **Cleaning, storage, maintenance** — disinfection, mattress care, shelf life (IFU §6)
7. **Patient suitability** — pressure injury stages, max weight, contraindications (IFU §1)
8. **Out-of-scope handling** — pricing, ordering, warranty, competitors → routed to support

## Strict no-inference rule

The validator refuses to translate clinical conditions, diagnoses, or general risk descriptors into a recommendation. Terms like *bedridden*, *palliative*, *high-risk*, *frail*, *diabetic*, *ICU*, *bariatric* are detected and explicitly listed in the response's `notes` field as ignored — they cannot drive product selection. This is enforced in code, not prompt.

If a query contains *only* unsupported terms (no stage, no weight, no powered preference), the bot returns an empty `products` array with `notes: "NOT FOUND IN PROVIDED DATA"` and asks for a supported criterion. It does not infer.

## Running locally

Requirements: Node.js 20+, an OpenAI API key.

```bash
git clone <your-repo-url>
cd elata-support-chatbot
npm install
cp .env.example .env.local
# Edit .env.local and paste your OPENAI_API_KEY
npm run dev
```

Open http://localhost:3000.

## Deploying to Vercel (5 minutes)

1. Push this repo to GitHub.
2. Go to https://vercel.com/new and import the repo.
3. In project settings → Environment Variables, add:
   - `OPENAI_API_KEY` = your key from the Bitwarden link in the assessment doc
4. Hit **Deploy**.

Vercel detects Next.js automatically. No config file needed.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Auth for the OpenAI Chat Completions API (informational path only) |

No other secrets. No database. No third-party services.

## Project structure

```
elata-app/
├── app/
│   ├── api/chat/route.ts    # API route — routes between validator and LLM
│   ├── globals.css          # Tailwind + chat styles
│   ├── layout.tsx           # Fonts and metadata
│   └── page.tsx             # Chat UI (renders both response modes)
├── lib/
│   ├── retrieval.ts         # In-process keyword + IDF retrieval over the KB
│   └── validator.ts         # Deterministic recommendation engine + spec table
├── data/
│   └── kb.json              # 224 page-chunks from 12 Elata documents
├── scripts/
│   └── build_kb.py          # Rebuild kb.json from extracted PDF text
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── PLANNING.md              # Task 1 — half-page planning brief
└── README.md
```

## Rebuilding the knowledge base

The KB is committed at `data/kb.json` so the app runs out of the box. If the underlying Elata documents change:

```bash
python3 scripts/build_kb.py
```

## Updating product specs

Specs live in `lib/validator.ts` as a typed `PRODUCT_SPECS` table. Each entry has `maxStage`, `swlKg`, `powered`, and a canonical source citation. To update a spec, edit the table and verify against the IFU Section 1 page. No prompt changes needed; the change is type-checked at build time.

## Known limitations

- **Retrieval is keyword-based**, not semantic — works well for the IFU/brochure terminology but a paraphrased query may miss. A future upgrade is OpenAI embeddings.
- **Page-level chunks** only. Sub-page chunking would tighten retrieval.
- **No conversation memory** beyond the last 6 turns.
- **Visuals in the manuals** (button diagrams, alarm icons) are referenced via text only.
- **English only.** No i18n.
- **No PHI handling.** The bot isn't designed to receive patient identifying information; the system prompt steers users away from sharing it.
- **Citations don't link to source PDFs** — they're by document name and page number. Hosting the PDFs alongside the app would let citation chips deep-link.
- **Validator only handles five products** (E300–E700). Adding a new model means adding a row to `PRODUCT_SPECS` — intentional design choice for audit safety.

## Planning brief

See [`PLANNING.md`](./PLANNING.md) for the half-page mini business case (Task 1 deliverable).

## Evaluation criteria mapping

| Brief criterion | Where it's addressed |
|---|---|
| Working app | Live URL above + this repo |
| AI integration | Strict system prompt in `app/api/chat/route.ts`; grounded retrieval in `lib/retrieval.ts`; deterministic validator in `lib/validator.ts`; graceful unknowns and "NOT FOUND IN PROVIDED DATA" wired into both paths |
| Stack & hosting choices | This README — see "Stack" and "Architecture" sections; LLM only runs where it adds value, recommendations are deterministic |
| Interface quality | Restrained clinical UI, mobile-friendly, suggested questions on first load, visible "1300 370 370" fallback in the header, separate render modes for recommendations vs informational answers |
| Code structure | TypeScript throughout, single-responsibility modules, validator is pure functions and easily unit-testable |
| Documentation | This file + `PLANNING.md` |

## License

This project is part of an Enable Lifecare interview assessment. Elata® and the source documentation are property of Enable Lifecare Pty Ltd.
