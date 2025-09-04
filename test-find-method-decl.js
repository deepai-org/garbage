const { Lexer } = require('./dist/lexer');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Find the parseFuncDecl method declaration (with 'private' before it)
let methodDeclToken = -1;
for (let i = 0; i < tokens.length - 2; i++) {
  if (tokens[i].value === 'private' && tokens[i+1].value === 'parseFuncDecl') {
    methodDeclToken = i + 1;
    console.log(`Found 'private parseFuncDecl' at token ${i}`);
    break;
  }
}

if (methodDeclToken === -1) {
  // Try without private
  for (let i = 0; i < tokens.length - 2; i++) {
    if (tokens[i].value === 'parseFuncDecl' && tokens[i+1].value === '(') {
      // Check if it looks like a declaration (has type annotation)
      let j = i + 2;
      let parenDepth = 1;
      while (j < tokens.length && parenDepth > 0) {
        if (tokens[j].value === '(') parenDepth++;
        if (tokens[j].value === ')') parenDepth--;
        j++;
      }
      if (j < tokens.length && tokens[j].value === ':') {
        methodDeclToken = i;
        console.log(`Found parseFuncDecl declaration at token ${i}`);
        break;
      }
    }
  }
}

if (methodDeclToken > 0) {
  console.log('\nTokens around parseFuncDecl declaration:');
  for (let i = methodDeclToken - 5; i < methodDeclToken + 35; i++) {
    const t = tokens[i];
    if (t.type !== 'VirtualSemi' && t.type !== 'Comment') {
      console.log(`  [${i}] ${t.type}:${t.value}`);
    }
  }
}