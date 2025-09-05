const fs = require('fs');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

console.log('=== PolyScript Self-Parsing Test ===\n');

// Read the parser source code
const parserSource = fs.readFileSync('./src/parser.ts', 'utf8');

console.log(`Source code stats:`);
console.log(`- Total lines: ${parserSource.split('\n').length}`);
console.log(`- Total chars: ${parserSource.length}`);

try {
  // Tokenize
  console.log('\n1. Tokenizing...');
  const lexer = new Lexer(parserSource);
  const tokens = lexer.tokenize();
  console.log(`✓ Tokenization successful: ${tokens.length} tokens`);

  // Parse
  console.log('\n2. Parsing...');
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log(`✓ Parsing successful!`);
  console.log(`- AST body length: ${ast.body.length}`);
  console.log(`- Root node type: ${ast.type}`);
  
  // Count different node types
  const nodeTypes = {};
  function countNodes(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type) {
      nodeTypes[node.type] = (nodeTypes[node.type] || 0) + 1;
    }
    for (const key in node) {
      if (Array.isArray(node[key])) {
        node[key].forEach(countNodes);
      } else if (typeof node[key] === 'object') {
        countNodes(node[key]);
      }
    }
  }
  countNodes(ast);
  
  console.log('\n3. AST Node Types:');
  Object.entries(nodeTypes)
    .sort(([,a], [,b]) => b - a)
    .forEach(([type, count]) => {
      console.log(`   ${type}: ${count}`);
    });

  console.log('\n✅ SUCCESS: Parser can parse 100% of its own source code!');
  
} catch (error) {
  console.log('\n❌ PARSING FAILED');
  console.log('Error:', error.message);
  
  if (error.message.includes('line')) {
    const lines = parserSource.split('\n');
    const match = error.message.match(/line (\d+)/);
    if (match) {
      const lineNum = parseInt(match[1]);
      console.log(`\nContext around line ${lineNum}:`);
      for (let i = Math.max(0, lineNum - 3); i < Math.min(lines.length, lineNum + 2); i++) {
        const marker = i === lineNum - 1 ? '>>> ' : '    ';
        console.log(`${marker}${i + 1}: ${lines[i]}`);
      }
    }
  }
  
  // Try to get more detailed error info
  console.log('\nFull error details:');
  console.log(error.stack);
}