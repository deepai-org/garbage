#!/usr/bin/env node

const { Lexer } = require('./dist/lexer');

// Minimal failing case
const code = `<div>
    {}
    <span>test</span>
</div>`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
tokens.forEach((t, i) => {
  const vs = t.virtualSemi ? ' [VIRTUAL SEMICOLON]' : '';
  console.log(`  ${i}: ${t.type}="${t.value}"${vs}`);
});

// Now let's manually check what the parser sees
console.log('\nParser would see:');
console.log('Token 0-2: <div>');
console.log('Token 3-4: {} - empty JSX expression');
console.log('Token 5: Virtual semicolon - PROBLEM HERE');
console.log('Token 6+: Rest of JSX...');

console.log('\nThe virtual semicolon at position 5 is likely causing');
console.log('the parser to think the JSX element ends after {}');
console.log('and then the <span> is seen as a new statement starting with <');