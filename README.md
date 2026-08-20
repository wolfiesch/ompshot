# ompshot

Typed tools for [Pi](https://github.com/badlogic/pi) and [Oh My Pi](https://omp.sh) coding agents to capture live websites and UI elements with [Iris](https://github.com/brijr/iris).

Iris runs headless Chrome with smart waiting for web fonts, near-viewport images, finite CSS animations, and lazy-loaded content. `ompshot` bridges Iris into Pi and Oh My Pi as a native agent tool returning inline image content blocks directly into the agent context.

## Install

### Oh My Pi (OMP)

```sh
omp install github:wolfiesch/ompshot
```

### Pi (`@mariozechner/pi`)

Clone or add to your Pi extensions directory (`~/.pi/agent/extensions/` or project `.pi/extensions/`):

```sh
git clone https://github.com/wolfiesch/ompshot.git
cd ompshot && bun install
ln -s "$PWD/src/index.ts" ~/.pi/agent/extensions/iris.ts
```

### Requirements

1. An installed Chrome-family browser (Google Chrome, Chromium, Edge, or Brave).
2. The `iris` CLI binary on your `PATH` or at `~/.cargo/bin/iris`:

```sh
cargo install iris-screenshot
```

## Tool

### `iris`

Capture high-fidelity screenshots of live websites or specific CSS selector elements.

| Parameter | Type | Description |
| --- | --- | --- |
| `url` | string | URL or host to capture (e.g. `localhost:3000`, `example.com`, `https://...`) |
| `selector` | string | CSS selector to tightly capture the first matching element |
| `padding` | number | Uniform CSS-pixel padding around the selected element |
| `full` | boolean | Capture the full page height with lazy-load step-scrolling |
| `size` | string | Viewport: `WxH` or preset: `desktop` (1440x900@2x), `iphone` (390x844@3x), `ipad` (1024x1366@2x) |
| `dark` | boolean | Emulate `prefers-color-scheme: dark` |
| `format` | string | Output format: `png`, `jpg`, `jpeg`, `webp` (default: `png`) |
| `out` | string | Optional file destination. When omitted, returns the image inline |
| `wait_ms` | number | Extra settle delay in milliseconds after smart waiting |
| `wait_for` | string | Wait until a CSS selector exists in the DOM before capturing |
| `scale` | number | Device scale factor overriding the preset (e.g. 1.0, 2.0, 3.0) |
| `timeout` | number | Per-page capture timeout in seconds (default: 30) |

## Example Prompts

```text
Take a screenshot of localhost:3000 to verify the landing page layout.

Capture the #pricing card on example.com with 16px padding.

Capture the full page of https://news.ycombinator.com in dark mode.

Check how this page looks on mobile: iris https://stripe.com with size iphone.
```

## Development

```sh
bun install
bun run check
bun test
```

## License

[MIT](LICENSE)
