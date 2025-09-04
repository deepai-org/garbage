const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find the Parser class and check first few methods
console.log('Checking Parser class methods:');

// Let's look at what methods should be there early on
for (let i = 90; i < 110; i++) {
  const line = lines[i - 1];
  if (line.includes('private') || line.includes('public') || line.includes('protected')) {
    console.log(`Line ${i}: ${line.trim().substring(0, 60)}`);
  }
}

// Now parse and see what we get
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

// Capture first errors
const originalError = parser.error.bind(parser);
let errorCount = 0;
parser.error = function(message) {
  if (errorCount < 5) {
    const token = this.peek();
    console.log(`\nERROR ${++errorCount}: ${message}`);
    console.log(`  at token: ${token.type}:${token.value}`);
    console.log(`  position: ${this.current}`);
  }
  return originalError(message);
};

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
  console.log(`\nParser class has ${members.length} members`);
  
  // Show first 10 members  
  console.log('\nFirst 10 members:');
  for (let i = 0; i < Math.min(10, members.length); i++) {
    const m = members[i];
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name} (${m.kind})`);
  }
}