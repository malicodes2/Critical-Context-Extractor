# MCP Tools Reference

The Critical Context Extractor exposes 7 targeted tools to the Prompt Opinion platform via the Model Context Protocol (MCP).

## Context / Authentication
All tools require an active FHIR instance Bearer token. This is **automatically injected** by Prompt Opinion into the request context.

## Available Tools

### 1. `extract_hidden_allergies`
Finds allergic reactions hidden in clinical notes that do not appear in the formal patient allergy list.
- **Input Schema:** `{ "patientId": "uuid" }`
- **Use Case:** Preventing anaphylaxis when unlisted allergies are missed by EMR configurations.

### 2. `find_unaddressed_findings`
Identifies abnormal test results or observation findings that have no documented follow-up.
- **Input Schema:** `{ "patientId": "uuid", "visitReason": "string (optional)" }`
- **Use Case:** Ensuring major abnormalities aren't "lost in the noise".

### 3. `detect_pattern_anomalies`
Identifies recurring symptom patterns across a distributed timeline (e.g. 24 months).
- **Input Schema:** `{ "patientId": "uuid", "minimumOccurrences": "number (default: 3)", "timeWindowMonths": "number" }`
- **Use Case:** Catching chronic conditions early before acute crisis.

### 4. `cross_reference_family_history`
Correlates family history mentions with currently presented symptoms.
- **Input Schema:** `{ "patientId": "uuid", "currentSymptoms": ["string"] }`
- **Use Case:** Highlighting immediate genetic predispositions relevant to the active problem.

### 5. `flag_contradictory_information`
Highlights direct contradictions between current diagnosis/reports and past major surgical or medication history.
- **Input Schema:** `{ "patientId": "uuid" }`
- **Use Case:** Decision support pre-surgery or pre-prescription.

### 6. `identify_specialist_recommendations`
Detects overdue referrals.
- **Input Schema:** `{ "patientId": "uuid", "specialtyFilter": ["cardiology", "etc"] }`
- **Use Case:** Continuity of care validation.

### 7. `generate_critical_context_brief`
**Main Dashboard Tool**. Synthesizes all 6 checks in parallel into a single, aggressively prioritized brief designed to be read in exactly 30 seconds before walking into the patient room.
- **Input Schema:** `{ "patientId": "uuid", "visitReason": "string" }`
