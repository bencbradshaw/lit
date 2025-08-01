import * as assert from 'node:assert/strict';
import {describe as suite, test} from 'node:test';
import {minifyHTMLLiterals} from '../lib/minify-html-literals.js';
import {
  LightningCSSStrategy,
  createLightningCSSStrategy,
} from '../lib/modern-css-strategy.js';

suite('Lightning CSS Nested CSS Handling', () => {
  suite('LightningCSSStrategy with native CSS nesting', () => {
    test('should handle CSS nesting with ampersand syntax', () => {
      const strategy = new LightningCSSStrategy({
        lightningOptions: {
          nesting: true,
          minify: true,
        },
      });

      const nestedCSS = `
        .card {
          padding: 1rem;
          border: 1px solid #ccc;
          
          & .header {
            font-size: 1.2em;
            font-weight: bold;
            
            & .title {
              color: var(--primary-color);
              margin: 0;
            }
          }
          
          & .content {
            margin-top: 1rem;
            
            & p {
              line-height: 1.6;
            }
          }
          
          &:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          &.highlighted {
            border-color: var(--accent-color);
          }
        }
      `;

      const result = strategy.minifyCSS(nestedCSS);

      assert.ok(result.length < nestedCSS.length);
      assert.ok(result.includes('.card'));
      assert.ok(result.includes('var(--primary-color)'));
      assert.ok(result.includes('var(--accent-color)'));
    });

    test('should handle CSS nesting without ampersand syntax', () => {
      const strategy = new LightningCSSStrategy({
        lightningOptions: {
          nesting: true,
          minify: true,
        },
      });

      const nestedCSS = `
        .card {
          padding: 1rem;
          border: 1px solid #ccc;
          
          .header {
            font-size: 1.2em;
            font-weight: bold;
            
            .title {
              color: var(--primary-color);
              margin: 0;
            }
          }
          
          .content {
            margin-top: 1rem;
            
            p {
              line-height: 1.6;
            }
          }
          
          /* Ampersand still required for pseudo-classes and modifiers */
          &:hover {
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
          
          &.highlighted {
            border-color: var(--accent-color);
          }
        }
      `;

      const result = strategy.minifyCSS(nestedCSS);

      assert.ok(result.length < nestedCSS.length);
      assert.ok(result.includes('.card'));
      assert.ok(result.includes('var(--primary-color)'));
      assert.ok(result.includes('var(--accent-color)'));
    });

    test('should handle mixed ampersand and non-ampersand nesting', () => {
      const strategy = new LightningCSSStrategy({
        lightningOptions: {
          nesting: true,
          minify: true,
        },
      });

      const mixedNestedCSS = `
        .navigation {
          display: flex;
          
          /* No ampersand for child elements */
          ul {
            list-style: none;
            padding: 0;
            
            li {
              position: relative;
              
              /* No ampersand for child elements */
              a {
                text-decoration: none;
                padding: 0.5rem 1rem;
                
                /* Ampersand required for pseudo-classes */
                &:hover {
                  background: var(--hover-bg);
                }
                
                &:focus {
                  outline: 2px solid var(--focus-color);
                }
                
                /* Ampersand required for class modifiers */
                &.active {
                  background: var(--active-bg);
                  font-weight: bold;
                }
              }
              
              /* Ampersand required for pseudo-selectors */
              &:not(:last-child) {
                border-right: 1px solid #ddd;
              }
            }
          }
          
          @media (max-width: 768px) {
            /* No ampersand for child elements in media queries */
            ul {
              flex-direction: column;
              
              li {
                border-right: none;
                border-bottom: 1px solid #ddd;
              }
            }
          }
        }
      `;

      const result = strategy.minifyCSS(mixedNestedCSS);

      assert.ok(result.includes('.navigation'));
      assert.ok(result.includes('display') || result.includes('flex'));
      assert.ok(result.includes('@media') || result.includes('768px'));
      assert.ok(result.includes('var(--hover-bg)'));
      assert.ok(result.includes('var(--focus-color)'));
      assert.ok(result.includes('var(--active-bg)'));
    });

    test('should handle template expressions within nested CSS', () => {
      const strategy = new LightningCSSStrategy();

      // Test with ampersand syntax
      const templatePartsWithAmpersand = [
        {text: '.component { color: ', start: 0, end: 20},
        {text: '; & .child { background: ', start: 20, end: 45},
        {text: '; } }', start: 45, end: 50},
      ];

      const placeholderAmpersand = strategy.getPlaceholder(
        templatePartsWithAmpersand
      );
      const combinedAmpersand = strategy.combineHTMLStrings(
        templatePartsWithAmpersand,
        placeholderAmpersand
      );
      const minifiedAmpersand = strategy.minifyCSS(combinedAmpersand);
      const splitAmpersand = strategy.splitHTMLByPlaceholder(
        minifiedAmpersand,
        placeholderAmpersand
      );

      assert.equal(splitAmpersand.length, 3);
      assert.ok(
        splitAmpersand[0].includes('color:') ||
          splitAmpersand[0].includes('.component')
      );
      assert.ok(
        splitAmpersand[1].includes('background:') ||
          splitAmpersand[1].includes('child')
      );
      assert.ok(splitAmpersand[2].includes('}') || splitAmpersand[2] === '}');

      // Test without ampersand syntax (for child elements)
      const templatePartsNoAmpersand = [
        {text: '.component { color: ', start: 0, end: 20},
        {text: '; .child { background: ', start: 20, end: 43},
        {text: '; } }', start: 43, end: 48},
      ];

      const placeholderNoAmpersand = strategy.getPlaceholder(
        templatePartsNoAmpersand
      );
      const combinedNoAmpersand = strategy.combineHTMLStrings(
        templatePartsNoAmpersand,
        placeholderNoAmpersand
      );
      const minifiedNoAmpersand = strategy.minifyCSS(combinedNoAmpersand);
      const splitNoAmpersand = strategy.splitHTMLByPlaceholder(
        minifiedNoAmpersand,
        placeholderNoAmpersand
      );

      assert.equal(splitNoAmpersand.length, 3);
      assert.ok(
        splitNoAmpersand[0].includes('color:') ||
          splitNoAmpersand[0].includes('.component')
      );
      assert.ok(
        splitNoAmpersand[1].includes('background:') ||
          splitNoAmpersand[1].includes('child')
      );
      assert.ok(
        splitNoAmpersand[2].includes('}') || splitNoAmpersand[2] === '}'
      );
    });

    test('should preserve modern CSS features with Lightning CSS', () => {
      const strategy = new LightningCSSStrategy({
        lightningOptions: {
          nesting: true,
          customMedia: true,
          minify: true,
        },
      });

      const modernNestedCSS = `
        .container {
          container-type: inline-size;
          
          .grid {
            display: grid;
            grid-template-areas: 
              "header header"
              "sidebar main"
              "footer footer";
            
            .header {
              grid-area: header;
              background: var(--header-bg);
            }
            
            .sidebar {
              grid-area: sidebar;
              width: clamp(200px, 25%, 300px);
            }
            
            .main {
              grid-area: main;
              padding: max(1rem, 2vw);
            }
          }
          
          .button {
            &::part(label) {
              color: var(--button-text);
            }
            
            &::part(icon focused) {
              outline: 2px solid var(--focus-ring);
            }
          }
        }
      `;

      const result = strategy.minifyCSS(modernNestedCSS);

      assert.ok(
        result.includes('container-type') || result.includes('.container')
      );
      assert.ok(result.includes('grid') || result.includes('display'));
      assert.ok(result.includes('clamp') || result.includes('200px'));
      assert.ok(result.includes('max') || result.includes('1rem'));
      assert.ok(result.includes('var(--header-bg)'));
      assert.ok(result.includes('var(--button-text)'));
      assert.ok(result.includes('var(--focus-ring)'));
    });
  });

  suite(
    'Integration with minifyHTMLLiterals using both nesting syntaxes',
    () => {
      test('should minify nested CSS with ampersand syntax in template literals', () => {
        const source = `
        import { css } from 'lit';
        
        export const styles = css\`
          .card {
            padding: 1rem;
            border-radius: 8px;
            
            & .header {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              
              & .title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--primary-text);
              }
              
              & .badge {
                background: var(--accent-color);
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.875rem;
                
                &.priority-high {
                  background: var(--danger-color);
                }
              }
            }
            
            & .content {
              margin-top: 1rem;
              
              & p {
                margin: 0 0 1rem 0;
                line-height: 1.6;
                
                &:last-child {
                  margin-bottom: 0;
                }
              }
            }
          }
        \`;
      `;

        const strategy = createLightningCSSStrategy({
          lightningOptions: {
            nesting: true,
            minify: true,
          },
        });

        const result = minifyHTMLLiterals(source, {
          fileName: 'test.js',
          strategy: strategy,
        });

        assert.ok(result !== null);
        assert.ok(result.code.length < source.length);
        assert.ok(result.code.includes('.card'));
        assert.ok(result.code.includes('var(--primary-text)'));
        assert.ok(result.code.includes('var(--accent-color)'));
        assert.ok(result.code.includes('var(--danger-color)'));
      });

      test('should minify nested CSS without ampersand syntax in template literals', () => {
        const source = `
        import { css } from 'lit';
        
        export const styles = css\`
          .card {
            padding: 1rem;
            border-radius: 8px;
            
            /* No ampersand for child elements */
            .header {
              display: flex;
              align-items: center;
              gap: 0.5rem;
              
              .title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--primary-text);
              }
              
              .badge {
                background: var(--accent-color);
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 4px;
                font-size: 0.875rem;
                
                /* Ampersand required for class modifiers */
                &.priority-high {
                  background: var(--danger-color);
                }
              }
            }
            
            .content {
              margin-top: 1rem;
              
              p {
                margin: 0 0 1rem 0;
                line-height: 1.6;
                
                /* Ampersand required for pseudo-selectors */
                &:last-child {
                  margin-bottom: 0;
                }
              }
            }
          }
        \`;
      `;

        const strategy = createLightningCSSStrategy({
          lightningOptions: {
            nesting: true,
            minify: true,
          },
        });

        const result = minifyHTMLLiterals(source, {
          fileName: 'test.js',
          strategy: strategy,
        });

        assert.ok(result !== null);
        assert.ok(result.code.length < source.length);
        assert.ok(result.code.includes('.card'));
        assert.ok(result.code.includes('var(--primary-text)'));
        assert.ok(result.code.includes('var(--accent-color)'));
        assert.ok(result.code.includes('var(--danger-color)'));
      });

      test('should handle deeply nested CSS with both syntaxes', () => {
        const source = `
        const deeplyNestedStyles = css\`
          .app {
            .layout {
              .sidebar {
                .menu {
                  .section {
                    .item {
                      .link {
                        color: var(--link-color);
                        
                        /* Ampersand required for pseudo-classes */
                        &:hover {
                          color: var(--link-hover);
                          
                          .icon {
                            transform: scale(1.1);
                          }
                        }
                        
                        /* Ampersand required for class modifiers */
                        &.active {
                          font-weight: bold;
                          
                          .icon {
                            color: var(--active-icon);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        \`;
      `;

        const strategy = createLightningCSSStrategy({
          lightningOptions: {
            nesting: true,
            minify: true,
          },
        });

        const result = minifyHTMLLiterals(source, {
          fileName: 'test.js',
          strategy: strategy,
        });

        assert.ok(result !== null);
        assert.ok(result.code.length < source.length);
        assert.ok(result.code.includes('.app'));
        assert.ok(result.code.includes('var(--link-color)'));
        assert.ok(result.code.includes('var(--link-hover)'));
        assert.ok(result.code.includes('var(--active-icon)'));
      });

      test('should handle edge cases with both nesting syntaxes', () => {
        const source = `
        const edgeCaseStyles = css\`
          /* Test comments within nesting */
          .component {
            /* Base styles */
            padding: 1rem;
            
            /* Mix of ampersand and no-ampersand nesting */
            .nested {
              /* Nested comment */
              color: red;
              
              /* No ampersand for child elements */
              .deep {
                /* Deep comment */
                background: blue;
              }
            }
            
            /* Ampersand required for pseudo-elements */
            &::before {
              content: '';
              display: block;
            }
            
            /* Ampersand required for attribute selectors */
            &[data-active="true"] {
              border: 2px solid green;
            }
            
            /* No ampersand needed for child elements in media queries */
            @media (prefers-color-scheme: dark) {
              .dark-mode {
                background: #333;
                color: #fff;
              }
              
              /* But ampersand still needed for modifiers */
              &.dark-theme {
                border-color: #666;
              }
            }
          }
        \`;
      `;

        const strategy = createLightningCSSStrategy({
          lightningOptions: {
            nesting: true,
            minify: true,
          },
        });

        const result = minifyHTMLLiterals(source, {
          fileName: 'test.js',
          strategy: strategy,
        });

        assert.ok(result !== null);
        assert.ok(result.code.length < source.length);
        assert.ok(!result.code.includes('/* Test comments'));
        assert.ok(!result.code.includes('/* Base styles'));
        assert.ok(result.code.includes('.component'));
        assert.ok(
          result.code.includes('padding') || result.code.includes('1rem')
        );
        assert.ok(
          result.code.includes('@media') || result.code.includes('dark')
        );
      });
    }
  );
});
