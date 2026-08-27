/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {AsyncDirective} from '../async-directive.js';
import {
  directive,
  DirectiveParameters,
  DirectiveResult,
  PartInfo,
  PartType,
} from '../directive.js';
import {
  _$LH as litHtmlPrivate,
  AttributePart,
  BooleanAttributePart,
  ElementPart,
  EventPart,
  noChange,
  nothing,
  Part,
  PropertyPart,
} from '../lit-html.js';

const DEV_MODE = true;
const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';

/** A set of values to apply to an element with {@link spread}. */
export interface SpreadValues {
  readonly [name: string]: unknown;
}

/** The kind of bindings represented by an unprefixed spread object. */
export type SpreadMode = 'attribute' | 'boolean' | 'property' | 'event';

type SpreadArguments =
  | [values: Readonly<SpreadValues> | null | undefined]
  | [mode: SpreadMode, values: Readonly<SpreadValues> | null | undefined];

type BindingType =
  | typeof PartType.ATTRIBUTE
  | typeof PartType.BOOLEAN_ATTRIBUTE
  | typeof PartType.PROPERTY
  | typeof PartType.EVENT;

interface SpreadBinding {
  readonly name: string;
  readonly target: string;
  readonly type: BindingType;
  readonly value: unknown;
}

interface SpreadRegistration {
  readonly order: number;
  bindings: Map<string, SpreadBinding>;
}

type SpreadPart =
  | AttributePart
  | BooleanAttributePart
  | PropertyPart
  | EventPart;

interface CommittedBinding {
  binding: SpreadBinding;
  part: SpreadPart;
}

interface ExplicitBinding {
  readonly order: number;
  readonly part: SpreadPart;
}

interface StaticBinding {
  readonly name: string;
  readonly order: number;
  readonly target: string;
  readonly value: string;
}

interface TemplateInstanceLike {
  readonly _$parts: Array<Part | undefined>;
}

const coordinators = new WeakMap<Element, SpreadCoordinator>();

const normalizeAttributeName = (element: Element, name: string) =>
  element.namespaceURI === HTML_NAMESPACE ? name.toLowerCase() : name;

const targetFor = (type: BindingType, name: string) => {
  switch (type) {
    case PartType.ATTRIBUTE:
    case PartType.BOOLEAN_ATTRIBUTE:
      return `attribute:${name}`;
    case PartType.PROPERTY:
      return `property:${name}`;
    case PartType.EVENT:
      return `event:${name}`;
  }
};

const makeBinding = (
  element: Element,
  type: BindingType,
  name: string,
  value: unknown
): SpreadBinding => {
  if (name === '') {
    throw new Error('A `spread()` binding name must not be empty.');
  }
  if (type === PartType.ATTRIBUTE || type === PartType.BOOLEAN_ATTRIBUTE) {
    name = normalizeAttributeName(element, name);
  }
  return {name, target: targetFor(type, name), type, value};
};

const normalizeBindings = (
  element: Element,
  [modeOrValues, modeValues]: SpreadArguments
) => {
  const mode = typeof modeOrValues === 'string' ? modeOrValues : undefined;
  const values = mode === undefined ? modeOrValues : modeValues;
  const bindings = new Map<string, SpreadBinding>();

  if (
    mode !== undefined &&
    mode !== 'attribute' &&
    mode !== 'boolean' &&
    mode !== 'property' &&
    mode !== 'event'
  ) {
    throw new Error(
      `The \`${mode}\` spread mode is invalid. Expected \`attribute\`, ` +
        '`boolean`, `property`, or `event`.'
    );
  }
  if (values == null) {
    return bindings;
  }
  if (typeof values !== 'object' && typeof values !== 'function') {
    throw new TypeError('The values passed to `spread()` must be an object.');
  }

  for (const sourceName of Object.keys(values)) {
    let type: BindingType;
    let name: string;
    if (mode === 'attribute') {
      type = PartType.ATTRIBUTE;
      name = sourceName;
    } else if (mode === 'boolean') {
      type = PartType.BOOLEAN_ATTRIBUTE;
      name = sourceName;
    } else if (mode === 'property') {
      type = PartType.PROPERTY;
      name = sourceName;
    } else if (mode === 'event') {
      type = PartType.EVENT;
      name = sourceName;
    } else {
      const prefix = sourceName[0];
      if (prefix === '.') {
        type = PartType.PROPERTY;
        name = sourceName.slice(1);
      } else if (prefix === '?') {
        type = PartType.BOOLEAN_ATTRIBUTE;
        name = sourceName.slice(1);
      } else if (prefix === '@') {
        type = PartType.EVENT;
        name = sourceName.slice(1);
      } else {
        type = PartType.ATTRIBUTE;
        name = sourceName;
      }
    }

    const binding = makeBinding(element, type, name, values[sourceName]);
    if (DEV_MODE && bindings.has(binding.target)) {
      throw new Error(
        `The \`${sourceName}\` entry passed to \`spread()\` targets the same ` +
          'element binding as another entry in the object.'
      );
    }
    bindings.set(binding.target, binding);
  }
  return bindings;
};

