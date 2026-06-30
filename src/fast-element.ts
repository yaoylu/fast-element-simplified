/**
 * Simplified FASTElement system.
 * Provides FASTElement base class, @customElement decorator,
 * @attr decorator for attribute ↔ property sync.
 *
 * Architecture:
 *   @customElement({ name, template, styles })  ← register custom element
 *   class MyEl extends FASTElement {
 *       @attr count = 0;        ← HTML attribute ↔ JS property two-way sync
 *       @observable label = ""; ← pure JS reactive property (no attribute sync)
 *   }
 *
 * Lifecycle:
 *   1. Browser parses <my-el> → calls constructor()
 *   2. Inserted into DOM → connectedCallback()
 *      → _bindObservables() fixes class field shadowing
 *      → attachShadow() creates Shadow DOM
 *      → injects <style> + renders template
 *   3. Removed from DOM → disconnectedCallback() → unbinds view
 *   4. Attribute changes → attributeChangedCallback() → updates JS property
 */

import { observable, Observable } from "./observable.js";
import type { ViewTemplate, View } from "./template.js";

// ─── Value Converters ────────────────────────────────────────────────────────
// Convert between HTML attributes (strings) and JS properties (any type).
// toView: JS → HTML  (e.g. 5 → "5")
// fromView: HTML → JS (e.g. "5" → 5)

export interface ValueConverter {
    toView(value: any): string | null;
    fromView(value: string | null): any;
}

// Boolean attribute: presence = true, absence = false
// <my-el disabled>  → true
// <my-el>           → false
export const booleanConverter: ValueConverter = {
    toView(value: any): string | null {
        return value ? "" : null; // true → empty string (attr present), false → null (remove attr)
    },
    fromView(value: string | null): boolean {
        return value !== null && value !== "false";
    },
};

// Number attribute: "5" ↔ 5
export const numberConverter: ValueConverter = {
    toView(value: any): string | null {
        return value == null ? null : String(value);
    },
    fromView(value: string | null): number | null {
        if (value === null || value === "") return null;
        return Number(value);
    },
};

// ─── @attr metadata ──────────────────────────────────────────────────────────
// @attr is a superset of @observable:
//   @observable → getter/setter + change notification
//   @attr      → all of the above + HTML attribute two-way sync

export type AttributeMode = "reflect" | "boolean" | "fromView";
// "reflect"  → two-way: property change → attr change, attr change → property change
// "boolean"  → same as reflect, but uses boolean semantics (presence/absence)
// "fromView" → one-way: only attr → property; property changes don't reflect back

export interface AttributeConfig {
    attribute?: string;   // HTML attribute name (defaults to lowercased property name)
    mode?: AttributeMode; // sync mode (defaults to "reflect")
    converter?: ValueConverter; // type converter
}

interface AttributeDefinition {
    property: string;
    attribute: string;
    mode: AttributeMode;
    converter?: ValueConverter;
}

// Stores @attr definitions for each class
const attrDefinitions = new Map<Function, AttributeDefinition[]>();

function getAttrDefs(ctor: Function): AttributeDefinition[] {
    let defs = attrDefinitions.get(ctor);
    if (!defs) {
        defs = [];
        attrDefinitions.set(ctor, defs);
    }
    return defs;
}

// @attr decorator — supports two forms:
//   @attr count = 0;                                  ← no config
//   @attr({ converter: numberConverter }) count = 0;  ← with config
export function attr(configOrTarget: AttributeConfig | object, name?: string): any {
    if (name !== undefined) {
        // No-config form: @attr applied directly to a property
        registerAttr({}, configOrTarget as object, name);
        return;
    }

    // Config form: @attr({...}) returns a decorator function
    return (target: object, propertyName: string) => {
        registerAttr(configOrTarget as AttributeConfig, target, propertyName);
    };
}

function registerAttr(config: AttributeConfig, target: object, property: string): void {
    const mode = config.mode ?? "reflect";
    const attrName = config.attribute ?? property.toLowerCase();
    let converter = config.converter;

    if (mode === "boolean" && !converter) {
        converter = booleanConverter;
    }

    const ctor = target.constructor;
    getAttrDefs(ctor).push({ property, attribute: attrName, mode, converter });

    // @attr internally calls @observable — gets getter/setter + change notification
    observable(target, property);
}

// ─── FASTElement ─────────────────────────────────────────────────────────────

interface ElementDefinition {
    name: string;
    template?: ViewTemplate;
    styles?: string;
}

// Stores element definitions (template, styles, etc.) for each class
const elementDefinitions = new WeakMap<Function, ElementDefinition>();

export class FASTElement extends HTMLElement {
    private _view: View | null = null;
    private _isReflecting = false; // guard to prevent attr↔property infinite loop

