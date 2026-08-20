import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import type {
  IrisJsonError,
  IrisJsonSuccess,
  IrisParams,
  ToolExecutionResult,
} from "./types";

const execFileAsync = promisify(execFile);

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeTypeForFormat(format: string): string {
  const norm = format.toLowerCase();
  if (norm === "webp") return "image/webp";
  if (norm === "jpg" || norm === "jpeg") return "image/jpeg";
  return "image/png";
}

export function resolveIrisBinary(
  customPath?: string,
  env: Record<string, string | undefined> = process.env
): string {
  if (customPath && customPath.trim().length > 0) {
    return customPath.trim();
  }

  const envPath = env.IRIS_PATH || env.IRIS_BIN;
  if (envPath && envPath.trim().length > 0) {
    return envPath.trim();
  }

  const candidates: string[] = [];
  if (env.CARGO_HOME) {
    candidates.push(path.join(env.CARGO_HOME, "bin", "iris"));
  } else {
    const home = env.HOME || os.homedir();
    candidates.push(path.join(home, ".cargo", "bin", "iris"));
  }

  for (const candidate of candidates) {
    try {
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    } catch {}
  }

  const pathEnv = env.PATH || "";
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, "iris");
    try {
      if (fsSync.existsSync(candidate)) {
        return candidate;
      }
    } catch {}
  }

  return "iris";
}

export function buildIrisArgs(params: IrisParams, targetPath: string): string[] {
  const args: string[] = [params.url, "-o", targetPath, "--json"];

  if (params.selector) {
    args.push("--selector", params.selector);
    if (params.padding !== undefined) {
      args.push("--padding", String(params.padding));
    }
  } else if (params.full) {
    args.push("--full");
  }

  if (params.size) {
    args.push("--size", params.size);
  }
  if (params.dark) {
    args.push("--dark");
  }
  if (params.format) {
    args.push("--format", params.format);
  }
  if (params.wait_ms && params.wait_ms > 0) {
    args.push("--wait", String(params.wait_ms));
  }
  if (params.wait_for) {
    args.push("--wait-for", params.wait_for);
  }
  if (params.scale !== undefined) {
    args.push("--scale", String(params.scale));
  }
  if (params.timeout !== undefined) {
    args.push("--timeout", String(params.timeout));
  }

  return args;
}

export async function executeIris(
  params: IrisParams,
  signal?: AbortSignal,
  customBinaryPath?: string
): Promise<ToolExecutionResult> {
  const binaryPath = resolveIrisBinary(customBinaryPath);
  const formatExt = params.format ?? "png";
  const isTempOutput = !params.out;
  const targetPath =
    params.out ??
    path.join(
      os.tmpdir(),
      `iris-${Date.now()}-${Math.random().toString(36).slice(2)}.${formatExt}`
    );

  const args = buildIrisArgs(params, targetPath);

  try {
    const { stdout, stderr } = await execFileAsync(binaryPath, args, {
      signal,
      maxBuffer: 20 * 1024 * 1024,
    });

    const outputText = stdout.trim() || stderr.trim();
    let report: IrisJsonSuccess | IrisJsonError | undefined;

    try {
      report = JSON.parse(outputText) as IrisJsonSuccess | IrisJsonError;
    } catch {
      const lines = outputText.split("\n").map((l) => l.trim()).filter(Boolean);
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          report = JSON.parse(lines[i]) as IrisJsonSuccess | IrisJsonError;
          break;
        } catch {}
      }
    }

    if (report && report.status === "error") {
      if (isTempOutput) {
        await fs.unlink(targetPath).catch(() => {});
      }
      return {
        content: [{ type: "text", text: `Iris capture failed: ${report.error}` }],
        details: report,
        isError: true,
      };
    }

    const successReport = report && report.status === "ok" ? report : undefined;
    const actualPath = successReport?.output ?? targetPath;
    const imageBuffer = await fs.readFile(actualPath);
    const base64Data = imageBuffer.toString("base64");

    const actualFormat = successReport?.format ?? formatExt;
    const mimeType = mimeTypeForFormat(actualFormat);

    if (isTempOutput) {
      await fs.unlink(actualPath).catch(() => {});
      if (actualPath !== targetPath) {
        await fs.unlink(targetPath).catch(() => {});
      }
    }

    const width = successReport?.css_width ?? "unknown";
    const height = successReport?.css_height ?? "unknown";
    const scale = successReport?.scale ?? 1.0;
    const bytes = successReport?.bytes ?? imageBuffer.length;
    const destination = params.out ? ` → ${actualPath}` : "";

    const summaryText = `✓ Captured ${width}×${height} CSS px @${scale}x as ${actualFormat} (${formatBytes(bytes)})${destination}`;

    return {
      content: [
        {
          type: "image",
          data: base64Data,
          mimeType,
        },
        {
          type: "text",
          text: summaryText,
        },
      ],
      details: successReport ?? {
        status: "ok",
        url: params.url,
        output: params.out ?? "(inline)",
        format: actualFormat,
        bytes,
      },
    };
  } catch (err: unknown) {
    if (isTempOutput) {
      await fs.unlink(targetPath).catch(() => {});
    }

    let rawMsg = "Unknown execution error";
    if (err && typeof err === "object") {
      if ("stdout" in err && typeof err.stdout === "string" && err.stdout.trim()) {
        rawMsg = err.stdout.trim();
      } else if ("stderr" in err && typeof err.stderr === "string" && err.stderr.trim()) {
        rawMsg = err.stderr.trim();
      } else if ("message" in err && typeof err.message === "string") {
        rawMsg = err.message;
      }
    }

    let errorMsg = rawMsg;
    try {
      const parsed = JSON.parse(rawMsg) as { error?: string };
      if (parsed && typeof parsed.error === "string") {
        errorMsg = parsed.error;
      }
    } catch {}

    return {
      content: [{ type: "text", text: `Iris capture failed: ${errorMsg}` }],
      details: { error: errorMsg },
      isError: true,
    };
  }
}
