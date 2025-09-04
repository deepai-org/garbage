const fs = require('fs');

// Read the test file
const content = fs.readFileSync('./test/parser-polyglot-showcase.test.ts', 'utf-8');

// Find all test() blocks
const testRegex = /test\(['"`](.*?)['"`],.*?\(\) => \{([\s\S]*?)\n  \}\);/g;
let match;
let testNum = 1;

while ((match = testRegex.exec(content)) !== null) {
  const testName = match[1];
  const testBody = match[2];
  
  // Extract the code from const code = `...`
  const codeMatch = testBody.match(/const code = `([\s\S]*?)`;/);
  
  if (codeMatch) {
    const code = codeMatch[1];
    console.log(`Test ${testNum}: ${testName}`);
    console.log(`Code length: ${code.length} chars`);
    console.log('First 100 chars:', code.substring(0, 100).replace(/\n/g, '\\n'));
    console.log('---');
    
    // Save each test case
    fs.writeFileSync(`test-case-${testNum}.js`, `
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = \`${code}\`;

console.log('Testing: ${testName}');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(\`Success! AST body length: \${ast.body.length}\`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
`);
    
    testNum++;
  }
}

console.log(`\nExtracted ${testNum - 1} test cases`);