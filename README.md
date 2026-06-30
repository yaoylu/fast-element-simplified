# fast-element-simplified

Simplified [FAST Element](https://github.com/nicknisi/coreux-components/tree/main/packages/fast-element) implementation for learning. Builds up the core concepts from scratch — observable properties, dependency tracking, templating, directives, and custom elements.

## What's included

| File | Concept | What it teaches |
|------|---------|-----------------|
| `notifier.ts` | Subscriber/Notifier | Pub-sub pattern, per-property subscriptions, optimized SubscriberSet (1-2 fast path, array spillover) |
| `observable.ts` | @observable + ExpressionWatcher | Getter/setter interception, change callbacks, automatic dependency tracking via linked list |
| `template.ts` | html\`\`, View, css\`\` | Tagged template parsing, comment markers, text bindings with auto-update |
| `template.ts` | when() | Conditional rendering, anchor-node pattern, sub-view lifecycle |
| `template.ts` | repeat() | List rendering, array mutation patching (push/splice/pop), incremental DOM updates |
| `fast-element.ts` | FASTElement, @customElement, @attr | Web Component lifecycle, Shadow DOM, attribute ↔ property sync, value converters |

## Examples

Each example demonstrates one layer of the system:

| # | Example | Run |
|---|---------|-----|
| 01 | @observable + change callbacks | `npx tsx src/examples/01-observable.ts` |
| 02 | ExpressionWatcher + dependency tracking | `npx tsx src/examples/02-watcher.ts` |
| 03 | html\`\` template + text bindings | `npx tsx src/examples/03-template.ts` |
| 04 | when() conditional rendering | `npx tsx src/examples/04-when.ts` |
| 05 | repeat() list rendering | `npx tsx src/examples/05-repeat.ts` |
| 06 | FASTElement custom component | `npm run dev` → open http://localhost:3000/src/examples/06-component.html |

Examples 01-05 run in Node.js via JSDOM. Example 06 runs in a real browser (custom elements require a browser environment).

## Getting started

```bash
npm install
npm run dev        # starts dev server with on-the-fly TS transpilation
```

Open http://localhost:3000/src/examples/06-component.html in your browser.

## How it maps to real FAST

| This repo | Real FAST Element | Simplification |
|-----------|-------------------|----------------|
| `SubscriberSet` | `SubscriberSet` | Same 2-field + spillover optimization |
| `PropertyChangeNotifier` | `PropertyChangeNotifier` | Same per-property routing |
| `ExpressionWatcher` | `ExpressionNotifier` | Same linked-list dependency tracking, no update queue batching |
| `html` tag | `html` tag + `Compiler` | Direct comment-marker parsing, no compile cache |
| `when()` | `when()` directive | No else clause |
| `repeat()` | `repeat()` directive | No view recycling, no splice diffing, no positioning |
| `FASTElement` | `FASTElement` + `ElementController` | No controller separation, no pre-upgrade capture, no async update queue |
| `@attr` | `@attr` + `AttributeDefinition` | Same converter/mode pattern, no queued reflection |
| `css` | `css` + `ElementStyles` | Plain string, no CSSBindingDirective or adoptedStyleSheets |

## License

MIT
