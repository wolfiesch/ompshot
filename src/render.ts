import { formatBytes } from "./exec";
import type { IrisJsonSuccess, IrisParams, Theme, ToolExecutionResult } from "./types";

export function renderCall(
  args: IrisParams,
  _options: unknown,
  theme?: Theme
): unknown {
  let TextClass: { new (text: string, x: number, y: number): unknown } | undefined;
  try {
    const tuiModule = require("@oh-my-pi/pi-tui") as {
      Text?: { new (text: string, x: number, y: number): unknown };
    };
    TextClass = tuiModule.Text;
  } catch {}

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
    return TextClass ? new TextClass(raw, 0, 0) : raw;
  }

  const flagText = flags.length > 0 ? " " + theme.fg("muted", flags.join(" ")) : "";
  const label =
    theme.fg("toolTitle", theme.bold("iris ")) +
    theme.fg("accent", args.url || "") +
    flagText;

  if (TextClass) {
    return new TextClass(label, 0, 0);
  }
  return label;
}

export function renderResult(
  result: ToolExecutionResult,
  _options: unknown,
  theme?: Theme
): unknown {
  let TextClass: { new (text: string, x: number, y: number): unknown } | undefined;
  try {
    const tuiModule = require("@oh-my-pi/pi-tui") as {
      Text?: { new (text: string, x: number, y: number): unknown };
    };
    TextClass = tuiModule.Text;
  } catch {}

  if (result.isError) {
    const rawErr = result.content?.[0]?.text ?? "Iris capture failed";
    const errorText = theme ? theme.fg("error", rawErr) : rawErr;
    return TextClass ? new TextClass(errorText, 0, 0) : errorText;
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

  return TextClass ? new TextClass(summary, 0, 0) : summary;
}
