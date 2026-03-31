import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ILogger } from '../../domain/interfaces/ILogger';

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * MCPToolRegistry — centralized registry for all MCP tool definitions.
 * Provides discoverability, introspection, and metadata management.
 */
export class MCPToolRegistry {
  private readonly _registry = new Map<string, ToolDefinition>();

  constructor(private readonly _logger: ILogger) {}

  register(tool: ToolDefinition, _server: McpServer): void {
    if (this._registry.has(tool.name)) {
      this._logger.warn('Tool already registered — skipping duplicate', {
        tool: tool.name,
      });
      return;
    }
    this._registry.set(tool.name, tool);
    this._logger.debug('Tool registered', { tool: tool.name });
  }

  getAll(): ToolDefinition[] {
    return Array.from(this._registry.values());
  }

  get(name: string): ToolDefinition | undefined {
    return this._registry.get(name);
  }

  has(name: string): boolean {
    return this._registry.has(name);
  }

  get size(): number {
    return this._registry.size;
  }

  /** Returns a manifest suitable for schema documentation */
  toManifest(): Record<string, unknown> {
    return {
      toolCount: this._registry.size,
      tools: this.getAll().map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  }
}
