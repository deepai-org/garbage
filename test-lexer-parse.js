const fs = require('fs');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Read the lexer source
const source = fs.readFileSync('./src/lexer.ts', 'utf-8');

// Tokenize and parse
const lexer = new Lexer(source);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Count class declarations and their methods
let classCount = 0;
let methodCount = 0;

function countMethods(node) {
  if (node && typeof node === 'object') {
    if (node.kind === 'ClassDecl') {
      classCount++;
      console.log(`Found class: ${node.name?.name}`);
      if (node.members && Array.isArray(node.members)) {
        node.members.forEach(member => {
          if (member.kind === 'Method' || member.kind === 'Constructor') {
            methodCount++;
            console.log(`  - ${member.kind}: ${member.name?.name || 'constructor'}`);
          }
        });
      }
    }
    
    // Recurse through all properties
    for (const key in node) {
      if (node[key]) {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => countMethods(child));
        } else if (typeof node[key] === 'object') {
          countMethods(node[key]);
        }
      }
    }
  }
}

countMethods(ast);

console.log(`\nAST nodes: ${ast.body.length}`);
console.log(`Classes found: ${classCount}`);
console.log(`Methods parsed: ${methodCount}`);
console.log(`Parse errors: ${parser.errors.length}`);

if (parser.errors.length > 0) {
  console.log('\nFirst 10 errors:');
  parser.errors.slice(0, 10).forEach(err => {
    console.log(`  - ${err.message} at "${err.token?.value}" (line ${err.token?.line})`);
  });
}