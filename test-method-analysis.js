const fs = require('fs');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

console.log('=== PolyScript Method-Level Parsing Analysis ===\n');

// Read the parser source code
const parserSource = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = parserSource.split('\n');

// Find all methods in the source using regex
const methodRegex = /^\s*(private |public |protected |static )*(async )?\s*(\w+)\s*\(/gm;
const allMethods = [];
let match;

while ((match = methodRegex.exec(parserSource)) !== null) {
  const methodName = match[3];
  if (methodName && !['if', 'while', 'for', 'catch', 'switch'].includes(methodName)) {
    const lineNumber = parserSource.substring(0, match.index).split('\n').length;
    allMethods.push({
      name: methodName,
      line: lineNumber,
      match: match[0].trim()
    });
  }
}

console.log(`Found ${allMethods.length} methods in parser.ts:`);
allMethods.forEach((method, i) => {
  console.log(`${i + 1}. ${method.name} (line ${method.line})`);
});

console.log(`\n=== Testing Individual Method Parsing ===\n`);

let successCount = 0;
let errorCount = 0;
const errors = [];

// Test parsing each method individually
for (const method of allMethods) {
  try {
    // Extract the method from source
    const startLine = method.line - 1;
    let endLine = startLine;
    let braceCount = 0;
    let foundStart = false;
    
    // Find the method's end by counting braces
    for (let i = startLine; i < lines.length; i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          braceCount++;
          foundStart = true;
        } else if (char === '}') {
          braceCount--;
          if (foundStart && braceCount === 0) {
            endLine = i;
            break;
          }
        }
      }
      if (foundStart && braceCount === 0) break;
    }
    
    const methodSource = lines.slice(startLine, endLine + 1).join('\n');
    
    // Try to parse the method
    const lexer = new Lexer(methodSource);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    console.log(`✓ ${method.name}`);
    successCount++;
    
  } catch (error) {
    console.log(`❌ ${method.name}: ${error.message}`);
    errors.push({
      method: method.name,
      line: method.line,
      error: error.message
    });
    errorCount++;
  }
}

console.log(`\n=== Summary ===`);
console.log(`Methods successfully parsed: ${successCount}/${allMethods.length} (${((successCount/allMethods.length)*100).toFixed(1)}%)`);
console.log(`Methods with errors: ${errorCount}`);
console.log(`Total errors: ${errors.length}`);

// Analyze error patterns
console.log(`\n=== Error Pattern Analysis ===`);
const errorPatterns = {};
errors.forEach(err => {
  const pattern = err.error.split(':')[0] || err.error;
  errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
});

Object.entries(errorPatterns)
  .sort(([,a], [,b]) => b - a)
  .forEach(([pattern, count]) => {
    console.log(`${count}x: ${pattern}`);
  });

// Show first few errors in detail
console.log(`\n=== First 5 Errors (Detail) ===`);
errors.slice(0, 5).forEach((err, i) => {
  console.log(`${i + 1}. Method: ${err.method} (line ${err.line})`);
  console.log(`   Error: ${err.error}`);
  
  // Show context
  const contextStart = Math.max(0, err.line - 3);
  const contextEnd = Math.min(lines.length, err.line + 2);
  console.log(`   Context:`);
  for (let i = contextStart; i < contextEnd; i++) {
    const marker = i === err.line - 1 ? '   >>> ' : '       ';
    console.log(`${marker}${i + 1}: ${lines[i]}`);
  }
  console.log('');
});