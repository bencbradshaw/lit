import {Options as HTMLOptions, minify} from 'html-minifier';
import {TemplatePart} from './models.js';
import {Strategy} from './strategy.js';

/**
 * Lightning CSS transform options for CSS minification.
 */
export interface LightningCSSOptions {
  /**
   * The filename to use for error reporting.
   */
  filename?: string;

  /**
   * Whether to minify the CSS.
   * @default true
   */
  minify?: boolean;

  /**
   * Whether to generate a source map.
   * @default false
   */
  sourceMap?: boolean;

  /**
   * Browser targets for Lightning CSS.
   */
  targets?: {
    android?: number;
    chrome?: number;
    edge?: number;
    firefox?: number;
    ios_saf?: number;
    safari?: number;
    samsung?: number;
  };

  /**
   * Whether to enable CSS nesting support.
   * @default true
   */
  nesting?: boolean;

  /**
   * Whether to enable custom media queries.
   * @default true
   */
  customMedia?: boolean;

  /**
   * Draft syntax to enable.
   */
  drafts?: {
    nesting?: boolean;
    customMedia?: boolean;
  };

  /**
   * Features to enable or disable.
   */
  include?: number;
  exclude?: number;

  /**
   * Pseudo-class replacement for :not() selectors.
   */
  pseudoClasses?: Record<string, string>;
}

/**
 * Options for modern CSS minification using Lightning CSS.
 */
export interface ModernCSSOptions {
  /**
   * Lightning CSS options for minification.
   */
  lightningOptions?: LightningCSSOptions;

  /**
   * Custom CSS minifier function. If provided, this will be used instead of Lightning CSS.
   */
  customMinifier?: (css: string, options?: unknown) => string;

  /**
   * Whether to fix spaces in pseudo-class selectors like ::part().
   * @default true
   */
  fixPseudoClassSpaces?: boolean;

  /**
   * Whether to preserve template expressions by ensuring they end with semicolons.
   * @default true
   */
  preserveTemplateExpressions?: boolean;

  /**
   * Fallback minifier to use if Lightning CSS fails.
   * @default 'clean-css'
   */
  fallbackMinifier?: 'clean-css' | 'none';
}

/**
 * A modern CSS minification strategy that uses Lightning CSS for optimal performance
 * and modern CSS feature support.
 */
