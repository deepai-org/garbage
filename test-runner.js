const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Extract test cases from the showcase test file
const testFile = fs.readFileSync('./test/parser-polyglot-showcase.test.ts', 'utf-8');

// Extract test cases using regex
const testCases = [];
const regex = /test\(['"`](.*?)['"`].*?\n([\s\S]*?)testCode\(`([\s\S]*?)`\)/g;
let match;

while ((match = regex.exec(testFile)) !== null) {
  testCases.push({
    name: match[1],
    code: match[3]
  });
}

console.log(`Found ${testCases.length} test cases`);

// Run each test with timeout
for (let i = 0; i < testCases.length; i++) {
  const test = testCases[i];
  console.log(`\n[${i+1}/${testCases.length}] Testing: ${test.name}`);
  
  const startTime = Date.now();
  const timeout = setTimeout(() => {
    console.log(`  ❌ TIMEOUT after 1 second!`);
    console.log(`  Code snippet: ${test.code.substring(0, 100)}...`);
    process.exit(1);
  }, 1000);
  
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;
    
    if (ast.body.length > 0) {
      console.log(`  ✅ PASS (${elapsed}ms) - AST nodes: ${ast.body.length}`);
    } else {
      console.log(`  ⚠️  EMPTY AST (${elapsed}ms)`);
    }
  } catch (e) {
    clearTimeout(timeout);
    const elapsed = Date.now() - startTime;
    console.log(`  ❌ ERROR (${elapsed}ms): ${e.message}`);
  }
}

console.log('\nAll tests completed successfully!');