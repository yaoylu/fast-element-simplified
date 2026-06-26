/**
 * Simplified version of FAST's observable system.
 * Provides @observable decorator that turns properties into
 * getter/setter pairs with change notification support.
 */

import { PropertyChangeNotifier } from "./notifier.js";
import type { Notifier } from "./notifier.js";

export interface Accessor {
    name: string;
    getValue(source: any): any;
    setValue(source: any, value: any): void;
}

const notifierLookup = new WeakMap<any, Notifier>();
const accessorLookup = new WeakMap<any, Accessor[]>();

function isFunction(value: any): value is Function {
    return typeof value === "function";
}

function getNotifier(source: any): Notifier {
    let found = notifierLookup.get(source);

    if (found === undefined) {
        found = new PropertyChangeNotifier(source);
        notifierLookup.set(source, found);
    }

    return found;
}

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

class DefaultObservableAccessor implements Accessor {
    private field: string;
    private callback: string;

    constructor(public name: string) {
        this.field = `_${name}`;
        this.callback = `${name}Changed`;
    }

    getValue(source: any): any {
        return source[this.field];
    }

    setValue(source: any, newValue: any): void {
        const field = this.field;
        const oldValue = source[field];

        if (oldValue !== newValue) {
            source[field] = newValue;

            const callback = source[this.callback];

            if (isFunction(callback)) {
                callback.call(source, oldValue, newValue);
            }

            getNotifier(source).notify(this.name);
        }
    }
}

function defineProperty(target: {}, nameOrAccessor: string | Accessor): void {
    if (typeof nameOrAccessor === "string") {
        nameOrAccessor = new DefaultObservableAccessor(nameOrAccessor);
    }

    getAccessors(target).push(nameOrAccessor);

    Reflect.defineProperty(target, nameOrAccessor.name, {
        enumerable: true,
        get(this: any) {
            return (nameOrAccessor as Accessor).getValue(this);
        },
        set(this: any, newValue: any) {
            (nameOrAccessor as Accessor).setValue(this, newValue);
        },
    });
}

/**
 * Decorator: Defines an observable property on the target.
 *
 * Usage:
 *   class MyClass {
 *       @observable name: string = "hello";
 *       nameChanged(oldVal, newVal) { ... }
 *   }
 */
export function observable(target: {}, nameOrAccessor: string | Accessor): void {
    defineProperty(target, nameOrAccessor);
}

/**
 * Observable utilities — simplified version of FAST's Observable object.
 */
export const Observable = {
    getNotifier,
    defineProperty,
    getAccessors(target: any): Accessor[] {
        return getAccessors(target);
    },
    notify(source: any, args: any): void {
        getNotifier(source).notify(args);
    },
};
