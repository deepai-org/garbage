#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');

const code = `<div>
    {/* This is a comment */}
    <span>Content</span>
    {/* Multi
        line
        comment */}
</div>`;

console.log('Tokenizing JSX with comments:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Total tokens:', tokens.length);
console.log('\nFirst 20 tokens:');
tokens.slice(0, 20).forEach((t, i) => {
  console.log(`  ${i}: ${t.type} = "${t.value}"`);
});
