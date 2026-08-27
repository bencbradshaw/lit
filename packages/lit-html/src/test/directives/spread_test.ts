/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: BSD-3-Clause
 */

import {html, nothing, render} from 'lit-html';
import {Directive, directive} from 'lit-html/directive.js';
import {assert} from 'chai';

import {spread, SpreadValues} from 'lit-html/directives/spread.js';

interface ElementWithSpreadProperties extends HTMLElement {
  mixedValue?: unknown;
  propertyValue?: unknown;
}

suite('spread', () => {
  let container: HTMLDivElement;

  setup(() => {
    container = document.createElement('div');
  });

  test('applies a mixed bag of Lit binding types', () => {
    const mixedValue = {source: 'mixed'};
    let clicks = 0;
    const listener = () => clicks++;

    render(
      html`<button
        ${spread({
          id: 'target',
          '?disabled': true,
          '.mixedValue': mixedValue,
          '@click': listener,
        })}
      ></button>`,
      container
    );

    const button = container.firstElementChild as HTMLButtonElement &
      ElementWithSpreadProperties;
    assert.equal(button.id, 'target');
    assert.isTrue(button.disabled);
    assert.strictEqual(button.mixedValue, mixedValue);
    button.dispatchEvent(new Event('click'));
    assert.equal(clicks, 1);
  });

  test('applies attribute mode', () => {
    render(
      html`<div
        ${spread('attribute', {
          id: 'target',
          title: 'Title',
          'aria-label': 'Label',
        })}
      ></div>`,
      container
    );

    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('id'), 'target');
    assert.equal(element.getAttribute('title'), 'Title');
    assert.equal(element.getAttribute('aria-label'), 'Label');
  });

  test('applies boolean mode', () => {
    const go = (disabled: boolean, required: boolean) =>
      render(
        html`<input ${spread('boolean', {disabled, required})} />`,
        container
      );

    go(true, false);
    const input = container.firstElementChild as HTMLInputElement;
    assert.isTrue(input.hasAttribute('disabled'));
    assert.isFalse(input.hasAttribute('required'));

    go(false, true);
    assert.isFalse(input.hasAttribute('disabled'));
    assert.isTrue(input.hasAttribute('required'));
  });

  test('applies property mode', () => {
    const propertyValue = {source: 'property'};
    render(
      html`<div
        ${spread('property', {propertyValue, title: 'Property title'})}
      ></div>`,
      container
    );

    const element = container.firstElementChild as ElementWithSpreadProperties;
    assert.strictEqual(element.propertyValue, propertyValue);
    assert.equal(element.title, 'Property title');
  });

  test('applies event mode', () => {
    const calls: string[] = [];
    render(
      html`<div
        ${spread('event', {
          click: () => calls.push('click'),
          pointerenter: () => calls.push('pointerenter'),
        })}
      ></div>`,
      container
    );

    const element = container.firstElementChild!;
    element.dispatchEvent(new Event('click'));
    element.dispatchEvent(new Event('pointerenter'));
    assert.deepEqual(calls, ['click', 'pointerenter']);
  });

  test('updates values and removes omitted bindings', () => {
    let calls = 0;
    const listener = () => calls++;
    const go = (values: SpreadValues) =>
      render(html`<button ${spread(values)}></button>`, container);

    go({
      title: 'one',
      '?disabled': true,
      '.propertyValue': 'one',
      '@click': listener,
    });
    const button = container.firstElementChild as HTMLButtonElement &
      ElementWithSpreadProperties;
    button.dispatchEvent(new Event('click'));
    assert.equal(calls, 1);

    go({'aria-label': 'two'});
    assert.isFalse(button.hasAttribute('title'));
    assert.isFalse(button.disabled);
    assert.isUndefined(button.propertyValue);
    assert.equal(button.getAttribute('aria-label'), 'two');
    button.click();
    assert.equal(calls, 1);
  });

  test('supports null and undefined bags and cleans up previous values', () => {
    const go = (values: SpreadValues | null | undefined) =>
      render(html`<div ${spread(values)}></div>`, container);

    go({title: 'set', '.propertyValue': 'set'});
    const element = container.firstElementChild as ElementWithSpreadProperties;
    assert.equal(element.title, 'set');
    assert.equal(element.propertyValue, 'set');

    go(null);
    assert.isFalse(element.hasAttribute('title'));
    assert.isUndefined(element.propertyValue);

    go({title: 'set again'});
    go(undefined);
    assert.isFalse(element.hasAttribute('title'));
  });

  test('uses native Lit value semantics', () => {
    const go = (title: unknown, hidden: unknown, propertyValue: unknown) =>
      render(
        html`<div
          ${spread({
            title,
            '?hidden': hidden,
            '.propertyValue': propertyValue,
          })}
        ></div>`,
        container
      );

    go(null, 1, null);
    const element = container.firstElementChild as ElementWithSpreadProperties;
    assert.equal(element.getAttribute('title'), '');
    assert.isTrue(element.hidden);
    assert.isNull(element.propertyValue);

    go(nothing, 0, nothing);
    assert.isFalse(element.hasAttribute('title'));
    assert.isFalse(element.hidden);
    assert.isUndefined(element.propertyValue);
  });

  test('only applies own enumerable string keys', () => {
    const symbol = Symbol('symbol');
    const values = Object.create({inherited: 'ignored'}) as Record<
      string | symbol,
      unknown
    >;
    values.own = 'applied';
    values[symbol] = 'ignored';
    Object.defineProperty(values, 'nonEnumerable', {
      enumerable: false,
      value: 'ignored',
    });

    render(
      html`<div ${spread('attribute', values as SpreadValues)}></div>`,
      container
    );
    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('own'), 'applied');
    assert.isFalse(element.hasAttribute('inherited'));
    assert.isFalse(element.hasAttribute('nonEnumerable'));
    assert.lengthOf(element.getAttributeNames(), 1);
  });

  test('supports directives as spread values', () => {
    class PrefixDirective extends Directive {
      render(value: string) {
        return `prefix:${value}`;
      }
    }
    const prefix = directive(PrefixDirective);
    const go = (value: string) =>
      render(
        html`<div
          ${spread({
            'data-value': prefix(value),
            '.propertyValue': prefix(value),
          })}
        ></div>`,
        container
      );

    go('one');
    const element = container.firstElementChild as ElementWithSpreadProperties;
    assert.equal(element.getAttribute('data-value'), 'prefix:one');
    assert.equal(element.propertyValue, 'prefix:one');

    go('two');
    assert.equal(element.getAttribute('data-value'), 'prefix:two');
    assert.equal(element.propertyValue, 'prefix:two');
  });

  test('binds event listener functions to the render host', () => {
    class Host {
      calls = 0;

      listener(this: Host) {
        this.calls++;
      }
    }
    const host = new Host();
    render(
      html`<button ${spread('event', {click: host.listener})}></button>`,
      container,
      {host}
    );

    (container.firstElementChild as HTMLButtonElement).click();
    assert.equal(host.calls, 1);
  });

  test('preserves native event listener options', () => {
    let calls = 0;
    const listener = Object.assign(() => calls++, {once: true});
    render(
      html`<button ${spread('event', {click: listener})}></button>`,
      container
    );

    const button = container.firstElementChild as HTMLButtonElement;
    button.click();
    button.click();
    assert.equal(calls, 1);
  });

  test('the farthest-right spread wins and restores earlier attributes', () => {
    const go = (left: SpreadValues, right: SpreadValues) =>
      render(html`<div ${spread(left)} ${spread(right)}></div>`, container);

    go({title: 'left'}, {title: 'right'});
    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('title'), 'right');

    go({title: 'updated left'}, {title: 'right'});
    assert.equal(element.getAttribute('title'), 'right');

    go({title: 'updated left'}, {});
    assert.equal(element.getAttribute('title'), 'updated left');
  });

  test('the farthest-right spread wins across attribute binding types', () => {
    const go = (right: SpreadValues) =>
      render(
        html`<div
          ${spread('attribute', {hidden: 'left'})}
          ${spread(right)}
        ></div>`,
        container
      );

    go({'?hidden': false});
    const element = container.firstElementChild!;
    assert.isFalse(element.hasAttribute('hidden'));

    go({});
    assert.equal(element.getAttribute('hidden'), 'left');
  });

  test('the farthest-right event spread wins without duplicate listeners', () => {
    const calls: string[] = [];
    const left = () => calls.push('left');
    const right = () => calls.push('right');
    const go = (rightEvents: SpreadValues) =>
      render(
        html`<button
          ${spread('event', {click: left})}
          ${spread('event', rightEvents)}
        ></button>`,
        container
      );

    go({click: right});
    const button = container.firstElementChild as HTMLButtonElement;
    button.click();
    assert.deepEqual(calls, ['right']);

    go({});
    button.click();
    assert.deepEqual(calls, ['right', 'left']);
  });

  test('cleans bindings up when the directive is removed', () => {
    let calls = 0;
    const listener = () => calls++;
    const go = (enabled: boolean) =>
      render(
        html`<button
          ${
            enabled
              ? spread({
                  title: 'set',
                  '?disabled': true,
                  '.propertyValue': 'set',
                  '@click': listener,
                })
              : nothing
          }
        ></button>`,
        container
      );

    go(true);
    const button = container.firstElementChild as HTMLButtonElement &
      ElementWithSpreadProperties;
    assert.equal(button.title, 'set');
    assert.isTrue(button.disabled);
    assert.equal(button.propertyValue, 'set');

    go(false);
    assert.isFalse(button.hasAttribute('title'));
    assert.isFalse(button.disabled);
    assert.isUndefined(button.propertyValue);
    button.click();
    assert.equal(calls, 0);
  });

  test('throws for duplicate targets in a mixed bag', () => {
    assert.throws(
      () =>
        render(
          html`<div ${spread({hidden: '', '?hidden': true})}></div>`,
          container
        ),
      /targets the same element binding/
    );
  });

  test('a spread after a static attribute wins and restores it', () => {
    const go = (values: SpreadValues) =>
      render(html`<div title="static" ${spread(values)}></div>`, container);

    go({title: 'spread'});
    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('title'), 'spread');

    go({title: 'updated spread'});
    assert.equal(element.getAttribute('title'), 'updated spread');

    go({});
    assert.equal(element.getAttribute('title'), 'static');
  });

  test('a static attribute after a spread always wins', () => {
    const go = (title: string) =>
      render(html`<div ${spread({title})} title="static"></div>`, container);

    go('spread');
    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('title'), 'static');

    go('updated spread');
    assert.equal(element.getAttribute('title'), 'static');
  });

  test('a static attribute between spreads participates in source order', () => {
    const go = (right: SpreadValues) =>
      render(
        html`<div
          ${spread({title: 'left spread'})}
          title="static"
          ${spread(right)}
        ></div>`,
        container
      );

    go({title: 'right spread'});
    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('title'), 'right spread');

    go({});
    assert.equal(element.getAttribute('title'), 'static');
  });

  test('a spread after an explicit attribute binding always wins', () => {
    const go = (explicit: string, values: SpreadValues) =>
      render(html`<div title=${explicit} ${spread(values)}></div>`, container);

    go('explicit', {title: 'spread'});
    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('title'), 'spread');

    go('updated explicit', {title: 'spread'});
    assert.equal(element.getAttribute('title'), 'spread');

    go('updated explicit', {});
    assert.equal(element.getAttribute('title'), 'updated explicit');
  });

  test('an explicit attribute binding after a spread always wins', () => {
    const go = (spreadTitle: string, explicit: string) =>
      render(
        html`<div ${spread({title: spreadTitle})} title=${explicit}></div>`,
        container
      );

    go('spread', 'explicit');
    const element = container.firstElementChild!;
    assert.equal(element.getAttribute('title'), 'explicit');

    go('updated spread', 'explicit');
    assert.equal(element.getAttribute('title'), 'explicit');
  });

  test('source order applies to property bindings', () => {
    const go = (
      explicit: unknown,
      spreadValue: SpreadValues,
      laterExplicit: unknown
    ) =>
      render(
        html`<div
          .mixedValue=${explicit}
          ${spread('property', spreadValue)}
          .propertyValue=${laterExplicit}
        ></div>`,
        container
      );

    go(
      'left explicit',
      {mixedValue: 'spread', propertyValue: 'spread'},
      'right explicit'
    );
    const element = container.firstElementChild as ElementWithSpreadProperties;
    assert.equal(element.mixedValue, 'spread');
    assert.equal(element.propertyValue, 'right explicit');

    go(
      'updated left explicit',
      {mixedValue: 'spread', propertyValue: 'updated spread'},
      'right explicit'
    );
    assert.equal(element.mixedValue, 'spread');
    assert.equal(element.propertyValue, 'right explicit');

    go('updated left explicit', {}, 'right explicit');
    assert.equal(element.mixedValue, 'updated left explicit');
    assert.equal(element.propertyValue, 'right explicit');
  });

  test('source order applies across attribute and boolean bindings', () => {
    const go = (values: SpreadValues, explicit: boolean) =>
      render(
        html`<div
          ${spread(values)}
          ?hidden=${explicit}
        ></div>`,
        container
      );

    go({hidden: 'spread'}, false);
    const element = container.firstElementChild!;
    assert.isFalse(element.hasAttribute('hidden'));

    go({'?hidden': true}, false);
    assert.isFalse(element.hasAttribute('hidden'));
  });

  test('a spread after an explicit event binding wins and restores it', () => {
    const calls: string[] = [];
    const explicitOne = () => calls.push('explicit one');
    const explicitTwo = () => calls.push('explicit two');
    const spreadListener = () => calls.push('spread');
    const go = (explicit: EventListener, events: SpreadValues) =>
      render(
        html`<button
          @click=${explicit}
          ${spread('event', events)}
        ></button>`,
        container
      );

    go(explicitOne, {click: spreadListener});
    const button = container.firstElementChild as HTMLButtonElement;
    button.click();
    assert.deepEqual(calls, ['spread']);

    go(explicitTwo, {click: spreadListener});
    button.click();
    assert.deepEqual(calls, ['spread', 'spread']);

    go(explicitTwo, {});
    button.click();
    assert.deepEqual(calls, ['spread', 'spread', 'explicit two']);
  });

  test('an explicit event binding after a spread always wins', () => {
    const calls: string[] = [];
    const spreadOne = () => calls.push('spread one');
    const spreadTwo = () => calls.push('spread two');
    const explicit = () => calls.push('explicit');
    const go = (listener: EventListener) =>
      render(
        html`<button
          ${spread('event', {click: listener})}
          @click=${explicit}
        ></button>`,
        container
      );

    go(spreadOne);
    const button = container.firstElementChild as HTMLButtonElement;
    button.click();
    assert.deepEqual(calls, ['explicit']);

    go(spreadTwo);
    button.click();
    assert.deepEqual(calls, ['explicit', 'explicit']);
  });

  test('throws when a binding name is empty', () => {
    assert.throws(
      () => render(html`<div ${spread({'?': true})}></div>`, container),
      /binding name must not be empty/
    );
  });

  test('throws when used outside an element expression', () => {
    assert.throws(
      () => render(html`<div>${spread({})}</div>`, container),
      /must be used in an element expression/
    );
    assert.throws(
      () => render(html`<div title=${spread({})}></div>`, container),
      /must be used in an element expression/
    );
  });
});
