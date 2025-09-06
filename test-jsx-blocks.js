#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various patterns
const tests = [
  '<div>test</div>',
  '<div>{}</div>',
  '<div>{/* comment */}</div>',
  '<div>{}<span>test</span></div>',
  '<div>\n    {}\n    <span>test</span>\n</div>'
];

tests.forEach((code, i) => {
  console.log(`\nTest ${i + 1}: "${code.replace(/\n/g, '\\n')}"`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`  ✓ AST body length: ${ast.body.length}`);
    if (ast.body.length > 0) {
      console.log(`  First node: ${ast.body[0].kind}`);
    } else {
      console.log(`  ⚠️ EMPTY AST!`);
    }
  } catch (e) {
    console.log(`  ✗ Error: ${e.message}`);
  }
});