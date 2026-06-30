/**
 * Demo 6: FASTElement — full Web Component
 * Shows: @customElement, @attr, @observable, css, template, $emit.
 *
 * This runs in a real browser via 06-component.html
 */
import {
    FASTElement,
    customElement,
    attr,
    observable,
    numberConverter,
    html,
    css,
    when,
} from "../index.js";

// ===========================================
// Define a counter component
// ===========================================

const counterTemplate = html`
  <span>${(x: any) => x.label}: ${(x: any) => x.count}</span>
  ${when(
    (x: any) => x.count > 0,
    html`<span class="positive"> (positive)</span>`
  )}
`;

const counterStyles = css`
  :host {
    display: inline-block;
    padding: 8px 16px;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-family: sans-serif;
  }
  .positive { color: green; font-weight: bold; }
`;

@customElement({ name: "my-counter", template: counterTemplate, styles: counterStyles })
class MyCounter extends FASTElement {
    @attr({ converter: numberConverter }) count: number = 0;
    @observable label: string = "Count";

    increment() { this.count++; }
    decrement() { this.count--; }
}

// ===========================================
// Tests
// ===========================================

const counter = document.querySelector("my-counter") as InstanceType<typeof MyCounter>;

console.log("=== 1. Initial render ===");
console.log("  count =", counter.count, "attr =", counter.getAttribute("count"));
console.log("  shadowRoot:", counter.shadowRoot?.innerHTML);

console.log("\n=== 2. Property → Attribute ===");
counter.count = 5;
console.log("  count =", counter.count, "attr =", counter.getAttribute("count"));
console.log("  shadowRoot:", counter.shadowRoot?.innerHTML);

console.log("\n=== 3. Attribute → Property ===");
counter.setAttribute("count", "10");
console.log("  count =", counter.count, "attr =", counter.getAttribute("count"));

console.log("\n=== 4. @observable label change ===");
counter.label = "Score";
console.log("  shadowRoot:", counter.shadowRoot?.innerHTML);

console.log("\n=== 5. Conditional: count = 0 ===");
counter.count = 0;
console.log("  count=0:", counter.shadowRoot?.innerHTML);
counter.count = 1;
console.log("  count=1:", counter.shadowRoot?.innerHTML);

console.log("\n=== 6. $emit ===");
let received: any = null;
counter.addEventListener("count-changed", ((e: CustomEvent) => {
    received = e.detail;
}) as EventListener);
counter.$emit("count-changed", { count: counter.count });
console.log("  Event detail:", received);

console.log("\n=== All tests complete ===");
