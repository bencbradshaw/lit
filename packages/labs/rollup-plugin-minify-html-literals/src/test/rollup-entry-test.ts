/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */

import {html, css} from 'lit';
function render(title: unknown, items: any[], styles: unknown) {
  return html`
    <style>
      ${styles}
    </style>
    <h1 class="heading">${title}</h1>
    <button @click="${() => eventHandler()}"></button>
    <ul>
      ${items.map((item: unknown) => html` <li>${item}</li> `)}
    </ul>
  `;
}

function noMinify() {
  return `<div>Not tagged</div>`;
}

function taggednoMinify(extra: unknown) {
  return html`
    <style>
      .heading {
        font-size: 24px;
      }

      ${extra}
    </style>
  `;
}

function taggedCSSMinify(extra: any) {
  return css`
    .heading {
      font-size: 24px;
    }

    ${extra}
  `;
}

function cssProperty(property: any) {
  const width = '20px';
  return css`
    .foo {
      font-size: 1rem;
      width: ${width};
      color: ${property};
    }
  `;
}

function eventHandler() {
  throw new Error('Function not implemented.');
}

// export each so that they are not tree-shaken
export {cssProperty, noMinify, render, taggedCSSMinify, taggednoMinify};
