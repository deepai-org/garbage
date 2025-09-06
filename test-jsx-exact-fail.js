#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function parseCode(code) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

// This is the exact code from the failing test
const code = `
<div>
    {/* This is a comment */}
    <span>Content</span>
    {/* Multi
        line
        comment */}
</div>`;

console.log('Testing exact failing code:');
const ast = parseCode(code);

console.log('AST body length:', ast.body.length);

if (ast.body.length === 0) {
  // Try without leading/trailing newlines
  const trimmedCode = code.trim();
  console.log('\nTrying trimmed version:');
  const ast2 = parseCode(trimmedCode);
  console.log('AST body length:', ast2.body.length);
  
  if (ast2.body.length > 0) {
    console.log('Success! The issue was whitespace.');
    const stmt = ast2.body[0];
    console.log('First statement kind:', stmt.kind);
    if (stmt.kind === 'ExprStmt') {
      console.log('Expression kind:', stmt.expr?.kind);
    }
  }
}