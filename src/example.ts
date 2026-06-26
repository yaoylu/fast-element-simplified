import { observable, Observable } from "./index.js";

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

// --- Demo 1: propertyChanged callbacks ---
console.log("=== Demo 1: Change Callbacks ===");
p.name = "Jane";
p.age = 25;

// --- Demo 2: Subscriber pattern ---
console.log("\n=== Demo 2: Subscribers ===");
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

// --- Demo 3: No notification if value unchanged ---
console.log("\n=== Demo 3: No-op on same value ===");
console.log("Setting name to 'Alice' again (should be silent):");
p.name = "Alice";
console.log("(nothing printed = correct)");
