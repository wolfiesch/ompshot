import { describe, expect, test } from "bun:test";
import { z } from "zod";
import ompshotExtension, {
  buildIrisArgs,
  formatBytes,
  mimeTypeForFormat,
  renderCall,
  renderResult,
} from "./src/index";
import type { ExtensionAPI, IrisParams, ToolDefinition, ToolExecutionResult } from "./src/types";

describe("buildIrisArgs", () => {
  test("constructs minimal args with output path and --json", () => {
    const args = buildIrisArgs({ url: "https://example.com" }, "/tmp/out.png");
    expect(args).toEqual(["https://example.com", "-o", "/tmp/out.png", "--json"]);
  });

  test("adds selector and padding flags", () => {
    const args = buildIrisArgs(
      { url: "https://example.com", selector: "#hero", padding: 16 },
      "/tmp/hero.png"
    );
    expect(args).toEqual([
      "https://example.com",
      "-o",
      "/tmp/hero.png",
      "--json",
      "--selector",
      "#hero",
      "--padding",
      "16",
    ]);
  });

  test("adds full page and dark mode flags", () => {
    const args = buildIrisArgs(
      { url: "https://example.com", full: true, dark: true },
      "/tmp/full.png"
    );
    expect(args).toEqual([
      "https://example.com",
      "-o",
      "/tmp/full.png",
      "--json",
      "--full",
      "--dark",
    ]);
  });

  test("adds size, format, scale, wait, wait-for, and timeout options", () => {
    const args = buildIrisArgs(
      {
        url: "localhost:3000",
        size: "iphone",
        format: "webp",
        scale: 3.0,
        wait_ms: 250,
        wait_for: "h1",
        timeout: 45,
      },
      "/tmp/mobile.webp"
    );
    expect(args).toEqual([
      "localhost:3000",
      "-o",
      "/tmp/mobile.webp",
      "--json",
      "--size",
      "iphone",
      "--format",
      "webp",
      "--wait",
      "250",
      "--wait-for",
      "h1",
      "--scale",
      "3",
      "--timeout",
      "45",
    ]);
  });
});

describe("helpers", () => {
  test("formats byte sizes accurately", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(15 * 1024 * 1024)).toBe("15.0 MB");
  });

  test("resolves correct MIME types for formats", () => {
    expect(mimeTypeForFormat("png")).toBe("image/png");
    expect(mimeTypeForFormat("PNG")).toBe("image/png");
    expect(mimeTypeForFormat("jpg")).toBe("image/jpeg");
    expect(mimeTypeForFormat("jpeg")).toBe("image/jpeg");
    expect(mimeTypeForFormat("webp")).toBe("image/webp");
  });

  test("resolves iris binary path with custom override and env fallbacks", () => {
    const { resolveIrisBinary } = require("./src/index");

    // 1. Explicit argument override
    expect(resolveIrisBinary("/custom/bin/iris")).toBe("/custom/bin/iris");

    // 2. IRIS_PATH env override
    expect(
      resolveIrisBinary(undefined, { IRIS_PATH: "/opt/iris/bin/iris" })
    ).toBe("/opt/iris/bin/iris");

    // 3. IRIS_BIN env override
    expect(
      resolveIrisBinary(undefined, { IRIS_BIN: "/usr/local/bin/iris" })
    ).toBe("/usr/local/bin/iris");

    // 4. Fallback to command name 'iris' when non-existent custom CARGO_HOME / empty PATH is provided
    expect(
      resolveIrisBinary(undefined, {
        CARGO_HOME: "/nonexistent/cargo",
        PATH: "/empty",
      })
    ).toBe("iris");
  });
});

describe("tool registration", () => {
  test("registers iris tool with OMP zod schema", () => {
    let registeredTool: ToolDefinition | null = null;
    const mockPi: ExtensionAPI = {
      zod: { z },
      registerTool: (t) => {
        registeredTool = t;
      },
    };

    ompshotExtension(mockPi);
    expect(registeredTool).not.toBeNull();
    expect(registeredTool!.name).toBe("iris");
    expect(registeredTool!.label).toBe("Iris Screenshot");
  });

  test("registers iris tool with TypeBox adapter when zod is absent", () => {
    let registeredTool: ToolDefinition | null = null;
    const mockPi: ExtensionAPI = {
      registerTool: (t) => {
        registeredTool = t;
      },
    };

    ompshotExtension(mockPi);
    expect(registeredTool).not.toBeNull();
    expect(registeredTool!.name).toBe("iris");
    expect(registeredTool!.parameters).toBeDefined();
  });
});

describe("rendering", () => {
  const mockTheme = {
    fg: (name: string, text: string) => `[${name}]${text}[/${name}]`,
    bold: (text: string) => `<b>${text}</b>`,
  };

  test("renders call with url and flags", () => {
    const params: IrisParams = {
      url: "https://example.com",
      selector: "#main",
      dark: true,
    };
    const rendered = String(renderCall(params, {}, mockTheme));
    expect(rendered).toContain("iris");
    expect(rendered).toContain("https://example.com");
    expect(rendered).toContain("--selector \"#main\"");
    expect(rendered).toContain("--dark");
  });

  test("renders successful capture result", () => {
    const result: ToolExecutionResult = {
      content: [{ type: "image" }, { type: "text", text: "Captured" }],
      details: {
        status: "ok",
        url: "https://example.com",
        output: "/tmp/shot.png",
        mode: "element",
        css_width: 800,
        css_height: 600,
        scale: 2.0,
        format: "png",
        bytes: 10240,
      },
    };
    const rendered = String(renderResult(result, {}, mockTheme));
    expect(rendered).toContain("800×600");
    expect(rendered).toContain("@2x");
    expect(rendered).toContain("10.0 KB");
    expect(rendered).toContain("/tmp/shot.png");
  });

  test("renders error result", () => {
    const result: ToolExecutionResult = {
      content: [{ type: "text", text: "Iris capture failed: timeout" }],
      isError: true,
    };
    const rendered = String(renderResult(result, {}, mockTheme));
    expect(rendered).toContain("Iris capture failed: timeout");
  });
});
