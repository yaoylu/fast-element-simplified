/**
 * Demo 3: Template Binding
 * Shows: html tagged template auto-updates DOM when @observable changes.
 *
 * Run: npx tsx src/examples/03-template.ts
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!DOCTYPE html><div id="app"></div>`);
(globalThis as any).document = dom.window.document;

import { observable, html } from "../index.js";

class Counter {
    @observable count: number = 0;
    @observable label: string = "Count";
}

const counter = new Counter();

// ===========================================
// Basic template binding
// ===========================================
console.log("=== Template Binding ===");

const template = html<Counter>`<p>${x => x.label}: ${x => x.count}</p>`;
const view = template.render(counter, document.getElementById("app")!);

console.log("Initial:", document.getElementById("app")!.innerHTML);

// ===========================================
// Auto-update on property change
// ===========================================
console.log("\n=== Auto-Update ===");

counter.count = 1;
console.log("count = 1:", document.getElementById("app")!.innerHTML);

counter.count = 42;
console.log("count = 42:", document.getElementById("app")!.innerHTML);

counter.label = "Score";
console.log('label = "Score":', document.getElementById("app")!.innerHTML);

// ===========================================
// Multiple changes
// ===========================================
console.log("\n=== Multiple Changes ===");

counter.count = 100;
counter.label = "Total";
console.log("After both:", document.getElementById("app")!.innerHTML);

// ===========================================
// Unbind — stop reactive updates
// ===========================================
console.log("\n=== Unbind ===");

view.unbind();
counter.count = 999;
console.log("After unbind, count = 999:", document.getElementById("app")!.innerHTML);
console.log("(still shows 100 = correct, no longer updating)");
