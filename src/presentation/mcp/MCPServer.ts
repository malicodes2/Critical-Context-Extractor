/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { PatientRepository } from '../../domain/interfaces/PatientRepository';
import { LLMClient } from '../../domain/interfaces/LLMClient';
import { ILogger } from '../../domain/interfaces/ILogger';
import { ExtractHiddenAllergiesUseCase } from '../../application/use-cases/ExtractHiddenAllergies/ExtractHiddenAllergiesUseCase';
import { FindUnaddressedFindingsUseCase } from '../../application/use-cases/FindUnaddressedFindings/FindUnaddressedFindingsUseCase';
import { DetectPatternAnomaliesUseCase } from '../../application/use-cases/DetectPatternAnomalies/DetectPatternAnomaliesUseCase';
import {
  CrossReferenceFamilyHistoryUseCase,
} from '../../application/use-cases/CrossReferenceFamilyHistory/CrossReferenceFamilyHistoryUseCase';
import { FlagContradictionsUseCase } from '../../application/use-cases/FlagContradictions/FlagContradictionsUseCase';
import {
  IdentifySpecialistRecommendationsUseCase,
} from '../../application/use-cases/IdentifySpecialistRecommendations/IdentifySpecialistRecommendationsUseCase';
import {
  GenerateCriticalContextBriefUseCase,
} from '../../application/use-cases/GenerateCriticalContextBrief/GenerateCriticalContextBriefUseCase';
import {
  DomainError
} from '../../shared/errors/DomainError';

export interface MCPServerConfig {
  name: string;
  version: string;
  port: number;
}

/**
 * MCPServer — presentation layer that registers all 7 tools with the MCP protocol.
 * Prompt Opinion injects the FHIR token via the Authorization header.
 */
export class MCPServer {
  private readonly _server: McpServer;

  constructor(
    _config: MCPServerConfig,
    private readonly _patientRepo: PatientRepository,
    private readonly _llmClient: LLMClient,
    private readonly _logger: ILogger
  ) {
    this._server = new McpServer({
      name: _config.name,
      version: _config.version,
    });

    this.registerTools();
  }

  private registerTools(): void {
    // Tool 1: Extract Hidden Allergies
    (this._server as any).tool(
      'extract_hidden_allergies',
      'Prevent anaphylaxis by finding allergic reactions in clinical notes missing from the official allergy list.',
      { patientId: z.string().uuid().describe('Patient UUID') },
      async (args: any, extra: any): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
        const fhirToken = this.extractFHIRToken(extra);
        try {
          const useCase = new ExtractHiddenAllergiesUseCase(
            this._patientRepo, this._llmClient, this._logger
          );
          const result = await useCase.execute({ patientId: args.patientId }, fhirToken);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return this.handleError(err);
        }
      }
    );

    // Tool 2: Find Unaddressed Findings
    (this._server as any).tool(
      'find_unaddressed_findings',
      'Catch missed diagnoses by identifying abnormal test results with no documented follow-up.',
      {
        patientId: z.string().uuid().describe('Patient UUID'),
        visitReason: z.string().optional().describe('Current visit reason for context'),
      },
      async (args: any, extra: any): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
        const fhirToken = this.extractFHIRToken(extra);
        try {
          const useCase = new FindUnaddressedFindingsUseCase(
            this._patientRepo, this._llmClient, this._logger
          );
          const result = await useCase.execute(
            { patientId: args.patientId, visitReason: args.visitReason },
            fhirToken
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return this.handleError(err);
        }
      }
    );

