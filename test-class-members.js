const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Parse the actual parser.ts file and look at the class structure
const code = fs.readFileSync('./src/parser.ts', 'utf-8');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Find the Parser class in the AST
for (const node of ast.body) {
  if (node.kind === 'ExportDecl' && node.declaration?.kind === 'ClassDecl') {
    const classDecl = node.declaration;
    if (classDecl.name?.name === 'Parser') {
      console.log('Parser class members:');
      classDecl.members?.forEach((member, i) => {
        const name = member.name?.name || member.kind;
        console.log(`  ${i + 1}. ${member.kind}: ${name}`);
      });
      
      // Find the span of the last member
      if (classDecl.members && classDecl.members.length > 0) {
        const lastMember = classDecl.members[classDecl.members.length - 1];
        console.log('\nLast member span:', lastMember.span);
        
        // Find what token this corresponds to
        const endPos = lastMember.span?.end;
        if (endPos !== undefined) {
          // Find the token at this position
          let tokenIndex = 0;
          for (let i = 0; i < tokens.length; i++) {
            if (i >= endPos) {
              tokenIndex = i;
              break;
            }
          }
          console.log('Last member ends around token', tokenIndex);
          console.log('Tokens around that position:');
          for (let i = Math.max(0, tokenIndex - 2); i < Math.min(tokens.length, tokenIndex + 5); i++) {
            console.log(`  [${i}] ${tokens[i].type}:${tokens[i].value}`);
          }
        }
      }
    }
  }
}