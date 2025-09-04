const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

const lines = code.split('\n');
const totalLines = lines.filter(line => line.trim()).length;
const errorLines = new Set(parser.errors.map(e => e.line)).size;

console.log('PARSER.TS PARSING SUMMARY');
console.log('=========================');
console.log(`Total lines: ${lines.length}`);
console.log(`Non-empty lines: ${totalLines}`);
console.log(`Lines with errors: ${errorLines}`);
console.log(`Lines successfully parsed: ${totalLines - errorLines} (${((totalLines - errorLines) / totalLines * 100).toFixed(1)}%)`);
console.log(`Total parse errors: ${parser.errors.length}`);
console.log(`\nERRORS DOWN FROM:`);
console.log(`  976 → 413 → 379 → ${parser.errors.length} errors`);

// Show error types
const errorTypes = {};
parser.errors.forEach(e => {
  const msg = e.message.split(' at token')[0];
  errorTypes[msg] = (errorTypes[msg] || 0) + 1;
});

console.log('\nTop error types:');
Object.entries(errorTypes)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5)
  .forEach(([msg, count]) => {
    console.log(`  ${count}: ${msg}`);
  });