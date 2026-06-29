/**
 * Simplified template system.
 * Provides html tagged template + View that auto-updates DOM
 * when @observable properties change.
 */

import { ExpressionWatcher, Observable } from "./observable.js";
import type { Expression } from "./observable.js";
import type { Subscriber } from "./notifier.js";

type TemplateExpression<TSource> = Expression<TSource, any>;

class Binding<TSource> implements Subscriber {
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

export class View<TSource = any> {
    private fragment: DocumentFragment;
    private bindings: Binding<TSource>[] = [];

    constructor(fragment: DocumentFragment, expressions: TemplateExpression<TSource>[]) {
        this.fragment = fragment;
        this.findAndBindMarkers(expressions);
    }

    private findAndBindMarkers(expressions: TemplateExpression<TSource>[]): void {
        const walker = document.createTreeWalker(
            this.fragment,
            128 // NodeFilter.SHOW_COMMENT
        );

        let index = 0;
        while (walker.nextNode()) {
            const comment = walker.currentNode as Comment;
            const match = comment.textContent?.match(/^fast-(\d+)$/);

            if (match) {
                const exprIndex = parseInt(match[1], 10);
                const textNode = document.createTextNode("");
                comment.parentNode!.insertBefore(textNode, comment.nextSibling);

                this.bindings.push(new Binding(expressions[exprIndex], textNode));
                index++;
            }
        }
    }

    bind(source: TSource): void {
        for (const binding of this.bindings) {
            binding.bind(source);
        }
    }

    unbind(): void {
        for (const binding of this.bindings) {
            binding.unbind();
        }
    }

    appendTo(host: Element): void {
        host.appendChild(this.fragment);
    }
}

export class ViewTemplate<TSource = any> {
    private htmlString: string;
    private expressions: TemplateExpression<TSource>[];

    constructor(htmlString: string, expressions: TemplateExpression<TSource>[]) {
        this.htmlString = htmlString;
        this.expressions = expressions;
    }

    render(source: TSource, host: Element): View<TSource> {
        const template = document.createElement("template");
        template.innerHTML = this.htmlString;

        const fragment = template.content.cloneNode(true) as DocumentFragment;
        const view = new View(fragment, this.expressions);

        view.bind(source);
        view.appendTo(host);

        return view;
    }
}

export function html<TSource = any>(
    strings: TemplateStringsArray,
    ...values: TemplateExpression<TSource>[]
): ViewTemplate<TSource> {
    const expressions: TemplateExpression<TSource>[] = [];
    let htmlString = "";

    for (let i = 0; i < strings.length; i++) {
        htmlString += strings[i];

        if (i < values.length) {
            expressions.push(values[i]);
            htmlString += `<!--fast-${expressions.length - 1}-->`;
        }
    }

    return new ViewTemplate(htmlString, expressions);
}
