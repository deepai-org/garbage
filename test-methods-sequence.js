const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find all method declarations
const methods = [];
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.match(/^\s*(private|public|protected)\s+\w+\s*\(/)) {
    const methodName = line.match(/\s+(\w+)\s*\(/)?.[1];
    if (methodName) {
      methods.push({ line: i + 1, name: methodName });
    }
  }
}

// Extract methods 70-80 and wrap in a class
const startLine = methods[69].line - 1; // 0-indexed
const endLine = methods[79] ? methods[79].line - 1 : methods[78].line + 100;

const testCode = `
export class TestParser {
${lines.slice(startLine, endLine).join('\n')}
}
`;

console.log('=== Testing methods 70-80 ===\n');
console.log('Methods to parse:');
methods.slice(69, 80).forEach((m, i) => {
  console.log(`  Method ${70 + i}: ${m.name} (line ${m.line})`);
});

const lexer = new Lexer(testCode);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  // Find the class
  let classNode = ast.body[0];
  if (classNode?.kind === 'ExportDecl') {
    classNode = classNode.declaration;
  }
  
  if (classNode?.kind === 'ClassDecl') {
    console.log(`\nActually parsed ${classNode.members?.length || 0} members:`);
    classNode.members?.forEach((m, idx) => {
      if (m.kind === 'Method') {
        const name = m.name?.name || 'unnamed';
        console.log(`  Member ${idx}: ${name}`);
      }
    });
  }
  
  console.log(`\nTotal parse errors: ${parser.errors.length}`);
  
  // Show unique error patterns
  const errorPatterns = {};
  parser.errors.forEach(e => {
    const pattern = e.message;
    errorPatterns[pattern] = (errorPatterns[pattern] || 0) + 1;
  });
  
  console.log('\nError patterns:');
  Object.entries(errorPatterns)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .forEach(([pattern, count]) => {
      console.log(`  ${count}x: ${pattern}`);
    });
} catch (e) {
  console.log(`\nParse failed: ${e.message}`);
}