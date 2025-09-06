const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
const el = (
  <div>
    <Button onClick={() => x < 5} />
    <List<Item> data={items} />
  </div>
);`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  // Count JSX recursively
  let jsxCount = 0;
  function countJSX(node) {
    if (node && node.kind === 'JSXElement') {
      jsxCount++;
      const tag = node.openingElement?.name?.name || node.openingElement?.tagName?.name;
      console.log(`Found JSX: <${tag}>`);
    }
    if (node && typeof node === 'object') {
      for (const key in node) {
        if (key === 'span') continue;
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach(countJSX);
        } else if (value && typeof value === 'object') {
          countJSX(value);
        }
      }
    }
  }
  
  countJSX(ast);
  console.log('Total JSX elements:', jsxCount);
} catch (e) {
  console.log('✗ Error:', e.message);
}
