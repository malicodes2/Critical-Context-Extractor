# 🏥 Critical Context Extractor

> **Enterprise-grade MCP Server** that surfaces critical patient information buried in unstructured FHIR clinical notes — preventing diagnostic errors, missed allergies, and care gaps.

## 🎯 Mission

Prevent the 40,000–80,000 preventable deaths/year caused by diagnostic errors by using AI to extract critical context from clinical notes that busy clinicians don't have time to read.

---

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd critical-context-extractor
npm install

# 2. Configure
cp .env.example .env
# Add your GEMINI_API_KEY and FHIR_BASE_URL

# 3. Start server
npm run dev
# → Server running at http://localhost:3000/mcp
# → Health check: http://localhost:3000/health

# 4. Expose publicly (for Prompt Opinion)
npx ngrok http 3000
# Copy the HTTPS URL → Register in Prompt Opinion as <ngrok-url>/mcp
```

---

## 🛠️ 7 MCP Tools

| Tool | Purpose |
|------|---------|
| `extract_hidden_allergies` | Find allergies in notes but missing from allergy list |
| `find_unaddressed_findings` | Abnormal test results with no follow-up documented |
| `detect_pattern_anomalies` | Recurring symptoms never fully investigated |
| `cross_reference_family_history` | Genetic risk correlation with current symptoms |
| `flag_contradictory_information` | Contradictions across the patient record |
| `identify_specialist_recommendations` | Overdue referrals and specialist follow-ups |
| `generate_critical_context_brief` | **Master tool** — synthesizes all insights into a pre-visit brief |

---

## 📋 Platform Integration (Prompt Opinion)

1. Start the server: `npm run dev`
2. Expose via ngrok: `npx ngrok http 3000`
3. In Prompt Opinion → Workspace Hub → Add MCP Server:
   - URL: `<ngrok-url>/mcp`
   - Type: **Streamable HTTP**
   - ✅ Check **"Pass FHIR token"** — the server will receive a Bearer token to query patient data
4. Add tools to your agent in Prompt Opinion
5. Test via the Launchpad with a patient selected

### FHIR Token Flow
Prompt Opinion automatically injects a Bearer token in the `Authorization` header when calling our MCP server. The server extracts it and passes it to the FHIR client for patient data queries.

---

## 🏗️ Architecture

```
src/
├── domain/          # Pure business logic — NO external deps
│   ├── entities/    # Patient, ClinicalNote, Allergy, Finding, Evidence
│   ├── value-objects/   # PatientId, Severity, DateRange, AlertLevel
│   ├── interfaces/  # PatientRepository, LLMClient, CacheStrategy
│   └── services/    # AllergyDomainService, TemporalAnalysisService
├── application/     # Use cases (7 MCP tools)
├── infrastructure/  # FHIR client, Gemini LLM, cache, logging
├── presentation/    # MCP server + tool registration
└── shared/          # Errors, validators, utilities
```

**Clean Architecture (Hexagonal) — dependencies flow inward:**
`Infrastructure → Application → Domain ← Interfaces`

---

## 🔧 Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `GEMINI_API_KEY` | Google AI API key | **required** |
| `GEMINI_MODEL` | Model identifier | `gemini-2.5-flash-preview-04-17` |
| `FHIR_BASE_URL` | FHIR server URL | `https://hapi.fhir.org/baseR4` |
| `MCP_SERVER_PORT` | HTTP port | `3000` |
| `LOG_LEVEL` | Logging verbosity | `info` |
| `CACHE_STRATEGY` | `memory` or `redis` | `memory` |

---

## 🧪 Testing

```bash
npm test                 # Unit tests
npm run test:coverage    # Coverage report (target: >80%)
npm run test:all         # All tests
npm run build            # TypeScript compilation
npm run lint             # ESLint
```

## 🐳 Docker

```bash
cd docker
docker-compose up --build
```

---

## 📊 Quality Standards

- ✅ TypeScript strict mode
- ✅ Clean hexagonal architecture
- ✅ SOLID principles throughout
- ✅ PHI-safe logging (patient IDs hashed)
- ✅ Exponential backoff for FHIR resilience
- ✅ Graceful degradation on LLM failures
- ✅ Parallel processing (Tool 7 runs all 6 in parallel)

---

*Built for the [Agents Assemble Healthcare AI Hackathon](https://app.promptopinion.ai)*
