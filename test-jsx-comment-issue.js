#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
<div>
    {/* This is a comment */}
    <span>Content</span>
    {/* Multi
        line
        comment */}
</div>`;

console.log('Testing JSX with comments:');
try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('  ✓ Parsed successfully');
  console.log(`  AST body length: ${ast.body.length}`);
  
  if (ast.body.length > 0) {
    const first = ast.body[0];
    console.log(`  First node kind: ${first.kind}`);
    
    if (first.kind === 'ExprStmt' && first.expr) {
      console.log(`  Expression kind: ${first.expr.kind}`);
      
      if (first.expr.kind === 'JSXElement') {
        const jsx = first.expr;
        console.log(`  JSX tag: ${jsx.openingElement?.name?.name}`);
        console.log(`  Children count: ${jsx.children?.length || 0}`);
      }
    }
  }
} catch (e) {
  console.log(`  ✗ Parse error: ${e.message}`);
  console.log(e.stack);
}