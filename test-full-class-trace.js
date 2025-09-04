const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find where Parser class starts
let parserClassStart = -1;
for (let i = 0; i < tokens.length - 2; i++) {
  if (tokens[i].value === 'class' && tokens[i+1].value === 'Parser') {
    parserClassStart = i;
    break;
  }
}

console.log('Parser class starts at token', parserClassStart);

// Find where parseFuncDecl appears
let parseFuncDeclToken = -1;
for (let i = parserClassStart; i < tokens.length; i++) {
  if (tokens[i].value === 'parseFuncDecl') {
    parseFuncDeclToken = i;
    break;
  }
}

console.log('parseFuncDecl appears at token', parseFuncDeclToken);

// Show tokens around parseFuncDecl
console.log('\nTokens before parseFuncDecl:');
for (let i = parseFuncDeclToken - 10; i < parseFuncDeclToken; i++) {
  const t = tokens[i];
  if (t.type !== 'VirtualSemi' && t.type !== 'Comment') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
}

console.log('\nTokens at and after parseFuncDecl:');
for (let i = parseFuncDeclToken; i < parseFuncDeclToken + 20; i++) {
  const t = tokens[i];
  if (t.type !== 'VirtualSemi' && t.type !== 'Comment') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
}

// Now parse and check members
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
  console.log(`\nClass parsed with ${members.length} members`);
  
  // Show members 40-50
  console.log('\nMembers 40-50:');
  for (let i = 40; i < Math.min(50, members.length); i++) {
    const m = members[i];
    const name = m.name?.name || m.kind || 'Unknown';
    const isMethod = m.kind === 'MethodDecl';
    console.log(`  ${i}: ${name} (${m.kind})`);
  }
}