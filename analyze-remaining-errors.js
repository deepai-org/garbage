const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('=== Detailed Error Analysis ===\n');
console.log(`Total errors: ${parser.errors.length}`);

// Group errors by type
const errorTypes = {};
const errorExamples = {};

parser.errors.forEach(e => {
  const key = e.message.split(' at ')[0];
  errorTypes[key] = (errorTypes[key] || 0) + 1;
  
  // Keep first 3 examples of each error type
  if (!errorExamples[key]) {
    errorExamples[key] = [];
  }
  if (errorExamples[key].length < 3 && e.token) {
    const tokenIndex = tokens.indexOf(e.token);
    if (tokenIndex >= 0) {
      // Find line number
      let lineNum = 1;
      let charCount = 0;
      for (let i = 0; i < lines.length; i++) {
        if (charCount + lines[i].length >= e.token.position) {
          lineNum = i + 1;
          break;
        }
        charCount += lines[i].length + 1;
      }
      
      errorExamples[key].push({
        token: e.token.value,
        line: lineNum,
        context: lines[lineNum - 1]?.substring(0, 80)
      });
    }
  }
});

console.log('\n=== Error Types by Frequency ===\n');
Object.entries(errorTypes)
  .sort((a, b) => b[1] - a[1])
  .forEach(([msg, count]) => {
    console.log(`${count}x: ${msg}`);
    if (errorExamples[msg]) {
      errorExamples[msg].forEach(ex => {
        console.log(`     Line ${ex.line}: "${ex.token}" in: ${ex.context}`);
      });
    }
    console.log();
  });

// Analyze "Unexpected token in expression" - the most common
console.log('\n=== Deep Dive: "Unexpected token in expression" (89 instances) ===\n');

const unexpectedTokens = {};
parser.errors
  .filter(e => e.message.includes('Unexpected token in expression'))
  .forEach(e => {
    if (e.token) {
      const key = `${e.token.type}:${e.token.value}`;
      unexpectedTokens[key] = (unexpectedTokens[key] || 0) + 1;
    }
  });

console.log('Token types causing "Unexpected token in expression":');
Object.entries(unexpectedTokens)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([token, count]) => {
    console.log(`  ${count}x: ${token}`);
  });

// Analyze switch/case errors
console.log('\n=== Deep Dive: Case/Switch Errors ===\n');

const caseErrors = parser.errors
  .filter(e => e.message.includes('case') || e.message.includes('switch'));

console.log(`Total case/switch errors: ${caseErrors.length}`);
console.log('\nSample locations:');
caseErrors.slice(0, 5).forEach(e => {
  if (e.token) {
    const tokenIndex = tokens.indexOf(e.token);
    if (tokenIndex >= 0) {
      // Show context
      console.log(`\nError: ${e.message}`);
      console.log('Context:');
      for (let i = Math.max(0, tokenIndex - 3); i <= Math.min(tokens.length - 1, tokenIndex + 3); i++) {
        const t = tokens[i];
        if (t.type !== 'VirtualSemi' && t.type !== 'EOF') {
          const marker = i === tokenIndex ? ' <-- ERROR' : '';
          console.log(`  [${i}] ${t.type}:${t.value}${marker}`);
        }
      }
    }
  }
});