import { html, css } from 'lit';

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
function render(title, items, styles) {
    return html`<style>${styles}</style><h1 class="heading">${title}</h1><button @click="${() => eventHandler()}"></button><ul>${items.map((item) => html`<li>${item}</li>`)}</ul>`;
}
function noMinify() {
    return `<div>Not tagged</div>`;
}
function taggednoMinify(extra) {
    return html`<style>.heading{font-size:24px}${extra}</style>`;
}
function taggedCSSMinify(extra) {
    return css`.heading{font-size:24px}${extra}`;
}
function cssProperty(property) {
    const width = '20px';
    return css`.foo{font-size:1rem;width:${width};color:${property}}`;
}
function eventHandler() {
    throw new Error('Function not implemented.');
}

export { cssProperty, noMinify, render, taggedCSSMinify, taggednoMinify };
//# sourceMappingURL=rollup-entry-result.js.map