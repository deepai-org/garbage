#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test with and without leading newline
const tests = [
  { name: 'Without newline', code: '<div>test</div>' },
  { name: 'With newline', code: '\n<div>test</div>' },
  { name: 'With multiple newlines', code: '\n\n<div>test</div>' },
  { name: 'With spaces and newline', code: '  \n  <div>test</div>' }
];

tests.forEach(({ name, code }) => {
  console.log(`\n${name}:`);
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`  ✓ Parsed`);
    console.log(`  AST body length: ${ast.body.length}`);
    
    if (ast.body.length === 0) {
      console.log('  ⚠️ Empty body!');
      console.log('  Tokens:', tokens.slice(0, 5).map(t => `${t.type}:${t.value}`).join(', '));
    }
  } catch (e) {
    console.log(`  ✗ Error: ${e.message}`);
  }
});