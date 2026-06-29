/**
 * Demo 5: repeat directive
 * Shows: list rendering — creates/removes DOM nodes for each array item.
 *
 * Run: npx tsx src/examples/05-repeat.ts
 */
import { JSDOM } from "jsdom";

const dom = new JSDOM(`<!DOCTYPE html><div id="app"></div>`);
(globalThis as any).document = dom.window.document;

import { observable, html, repeat } from "../index.js";

class Todo {
    @observable text: string;
    constructor(text: string) {
        this.text = text;
    }
}

class App {
    @observable todos: Todo[] = [];
}

const app = new App();
app.todos = [new Todo("Buy milk"), new Todo("Walk dog")];

const template = html<App>`
  <ul>${repeat(
    (x: App) => x.todos,
    html<Todo>`<li>${(x: Todo) => x.text}</li>`
  )}</ul>
`;

const view = template.render(app, document.getElementById("app")!);
const getHTML = () => document.getElementById("app")!.innerHTML.replace(/\s+/g, " ").trim();

// ===========================================
// Initial list
// ===========================================
console.log("=== Initial list ===");
console.log(getHTML());

// ===========================================
// Push — add item to end
// ===========================================
console.log('\n=== Push "Write code" ===');
app.todos.push(new Todo("Write code"));
console.log(getHTML());

// ===========================================
// Splice — remove first item
// ===========================================
console.log("\n=== Splice: remove index 0 ===");
app.todos.splice(0, 1);
console.log(getHTML());

// ===========================================
// Pop — remove last item
// ===========================================
console.log("\n=== Pop: remove last ===");
app.todos.pop();
console.log(getHTML());

// ===========================================
// Replace entire array
// ===========================================
console.log("\n=== Replace entire array ===");
app.todos = [new Todo("New item A"), new Todo("New item B")];
console.log(getHTML());
view.unbind();
app.todos = [new Todo("New item C"), new Todo("New item D")];
console.log("After unbind, should not update:", getHTML());
view.bind(app);
console.log("After rebind, should update:", getHTML());