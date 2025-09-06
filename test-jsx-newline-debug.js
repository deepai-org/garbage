#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test case that fails
const code = `
<div>test</div>`;

console.log('Testing JSX with leading newline:');
console.log('Code:', JSON.stringify(code));

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
  if (i < 10) {
    console.log(`  ${i}: ${t.type} = "${t.value}" ${t.virtualSemi ? '(virtualSemi)' : ''}`);
  }
});

// Set debug flag
process.env.DEBUG_PARSER = '1';

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
if (ast.body.length > 0) {
  console.log('First node:', ast.body[0].kind);
}