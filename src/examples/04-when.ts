/**
 * Demo 4: when directive
 * Shows: conditional rendering — inserts/removes DOM based on observable condition.
 *
 * Run: npx tsx src/examples/04-when.ts
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!DOCTYPE html><div id="app"></div>`);
(globalThis as any).document = dom.window.document;

import { observable, html, when } from "../index.js";

class App {
    @observable name: string = "Alice";
    @observable isAdmin: boolean = false;
}

const app = new App();

const template = html<App>`
  <p>Hello ${(x: App) => x.name}</p>
  ${when((x: App) => x.isAdmin, html<App>`<button>Delete</button>`)}
`;

const view = template.render(app, document.getElementById("app")!);
const getHTML = () => document.getElementById("app")!.innerHTML.replace(/\s+/g, " ").trim();

// ===========================================
// Initial state — isAdmin = false
// ===========================================
console.log("=== Initial (isAdmin=false) ===");
console.log(getHTML());
// button NOT in DOM

// ===========================================
// Show button when isAdmin = true
// ===========================================
console.log("\n=== Set isAdmin = true ===");
app.isAdmin = true;
console.log(getHTML());
// button IN DOM

// ===========================================
// Hide button when isAdmin = false again
// ===========================================
console.log("\n=== Set isAdmin = false ===");
app.isAdmin = false;
console.log(getHTML());
// button REMOVED

// ===========================================
// Text binding still works independently
// ===========================================
console.log("\n=== name change still works ===");
app.name = "Bob";
console.log(getHTML());

// ===========================================
// Both conditions toggling
// ===========================================
console.log("\n=== Toggle isAdmin + change name ===");
app.isAdmin = true;
app.name = "Carol";
console.log(getHTML());