    // Called by the browser when the element is inserted into the DOM
    connectedCallback(): void {
        const def = elementDefinitions.get(this.constructor);
        if (!def) return;

        // Fix class field shadowing (see _bindObservables comments)
        this._bindObservables();

        // Create Shadow DOM — styles and template render inside, isolated from outside
        const shadow = this.shadowRoot ?? this.attachShadow({ mode: "open" });

        // Inject scoped styles
        if (def.styles) {
            const style = document.createElement("style");
            style.textContent = def.styles;
            shadow.appendChild(style);
        }

        // Render template and bind data (this = component instance as data source)
        if (def.template) {
            this._view = def.template.render(this as any, shadow as any);
        }
    }

    // Called by the browser when the element is removed from the DOM
    disconnectedCallback(): void {
        if (this._view) {
            this._view.unbind(); // unsubscribe all data bindings
            this._view = null;
        }
    }

    // Called by the browser when an observed attribute changes
    // e.g. el.setAttribute("count", "5") → triggers this callback
    attributeChangedCallback(name: string, _oldValue: string | null, newValue: string | null): void {
        if (this._isReflecting) return; // prevent loop: property→attr→callback→property...

        const defs = attrDefinitions.get(this.constructor);
        if (!defs) return;

        const def = defs.find(d => d.attribute === name);
        if (!def) return;

        // Use converter to turn string into the correct JS type, then write to property
        const value = def.converter ? def.converter.fromView(newValue) : newValue;
        (this as any)[def.property] = value;
    }

    // Emit a custom event — convenience wrapper around dispatchEvent
    $emit(type: string, detail?: any): boolean {
        return this.dispatchEvent(
            new CustomEvent(type, { detail, bubbles: true, composed: true })
        );
    }

    // Fix "class field shadows prototype accessor" problem:
    //
    // Problem: esbuild/tsc compiles `@attr count = 0` into:
    //   constructor() { Object.defineProperty(this, "count", {value: 0}) }
    //   This creates an own data property on the instance that shadows the
    //   prototype's observable getter/setter.
    //   So this.count = 5 writes to the data property → skips the setter → no notification
    //
    // Fix: delete the own property, then re-assign through the setter
    //   delete this.count;   → removes the shadow
    //   this.count = value;  → goes through prototype setter → writes _count → notifies
    private _bindObservables(): void {
        const accessors = Observable.getAccessors(
            Object.getPrototypeOf(this)
        );

        for (const accessor of accessors) {
            if (this.hasOwnProperty(accessor.name)) {
                const value = (this as any)[accessor.name]; // save current value
                delete (this as any)[accessor.name];        // remove own property
                (this as any)[accessor.name] = value;       // re-assign through setter
            }
        }
    }
}

// ─── Attribute reflection patching ───────────────────────────────────────────
// Wraps @observable's setter so that property changes automatically sync to HTML attribute.
// e.g. el.count = 5 → setter fires → automatically calls el.setAttribute("count", "5")

function patchAttrReflection(ctor: Function): void {
    const defs = attrDefinitions.get(ctor);
    if (!defs) return;

    for (const def of defs) {
        if (def.mode === "fromView") continue; // fromView mode doesn't reflect back to attribute

        const descriptor = Object.getOwnPropertyDescriptor(ctor.prototype, def.property);
        if (!descriptor?.set) continue;

        const originalSet = descriptor.set;   // @observable's setter
        const originalGet = descriptor.get!;  // @observable's getter
        const attrDef = def;

        // Replace with a new setter that calls the original, then syncs the attribute
        Object.defineProperty(ctor.prototype, def.property, {
            enumerable: true,
            configurable: true,
            get: originalGet,
            set(this: FASTElement, value: any) {
                originalSet.call(this, value); // run observable's setValue → notify subscribers

                // Prevent loop: if we're syncing from attribute to property, don't reflect back
                if ((this as any)._isReflecting) return;
                (this as any)._isReflecting = true;

                try {
                    const attrValue = attrDef.converter
                        ? attrDef.converter.toView(value)
                        : String(value);

                    if (attrValue === null) {
                        this.removeAttribute(attrDef.attribute); // null → remove attribute
                    } else {
                        this.setAttribute(attrDef.attribute, attrValue); // sync to DOM
                    }
                } finally {
                    (this as any)._isReflecting = false;
                }
            },
        });
    }
}

// ─── @customElement decorator ────────────────────────────────────────────────
// Registers a class as a browser custom element.
//
// Does three things:
//   1. Stores the template/styles definition
//   2. Sets observedAttributes (tells the browser which attributes to watch)
//   3. Calls customElements.define() to register

export function customElement(config: ElementDefinition) {
    return function (ctor: typeof FASTElement) {
        elementDefinitions.set(ctor, config);

        // Tell the browser: call attributeChangedCallback when these attributes change
        const defs = attrDefinitions.get(ctor) ?? [];
        Object.defineProperty(ctor, "observedAttributes", {
            value: defs.map(d => d.attribute),
            configurable: true,
        });

        // Wrap setters to auto-reflect property → attribute
        patchAttrReflection(ctor);

        // Register with the browser's Custom Elements Registry
        // After this, <my-counter> tags will be instantiated with this class
        customElements.define(config.name, ctor);

        return ctor as any;
    };
}