    // Tool 3: Detect Pattern Anomalies
    (this._server as any).tool(
      'detect_pattern_anomalies',
      'Find recurring symptom patterns in clinical notes that were never fully investigated.',
      {
        patientId: z.string().uuid().describe('Patient UUID'),
        minimumOccurrences: z.number().int().min(2).optional()
          .describe('Minimum times a symptom must appear (default: 3)'),
        timeWindowMonths: z.number().int().min(1).optional()
          .describe('Time window in months to analyze (default: 24)'),
      },
      async (args: any, extra: any): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
        const fhirToken = this.extractFHIRToken(extra);
        try {
          const useCase = new DetectPatternAnomaliesUseCase(
            this._patientRepo, this._llmClient, this._logger
          );
          const result = await useCase.execute({ patientId: args.patientId }, fhirToken);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return this.handleError(err);
        }
      }
    );

    // Tool 4: Cross-Reference Family History
    (this._server as any).tool(
      'cross_reference_family_history',
      'Identify genetic risks by correlating family history with current symptoms.',
      {
        patientId: z.string().uuid().describe('Patient UUID'),
        currentSymptoms: z.array(z.string()).optional()
          .describe('Current symptoms for targeted correlation'),
      },
      async (args: any, extra: any): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
        const fhirToken = this.extractFHIRToken(extra);
        try {
          const useCase = new CrossReferenceFamilyHistoryUseCase(
            this._patientRepo, this._llmClient, this._logger
          );
          const result = await useCase.execute(
            { patientId: args.patientId, currentSymptoms: args.currentSymptoms },
            fhirToken
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return this.handleError(err);
        }
      }
    );

    // Tool 5: Flag Contradictions
    (this._server as any).tool(
      'flag_contradictory_information',
      'Find contradictions in the patient record that could affect clinical decisions.',
      { patientId: z.string().uuid().describe('Patient UUID') },
      async (args: any, extra: any): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
        const fhirToken = this.extractFHIRToken(extra);
        try {
          const useCase = new FlagContradictionsUseCase(
            this._patientRepo, this._llmClient, this._logger
          );
          const result = await useCase.execute({ patientId: args.patientId }, fhirToken);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return this.handleError(err);
        }
      }
    );

    // Tool 6: Identify Specialist Recommendations
    (this._server as any).tool(
      'identify_specialist_recommendations',
      'Track specialist referrals and flag overdue follow-ups to ensure continuity of care.',
      {
        patientId: z.string().uuid().describe('Patient UUID'),
        specialtyFilter: z.array(z.string()).optional()
          .describe("Filter by specialty, e.g. ['cardiology', 'endocrinology']"),
      },
      async (args: any, extra: any): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
        const fhirToken = this.extractFHIRToken(extra);
        try {
          const useCase = new IdentifySpecialistRecommendationsUseCase(
            this._patientRepo, this._llmClient, this._logger
          );
          const result = await useCase.execute(
            { patientId: args.patientId, specialtyFilter: args.specialtyFilter },
            fhirToken
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return this.handleError(err);
        }
      }
    );

    // Tool 7: Generate Critical Context Brief
    (this._server as any).tool(
      'generate_critical_context_brief',
      'Synthesize all critical patient information into a prioritized pre-visit summary for the clinician.',
      {
        patientId: z.string().uuid().describe('Patient UUID'),
        visitReason: z.string().describe('Reason for today\'s visit — required for contextualization'),
      },
      async (args: any, extra: any): Promise<{ content: Array<{ type: 'text'; text: string }> }> => {
        const fhirToken = this.extractFHIRToken(extra);
        try {
          const useCase = new GenerateCriticalContextBriefUseCase(
            this._patientRepo, this._llmClient, this._logger
          );
          const result = await useCase.execute(
            { patientId: args.patientId, visitReason: args.visitReason },
            fhirToken
          );
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        } catch (err) {
          return this.handleError(err);
        }
      }
    );
  }

  private extractFHIRToken(extra: Record<string, unknown>): string | undefined {
    // Prompt Opinion injects the FHIR Bearer token via request metadata
    const meta = extra as { requestContext?: { fhirToken?: string } };
    return meta.requestContext?.fhirToken;
  }

  private handleError(err: unknown): { content: [{ type: 'text'; text: string }] } {
    if (err instanceof DomainError) {
      this._logger.warn('Domain error in tool call', { code: err.code, message: err.message });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: err.code, message: err.message }),
          },
        ],
      };
    }

    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    this._logger.error('Unexpected error in tool call', err instanceof Error ? err : undefined);
    return {
      content: [{ type: 'text', text: JSON.stringify({ error: 'INTERNAL_ERROR', message }) }],
    };
  }

  getMcpServer(): McpServer {
    return this._server;
  }

  getTransport(): StreamableHTTPServerTransport {
    return new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
  }
}
