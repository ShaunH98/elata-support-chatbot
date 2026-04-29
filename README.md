# Elata Support Chatbot

An AI support assistant for Enable Lifecare's **Elata® pressure care system** (E300 foam, E400/E500 hybrid, E600/E700 alternating air mattresses and pumps).

Live URL: _add yours after deploying_
Repo: _add yours after pushing_

---

## What it does

Clinicians and carers using Elata equipment have routine questions every day — alarm meanings, how to switch modes, setup steps, what to do in a power outage, weight limits, contraindications. Today those go through phone and email support. This chatbot turns the official Elata user manuals, brochures, and pressure mapping reports into a 10-second answer, available anywhere, anytime.

It is **strictly grounded** in the supplied Elata documents. If a question is outside those documents, the bot says so and points the user to Enable Lifecare on **1300 370 370**. It is not a clinical decision-making tool.

## How it works

```
User question
   ↓
Keyword + IDF retrieval over the Elata KB (224 chunks across 12 documents)
   ↓
Top 6 most relevant chunks → injected into the prompt as SOURCES
   ↓
OpenAI gpt-4o-mini with strict system prompt → grounded reply + citations
```

- **Knowledge base:** `data/kb.json`, built once from the Elata user manuals (E300–E700 IFUs), brochures, and pressure mapping reports. Page-level chunks with document labels.
- **Retrieval:** simple TF/IDF-style scoring in-process. No vector DB. With ~220 chunks this is plenty fast and zero-cost.
- **Generation:** `gpt-4o-mini` with temperature 0.1 and a tight system prompt that forbids out-of-document answers and requires citations.
- **Safety net:** any question the docs don't cover → the bot replies with the support phone number rather than guessing.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | One repo for UI + API; zero-config Vercel deploy |
| Language | TypeScript | Catches prompt/data-shape mistakes early |
| Styling | Tailwind CSS | Fast, restrained clinical UI |
| AI | OpenAI `gpt-4o-mini` | Cheap (~$0.15 per 1M input tokens) — fits the $5 assessment budget comfortably |
| Hosting | Vercel (free tier) | Free, fast, native Next.js, custom URLs |
| Storage | Bundled JSON | No DB needed for static product docs; cheaper and simpler |

## Topics it handles

The brief required ≥5. The chatbot covers:

1. **Alerts and alarms** — every pump alarm and indicator in the IFUs (§5.3 across E600/E700)
2. **Operating modes** — alternating, static, seat, comfort settings (§2.3, §4.3)
3. **Setup and installation** — unpacking, mattress + pump install, initial inflation, recommended linen (§3, §4.1)
4. **Power outage, transport, and CPR** — pump behaviour on power loss, transport function, CPR release (§4.4–§4.5)
5. **Cleaning, storage, maintenance** — disinfection, mattress care, shelf life (§6)
6. **Patient suitability** — pressure injury stages, max weight (e.g. 180 kg alternating air), contraindications (§1)
7. **Product comparison** — which Elata model fits which use case (foam / hybrid / alternating air)

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
3. In the project settings → Environment Variables, add:
   - `OPENAI_API_KEY` = your key from the Bitwarden link in the assessment doc
4. Hit **Deploy**.

That's it. Vercel detects Next.js automatically. No config file needed.

## Environment variables

| Name | Required | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | Yes | Auth for the OpenAI Chat Completions API |

There are no other secrets, no database credentials, no third-party services.

## Project structure

```
elata-app/
├── app/
│   ├── api/chat/route.ts    # Backend chat endpoint with grounded prompt
│   ├── globals.css          # Tailwind + chat styles
│   ├── layout.tsx           # Fonts and metadata
│   └── page.tsx             # Chat UI
├── lib/
│   └── retrieval.ts         # In-process keyword retrieval over the KB
├── data/
│   └── kb.json              # 224 page-chunks from 12 Elata documents
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
└── README.md
```

## Rebuilding the knowledge base

The KB is committed at `data/kb.json` so the app runs out of the box. If the underlying Elata documents change, regenerate it from the source PDFs:

```bash
# (See scripts/build_kb.py in this repo)
python3 scripts/build_kb.py
```

## Known limitations

- **Retrieval is keyword-based**, not semantic. It works well for clinical-support questions because the manuals use precise terminology, but a question phrased in unusual language may miss. A future upgrade is OpenAI embeddings (cheap, ~$0.02 per 1M tokens), which would lift recall on paraphrased queries.
- **Page-level chunks only.** Long pages occasionally retrieve more context than needed. Sub-page chunking would tighten this.
- **No conversation memory beyond the last 6 turns.** Sufficient for support but not for long sessions.
- **Visuals in the manuals** (diagrams of buttons, alarm icons) are referenced via text only; the bot describes them, not shows them.
- **English only.** No i18n.
- **No PHI handling** — the bot is not designed to receive patient information and the system prompt steers users away from sharing it. It uses the OpenAI API, which has its own data-handling policy.
- **No citations link to the source PDF directly** — citations are by document name and page number. A future upgrade is to host the PDFs alongside the app and link the citation chips.

## Planning brief

See [`PLANNING.md`](./PLANNING.md) for the half-page mini business case (Task 1 deliverable).

## Evaluation criteria mapping

| Brief criterion | Where it's addressed |
|---|---|
| Working app | Live URL above + this repo |
| AI integration | Strict system prompt in `app/api/chat/route.ts`, grounded retrieval in `lib/retrieval.ts`, graceful unknowns wired into the prompt |
| Stack & hosting choices | This README — see "Stack" table and "Why" columns |
| Interface quality | Restrained clinical UI, mobile-friendly, suggested questions on first load, visible "1300 370 370" fallback in the header |
| Code structure | TypeScript throughout, single-responsibility modules, no over-engineering |
| Documentation | This file |

## License

This project is part of an Enable Lifecare interview assessment. Elata® and the source documentation are property of Enable Lifecare Pty Ltd.
