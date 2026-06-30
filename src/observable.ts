/**
 * Simplified version of FAST's observable system.
 *
 * Core concepts:
 *   @observable name = "John"
 *   → turns name into a getter/setter pair
 *   → actual value stored in _name (backing field)
 *   → setter triggers change notification → template auto-updates
 *
 * Two layers:
 *   1. @observable + Accessor  → property-level getter/setter interception
 *   2. ExpressionWatcher       → expression-level automatic dependency tracking
 */

import { PropertyChangeNotifier, SubscriberSet } from "./notifier.js";
import type { Notifier, Subscriber } from "./notifier.js";

// Accessor: describes how to read/write an observable property
export interface Accessor {
    name: string;
    getValue(source: any): any;
    setValue(source: any, value: any): void;
}

// Expression: a function that reads from a data source, e.g. (x) => x.firstName + " " + x.lastName
export type Expression<TSource = any, TReturn = any> = (source: TSource) => TReturn;

// Linked list node for dependency tracking — records "I'm watching property X on object Y"
interface SubscriptionRecord {
    propertySource: any;              // the object being watched
    propertyName: string;             // the property name being watched
    notifier: Notifier;               // that object's notifier
    next: SubscriptionRecord | undefined; // next node in the linked list
}

// Global registries
const notifierLookup = new WeakMap<any, Notifier>(); // object → notifier
const accessorLookup = new WeakMap<any, Accessor[]>(); // prototype → accessor list

// The watcher currently collecting dependencies.
// Set by observe() before running the expression; checked by getters during execution.
let watcher: ExpressionWatcher | undefined = undefined;

function isFunction(value: any): value is Function {
    return typeof value === "function";
}

// Get the notifier for an object (lazily created)
function getNotifier(source: any): Notifier {
    let found = notifierLookup.get(source);

    if (found === undefined) {
        found = new PropertyChangeNotifier(source);
        notifierLookup.set(source, found);
    }

    return found;
}

// Get all observable accessors registered on a prototype (supports inheritance)
function getAccessors(target: any): Accessor[] {
    let accessors = accessorLookup.get(target);

    if (accessors === undefined) {
        const parent = Object.getPrototypeOf(target);
        if (parent !== null) {
            const parentAccessors = accessorLookup.get(parent);
            accessors = parentAccessors ? parentAccessors.slice() : [];
        } else {
            accessors = [];
        }
        accessorLookup.set(target, accessors);
    }

    return accessors;
}

// Default Accessor implementation
// @observable name → getter reads _name, setter writes _name + notifies
class DefaultObservableAccessor implements Accessor {
    private field: string;     // backing field name: "_name"
    private callback: string;  // change callback name: "nameChanged"

    constructor(public name: string) {
        this.field = `_${name}`;
        this.callback = `${name}Changed`;
    }

    getValue(source: any): any {
        // If a watcher is collecting dependencies → record "this property was read"
        if (watcher !== undefined) {
            watcher.watch(source, this.name);
        }

        return source[this.field];
    }

    setValue(source: any, newValue: any): void {
        const field = this.field;
        const oldValue = source[field];

        if (oldValue !== newValue) {
            source[field] = newValue;

            // Call nameChanged(oldVal, newVal) callback if it exists
            const callback = source[this.callback];
            if (isFunction(callback)) {
                callback.call(source, oldValue, newValue);
            }

            // Notify all subscribers: "name changed"
            getNotifier(source).notify(this.name);
        }
    }
}

// ─── ExpressionWatcher ───────────────────────────────────────────────────────
// Automatic dependency tracking: executes an expression, records which properties
// it accesses, and when any of those properties change, re-executes and notifies.
//
// How it works:
//   1. observe(source) sets global watcher = this before running the expression
//   2. Expression reads x.firstName → triggers getter → getter sees watcher → calls watch()
//   3. watch() records the dependency and subscribes to that property's notifications
//   4. Property changes → handleChange() → re-observe() → notify subscribers
//
// Dependencies stored as a linked list (first → ... → last) to save memory.

