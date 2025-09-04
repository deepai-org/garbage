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

if (classDecl && classDecl.members) {
  console.log(`Found ${classDecl.members.length} class members:\n`);
  
  classDecl.members.forEach((member, i) => {
    if (member.kind === 'Constructor') {
      console.log(`  ${i}: Constructor`);
    } else if (member.name) {
      console.log(`  ${i}: ${member.name.name || member.name}`);
    } else {
      console.log(`  ${i}: ${member.kind || 'Unknown'}`);
    }
  });
  
  // Find where the class parsing stopped
  const lastMember = classDecl.members[classDecl.members.length - 1];
  if (lastMember && lastMember.span) {
    // Find the token at that position
    const endPos = lastMember.span.end;
    const tokenAtEnd = tokens[endPos];
    if (tokenAtEnd) {
      console.log(`\nLast member ends at line ${tokenAtEnd.line}`);
      
      // Show what comes after
      console.log('\nTokens after last member:');
      for (let i = endPos + 1; i < Math.min(endPos + 10, tokens.length); i++) {
        const t = tokens[i];
        if (t.type !== 'EOF') {
          console.log(`  [${i}] ${t.type}:${t.value} (line ${t.line})`);
        }
      }
    }
  }
}