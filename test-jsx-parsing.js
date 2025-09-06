#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various JSX patterns to see what's parsing and what's not
const tests = [
  '<div />',
  '<Component />',
  '<div>content</div>',
  '<div>{expr}</div>',
  'const a = <Success />',
  'const b = isTrue ? <Success /> : <Error />',
  '<App><Header><Nav><Link /></Nav></Header></App>',
  '<div>{/* comment */}</div>'
];

tests.forEach(code => {
  console.log(`\nTesting: "${code}"`);
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`  ✓ Parsed successfully`);
    console.log(`  AST body length: ${ast.body.length}`);
    
    if (ast.body.length > 0) {
      const first = ast.body[0];
      console.log(`  First node kind: ${first.kind}`);
      if (first.kind === 'ExprStmt' && first.expr) {
        console.log(`  Expression kind: ${first.expr.kind}`);
      } else if (first.kind === 'ConstDecl' && first.values && first.values[0]) {
        console.log(`  First value kind: ${first.values[0].kind}`);
      }
    } else {
      console.log(`  ⚠️ Empty AST body!`);
    }
  } catch (e) {
    console.log(`  ✗ Parse error: ${e.message}`);
  }
});