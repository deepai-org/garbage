const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log(`Total errors: ${parser.errors.length}`);

// Map errors to line numbers
const errorsByLine = {};
parser.errors.forEach(e => {
  if (e.token) {
    // Try to find the line number for this token
    let lineNum = 1;
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= e.token.position) {
        lineNum = i + 1;
        break;
      }
      charCount += lines[i].length + 1; // +1 for newline
    }
    
    if (!errorsByLine[lineNum]) {
      errorsByLine[lineNum] = [];
    }
    errorsByLine[lineNum].push(e.message);
  }
});

// Find the first few error clusters
const sortedLines = Object.keys(errorsByLine).map(Number).sort((a, b) => a - b);
console.log('\nFirst error clusters:');
sortedLines.slice(0, 10).forEach(line => {
  console.log(`Line ${line}: ${errorsByLine[line][0]}`);
  const codeLine = lines[line - 1];
  if (codeLine) {
    console.log(`  Code: ${codeLine.trim().substring(0, 60)}`);
  }
});

// Find methods with most errors
const methodRanges = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^\s*(private|public|protected)\s+\w+\(/)) {
    const methodName = line.match(/\s+(\w+)\(/)?.[1];
    if (methodName) {
      methodRanges.push({ name: methodName, start: i + 1, errors: 0 });
    }
  }
}

// Count errors per method
methodRanges.forEach((method, idx) => {
  const nextStart = methodRanges[idx + 1]?.start || lines.length;
  for (let line = method.start; line < nextStart; line++) {
    if (errorsByLine[line]) {
      method.errors += errorsByLine[line].length;
    }
  }
});

console.log('\nMethods with most errors:');
methodRanges
  .filter(m => m.errors > 0)
  .sort((a, b) => b.errors - a.errors)
  .slice(0, 10)
  .forEach(m => {
    console.log(`  ${m.name}: ${m.errors} errors (line ${m.start})`);
  });