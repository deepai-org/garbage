const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find "Unexpected token in expression" errors
const unexpectedErrors = parser.errors.filter(e => 
  e.message === "Unexpected token in expression");

console.log(`Found ${unexpectedErrors.length} "Unexpected token in expression" errors\n`);

// Group by context (what comes before the error)
const contextGroups = {};
unexpectedErrors.forEach(e => {
  const idx = tokens.indexOf(e.token);
  if (idx > 1) {
    const prev2 = tokens[idx - 2];
    const prev1 = tokens[idx - 1];
    const context = `${prev2?.value} ${prev1?.value} [${e.token?.value}]`;
    contextGroups[context] = (contextGroups[context] || 0) + 1;
  }
});

console.log('Top error contexts (prev2 prev1 [error]):');
Object.entries(contextGroups)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15)
  .forEach(([context, count]) => {
    console.log(`  ${count}x: ${context}`);
  });

// Check specific patterns
const colonErrors = unexpectedErrors.filter(e => e.token?.value === ':');
const caseErrors = unexpectedErrors.filter(e => e.token?.value === 'case');
const elseErrors = unexpectedErrors.filter(e => e.token?.value === 'else');
const endErrors = unexpectedErrors.filter(e => e.token?.value === 'end');

console.log('\nBreakdown by token type:');
console.log(`  Colons (:): ${colonErrors.length}`);
console.log(`  Case keywords: ${caseErrors.length}`);
console.log(`  Else keywords: ${elseErrors.length}`);
console.log(`  End keywords: ${endErrors.length}`);
console.log(`  Others: ${unexpectedErrors.length - colonErrors.length - caseErrors.length - elseErrors.length - endErrors.length}`);