export class LightningCSSStrategy
  implements Strategy<HTMLOptions, ModernCSSOptions>
{
  private lightningCSS: {
    transform: (options: unknown) => {code: Buffer};
  } | null = null;
  private cleanCSS:
    | (new (options: unknown) => {
        minify: (css: string) => {styles: string; errors: string[]};
      })
    | null = null;
  private readonly options: ModernCSSOptions;

  constructor(options: ModernCSSOptions = {}) {
    this.options = options;
    this.initializeMinifiers();
  }

  /**
   * Initialize CSS minifiers with proper fallbacks.
   */
  private initializeMinifiers() {
    // Always try to load Lightning CSS first
    try {
      this.lightningCSS = require('lightningcss');
    } catch (e) {
      // Lightning CSS not available - will use fallback
    }

    // Load fallback minifiers
    try {
      this.cleanCSS = require('clean-css');
    } catch (e) {
      // Clean CSS not available
    }
  }

  getPlaceholder(parts: TemplatePart[]): string {
    // Using @ and (); will cause the expression not to be removed in CSS.
    // However, sometimes the semicolon can be removed (ex: inline styles).
    // In those cases, we want to make sure that the HTML splitting also
    // accounts for the missing semicolon.
    const suffix = '();';
    let placeholder = '@TEMPLATE_EXPRESSION';
    while (parts.some((part) => part.text.includes(placeholder + suffix))) {
      placeholder += '_';
    }

    return placeholder + suffix;
  }

  combineHTMLStrings(parts: TemplatePart[], placeholder: string): string {
    return parts.map((part) => part.text).join(placeholder);
  }

  minifyHTML(html: string, options: HTMLOptions = {}): string {
    // Use html-minifier but with our modern CSS strategy
    let minifyCSSOptions: HTMLOptions['minifyCSS'] = false;

    if (options.minifyCSS) {
      // Set to false to prevent html-minifier from handling CSS
      // We'll handle CSS minification separately
      minifyCSSOptions = false;
    }

    let result = minify(html, {
      ...options,
      minifyCSS: minifyCSSOptions,
    });

    if (options.collapseWhitespace) {
      // html-minifier does not support removing newlines inside <svg>
      // attributes. Support this, but be careful not to remove newlines from
      // supported areas (such as within <pre> and <textarea> tags).
      const matches = Array.from(result.matchAll(/<svg/g)).reverse();
      for (const match of matches) {
        const startTagIndex = match.index!;
        const closeTagIndex = result.indexOf('</svg', startTagIndex);
        if (closeTagIndex < 0) {
          // Malformed SVG without a closing tag
          continue;
        }

        const start = result.substring(0, startTagIndex);
        let svg = result.substring(startTagIndex, closeTagIndex);
        const end = result.substring(closeTagIndex);
        svg = svg.replace(/\r?\n/g, '');
        result = start + svg + end;
      }
    }

    return result;
  }

  minifyCSS(css: string, options: ModernCSSOptions = {}): string {
    // Merge instance options with method options
    const mergedOptions = {...this.options, ...options};

    try {
      // Use custom minifier if provided
      if (mergedOptions.customMinifier) {
        return this.postProcessCSS(
          mergedOptions.customMinifier(css),
          css,
          mergedOptions
        );
      }

      // Try Lightning CSS first (primary minifier)
      if (this.lightningCSS) {
        const lightningOptions: LightningCSSOptions = {
          filename: 'template.css',
          minify: true,
          sourceMap: false,
          // Enable modern CSS features by default
          nesting: true,
          customMedia: true,
          // Target modern browsers by default
          targets: {
            chrome: 90,
            firefox: 88,
            safari: 14,
            edge: 90,
          },
          ...mergedOptions.lightningOptions,
        };

        const result = this.lightningCSS.transform({
          code: Buffer.from(css),
          ...lightningOptions,
        });

        return this.postProcessCSS(result.code.toString(), css, mergedOptions);
      }

      // Fallback to other minifiers
      return this.fallbackMinify(css, mergedOptions);
    } catch (error) {
      // If Lightning CSS fails, try fallback
      console.warn('Lightning CSS minification failed:', error);
      return this.fallbackMinify(css, mergedOptions);
    }
  }

  /**
   * Fallback minification when Lightning CSS is not available or fails.
   */
  private fallbackMinify(css: string, options: ModernCSSOptions): string {
    const fallback = options.fallbackMinifier || 'clean-css';

    try {
      switch (fallback) {
        case 'clean-css': {
          if (this.cleanCSS) {
            const cleanCSS = new this.cleanCSS({});
            const result = cleanCSS.minify(css);
            if (result.errors && result.errors.length) {
              throw new Error(result.errors.join('\n\n'));
            }
            return this.postProcessCSS(result.styles, css, options);
          }
          // Clean CSS not available, fall through to basic minification
          break;
        }

        case 'none':
        default: {
          // Basic minification as last resort
          const minified = css
            .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
            .replace(/\s+/g, ' ') // Collapse whitespace
            .replace(/;\s*}/g, '}') // Remove last semicolon before closing brace
            .replace(/\s*{\s*/g, '{') // Remove spaces around opening brace
            .replace(/:\s*/g, ':') // Remove space after colon
            .replace(/;\s*/g, ';') // Remove space after semicolon
            .trim();
          return this.postProcessCSS(minified, css, options);
        }
      }

      // If we reach here, all minifiers failed but didn't throw
      // Use basic minification as fallback
      const basicMinified = css
        .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
        .replace(/\s+/g, ' ') // Collapse whitespace
        .replace(/;\s*}/g, '}') // Remove last semicolon before closing brace
        .replace(/\s*{\s*/g, '{') // Remove spaces around opening brace
        .replace(/:\s*/g, ':') // Remove space after colon
        .replace(/;\s*/g, ';') // Remove space after semicolon
        .trim();
      return this.postProcessCSS(basicMinified, css, options);
    } catch (error) {
      console.warn(`Fallback minifier '${fallback}' failed:`, error);
      // Return original CSS if all minification fails
      return css;
    }
  }

  /**
   * Post-process minified CSS to fix specific issues.
   */
  private postProcessCSS(
    minified: string,
    original: string,
    options: ModernCSSOptions
  ): string {
    let result = minified;

    // Fix spaces in pseudo-class selectors (default: true)
    if (options.fixPseudoClassSpaces !== false) {
      result = this.fixPseudoClassSpaces(original, result);
    }

    // Preserve template expressions (default: true)
    if (options.preserveTemplateExpressions !== false) {
      result = this.fixTemplateExpressions(result);
    }

    return result;
  }

  /**
   * Fix spaces in pseudo-class selectors that might have been incorrectly minified.
   * This preserves spaces in selectors like ::part(space separated).
   */
  private fixPseudoClassSpaces(original: string, minified: string): string {
    const regex = /(::?.+\((.*)\))[\s\r\n]*{/gm;
    let match: RegExpMatchArray | null;
    while ((match = regex.exec(original)) != null) {
      const pseudoClass = match[1];
      const parameters = match[2];
      if (!parameters.match(/\s/)) {
        continue;
      }

      const parametersWithoutSpaces = parameters.replace(/\s/g, '');
      const resultPseudoClass = pseudoClass.replace(
        parameters,
        parametersWithoutSpaces
      );
      const resultStartIndex = minified.indexOf(resultPseudoClass);
      if (resultStartIndex < 0) {
        continue;
      }

      const resultEndIndex = resultStartIndex + resultPseudoClass.length;
      // Restore the original pseudo class with spaces
      minified =
        minified.substring(0, resultStartIndex) +
        pseudoClass +
        minified.substring(resultEndIndex);
    }

    return minified;
  }

  /**
   * Ensure template expressions maintain their semicolons after minification.
   */
  private fixTemplateExpressions(css: string): string {
    return css.replace(/@TEMPLATE_EXPRESSION[^;()]*\(\)(?!;)/g, (match) => {
      return match + ';';
    });
  }

  splitHTMLByPlaceholder(html: string, placeholder: string): string[] {
    const parts = html.split(placeholder);
    // Make the last character (a semicolon) optional. See above.
    if (placeholder.endsWith(';')) {
      const withoutSemicolon = placeholder.substring(0, placeholder.length - 1);
      for (let i = parts.length - 1; i >= 0; i--) {
        parts.splice(i, 1, ...parts[i].split(withoutSemicolon));
      }
    }

    return parts;
  }
}

/**
 * Create a Lightning CSS-based strategy with the given options.
 */
export function createLightningCSSStrategy(
  options: ModernCSSOptions = {}
): LightningCSSStrategy {
  return new LightningCSSStrategy(options);
}

/**
 * Default options for Lightning CSS minification.
 */
export const defaultLightningCSSOptions: ModernCSSOptions = {
  lightningOptions: {
    minify: true,
    nesting: true,
    customMedia: true,
    targets: {
      chrome: 90,
      firefox: 88,
      safari: 14,
      edge: 90,
    },
  },
  fixPseudoClassSpaces: true,
  preserveTemplateExpressions: true,
  fallbackMinifier: 'clean-css',
};

/**
 * The modern strategy using Lightning CSS for optimal performance and feature support.
 */
export const lightningStrategy = createLightningCSSStrategy(
  defaultLightningCSSOptions
);

// Re-export with new names for backward compatibility
export const ModernCSSStrategy = LightningCSSStrategy;
export const createModernCSSStrategy = createLightningCSSStrategy;
export const defaultModernCSSOptions = defaultLightningCSSOptions;
export const modernStrategy = lightningStrategy;
