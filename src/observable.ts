/**
 * Simplified version of FAST's observable system.
 * Provides @observable decorator and ExpressionWatcher for
 * automatic dependency tracking.
 */

import { PropertyChangeNotifier, SubscriberSet } from "./notifier.js";
import type { Notifier, Subscriber } from "./notifier.js";

export interface Accessor {
    name: string;
    getValue(source: any): any;
    setValue(source: any, value: any): void;
}

export type Expression<TSource = any, TReturn = any> = (source: TSource) => TReturn;

interface SubscriptionRecord {
    propertySource: any;
    propertyName: string;
    notifier: Notifier;
    next: SubscriptionRecord | undefined;
}

const notifierLookup = new WeakMap<any, Notifier>();
const accessorLookup = new WeakMap<any, Accessor[]>();
let watcher: ExpressionWatcher | undefined = undefined;

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

            const callback = source[this.callback];

            if (isFunction(callback)) {
                callback.call(source, oldValue, newValue);
            }

            getNotifier(source).notify(this.name);
        }
    }
}

/**
 * Watches an expression and automatically tracks which @observable
 * properties it reads. When any dependency changes, re-evaluates
 * the expression and notifies subscribers.
 *
 * This is a simplified version of FAST's ExpressionNotifierImplementation.
 */
export class ExpressionWatcher<TSource = any, TReturn = any>
    extends SubscriberSet
    implements Subscriber
{
    private needsRefresh: boolean = true;
    private source: TSource | undefined = undefined;

    private first: SubscriptionRecord = this as any;
    private last: SubscriptionRecord | null = null;
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

    public observe(source: TSource): TReturn {
        if (this.needsRefresh && this.last !== null) {
            this.dispose();
        }

        this.source = source;

        const previousWatcher = watcher;
        watcher = this.needsRefresh ? this : undefined;
        this.needsRefresh = false;

        let result: TReturn;
        try {
            result = this.expression(source);
        } finally {
            watcher = previousWatcher;
        }

        return result;
    }

    public watch(propertySource: unknown, propertyName: string): void {
        const prev = this.last;
        const notifier = getNotifier(propertySource);
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

    public handleChange(): void {
        this.needsRefresh = true;

        if (this.source !== undefined) {
            this.observe(this.source);
        }

        this.notify(this);
    }

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
 */
export function observable(target: {}, nameOrAccessor: string | Accessor): void {
    defineProperty(target, nameOrAccessor);
}

/**
 * Observable utilities.
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
    binding<TSource = any, TReturn = any>(
        expression: Expression<TSource, TReturn>,
        initialSubscriber?: Subscriber
    ): ExpressionWatcher<TSource, TReturn> {
        return new ExpressionWatcher(expression, initialSubscriber);
    },
};
