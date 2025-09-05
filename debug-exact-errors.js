const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
} catch (e) {
  // Ignore final error, we want to see collected errors
}

// Find colon errors and map to line numbers
const colonErrors = parser.errors.filter(e => 
  e.message === "Unexpected token in expression" && e.token?.value === ':');

console.log(`=== Analyzing ${colonErrors.length} colon errors ===\n`);

colonErrors.slice(0, 5).forEach((error, i) => {
  const tokenIndex = tokens.indexOf(error.token);
  
  // Find line number by counting characters
  let charCount = 0;
  let lineNum = 1;
  let colNum = 1;
  
  for (let j = 0; j < tokenIndex && j < tokens.length; j++) {
    const token = tokens[j];
    if (token.start !== undefined) {
      // Find which line contains this character position
      let tempCharCount = 0;
      let tempLineNum = 1;
      
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        if (tempCharCount + lines[lineIndex].length >= token.start) {
          tempLineNum = lineIndex + 1;
          break;
        }
        tempCharCount += lines[lineIndex].length + 1; // +1 for newline
      }
      
      lineNum = tempLineNum;
      break;
    }
  }
  
  console.log(`Error ${i + 1}:`);
  console.log(`  Token index: ${tokenIndex}`);
  console.log(`  Estimated line: ${lineNum}`);
  console.log(`  Context: ${lines[lineNum - 1]?.trim()}`);
  
  // Show tokens around the error
  console.log(`  Token context:`);
  for (let j = Math.max(0, tokenIndex - 3); j <= Math.min(tokens.length - 1, tokenIndex + 2); j++) {
    const t = tokens[j];
    const marker = j === tokenIndex ? ' <-- ERROR' : '';
    console.log(`    [${j}] ${t.type}:${t.value}${marker}`);
  }
  console.log();
});