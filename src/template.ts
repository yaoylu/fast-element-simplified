/**
 * Simplified template system.
 * Provides html tagged template + View + when directive.
 * Auto-updates DOM when @observable properties change.
 */

import { ExpressionWatcher, Observable } from "./observable.js";
import type { Expression } from "./observable.js";
import type { Subscriber } from "./notifier.js";

type TemplateExpression<TSource> = Expression<TSource, any>;

interface Directive {
    bind(source: any): void;
    unbind(): void;
}

// Factory function type — receives the anchor comment, returns a Directive
type DirectiveFactory = (anchor: Comment) => Directive;

function isDirectiveFactory(value: any): value is DirectiveFactory {
    return typeof value === "function" && value.__isDirectiveFactory === true;
}

// ─── Text Binding ─────────────────────────────────────────────────────────────

class Binding<TSource> implements Directive, Subscriber {
    private watcher: ExpressionWatcher<TSource, any>;
    private target: Text;

    constructor(expression: TemplateExpression<TSource>, target: Text) {
        this.target = target;
        this.watcher = Observable.binding(expression, this);
    }

    bind(source: TSource): void {
        const value = this.watcher.observe(source);
        this.target.textContent = value ?? "";
    }

    unbind(): void {
        this.watcher.dispose();
    }

    handleChange(): void {
        const value = this.watcher.observe(this.watcher.source!);
        this.target.textContent = value ?? "";
    }
}

// ─── View ─────────────────────────────────────────────────────────────────────

export class View<TSource = any> {
    private fragment: DocumentFragment;
    private directives: Directive[] = [];
    public first: Node | null = null;
    public last: Node | null = null;

    constructor(fragment: DocumentFragment, values: (TemplateExpression<TSource> | DirectiveFactory)[]) {
        this.fragment = fragment;
        this.findAndBindMarkers(values);
        this.first = fragment.firstChild;
        this.last = fragment.lastChild;
    }

    private findAndBindMarkers(values: (TemplateExpression<TSource> | DirectiveFactory)[]): void {
        const walker = document.createTreeWalker(
            this.fragment,
            128 // NodeFilter.SHOW_COMMENT
        );

        const comments: Comment[] = [];
        while (walker.nextNode()) {
            comments.push(walker.currentNode as Comment);
        }

        for (const comment of comments) {
            const match = comment.textContent?.match(/^fast-(\d+)$/);
            if (!match) continue;

            const idx = parseInt(match[1], 10);
            const value = values[idx];

            if (isDirectiveFactory(value)) {
                // when() — pass anchor comment to factory
                this.directives.push(value(comment));
            } else {
                // plain expression — text binding
                const textNode = document.createTextNode("");
                comment.parentNode!.insertBefore(textNode, comment.nextSibling);
                this.directives.push(new Binding(value as TemplateExpression<TSource>, textNode));
            }
        }
    }

    bind(source: TSource): void {
        for (const directive of this.directives) {
            directive.bind(source);
        }
    }

    unbind(): void {
        for (const directive of this.directives) {
            directive.unbind();
        }
    }

    appendTo(host: Element): void {
        host.appendChild(this.fragment);
    }

    insertBefore(anchor: Node): void {
        anchor.parentNode!.insertBefore(this.fragment, anchor);
    }

    remove(): void {
        const fragment = this.fragment;
        const end = this.last!;
        let current = this.first!;

        while (current !== end) {
            const next = current.nextSibling!;
            fragment.appendChild(current);
            current = next;
        }
        fragment.appendChild(end);
    }
}

// ─── WhenDirective ────────────────────────────────────────────────────────────

class WhenDirective<TSource> implements Directive, Subscriber {
    private watcher: ExpressionWatcher<TSource, boolean>;
    private subView: View<TSource> | null = null;
    private source: TSource | undefined = undefined;

    constructor(
        private condition: Expression<TSource, boolean>,
        private template: ViewTemplate<TSource>,
        private anchor: Comment
    ) {
        this.watcher = Observable.binding(condition, this);
    }

    bind(source: TSource): void {
        this.source = source;
        const shouldShow = this.watcher.observe(source);
        if (shouldShow) {
            this.show();
        }
    }

    unbind(): void {
        this.watcher.dispose();
        if (this.subView) {
            this.subView.unbind();
            this.subView.remove();
            this.subView = null;
        }
    }

    handleChange(): void {
        const shouldShow = this.watcher.observe(this.source!);

        if (shouldShow && !this.subView) {
            this.show();
        } else if (!shouldShow && this.subView) {
            this.hide();
        }
    }

    private show(): void {
        this.subView = this.template.create(this.source!);
        this.subView.insertBefore(this.anchor);
    }

    private hide(): void {
        this.subView!.unbind();
        this.subView!.remove();
        this.subView = null;
    }
}

// ─── ViewTemplate ─────────────────────────────────────────────────────────────

export class ViewTemplate<TSource = any> {
    private htmlString: string;
    private values: (TemplateExpression<TSource> | DirectiveFactory)[];