export class ExpressionWatcher<TSource = any, TReturn = any>
    extends SubscriberSet    // inherits subscriber management (others can subscribe to me)
    implements Subscriber    // implements Subscriber (I can receive property change notifications)
{
    private needsRefresh: boolean = true;  // whether dependencies need to be re-collected
    public source: TSource | undefined = undefined;

    // Dependency linked list — ExpressionWatcher doubles as the first node (saves one allocation)
    private first: SubscriptionRecord = this as any;
    private last: SubscriptionRecord | null = null; // null = no dependencies
    private propertySource: any = undefined;
    private propertyName: string | undefined = undefined;
    private notifier: Notifier | undefined = undefined;
    private next: SubscriptionRecord | undefined = undefined;

    constructor(
        private expression: Expression<TSource, TReturn>,
        initialSubscriber?: Subscriber
    ) {
        super(expression, initialSubscriber);
    }

    // Execute the expression and collect dependencies
    public observe(source: TSource): TReturn {
        if (this.needsRefresh && this.last !== null) {
            this.dispose();
        }

        this.source = source;

        // Set global watcher: tell all getters "I'm collecting dependencies"
        const previousWatcher = watcher;
        watcher = this.needsRefresh ? this : undefined;
        this.needsRefresh = false;

        let result: TReturn;
        try {
            result = this.expression(source);
        } finally {
            watcher = previousWatcher; // restore (supports nesting)
        }

        return result;
    }

    // Called by getters: record one dependency and subscribe to its notifications
    public watch(propertySource: unknown, propertyName: string): void {
        const prev = this.last;
        const notifier = getNotifier(propertySource);

        // First dependency reuses this (first), subsequent ones create new nodes
        const current: SubscriptionRecord = prev === null
            ? this.first
            : ({} as any);

        current.propertySource = propertySource;
        current.propertyName = propertyName;
        current.notifier = notifier;

        notifier.subscribe(this, propertyName);

        if (prev !== null) {
            prev.next = current;
        }

        this.last = current;
    }

    // A dependency changed → re-evaluate → notify my subscribers
    public handleChange(): void {
        this.needsRefresh = true;

        if (this.source !== undefined) {
            this.observe(this.source);
        }

        this.notify(this); // notify whoever subscribes to me (e.g. Binding, WhenDirective)
    }

    // Clean up: unsubscribe from all dependency properties
    public dispose(): void {
        if (this.last !== null) {
            let current: SubscriptionRecord | undefined = this.first;

            while (current !== undefined) {
                current.notifier.unsubscribe(this, current.propertyName);
                current = current.next;
            }

            this.last = null;
            this.needsRefresh = true;
        }
    }
}

// ─── defineProperty ──────────────────────────────────────────────────────────
// Defines getter/setter on the prototype, turning a plain property into an observable.
//
// @observable name = "John" compiles to:
//   Object.defineProperty(MyClass.prototype, "name", {
//       get() { return accessor.getValue(this); },  // reads this._name
//       set(v) { accessor.setValue(this, v); },      // writes this._name + notifies
//   })

function defineProperty(target: {}, nameOrAccessor: string | Accessor): void {
    if (typeof nameOrAccessor === "string") {
        nameOrAccessor = new DefaultObservableAccessor(nameOrAccessor);
    }

    getAccessors(target).push(nameOrAccessor);

    Reflect.defineProperty(target, nameOrAccessor.name, {
        enumerable: true,
        configurable: true, // allows @attr's patchAttrReflection to redefine
        get(this: any) {
            return (nameOrAccessor as Accessor).getValue(this);
        },
        set(this: any, newValue: any) {
            (nameOrAccessor as Accessor).setValue(this, newValue);
        },
    });
}

// @observable decorator
export function observable(target: {}, nameOrAccessor: string | Accessor): void {
    defineProperty(target, nameOrAccessor);
}

// Observable utilities — the public API
export const Observable = {
    getNotifier,
    defineProperty,
    getAccessors(target: any): Accessor[] {
        return getAccessors(target);
    },
    notify(source: any, args: any): void {
        getNotifier(source).notify(args);
    },
    // Create an ExpressionWatcher — used by template bindings
    binding<TSource = any, TReturn = any>(
        expression: Expression<TSource, TReturn>,
        initialSubscriber?: Subscriber
    ): ExpressionWatcher<TSource, TReturn> {
        return new ExpressionWatcher(expression, initialSubscriber);
    },
};
