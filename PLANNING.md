# Elata Support Chatbot — Planning Brief

**Author:** Shaun Higgins  **Date:** 29 April 2026

**Problem.** Clinicians and carers using Enable Lifecare's Elata® pressure care system run into routine support questions every day — alarm meanings, mode changes, setup, power outages, cleaning. Today those go through phone and email, which is slow during the day and unavailable overnight. The answers already exist in the Elata user manuals, brochures, and FAQs; they're just not searchable in the moment.

**Users.** Aged-care and hospital clinicians (primary), home-care carers (often after-hours, often less familiar with the kit), and facility/biomed staff handling setup and cleaning. All three are usually talking to the bot with a patient in front of them — speed and accuracy beat personality.

**How the AI is used.** A retrieval-grounded chatbot, not a general-purpose assistant. The Elata resources page (IFUs E300–E700, brochures, pressure maps) is the only source of truth. A lower-cost OpenAI model (per the $5 budget) reformats retrieved content into clear answers, cites the source section, and refuses to answer anything outside the supplied docs — falling back to *"please contact Enable Lifecare on 1300 370 370"*. No clinical advice beyond what the manuals state.

**Topics handled at launch (≥5).**
1. Alerts and alarms (IFU §5.3)
2. Operating modes and comfort settings (IFU §2.3, §4.3)
3. Setup, installation, and initial inflation (IFU §3)
4. Power outage, transport function, and CPR release (IFU §4.4–§4.5)
5. Cleaning, storage, and maintenance (IFU §6)
6. Patient suitability — pressure injury stage, max weight, contraindications (IFU §1)

**Out of scope.** Clinical decisions, ordering, warranty, anything not in the Elata documents.

**Success.** A clinician opens the URL on their phone, asks a real question, and gets a correct, sourced answer in under five seconds — or a clean "not in the docs, call support" when the bot doesn't know.
