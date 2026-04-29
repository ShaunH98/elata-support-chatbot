**Elata Support Chatbot — Planning Brief**

**Author:** Shaun Higgins
**Date:** 29 April 2026

**Problem**
Clinicians and carers using Enable Lifecare's Elata® pressure care system encounter routine support questions daily — alarm meanings, mode changes, setup, power outages, and cleaning. These are currently handled via phone and email, which are slow during working hours and unavailable overnight. The answers already exist in official Elata documentation but are not easily accessible at the point of care.

**Users**
Aged-care and hospital clinicians (primary), home-care carers (often after-hours and less familiar with equipment), and facility/biomedical staff responsible for setup and maintenance. Users are typically interacting with the system in real time while attending to a patient — speed and accuracy are critical.

**How the AI is used**
The system is a retrieval-grounded assistant, not a general-purpose chatbot. The Elata resource library (IFUs E300–E700, brochures, pressure mapping reports) is the only source of truth.

The architecture is hybrid:

* Product selection queries are handled by a deterministic validator using a verified product specification table (ensuring correct stage, weight, and system matching).
* All other queries use retrieval + LLM (OpenAI `gpt-4o-mini`) to generate structured, citation-backed answers.

The system enforces a strict no-inference rule: clinical conditions, diagnoses, or general risk descriptors are not translated into product recommendations unless explicitly defined in the documentation.

All responses are grounded in and traceable to the source documents, with page-level citations. If a query falls outside the documentation, the system responds with a clear fallback directing users to Enable Lifecare support (1300 370 370). No clinical advice is provided beyond what is stated in the manuals.

**Topics handled at launch**

1. Alerts and alarms (IFU §5.3)
2. Operating modes and comfort settings (IFU §2.3, §4.3)
3. Setup, installation, and initial inflation (IFU §3)
4. Power outage, transport function, and CPR release (IFU §4.4–§4.5)
5. Cleaning, storage, and maintenance (IFU §6)
6. Patient suitability — pressure injury stage, max weight, contraindications (IFU §1)

**Out of scope**
Clinical decision-making, ordering, warranty queries, and any information not present in the Elata documentation.

**Success**
A clinician can open the application on a mobile device, ask a real-world question, and receive a correct, clearly sourced answer in under five seconds — or a clear “not found in documentation” response with a support fallback when appropriate.
