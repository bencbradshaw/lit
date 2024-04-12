import {expect} from 'chai';
import fs from 'node:fs';
import * as path from 'path';
import * as rollup3 from 'rollup-3';
import * as rollup4 from 'rollup-4';
import sinon from 'sinon';
import minifyHTML, {type Options} from '../index.js';
import * as minify from '../lib/minify-html-literals.js';

describe('rollup-plugin-minify-html-literals', () => {
  const fileName = path.resolve('test.js');
  let context: {warn: sinon.SinonSpy; error: sinon.SinonSpy};
  beforeEach(() => {
    context = {
      warn: sinon.spy(),
      error: sinon.spy(),
    };
  });

  it('should return a plugin with a transform function', () => {
    const plugin = minifyHTML();
    expect(plugin).to.be.an('object');
    expect(plugin.name).to.be.a('string');
    expect(plugin.transform).to.be.a('function');
  });

  it('should call minifyHTMLLiterals()', () => {
    const options: Options = {};
    const plugin = minifyHTML(options);
    expect(options.minifyHTMLLiterals).to.be.a('function');
    const minifySpy = sinon.spy(options, 'minifyHTMLLiterals');
    plugin.transform.apply(context as any, ['return', fileName]);
    expect(minifySpy.called).to.be.true;
  });

  it('should pass id and options to minifyHTMLLiterals()', () => {
    const options: Options = {
      options: {
        minifyOptions: {
          minifyCSS: false,
        },
      },
    };

    const plugin = minifyHTML(options);
    const minifySpy = sinon.spy(options, 'minifyHTMLLiterals');
    plugin.transform.apply(context as any, ['return', fileName]);
    expect(
      minifySpy.calledWithMatch(
        sinon.match.string,
        sinon.match({
          fileName,
          minifyOptions: {
            minifyCSS: false,
          },
        })
      )
    ).to.be.true;
  });

  it('should allow custom minifyHTMLLiterals', () => {
    const customMinify = sinon.spy(
      (source: string, options: minify.Options) => {
        return minify.minifyHTMLLiterals(source, options);
      }
    );

    const plugin = minifyHTML({
      minifyHTMLLiterals: customMinify as (
        source: string,
        options?: minify.DefaultOptions | undefined
      ) => minify.Result,
    });

    plugin.transform.apply(context as any, ['return', fileName]);
    expect(customMinify.called).to.be.true;
  });

  it('should warn errors', () => {
    const plugin = minifyHTML({
      minifyHTMLLiterals: () => {
        throw new Error('failed');
      },
    });

    plugin.transform.apply(context as any, ['return', fileName]);
    expect(context.warn.calledWith('failed')).to.be.true;
    expect(context.error.called).to.be.false;
  });

  it('should fail is failOnError is true', () => {
    const plugin = minifyHTML({
      minifyHTMLLiterals: () => {
        throw new Error('failed');
      },
      failOnError: true,
    });

    plugin.transform.apply(context as any, ['return', fileName]);
    expect(context.error.calledWith('failed')).to.be.true;
    expect(context.warn.called).to.be.false;
  });

  it('should filter ids', () => {
    let options: Options = {};
    minifyHTML(options);
    expect(options.filter).to.be.a('function');
    expect(options.filter!(fileName)).to.be.true;
    options = {
      include: '*.ts',
    };

    minifyHTML(options);
    expect(options.filter).to.be.a('function');
    expect(options.filter!(fileName)).to.be.false;
    expect(options.filter!(path.resolve('test.ts'))).to.be.true;
  });

  it('should allow custom filter', () => {
    const options = {
      filter: sinon.spy(() => false),
    };

    const plugin = minifyHTML(options);
    plugin.transform.apply(context as any, ['return', fileName]);
    expect(options.filter.calledWith()).to.be.true;
  });
  const bundleMin = `
import { html, css } from 'lit';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
function render(title, items, styles) {
    return html \`<style>\${styles}</style><h1 class="heading">\${title}</h1><button @click="\${() => eventHandler()}"></button><ul>\${items.map((item) => html \`<li>\${item}</li>\`)}</ul>\`;
}
function noMinify() {
    return \`<div>Not tagged</div>\`;
}
function taggednoMinify(extra) {
    return html \`<style>.heading{font-size:24px}\${extra}</style>\`;
}
function taggedCSSMinify(extra) {
    return css \`.heading{font-size:24px}\${extra}\`;
}
function cssProperty(property) {
    const width = '20px';
    return css \`.foo{font-size:1rem;width:\${width};color:\${property}}\`;
}
function eventHandler() {
    throw new Error('Function not implemented.');
}

export { cssProperty, noMinify, render, taggedCSSMinify, taggednoMinify };
  `;
  it('should bundle with rollup v3', async () => {
    const bundle = await rollup3.rollup({
      input: './test/rollup-entry-test.js',
      plugins: [minifyHTML() as unknown as rollup3.Plugin],
    });
    await bundle.write({file: './test/bundle-3.js', format: 'es'});
    const result = fs.readFileSync('./test/bundle-3.js', 'utf-8');
    const bundleMin = fs
      .readFileSync('./test/rollup-entry-result.js', 'utf-8')
      .replace('//# sourceMappingURL=rollup-entry-result.js.map', '');
    expect(result).to.be.equal(bundleMin);
  });

  it('should bundle with rollup v4', async () => {
    const bundle = await rollup4.rollup({
      input: './test/rollup-entry-test.js',
      plugins: [minifyHTML() as rollup4.Plugin],
    });
    bundle.write({file: './test/bundle-4.js', format: 'es'});
    expect(bundle).to.be.an('object');
  });
});
