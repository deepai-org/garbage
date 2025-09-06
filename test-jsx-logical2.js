#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// No leading newline
const code = `<div>{show && <Content />}</div>`;

function findJSX(node, results = []) {
  if (!node || typeof node !== 'object') return results;
  
  if (node.kind === 'JSXElement') {
    const name = node.openingElement?.name?.name || '?';
    results.push(name);
  }
  
  for (const key in node) {
    const value = node[key];
    if (Array.isArray(value)) {
      value.forEach(v => findJSX(v, results));
    } else if (value && typeof value === 'object') {
      findJSX(value, results);
    }
  }
  
  return results;
}

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST body length:', ast.body.length);
const jsxElements = findJSX(ast);
console.log('JSX elements found:', jsxElements);
