const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Check where the Parser class ends in the AST
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find the Parser class
for (const node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    const classDecl = node.declaration;
    if (classDecl.name?.name === 'Parser') {
      console.log(`Parser class has ${classDecl.members?.length || 0} members`);
      
      // Find the last member
      if (classDecl.members && classDecl.members.length > 0) {
        const lastMember = classDecl.members[classDecl.members.length - 1];
        console.log(`Last member: ${lastMember.kind} ${lastMember.name?.name || 'unnamed'}`);
        console.log(`Last member span:`, lastMember.span);
        
        // Find what line this corresponds to
        const endToken = tokens.find(t => t.start >= lastMember.span.end);
        if (endToken) {
          console.log(`Class parsing ends around line ${endToken.line}`);
          
          // Show what comes after
          const tokenIndex = tokens.indexOf(endToken);
          console.log('\nTokens after last member:');
          for (let i = tokenIndex - 2; i < Math.min(tokenIndex + 10, tokens.length); i++) {
            const marker = i === tokenIndex ? ' <-- Class ends here' : '';
            console.log(`  [${i}] ${tokens[i].type}:${tokens[i].value}${marker}`);
          }
        }
      }
      break;
    }
  }
}

// Check what's parsed after the class
console.log('\nTotal AST nodes:', ast.body.length);
let foundParser = false;
for (let i = 0; i < ast.body.length; i++) {
  const node = ast.body[i];
  if (node.kind === 'ExportDecl' && node.declaration?.name?.name === 'Parser') {
    foundParser = true;
    console.log(`Node ${i}: Parser class`);
  } else if (foundParser && i < 10) {
    console.log(`Node ${i}: ${node.kind}`);
  }
}