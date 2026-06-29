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
    private first: Node | null = null;
    private last: Node | null = null;

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
