#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact code from failing test
const code = `
<div>
    {/* This is a comment */}
    <span>Content</span>
    {/* Multi
        line
        comment */}
</div>`;

console.log('Testing exact failing JSX:');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nFirst 15 tokens:');
tokens.slice(0, 15).forEach((t, i) => {
  console.log(`  ${i}: ${t.type} = "${t.value}" ${t.virtualSemi ? '(virtualSemi)' : ''}`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
if (ast.body.length > 0) {
  console.log('First node:', ast.body[0].kind);
} else {
  console.log('EMPTY AST - This is the problem!');
  
  // Let's try without the leading newline
  const codeNoNewline = code.trim();
  const lexer2 = new Lexer(codeNoNewline);
  const tokens2 = lexer2.tokenize();
  const parser2 = new Parser(tokens2);
  const ast2 = parser2.parse();
  
  console.log('\nWithout leading newline:');
  console.log('AST body length:', ast2.body.length);
}