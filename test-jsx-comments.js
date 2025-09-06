#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test JSX with comments
const tests = [
  '{/* comment */}',
  '<div>{/* comment */}</div>',
  `
{/* Single line comment */}
<div>
    {/* 
        Multi-line
        comment
    */}
    Content
</div>`
];

tests.forEach((code, i) => {
  console.log(`\nTest ${i + 1}: "${code.split('\n')[0].substring(0, 30)}..."`);
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log('  ✓ Parsed successfully');
    console.log(`  AST body length: ${ast.body.length}`);
    
    if (ast.body.length === 0) {
      console.log('  ⚠️ Empty AST body - might be just a comment');
    } else {
      const first = ast.body[0];
      console.log(`  First node kind: ${first.kind}`);
    }
  } catch (e) {
    console.log(`  ✗ Parse error: ${e.message}`);
  }
});