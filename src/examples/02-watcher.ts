/**
 * Demo 2: Watcher (dependency tracking)
 * Shows: auto dependency collection, selective re-evaluation, dispose.
 *
 * Run: npx tsx src/examples/02-watcher.ts
 */
import { observable, Observable } from "../index.js";
import type { Subscriber } from "../index.js";

class Person {
    @observable firstName: string = "John";
    @observable lastName: string = "Doe";
    @observable age: number = 25;
}

const p = new Person();

// ===========================================
// Auto dependency tracking
// ===========================================
console.log("=== Auto Dependency Tracking ===");

const fullNameWatcher = Observable.binding(
    (x: Person) => x.firstName + " " + x.lastName
);

const subscriber: Subscriber = {
    handleChange() {
        const value = fullNameWatcher.observe(p);
        console.log(`  fullName updated: "${value}"`);
    },
};
fullNameWatcher.subscribe(subscriber);

const initialValue = fullNameWatcher.observe(p);
console.log(`Initial fullName: "${initialValue}"`);

console.log('Setting firstName = "Jane":');
p.firstName = "Jane";

console.log('Setting lastName = "Smith":');
p.lastName = "Smith";

console.log("Setting age = 30 (should be silent — not a dependency):");
p.age = 30;
console.log("(nothing printed = correct)");

// ===========================================
// Multiple watchers on same object
// ===========================================
console.log("\n=== Multiple Watchers ===");

const ageWatcher = Observable.binding((x: Person) => `Age: ${x.age}`);
const ageSubscriber: Subscriber = {
    handleChange() {
        const value = ageWatcher.observe(p);
        console.log(`  ageWatcher updated: "${value}"`);
    },
};
ageWatcher.subscribe(ageSubscriber);
console.log(`Initial age display: "${ageWatcher.observe(p)}"`);

console.log("Setting age = 35 (only ageWatcher fires):");
p.age = 35;

console.log('Setting firstName = "Bob" (only fullNameWatcher fires):');
p.firstName = "Bob";

// ===========================================
// Dispose — stop watching
// ===========================================
console.log("\n=== Dispose ===");

fullNameWatcher.dispose();
console.log("fullNameWatcher disposed.");

console.log('Setting firstName = "Alice" (fullNameWatcher should NOT fire):');
p.firstName = "Alice";
console.log("(only ageWatcher is silent too — correct)");

ageWatcher.dispose();
console.log("ageWatcher disposed.");
