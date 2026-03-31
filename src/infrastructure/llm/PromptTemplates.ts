/**
 * Structured prompt templates for LLM extraction tasks.
 * All prompts request JSON output to enable structured parsing.
 */

export const ALLERGY_EXTRACTION_PROMPT = (noteText: string): string => `
You are a clinical pharmacist AI analyzing a clinical note for allergy information.
Extract ALL mentions of allergic reactions, adverse drug reactions, or intolerances.

Clinical Note:
"""
${noteText}
"""

Respond with a JSON array. Each item must have:
- substance: string (drug, food, or environmental substance)
- reaction: string (the reaction described)
- severity: "mild" | "moderate" | "severe" | "life-threatening"
- excerpt: string (max 200 chars of relevant text from the note)
- confidence: number (0.0 to 1.0)

Rules:
- Only include explicitly mentioned reactions, NOT hypothetical or denied reactions
- If no allergies mentioned, return an empty array []
- Be conservative — only report high-confidence mentions (>=0.7)

Return ONLY valid JSON array, no markdown, no explanation.
`;

export const FINDING_FOLLOWUP_PROMPT = (
  findingDescription: string,
  subsequentNotes: string
): string => `
You are a clinical AI determining whether an abnormal medical finding was addressed.

Abnormal Finding:
${findingDescription}

Subsequent Clinical Notes:
"""
${subsequentNotes}
"""

Analyze whether the subsequent notes show evidence that this abnormal finding was:
- Acknowledged by a clinician
- Investigated (additional tests ordered)
- Treated or a treatment plan was made
- Referred to a specialist

Respond with JSON:
{
  "wasAddressed": boolean,
  "evidence": string (brief explanation, max 200 chars),
  "confidence": number (0.0 to 1.0)
}

Return ONLY valid JSON, no markdown, no explanation.
`;

export const SYMPTOM_EXTRACTION_PROMPT = (noteText: string): string => `
You are a clinical AI extracting symptom mentions from a clinical note.

Clinical Note:
"""
${noteText}
"""

Extract ALL symptoms, complaints, or clinical findings mentioned by or about the patient.
Normalize similar symptoms (e.g., "chest discomfort" and "chest pain" → "chest pain").

Respond with a JSON array of symptom strings. Example: ["headache", "fatigue", "chest pain"]

Rules:
- Use standardized clinical terminology
- Normalize variations of the same symptom
- Exclude symptoms that are explicitly denied ("no chest pain")
- Return ONLY valid JSON array, no markdown.
`;

export const FAMILY_HISTORY_PROMPT = (noteText: string): string => `
You are a clinical AI extracting family history information from a clinical note.

Clinical Note:
"""
${noteText}
"""

Extract ALL family history mentions. For each:
- relative: string (e.g., "father", "maternal aunt", "sibling")
- condition: string (the medical condition)
- ageAtOnset: number | null (age when condition was diagnosed, if mentioned)
- deceased: boolean | null

Respond with JSON array. Return [] if none found.
Return ONLY valid JSON array, no markdown, no explanation.
`;

export const CONTRADICTION_DETECTION_PROMPT = (
  dataPoint1: string,
  dataPoint2: string
): string => `
You are a clinical AI identifying contradictions in a patient's medical record.

Data Point 1:
${dataPoint1}

Data Point 2:
${dataPoint2}

Determine if these two data points contradict each other clinically.

Respond with JSON:
{
  "isContradiction": boolean,
  "contradictionType": "ALLERGY_MISMATCH" | "MEDICATION_DISCREPANCY" | 
                       "SURGICAL_HISTORY_CONFLICT" | "DIAGNOSIS_INCONSISTENCY" | 
                       "SOCIAL_HISTORY_CHANGE" | null,
  "explanation": string (max 200 chars),
  "clinicalImpact": string (max 200 chars),
  "confidence": number (0.0 to 1.0)
}

Return ONLY valid JSON, no markdown, no explanation.
`;

export const SPECIALIST_RECOMMENDATION_PROMPT = (noteText: string): string => `
You are a clinical AI extracting specialist recommendations from a clinical note.

Clinical Note:
"""
${noteText}
"""

Extract ALL specialist referrals, consultations, or recommendations mentioned.

For each recommendation:
- specialist: string (e.g., "cardiologist", "ophthalmologist")
- action: string (what was recommended)
- urgency: "routine" | "soon" | "urgent"
- date: string (ISO 8601 if available, else null)

Respond with JSON array. Return [] if none found.
Return ONLY valid JSON array, no markdown, no explanation.
`;

export const CRITICAL_BRIEF_SYNTHESIS_PROMPT = (
  patientContext: string,
  visitReason: string,
  findings: string
): string => `
You are a senior attending physician AI creating a pre-visit critical context brief.

Patient Context: ${patientContext}
Visit Reason: ${visitReason}

Critical Findings from Chart Review:
${findings}

Create a concise clinical brief prioritizing:
1. Life-threatening risks (allergies, critical abnormals)
2. Findings directly relevant to today's visit reason
3. Patterns or red flags needing investigation
4. Overdue follow-ups
5. Background context

Format as a professional clinical summary in 3-5 bullet points.
Lead with the most critical items. Be specific with values and dates.
Write for a busy clinician who has 2 minutes before seeing the patient.
`;
