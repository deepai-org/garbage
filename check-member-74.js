const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find the Parser class
let classDecl = null;
for (let node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    if (node.declaration.name?.name === 'Parser') {
      classDecl = node.declaration;
      break;
    }
  }
}

if (classDecl) {
  const members = classDecl.members || [];
  console.log(`Parser class has ${members.length} members\n`);
  
  // Show members 70-74 (last few that parse correctly)
  console.log('Last successfully parsed members:');
  for (let i = Math.max(0, members.length - 5); i < members.length; i++) {
    const m = members[i];
    const name = m.name?.name || m.kind || 'Unknown';
    const type = m.kind;
    console.log(`  Member ${i}: ${name} (${type})`);
  }
  
  // Try to find what method should come after member 73
  console.log('\n=== What should come after member 73? ===\n');
  
  // Find line numbers of methods
  const methodLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.match(/^\s*(private|public|protected)\s+\w+\s*\(/)) {
      const methodName = line.match(/\s+(\w+)\s*\(/)?.[1];
      if (methodName) {
        methodLines.push({ line: i + 1, name: methodName });
      }
    }
  }
  
  console.log(`Found ${methodLines.length} method declarations in source\n`);
  
  // Show methods 70-80
  console.log('Methods 70-80 in source file:');
  methodLines.slice(69, 80).forEach((m, i) => {
    console.log(`  Method ${70 + i}: ${m.name} (line ${m.line})`);
  });
  
  // Check what's at the line of method 74
  if (methodLines[73]) {
    const problemLine = methodLines[73].line;
    console.log(`\n=== Method 74 should be "${methodLines[73].name}" at line ${problemLine} ===\n`);
    
    // Show the code around that line
    console.log('Code context:');
    for (let i = problemLine - 2; i < problemLine + 8; i++) {
      const marker = i === problemLine ? ' <<< METHOD 74' : '';
      console.log(`  ${i}: ${lines[i - 1]?.substring(0, 70)}${marker}`);
    }
  }
}