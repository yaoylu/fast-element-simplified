/**
 * Simplified version of FAST's notifier system.
 * Provides Subscriber/Notifier interfaces and implementations
 * for property change notifications.
 */

export interface Subscriber {
    handleChange(subject: any, args: any): void;
}

export interface Notifier {
    readonly subject: any;
    notify(args: any): void;
    subscribe(subscriber: Subscriber, propertyToWatch?: any): void;
    unsubscribe(subscriber: Subscriber, propertyToUnwatch?: any): void;
}

/**
 * Optimized subscriber collection.
 * Uses two fields for the common case (1-2 subscribers),
 * upgrades to an array ("spillover") when there are more.
 */
export class SubscriberSet implements Notifier {
    private sub1: Subscriber | undefined = undefined;
    private sub2: Subscriber | undefined = undefined;
    private spillover: Subscriber[] | undefined = undefined;

    public readonly subject: any;

    constructor(subject: any, initialSubscriber?: Subscriber) {
        this.subject = subject;
        this.sub1 = initialSubscriber;
    }

    public has(subscriber: Subscriber): boolean {
        return this.spillover === undefined
            ? this.sub1 === subscriber || this.sub2 === subscriber
            : this.spillover.indexOf(subscriber) !== -1;
    }

    public subscribe(subscriber: Subscriber): void {
        const spillover = this.spillover;

        if (spillover === undefined) {
            if (this.sub1 === subscriber || this.sub2 === subscriber) {
                return;
            }

            if (this.sub1 === undefined) {
                this.sub1 = subscriber;
                return;
            }

            if (this.sub2 === undefined) {
                this.sub2 = subscriber;
                return;
            }

            this.spillover = [this.sub1, this.sub2, subscriber];
            this.sub1 = undefined;
            this.sub2 = undefined;
        } else {
            if (spillover.indexOf(subscriber) === -1) {
                spillover.push(subscriber);
            }
        }
    }

    public unsubscribe(subscriber: Subscriber): void {
        const spillover = this.spillover;

        if (spillover === undefined) {
            if (this.sub1 === subscriber) {
                this.sub1 = undefined;
            } else if (this.sub2 === subscriber) {
                this.sub2 = undefined;
            }
        } else {
            const index = spillover.indexOf(subscriber);
            if (index !== -1) {
                spillover.splice(index, 1);
            }
        }
    }

    public notify(args: any): void {
        const spillover = this.spillover;
        const subject = this.subject;

        if (spillover === undefined) {
            if (this.sub1 !== undefined) {
                this.sub1.handleChange(subject, args);
            }
            if (this.sub2 !== undefined) {
                this.sub2.handleChange(subject, args);
            }
        } else {
            for (let i = 0, len = spillover.length; i < len; i++) {
                spillover[i].handleChange(subject, args);
            }
        }
    }
}

/**
 * Notifier that supports per-property subscriptions.
 * - subscribe(handler, "name") → only notified when "name" changes
 * - subscribe(handler) → notified when ANY property changes
 */
export class PropertyChangeNotifier implements Notifier {
    private subscribers: Record<string, SubscriberSet> = {};
    private subjectSubscribers: SubscriberSet | null = null;

    public readonly subject: any;

    constructor(subject: any) {
        this.subject = subject;
    }

    public notify(propertyName: string): void {
        this.subscribers[propertyName]?.notify(propertyName);
        this.subjectSubscribers?.notify(propertyName);
    }

    public subscribe(subscriber: Subscriber, propertyToWatch?: string): void {
        let subscribers: SubscriberSet;

        if (propertyToWatch) {
            subscribers =
                this.subscribers[propertyToWatch] ??
                (this.subscribers[propertyToWatch] = new SubscriberSet(this.subject));
        } else {
            subscribers =
                this.subjectSubscribers ??
                (this.subjectSubscribers = new SubscriberSet(this.subject));
        }

        subscribers.subscribe(subscriber);
    }

    public unsubscribe(subscriber: Subscriber, propertyToUnwatch?: string): void {
        if (propertyToUnwatch) {
            this.subscribers[propertyToUnwatch]?.unsubscribe(subscriber);
        } else {
            this.subjectSubscribers?.unsubscribe(subscriber);
        }
    }
}
