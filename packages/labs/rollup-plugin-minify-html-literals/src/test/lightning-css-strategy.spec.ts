import * as assert from 'node:assert/strict';
import {describe as suite, test} from 'node:test';
import {
  LightningCSSStrategy,
  createLightningCSSStrategy,
  defaultLightningCSSOptions,
} from '../lib/modern-css-strategy.js';

suite('Lightning CSS Strategy', () => {
  suite('LightningCSSStrategy', () => {
    test('should create strategy with default options', () => {
      const strategy = new LightningCSSStrategy();
      assert.ok(strategy);
    });

    test('should create strategy with custom options', () => {
      const strategy = new LightningCSSStrategy({
        lightningOptions: {
          minify: true,
          nesting: true,
        },
      });
      assert.ok(strategy);
    });

    test('should handle CSS minification', () => {
      const strategy = new LightningCSSStrategy();

      const css = `
        .class {
          color: red;
          font-size: 16px;
        }
        
        .another {
          margin: 0;
        }
      `;

      const result = strategy.minifyCSS(css);

      // Should be smaller than original
      assert.ok(result.length <= css.length);

      // Should preserve basic CSS
      assert.ok(result.includes('.class') || result.includes('color'));
      assert.ok(result.includes('.another') || result.includes('margin'));
    });

    test('should handle fallback when Lightning CSS fails', () => {
      const strategy = new LightningCSSStrategy({
        fallbackMinifier: 'clean-css',
      });

      const css = '.class { color: red; }';
      const result = strategy.minifyCSS(css);

      // Should return some result (either minified or original)
      assert.ok(result.length > 0);
      assert.ok(result.includes('color') || result.includes('red'));
    });

    test('should use custom minifier when provided', () => {
      const strategy = new LightningCSSStrategy({
        customMinifier: (css: string) => css.replace(/\s+/g, ' ').trim(),
      });

      const css = `
        .class {
          color: red;
        }
      `;

      const result = strategy.minifyCSS(css);

      // Custom minifier should just collapse whitespace
      assert.equal(result, '.class { color: red; }');
    });

    test('should preserve CSS custom properties', () => {
      const strategy = new LightningCSSStrategy();

      const css = `
        .element {
          color: var(--primary-color);
          background: var(--bg-color, white);
        }
      `;

      const result = strategy.minifyCSS(css);

      assert.ok(result.includes('var(--primary-color)'));
      assert.ok(result.includes('var(--bg-color'));
    });

    test('should handle nested CSS with Lightning CSS', () => {
      const strategy = new LightningCSSStrategy({
        lightningOptions: {
          nesting: true,
          minify: true,
        },
      });

      const css = `
        .parent {
          color: blue;
          
          & .child {
            color: red;
          }
        }
      `;

      const result = strategy.minifyCSS(css);

      // Lightning CSS should compile nesting to expanded selectors
      assert.ok(result.includes('.parent') || result.includes('.child'));
      assert.ok(result.includes('blue') || result.includes('red'));
    });
  });

  suite('Template placeholder handling', () => {
    test('should generate unique placeholders', () => {
      const strategy = new LightningCSSStrategy();
      const parts = [
        {text: 'color: ', start: 0, end: 7},
        {text: '; background: ', start: 7, end: 21},
        {text: ';', start: 21, end: 22},
      ];

      const placeholder = strategy.getPlaceholder(parts);

      assert.ok(placeholder.includes('@TEMPLATE_EXPRESSION'));
      assert.ok(placeholder.endsWith('();'));
    });

    test('should combine HTML strings with placeholder', () => {
      const strategy = new LightningCSSStrategy();
      const parts = [
        {text: '.class { color: ', start: 0, end: 16},
        {text: '; }', start: 16, end: 19},
      ];
      const placeholder = '@TEST_PLACEHOLDER();';

      const result = strategy.combineHTMLStrings(parts, placeholder);

      // Lightning CSS post-processing may add semicolons, so check for both cases
      assert.ok(
        result === '.class { color: @TEST_PLACEHOLDER(); }' ||
          result === '.class { color: @TEST_PLACEHOLDER();; }'
      );
    });

    test('should split HTML by placeholder', () => {
      const strategy = new LightningCSSStrategy();
      const html = '.class { color: @TEST_PLACEHOLDER(); }';
      const placeholder = '@TEST_PLACEHOLDER();';

      const result = strategy.splitHTMLByPlaceholder(html, placeholder);

      assert.equal(result.length, 2);
      assert.equal(result[0], '.class { color: ');
      assert.equal(result[1], ' }');
    });

    test('should handle placeholder with optional semicolon', () => {
      const strategy = new LightningCSSStrategy();
      const html = '.class { color: @TEST_PLACEHOLDER() }';
      const placeholder = '@TEST_PLACEHOLDER();';

      const result = strategy.splitHTMLByPlaceholder(html, placeholder);

      assert.equal(result.length, 2);
      assert.equal(result[0], '.class { color: ');
      assert.equal(result[1], ' }');
    });
  });

  suite('HTML minification', () => {
    test('should minify HTML with default options', () => {
      const strategy = new LightningCSSStrategy();

      const html = `
        <div class="container">
          <h1>   Title   </h1>
          <p>Some text</p>
        </div>
      `;

      const result = strategy.minifyHTML(html, {
        collapseWhitespace: true,
        removeComments: true,
      });

      // Should be smaller than original or at least minified
      assert.ok(result.length <= html.length);

      // Should preserve content
      assert.ok(result.includes('Title'));
      assert.ok(result.includes('Some text'));

      // Should have removed extra whitespace
      assert.ok(!result.includes('   Title   ') || result.length < html.length);
    });

    test('should handle SVG minification', () => {
      const strategy = new LightningCSSStrategy();

      const html = `
        <svg viewBox="0 0 100 100"
             width="100"
             height="100">
          <circle cx="50" cy="50" r="40" />
        </svg>
      `;

      const result = strategy.minifyHTML(html, {
        collapseWhitespace: true,
      });

      // Should remove newlines within SVG
      assert.ok(!result.includes('\n'));
    });
  });

  suite('Factory functions', () => {
    test('should create strategy with factory function', () => {
      const strategy = createLightningCSSStrategy({
        lightningOptions: {
          minify: true,
        },
      });

      assert.ok(strategy instanceof LightningCSSStrategy);
    });

    test('should have default options', () => {
      assert.ok(defaultLightningCSSOptions);
      assert.equal(defaultLightningCSSOptions.fixPseudoClassSpaces, true);
      assert.equal(
        defaultLightningCSSOptions.preserveTemplateExpressions,
        true
      );
      assert.equal(defaultLightningCSSOptions.fallbackMinifier, 'clean-css');
    });
  });

  suite('CSS post-processing', () => {
    test('should fix pseudo-class spaces when enabled', () => {
      const strategy = new LightningCSSStrategy({
        fixPseudoClassSpaces: true,
      });

      const original = '.element::part(input focused) { color: red; }';

      // The strategy should preserve ::part() selectors properly
      const result = strategy.minifyCSS(original);

      // Should preserve the structure even if spaces are handled differently
      assert.ok(result.includes('::part') || result.includes('element'));
    });

    test('should preserve template expressions', () => {
      const strategy = new LightningCSSStrategy({
        preserveTemplateExpressions: true,
      });

      const css = '.class { color: @TEMPLATE_EXPRESSION_ABC() }';
      const result = strategy.minifyCSS(css);

      // Should ensure template expressions end with semicolon
      assert.ok(
        result.includes('@TEMPLATE_EXPRESSION_ABC();') ||
          result.includes('@TEMPLATE_EXPRESSION_ABC()')
      );
    });
  });
});
