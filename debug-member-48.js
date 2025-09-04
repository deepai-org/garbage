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

if (classDecl && classDecl.members) {
  const members = classDecl.members;
  console.log(`Found ${members.length} members\n`);
  
  // Show members 45-48
  console.log('Members 45-48:');
  for (let i = 44; i < Math.min(48, members.length); i++) {
    const m = members[i];
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name}`);
    
    if (m.span) {
      // Find the line where this member is
      let memberLine = 0;
      for (let t of tokens) {
        if (t.type === 'EOF') break;
        if (tokens.indexOf(t) <= m.span.end) {
          memberLine = t.line;
        } else {
          break;
        }
      }
      console.log(`     Ends around line ${memberLine}`);
    }
  }
  
  // Check errors after the last member
  const lastMember = members[members.length - 1];
  if (lastMember.span) {
    const lastMemberEnd = lastMember.span.end;
    console.log(`\nLast member ends at token position ${lastMemberEnd}`);
    
    // Show next few tokens
    console.log('\nNext 10 tokens:');
    for (let i = lastMemberEnd + 1; i < Math.min(lastMemberEnd + 11, tokens.length); i++) {
      const t = tokens[i];
      if (t.type !== 'EOF') {
        console.log(`  [${i}] ${t.type}:${t.value} (line ${t.line})`);
      }
    }
  }
}