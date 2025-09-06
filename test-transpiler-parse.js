const fs = require('fs');
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Read the transpiler source
const source = fs.readFileSync('./src/transpiler.ts', 'utf-8');

console.log('Source file size:', source.length, 'bytes');

// Tokenize and parse
const lexer = new Lexer(source);
const tokens = lexer.tokenize();
console.log('Total tokens:', tokens.length);

const parser = new Parser(tokens);
const ast = parser.parse();

// Count class declarations and their methods
let classCount = 0;
let methodCount = 0;
let functionCount = 0;

function countElements(node) {
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
    
    if (node.kind === 'FuncDecl') {
      functionCount++;
      console.log(`Found function: ${node.name?.name}`);
    }
    
    // Recurse through all properties
    for (const key in node) {
      if (node[key]) {
        if (Array.isArray(node[key])) {
          node[key].forEach(child => countElements(child));
        } else if (typeof node[key] === 'object') {
          countElements(node[key]);
        }
      }
    }
  }
}

countElements(ast);

console.log(`\nAST nodes: ${ast.body.length}`);
console.log(`Classes found: ${classCount}`);
console.log(`Methods parsed: ${methodCount}`);
console.log(`Functions parsed: ${functionCount}`);
console.log(`Parse errors: ${parser.errors.length}`);

if (parser.errors.length > 0) {
  console.log('\nFirst 10 errors:');
  parser.errors.slice(0, 10).forEach(err => {
    console.log(`  - ${err.message} at "${err.token?.value}" (line ${err.token?.line})`);
  });
}