const bindingForPart = (part: Part): SpreadBinding | undefined => {
  switch (part.type) {
    case PartType.ATTRIBUTE:
    case PartType.BOOLEAN_ATTRIBUTE:
    case PartType.PROPERTY:
    case PartType.EVENT:
      return makeBinding(part.element, part.type, part.name, undefined);
    default:
      return undefined;
  }
};

class SpreadCoordinator {
  private readonly _registrations: SpreadRegistration[] = [];
  private readonly _committed = new Map<string, CommittedBinding>();
  private readonly _explicit = new Map<string, ExplicitBinding>();
  private readonly _static = new Map<string, StaticBinding>();
  private readonly _suppressedEvents = new Set<EventPart>();
  private readonly _element: Element;
  private readonly _parent: ElementPart['_$parent'];
  private readonly _options: ElementPart['options'];

  constructor(part: ElementPart) {
    this._element = part.element;
    this._parent = part._$parent;
    this._options = part.options;

    const parent = part._$parent as unknown as TemplateInstanceLike;
    parent._$parts.forEach((sibling, order) => {
      if (sibling === undefined || sibling === part) {
        return;
      }
      const binding = bindingForPart(sibling);
      if (
        binding !== undefined &&
        (sibling as AttributePart).element === part.element
      ) {
        this._explicit.set(binding.target, {
          order,
          part: sibling as SpreadPart,
        });
      }
    });

    for (const {name, value, order} of part._$staticAttributes ?? []) {
      const normalizedName = normalizeAttributeName(part.element, name);
      const target = targetFor(PartType.ATTRIBUTE, normalizedName);
      this._static.set(target, {
        name: normalizedName,
        order,
        target,
        value,
      });
    }
  }

  register(order: number) {
    const registration: SpreadRegistration = {order, bindings: new Map()};
    const index = this._registrations.findIndex(
      ({order: existingOrder}) => existingOrder > order
    );
    if (index === -1) {
      this._registrations.push(registration);
    } else {
      this._registrations.splice(index, 0, registration);
    }
    return registration;
  }

  update(
    registration: SpreadRegistration,
    bindings: Map<string, SpreadBinding>
  ) {
    const affected = new Set([
      ...registration.bindings.keys(),
      ...bindings.keys(),
    ]);
    registration.bindings = bindings;
    for (const target of affected) {
      this._commitTarget(target, registration.order);
    }
  }

  unregister(registration: SpreadRegistration) {
    const index = this._registrations.indexOf(registration);
    if (index === -1) {
      return;
    }
    this._registrations.splice(index, 1);
    for (const target of registration.bindings.keys()) {
      this._commitTarget(target, registration.order);
    }
    if (this._registrations.length === 0) {
      coordinators.delete(this._element);
    }
  }

  private _commitTarget(target: string, currentOrder: number) {
    let winnerOrder = -Infinity;
    let spreadBinding: SpreadBinding | undefined;
    const staticBinding = this._static.get(target);
    if (staticBinding !== undefined) {
      winnerOrder = staticBinding.order;
    }
    const explicitBinding = this._explicit.get(target);
    if (explicitBinding !== undefined && explicitBinding.order > winnerOrder) {
      winnerOrder = explicitBinding.order;
    }
    for (const registration of this._registrations) {
      const binding = registration.bindings.get(target);
      if (binding !== undefined && registration.order > winnerOrder) {
        winnerOrder = registration.order;
        spreadBinding = binding;
      }
    }

    if (spreadBinding !== undefined) {
      if (
        explicitBinding?.part.type === PartType.EVENT &&
        explicitBinding.order < winnerOrder
      ) {
        this._suppressEvent(explicitBinding.part as EventPart);
      }
      this._commitSpread(
        target,
        spreadBinding,
        explicitBinding !== undefined && explicitBinding.order < winnerOrder
      );
      return;
    }

    const committed = this._committed.get(target);
    if (committed !== undefined) {
      committed.part._$setValue(nothing);
      this._committed.delete(target);
    }
    if (
      explicitBinding !== undefined &&
      explicitBinding.order === winnerOrder
    ) {
      if (explicitBinding.part.type === PartType.EVENT) {
        this._restoreEvent(explicitBinding.part as EventPart);
      } else if (
        committed !== undefined &&
        explicitBinding.order < currentOrder
      ) {
        explicitBinding.part._commitValue(
          this._getCommittedValue(explicitBinding.part)
        );
      }
    } else if (staticBinding?.order === winnerOrder) {
      this._element.setAttribute(staticBinding.name, staticBinding.value);
    }
  }

