const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
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
  console.log(`Parser class found with ${classDecl.members?.length || 0} members`);
  
  // Find the span of the class
  if (classDecl.span) {
    // Find what line the class ends on
    let lastLine = 0;
    for (let i = 0; i < tokens.length; i++) {
      if (i <= classDecl.span.end) {
        lastLine = Math.max(lastLine, tokens[i].line || 0);
      }
    }
    console.log(`Class appears to end around line ${lastLine}`);
  }
  
  // Show last member
  const members = classDecl.members || [];
  if (members.length > 0) {
    const lastMember = members[members.length - 1];
    console.log(`\nLast member: ${lastMember.name?.name || lastMember.kind}`);
  }
} else {
  console.log('Parser class not found in AST');
}

// Check if methods like isDeclStart are inside or outside the class
const lines = code.split('\n');
console.log('\nChecking key methods:');
[271, 307, 441, 1170].forEach(lineNum => {
  const line = lines[lineNum - 1];
  if (line && line.includes('private')) {
    console.log(`  Line ${lineNum}: ${line.trim().substring(0, 50)}`);
  }
});