export interface IrisParams {
  url: string;
  selector?: string;
  padding?: number;
  full?: boolean;
  size?: string;
  dark?: boolean;
  format?: "png" | "jpg" | "jpeg" | "webp";
  out?: string;
  wait_ms?: number;
  wait_for?: string;
  scale?: number;
  timeout?: number;
}

export interface IrisJsonSuccess {
  status: "ok";
  url: string;
  output: string;
  mode: string;
  selector?: string;
  padding?: number;
  css_width: number;
  css_height: number;
  scale: number;
  format: string;
  bytes: number;
}

export interface IrisJsonError {
  status: "error";
  url: string;
  output?: string;
  mode?: string;
  selector?: string;
  padding?: number;
  error: string;
}

export interface ToolContentBlock {
  type: "text" | "image";
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface ToolExecutionResult {
  content: ToolContentBlock[];
  details?: unknown;
  isError?: boolean;
}

export interface Theme {
  fg(name: string, text: string): string;
  bold(text: string): string;
}

export interface SchemaNode {
  optional(): SchemaNode;
  describe(description: string): SchemaNode;
  min(minimum: number): SchemaNode;
  max(maximum: number): SchemaNode;
  int(): SchemaNode;
}

export interface SchemaBuilder {
  string(): SchemaNode;
  number(): SchemaNode;
  boolean(): SchemaNode;
  enum(values: readonly string[]): SchemaNode;
  object(shape: Record<string, SchemaNode>): SchemaNode;
}

export interface ToolDefinition {
  name: string;
  label?: string;
  description: string;
  parameters: unknown;
  execute(
    toolCallId: string,
    params: IrisParams,
    signal?: AbortSignal,
    onUpdate?: unknown,
    ctx?: unknown
  ): Promise<ToolExecutionResult>;
  renderCall?(args: IrisParams, options?: unknown, theme?: Theme): unknown;
  renderResult?(result: ToolExecutionResult, options?: unknown, theme?: Theme): unknown;
}

export interface ExtensionAPI {
  zod?:
    | {
        z: unknown;
      }
    | unknown;
  registerTool(tool: ToolDefinition): void;
  setLabel?(labelOrEntryId: string, label?: string): void;
}
