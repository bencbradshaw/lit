# @lit-labs/rollup-plugin-minify-html-literals

A Rollup plugin to minify HTML and CSS markup inside JavaScript template literal strings.

## Features

- **Lightning CSS Integration**: High-performance CSS minification with native support for modern CSS features
- **CSS Nesting Support**: Full support for native CSS nesting syntax (both with and without ampersand)
- **Multiple CSS Minifiers**: Automatically selects the best available (Lightning CSS or Clean CSS fallback)
- **Template Literal Safety**: Properly handles Lit template expressions and placeholders
- **Backward Compatibility**: Drop-in replacement with existing configurations

## Usage

### Basic Usage

```js
import babel from 'rollup-plugin-babel';
import minifyHTML from '@lit-labs/rollup-plugin-minify-html-literals';
import {uglify} from 'rollup-plugin-uglify';

export default {
  entry: 'index.js',
  dest: 'dist/index.js',
  plugins: [
    minifyHTML(),
    // Order plugin before transpilers and other minifiers
    babel(),
    uglify(),
  ],
};
```

### Lightning CSS Minification

For optimal performance and modern CSS support:

```js
import minifyHTML, {
  createLightningCSSStrategy,
} from '@lit-labs/rollup-plugin-minify-html-literals';

export default {
  plugins: [
    minifyHTML({
      options: {
        strategy: createLightningCSSStrategy({
          lightningOptions: {
            nesting: true,
            customMedia: true,
            minify: true,
          },
        }),
      },
    }),
  ],
};
```

By default, this will minify any tagged template literal string whose tag contains "html" or "css" (case insensitive). [Additional options](#options) may be specified to control what templates should be minified.

The plugin uses Lightning CSS as the primary minifier for optimal performance and modern CSS feature support, with Clean CSS as a fallback when Lightning CSS is not available.

## Options

```js
export default {
  entry: 'index.js',
  dest: 'dist/index.js',
  plugins: [
    minifyHTML({
      // minimatch of files to minify
      include: [],
      // minimatch of files not to minify
      exclude: [],
      // set to `true` to abort bundling on a minification error
      failOnError: false,
      // minify-html-literals options
      // https://www.npmjs.com/package/minify-html-literals#options
      options: null,

      // Advanced Options
      // Override minify-html-literals function
      minifyHTMLLiterals: null,
      // Override rollup-pluginutils filter from include/exclude
      filter: null,
    }),
  ],
};
```

## Examples

### CSS Nesting Support

Lightning CSS supports modern CSS nesting syntax:

```js
import {css} from 'lit';

const styles = css`
  .card {
    padding: 1rem;
    border: 1px solid #ccc;

    /* No ampersand needed for child elements */
    .header {
      font-weight: bold;

      .title {
        color: var(--primary-color);
      }
    }

    /* Ampersand required for pseudo-classes and modifiers */
    &:hover {
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &.highlighted {
      border-color: var(--accent-color);
    }
  }
`;
```

### Minify Polymer Templates

```js
import minifyHTML from '@lit-labs/rollup-plugin-minify-html-literals';
import {defaultShouldMinify} from '@lit-labs/rollup-plugin-minify-html-literals/lib/minify-html-literals.js';

export default {
  entry: 'index.js',
  dest: 'dist/index.js',
  plugins: [
    minifyHTML({
      options: {
        shouldMinify(template) {
          return (
            defaultShouldMinify(template) ||
            template.parts.some((part) => {
              // Matches Polymer templates that are not tagged
              return (
                part.text.includes('<style') ||
                part.text.includes('<dom-module')
              );
            })
          );
        },
      },
    }),
  ],
};
```

# Acknowledgements

This is a combination and continuation of three previous projects:

1. [rollup-plugin-minify-html-literals](https://github.com/asyncLiz/rollup-plugin-minify-html-literals)
2. [minify html literals](https://github.com/asyncLiz/minify-html-literals)
3. [parse literals](https://github.com/asyncLiz/parse-literals)
