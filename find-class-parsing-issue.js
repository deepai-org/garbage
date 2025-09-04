const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

// Find the Parser class
let classStartLine = -1;
let classEndLine = -1;
let braceCount = 0;
let inClass = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (line.includes('export class Parser')) {
    classStartLine = i + 1;
    inClass = true;
  }
  
  if (inClass) {
    for (let char of line) {
      if (char === '{') braceCount++;
      if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          classEndLine = i + 1;
          inClass = false;
          break;
        }
      }
    }
  }
  
  if (classEndLine > 0) break;
}

console.log(`Parser class should span lines ${classStartLine} to ${classEndLine}`);
console.log(`Total lines in file: ${lines.length}`);

// Now parse and see what the AST thinks
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find the export node with the class
let exportNode = null;
for (let node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    if (node.declaration.name?.name === 'Parser') {
      exportNode = node;
      break;
    }
  }
}

if (exportNode) {
  console.log('\nFound Parser class in AST');
  const classDecl = exportNode.declaration;
  console.log(`Class has ${classDecl.members?.length || 0} members`);
  
  // Check span
  if (classDecl.span) {
    // Find the line of the last token in the span
    let lastTokenLine = 0;
    for (let t of tokens) {
      if (t.type === 'EOF') break;
      if (t.line <= classDecl.span.end) {
        lastTokenLine = t.line;
      }
    }
    console.log(`Class span suggests it ends around line ${lastTokenLine}`);
  }
} else {
  console.log('\nParser class NOT found in AST!');
  
  // Show what's at the beginning
  console.log('\nFirst 5 AST nodes:');
  ast.body.slice(0, 5).forEach((node, i) => {
    console.log(`  ${i}: ${node.kind}`);
  });
}