  private _commitSpread(
    target: string,
    binding: SpreadBinding,
    restoreAfterExplicit: boolean
  ) {
    let committed = this._committed.get(target);
    if (
      committed === undefined ||
      committed.binding.type !== binding.type ||
      committed.binding.name !== binding.name
    ) {
      committed?.part._$setValue(nothing);
      committed = {binding, part: this._createPart(binding)};
      this._committed.set(target, committed);
    } else {
      committed.binding = binding;
    }
    committed.part._$setValue(binding.value);
    if (restoreAfterExplicit && committed.part.type !== PartType.EVENT) {
      committed.part._commitValue(this._getCommittedValue(committed.part));
    }
  }

  private _getCommittedValue(part: SpreadPart) {
    if (part.strings === undefined) {
      return part._$committedValue;
    }

    const values = part._$committedValue as Array<unknown>;
    let value: unknown = part.strings[0];
    for (let i = 0; i < part.strings.length - 1; i++) {
      const item = values[i];
      if (item === nothing) {
        value = nothing;
      } else if (value !== nothing) {
        value += (item ?? '') + part.strings[i + 1];
      }
    }
    return value;
  }

  private _suppressEvent(part: EventPart) {
    const listener = part._$committedValue;
    if (listener !== nothing) {
      this._element.removeEventListener(
        part.name,
        part,
        listener as AddEventListenerOptions
      );
      this._suppressedEvents.add(part);
    }
  }

  private _restoreEvent(part: EventPart) {
    if (this._suppressedEvents.delete(part)) {
      const listener = part._$committedValue;
      if (listener !== nothing) {
        this._element.addEventListener(
          part.name,
          part,
          listener as AddEventListenerOptions
        );
      }
    }
  }

  private _createPart(binding: SpreadBinding): SpreadPart {
    const args = [
      this._element as HTMLElement,
      binding.name,
      ['', ''],
      this._parent,
      this._options,
    ] as const;
    switch (binding.type) {
      case PartType.ATTRIBUTE:
        return new litHtmlPrivate._AttributePart(...args);
      case PartType.BOOLEAN_ATTRIBUTE:
        return new litHtmlPrivate._BooleanAttributePart(...args);
      case PartType.PROPERTY:
        return new litHtmlPrivate._PropertyPart(...args);
      case PartType.EVENT:
        return new litHtmlPrivate._EventPart(...args);
    }
  }
}

class SpreadDirective extends AsyncDirective {
  private _coordinator?: SpreadCoordinator;
  private _registration?: SpreadRegistration;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error(
        'The `spread` directive must be used in an element expression.'
      );
    }
  }

  render(..._args: SpreadArguments) {
    return noChange;
  }

  override update(part: ElementPart, args: DirectiveParameters<this>) {
    const bindings = normalizeBindings(part.element, args);

    if (this._coordinator === undefined) {
      const parent = part._$parent as unknown as TemplateInstanceLike;
      const order = parent._$parts?.indexOf(part) ?? -1;
      this._coordinator =
        coordinators.get(part.element) ?? new SpreadCoordinator(part);
      coordinators.set(part.element, this._coordinator);
      this._registration = this._coordinator.register(order);
    }
    this._coordinator.update(this._registration!, bindings);
    return noChange;
  }

  override ['_$notifyDirectiveConnectionChanged'](
    isConnected: boolean,
    isClearingDirective = true
  ) {
    super['_$notifyDirectiveConnectionChanged'](
      isConnected,
      isClearingDirective
    );
    if (!isConnected && isClearingDirective) {
      this._coordinator?.unregister(this._registration!);
      this._coordinator = undefined;
      this._registration = undefined;
    }
  }
}

const spreadDirective = directive(SpreadDirective);

/**
 * Applies a set of attribute, property, boolean attribute, and event listener
 * bindings to an element.
 *
 * In the one-argument form, keys use Lit binding prefixes (`.`, `?`, and `@`),
 * with unprefixed keys treated as attributes. The two-argument form treats all
 * keys as attributes, boolean attributes, properties, or events according to
 * the selected mode.
 */
export function spread(
  values: Readonly<SpreadValues> | null | undefined
): DirectiveResult<typeof SpreadDirective>;
export function spread(
  mode: SpreadMode,
  values: Readonly<SpreadValues> | null | undefined
): DirectiveResult<typeof SpreadDirective>;
export function spread(
  modeOrValues: SpreadMode | Readonly<SpreadValues> | null | undefined,
  values?: Readonly<SpreadValues> | null
) {
  return typeof modeOrValues === 'string'
    ? spreadDirective(modeOrValues, values)
    : spreadDirective(modeOrValues);
}

/**
 * The type of the class that powers this directive. Necessary for naming the
 * directive's return type.
 */
export type {SpreadDirective};
