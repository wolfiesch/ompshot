import { formatBytes } from "./exec";
import type { IrisJsonSuccess, IrisParams, Theme, ToolExecutionResult } from "./types";

export class FallbackTextComponent {
  constructor(public text: string) {}

  render(): string[] {
    return [this.text];
  }

  invalidate(): void {}
}

export function extractTheme(arg2: unknown, arg3?: unknown): Theme | undefined {
  if (arg2 && typeof arg2 === "object" && "fg" in arg2 && typeof (arg2 as Record<string, unknown>).fg === "function") {
    return arg2 as Theme;
  }
  if (arg3 && typeof arg3 === "object" && "fg" in arg3 && typeof (arg3 as Record<string, unknown>).fg === "function") {
    return arg3 as Theme;
  }
  return undefined;
}

export function createTextComponent(text: string): unknown {
  try {
    const ompTui = require("@oh-my-pi/pi-tui") as {
      Text?: { new (text: string, x: number, y: number): unknown };
    };
    if (ompTui?.Text) {
      return new ompTui.Text(text, 0, 0);
    }
  } catch {}

  try {
    const piTui = require("@mariozechner/pi-tui") as {
      Text?: { new (text: string, x: number, y: number): unknown };
    };
    if (piTui?.Text) {
      return new piTui.Text(text, 0, 0);
    }
  } catch {}

  return new FallbackTextComponent(text);
}

export function renderCall(
  args: IrisParams,
  arg2: unknown,
  arg3?: unknown
): unknown {
  const theme = extractTheme(arg2, arg3);

  const flags: string[] = [];
  if (args.selector) flags.push(`--selector "${args.selector}"`);
  if (args.padding !== undefined) flags.push(`--padding ${args.padding}`);
  if (args.full) flags.push("--full");
  if (args.dark) flags.push("--dark");
  if (args.size) flags.push(`--size ${args.size}`);
  if (args.format) flags.push(`--format ${args.format}`);
  if (args.out) flags.push(`-o ${args.out}`);

  if (!theme) {
    const flagText = flags.length > 0 ? " " + flags.join(" ") : "";
    const raw = `iris ${args.url || ""}${flagText}`;
    return createTextComponent(raw);
  }

  const flagText = flags.length > 0 ? " " + theme.fg("muted", flags.join(" ")) : "";
  const label =
    theme.fg("toolTitle", theme.bold("iris ")) +
    theme.fg("accent", args.url || "") +
    flagText;

  return createTextComponent(label);
}

export function renderResult(
  result: ToolExecutionResult,
  arg2: unknown,
  arg3?: unknown
): unknown {
  const theme = extractTheme(arg2, arg3);

  if (result.isError) {
    const rawErr = result.content?.[0]?.text ?? "Iris capture failed";
    const errorText = theme ? theme.fg("error", rawErr) : rawErr;
    return createTextComponent(errorText);
  }

  const details = result.details as IrisJsonSuccess | undefined;
  let summary: string;
  if (details && details.css_width) {
    const dest = details.output ? ` → ${details.output}` : "";
    const formatted = `✓ ${details.url} — ${details.css_width}×${details.css_height} @${details.scale}x (${details.format}, ${formatBytes(details.bytes)})${dest}`;
    summary = theme ? theme.fg("success", formatted) : formatted;
  } else {
    const textBlock = result.content?.find((c) => c.type === "text");
    const rawText = textBlock?.text ?? "✓ Captured image";
    summary = theme ? theme.fg("success", rawText) : rawText;
  }

  return createTextComponent(summary);
}
