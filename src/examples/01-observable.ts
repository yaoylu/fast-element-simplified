/**
 * Demo 1: Basic @observable
 * Shows: getter/setter interception, change callbacks, subscriber pattern.
 *
 * Run: npx tsx src/examples/01-observable.ts
 */
import { observable, Observable } from "../index.js";

class Person {
    @observable name: string = "John";
    @observable age: number = 0;

    nameChanged(oldVal: string, newVal: string) {
        console.log(`nameChanged callback: "${oldVal}" → "${newVal}"`);
    }

    ageChanged(oldVal: number, newVal: number) {
        console.log(`ageChanged callback: ${oldVal} → ${newVal}`);
    }
}

const p = new Person();

// --- Change Callbacks ---
console.log("=== Change Callbacks ===");
p.name = "Jane";
p.age = 25;

// --- Subscriber pattern ---
console.log("\n=== Subscribers ===");
const notifier = Observable.getNotifier(p);

notifier.subscribe(
    { handleChange(subject, prop) { console.log(`  subscriber A: "${prop}" changed`); } },
    "name"
);

notifier.subscribe(
    { handleChange(subject, prop) { console.log(`  subscriber B: "${prop}" changed (watches all)`); } }
);

console.log("Setting name to 'Alice':");
p.name = "Alice";

console.log("\nSetting age to 30:");
p.age = 30;

// --- No-op on same value ---
console.log("\n=== No-op on same value ===");
console.log("Setting name to 'Alice' again (should be silent):");
p.name = "Alice";
console.log("(nothing printed = correct)");
