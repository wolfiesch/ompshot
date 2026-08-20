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
  test("registers iris tool and calls 1-arg setLabel with OMP zod schema", () => {
    let registeredTool: ToolDefinition | null = null;
    let extensionLabel = "";
    const mockPi: ExtensionAPI = {
      zod: { z },
      registerTool: (t) => {
        registeredTool = t;
      },
      setLabel: (label: string) => {
        extensionLabel = label;
      },
    };

    ompshotExtension(mockPi);
    expect(registeredTool).not.toBeNull();
    expect(registeredTool!.name).toBe("iris");
    expect(registeredTool!.label).toBe("Iris Screenshot");
    expect(extensionLabel).toBe("Iris Screenshot");
  });

  test("registers iris tool with TypeBox adapter without calling 1-arg setLabel in vanilla Pi", () => {
    let registeredTool: ToolDefinition | null = null;
    let setLabelCalled = false;
    const mockVanillaPi: ExtensionAPI = {
      registerTool: (t) => {
        registeredTool = t;
      },
      setLabel: (_entryId: string, _label: string) => {
        setLabelCalled = true;
      },
    };

    ompshotExtension(mockVanillaPi);
    expect(registeredTool).not.toBeNull();
    expect(registeredTool!.name).toBe("iris");
    expect(registeredTool!.parameters).toBeDefined();
    expect(setLabelCalled).toBe(false);
  });
});

describe("rendering", () => {
  const mockTheme = {
    fg: (name: string, text: string) => `[${name}]${text}[/${name}]`,
    bold: (text: string) => `<b>${text}</b>`,
  };

  test("renders call under OMP signature (args, options, theme)", () => {
    const params: IrisParams = {
      url: "https://example.com",
      selector: "#main",
      dark: true,
    };
    const component = renderCall(params, {}, mockTheme) as { render(): string[] };
    expect(component).toHaveProperty("render");
    const lines = component.render();
    const joined = lines.join("\n");
    expect(joined).toContain("iris");
    expect(joined).toContain("https://example.com");
    expect(joined).toContain("--selector \"#main\"");
    expect(joined).toContain("--dark");
  });

  test("renders call under vanilla Pi signature (args, theme, context)", () => {
    const params: IrisParams = {
      url: "https://example.com",
      selector: "#hero",
      padding: 12,
    };
    const component = renderCall(params, mockTheme, { cwd: "/tmp" }) as { render(): string[]; invalidate(): void };
    expect(component).toHaveProperty("render");
    expect(component).toHaveProperty("invalidate");
    const joined = component.render().join("\n");
    expect(joined).toContain("iris");
    expect(joined).toContain("https://example.com");
    expect(joined).toContain("--selector \"#hero\"");
    expect(joined).toContain("--padding 12");
  });

  test("renders successful capture result under OMP and vanilla Pi signatures", () => {
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

    // OMP signature (result, options, theme)
    const ompComp = renderResult(result, {}, mockTheme) as { render(): string[] };
    const ompJoined = ompComp.render().join("\n");
    expect(ompJoined).toContain("800×600");
    expect(ompJoined).toContain("@2x");
    expect(ompJoined).toContain("10.0 KB");
    expect(ompJoined).toContain("/tmp/shot.png");

    // Vanilla Pi signature (result, theme, context)
    const piComp = renderResult(result, mockTheme, {}) as { render(): string[] };
    const piJoined = piComp.render().join("\n");
    expect(piJoined).toContain("800×600");
    expect(piJoined).toContain("@2x");
  });

  test("renders error result as valid component", () => {
    const result: ToolExecutionResult = {
      content: [{ type: "text", text: "Iris capture failed: timeout" }],
      isError: true,
    };
    const component = renderResult(result, mockTheme, {}) as { render(): string[] };
    const joined = component.render().join("\n");
    expect(joined).toContain("Iris capture failed: timeout");
  });
});
