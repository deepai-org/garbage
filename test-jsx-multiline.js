#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the specific multiline case that's failing
const code = `
<App>
    <Header>
        <Nav>
            <Link to="/" />
        </Nav>
    </Header>
</App>`;

console.log('Testing multiline JSX:');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('  ✓ Parsed successfully');
  console.log(`  AST body length: ${ast.body.length}`);
  
  // Traverse to find all JSX elements
  function findJSX(node, depth = 0) {
    if (!node || typeof node !== 'object') return;
    
    if (node.kind === 'JSXElement') {
      const name = node.openingElement?.name?.name || '?';
      console.log(`${'  '.repeat(depth + 1)}Found JSX: <${name}>`);
    }
    
    for (const key in node) {
      const value = node[key];
      if (Array.isArray(value)) {
        value.forEach(v => findJSX(v, depth + 1));
      } else if (value && typeof value === 'object') {
        findJSX(value, depth + 1);
      }
    }
  }
  
  findJSX(ast);
} catch (e) {
  console.log(`  ✗ Parse error: ${e.message}`);
  console.log(e.stack);
}