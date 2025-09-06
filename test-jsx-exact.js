#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Exact patterns from tests
const tests = [
  // Original failing
  `
<div>
    {/* This is a comment */}
    <span>Content</span>
    {/* Multi
        line
        comment */}
</div>`,
  // Without leading newline
  `<div>
    {/* This is a comment */}
    <span>Content</span>
    {/* Multi
        line
        comment */}
</div>`,
  // Simpler version
  `<div>
    {}
    <span>Content</span>
    {}
</div>`,
  // Even simpler
  `<div>
    <span>Content</span>
</div>`
];

tests.forEach((code, i) => {
  console.log(`\nTest ${i + 1}: ${code.split('\n')[0].substring(0, 20)}...`);
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  // Check for virtual semicolons
  const vsCount = tokens.filter(t => t.virtualSemi).length;
  console.log(`  Virtual semicolons: ${vsCount}`);
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log(`  AST body length: ${ast.body.length}`);
  if (ast.body.length === 0) {
    console.log(`  ⚠️ EMPTY AST!`);
    
    // Show first few tokens
    console.log('  First 8 tokens:');
    tokens.slice(0, 8).forEach((t, j) => {
      console.log(`    ${j}: ${t.type}="${t.value}"${t.virtualSemi ? ' (VS)' : ''}`);
    });
  }
});