import { executeIris } from "./exec";
import { renderCall, renderResult } from "./render";
import { createTypeBoxAdapter } from "./schema";
import type { ExtensionAPI, SchemaBuilder, ToolDefinition } from "./types";

export { buildIrisArgs, executeIris, formatBytes, mimeTypeForFormat, resolveIrisBinary } from "./exec";
export { renderCall, renderResult } from "./render";
export { createTypeBoxAdapter } from "./schema";
export type * from "./types";

function resolveSchemaBuilder(pi: ExtensionAPI): SchemaBuilder {
  if (pi.zod && typeof pi.zod === "object") {
    if ("z" in pi.zod && pi.zod.z && typeof pi.zod.z === "object") {
      return pi.zod.z as unknown as SchemaBuilder;
    }
    return pi.zod as unknown as SchemaBuilder;
  }
  return createTypeBoxAdapter();
}

export default function ompshotExtension(pi: ExtensionAPI): void {
  const z = resolveSchemaBuilder(pi);

  // Only set the extension-level display label when running in OMP (which supports the 1-arg overload)
  if (Boolean(pi.zod) && typeof pi.setLabel === "function") {
    pi.setLabel("Iris Screenshot");
  }

  const toolDefinition: ToolDefinition = {
    name: "iris",
    label: "Iris Screenshot",
    description:
      "Capture high-fidelity screenshots of live websites or specific CSS selector elements using headless Chrome. Features intelligent settling (fonts, images, finite animations, lazy loading), retina @2x scaling, element clipping with padding, and dark mode emulation. Returns the image inline into context and optionally writes to disk.",
    parameters: z.object({
      url: z
        .string()
        .describe("URL or host to capture (e.g. localhost:3000, example.com, https://...)"),
      selector: z
        .string()
        .optional()
        .describe(
          "CSS selector to tightly capture the first matching element (conflicts with full)"
        ),
      padding: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Uniform CSS-pixel padding around the selected element"),
      full: z
        .boolean()
        .optional()
        .describe(
          "Capture the full page height with lazy-load step-scrolling (conflicts with selector)"
        ),
      size: z
        .string()
        .optional()
        .describe(
          "Viewport: WxH (e.g. 1440x900) or preset: desktop (1440x900@2x), iphone (390x844@3x), ipad (1024x1366@2x)"
        ),
      dark: z
        .boolean()
        .optional()
        .describe("Emulate prefers-color-scheme: dark"),
      format: z
        .enum(["png", "jpg", "jpeg", "webp"] as const)
        .optional()
        .describe("Image format (default: png)"),
      out: z
        .string()
        .optional()
        .describe(
          "Optional output file path. When omitted, writes to temporary storage and returns the image inline"
        ),
      wait_ms: z
        .number()
        .int()
        .min(0)
        .optional()
        .describe("Extra settle delay in milliseconds after smart waiting"),
      wait_for: z
        .string()
        .optional()
        .describe("Wait until this CSS selector exists in DOM before capturing"),
      scale: z
        .number()
        .min(0.1)
        .optional()
        .describe("Device scale factor overriding the preset (e.g. 1.0, 2.0, 3.0)"),
      timeout: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe("Per-page capture timeout in seconds (default: 30)"),
    }),

    async execute(_id, params, signal) {
      return executeIris(params, signal);
    },

    renderCall(args, options, theme) {
      return renderCall(args, options, theme);
    },

    renderResult(result, options, theme) {
      return renderResult(result, options, theme);
    },
  };

  pi.registerTool(toolDefinition);
}
