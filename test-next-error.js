const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
parser.parse();

// Group errors
const errorGroups = {};
parser.errors.forEach(e => {
  const key = e.message;
  if (!errorGroups[key]) {
    errorGroups[key] = { count: 0, examples: [] };
  }
  errorGroups[key].count++;
  if (errorGroups[key].examples.length < 3 && e.token) {
    errorGroups[key].examples.push({
      token: e.token.value,
      line: e.token.line
    });
  }
});

console.log('Total parse errors:', parser.errors.length);
console.log('\nTop error patterns:');
Object.entries(errorGroups)
  .sort((a, b) => b[1].count - a[1].count)
  .slice(0, 10)
  .forEach(([msg, data]) => {
    console.log(`  ${data.count}x: ${msg}`);
    if (data.examples.length > 0) {
      console.log('     Examples:');
      data.examples.forEach(ex => {
        console.log(`       Line ${ex.line}: token '${ex.token}'`);
      });
    }
  });

// Find first "Unexpected token in expression" error
const unexpectedErrors = parser.errors.filter(e => 
  e.message === "Unexpected token in expression");

if (unexpectedErrors.length > 0) {
  const first = unexpectedErrors[0];
  console.log('\n=== First "Unexpected token" error ===');
  console.log('Token:', first.token?.value);
  console.log('Line:', first.token?.line);
  console.log('Type:', first.token?.type);
}