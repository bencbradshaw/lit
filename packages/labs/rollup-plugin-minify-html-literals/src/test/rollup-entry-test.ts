export const SOURCE = `
function render(title, items, styles) {
  return html\`
    <style>
      \${styles}
    </style>
    <h1 class="heading">\${title}</h1>
    <button onclick="\${() => eventHandler()}"></button>
    <ul>
      \${items.map(item => {
        return getHTML()\`
          <li>\${item}</li>
        \`;
      })}
    </ul>
  \`;
}

function noMinify() {
  return \`
    <div>Not tagged html</div>
  \`;
}

function taggednoMinify(extra) {
  return other\`
    <style>
      .heading {
        font-size: 24px;
      }

      \${extra}
    </style>
  \`;
}

function taggedCSSMinify(extra) {
  return css\`
    .heading {
      font-size: 24px;
    }

    \${extra}
  \`;
}

function cssProperty(property) {
  const width = '20px';
  return css\`
    .foo {
      font-size: 1rem;
      width: \${width};
      color: \${property};
    }
  \`;
}
`;