    constructor(
        htmlString: string,
        values: (TemplateExpression<TSource> | DirectiveFactory)[]
    ) {
        this.htmlString = htmlString;
        this.values = values;
    }

    create(source: TSource): View<TSource> {
        const template = document.createElement("template");
        template.innerHTML = this.htmlString;
        const fragment = template.content.cloneNode(true) as DocumentFragment;
        const view = new View(fragment, this.values);
        view.bind(source);
        return view;
    }

    render(source: TSource, host: Element): View<TSource> {
        const view = this.create(source);
        view.appendTo(host);
        return view;
    }
}

// ─── html tag ─────────────────────────────────────────────────────────────────

export function html<TSource = any>(
    strings: TemplateStringsArray,
    ...values: any[]
): ViewTemplate<TSource> {
    const allValues: (TemplateExpression<TSource> | DirectiveFactory)[] = [];
    let htmlString = "";

    for (let i = 0; i < strings.length; i++) {
        htmlString += strings[i];

        if (i < values.length) {
            allValues.push(values[i]);
            htmlString += `<!--fast-${allValues.length - 1}-->`;
        }
    }

    return new ViewTemplate(htmlString, allValues);
}

// ─── when directive ───────────────────────────────────────────────────────────

export function when<TSource = any>(
    condition: Expression<TSource, boolean>,
    template: ViewTemplate<TSource>
): DirectiveFactory {
    const factory = (anchor: Comment): WhenDirective<TSource> =>
        new WhenDirective(condition, template, anchor);

    factory.__isDirectiveFactory = true;
    return factory as DirectiveFactory;
}

// ─── RepeatDirective ─────────────────────────────────────────────────────────

function observeArray<T>(
    array: T[],
    callbacks: {
        onPush: (items: T[]) => void;
        onSplice: (index: number, removedCount: number, added: T[]) => void;
        onPop: () => void;
    }
): void {
    const origPush = array.push;
    const origSplice = array.splice;
    const origPop = array.pop;

    array.push = function (...items: T[]) {
        const result = origPush.apply(this, items);
        callbacks.onPush(items);
        return result;
    };

    array.splice = function (start: number, deleteCount?: number, ...items: T[]) {
        const result = origSplice.call(this, start, deleteCount ?? 0, ...items);
        callbacks.onSplice(start, result.length, items);
        return result;
    };

    array.pop = function () {
        const result = origPop.call(this);
        if (result !== undefined) {
            callbacks.onPop();
        }
        return result;
    };
}

class RepeatDirective<TSource, TItem> implements Directive, Subscriber {
    private watcher: ExpressionWatcher<TSource, TItem[]>;
    private views: View<TItem>[] = [];
    private source: TSource | undefined = undefined;
    private items: TItem[] = [];

    constructor(
        private itemsExpression: Expression<TSource, TItem[]>,
        private template: ViewTemplate<TItem>,
        private anchor: Comment
    ) {
        this.watcher = Observable.binding(itemsExpression, this);
    }

    bind(source: TSource): void {
        this.source = source;
        const items = this.watcher.observe(source) ?? [];
        this.items = items;
        this.renderAll(items);
        this.patchArray(items);
    }

    unbind(): void {
        this.watcher.dispose();
        this.removeAll();
    }

    handleChange(): void {
        const newItems = this.watcher.observe(this.source!) ?? [];

        this.removeAll();
        this.items = newItems;
        this.renderAll(newItems);
        this.patchArray(newItems);
    }

    private renderAll(items: TItem[]): void {
        for (const item of items) {
            this.createAndInsertView(item);
        }
    }

    private removeAll(): void {
        for (const view of this.views) {
            view.unbind();
            view.remove();
        }
        this.views = [];
    }

    private createAndInsertView(item: TItem): View<TItem> {
        const view = this.template.create(item);
        view.insertBefore(this.anchor);
        this.views.push(view);
        return view;
    }

    private patchArray(items: TItem[]): void {
        observeArray(items, {
            onPush: (added) => {
                for (const item of added) {
                    this.createAndInsertView(item);
                }
            },
            onSplice: (index, removedCount, added) => {
                const removed = this.views.splice(index, removedCount);
                for (const view of removed) {
                    view.unbind();
                    view.remove();
                }

                const insertAnchor =
                    index < this.views.length
                        ? this.views[index].first!
                        : this.anchor;

                for (let i = 0; i < added.length; i++) {
                    const view = this.template.create(added[i]);
                    view.insertBefore(insertAnchor);
                    this.views.splice(index + i, 0, view);
                }
            },
            onPop: () => {
                const view = this.views.pop();
                if (view) {
                    view.unbind();
                    view.remove();
                }
            },
        });
    }
}

// ─── repeat factory ──────────────────────────────────────────────────────────

export function repeat<TSource = any, TItem = any>(
    items: Expression<TSource, TItem[]>,
    template: ViewTemplate<TItem>
): DirectiveFactory {
    const factory = (anchor: Comment): RepeatDirective<TSource, TItem> =>
        new RepeatDirective(items, template, anchor);

    factory.__isDirectiveFactory = true;
    return factory as DirectiveFactory;
}
