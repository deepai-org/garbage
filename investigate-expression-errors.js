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
const exprErrors = parser.errors.filter(e => 
  e.message.includes('Unexpected token in expression')
);

// Group by token value
const tokenGroups = {};
exprErrors.forEach(e => {
  const token = e.token.value;
  if (!tokenGroups[token]) {
    tokenGroups[token] = 0;
  }
  tokenGroups[token]++;
});

console.log('UNEXPECTED TOKENS IN EXPRESSIONS:');
console.log('==================================\n');

Object.entries(tokenGroups)
  .sort((a, b) => b[1] - a[1])
  .forEach(([token, count]) => {
    console.log(`Token "${token}": ${count} occurrences`);
  });

console.log('\n\nSPECIFIC EXAMPLES:');
console.log('==================\n');

// Show examples of the most common unexpected tokens
[';', ':', ')', '=>'].forEach(token => {
  const examples = exprErrors.filter(e => e.token.value === token).slice(0, 3);
  if (examples.length > 0) {
    console.log(`\nToken "${token}" examples:`);
    examples.forEach(e => {
      const line = lines[e.token.line - 1] || '';
      console.log(`  Line ${e.token.line}: ${line.trim().substring(0, 60)}`);
    });
  }
});