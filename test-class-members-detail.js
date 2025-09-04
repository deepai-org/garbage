const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Get detailed info about Parser class members
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
      console.log(`Parser class members (${classDecl.members?.length || 0} total):\n`);
      
      classDecl.members?.forEach((member, i) => {
        const name = member.name?.name || 'unnamed';
        const span = member.span;
        
        // Find the token at this position to get line number
        let line = '?';
        for (const token of tokens) {
          if (token.start >= span.start) {
            line = token.line;
            break;
          }
        }
        
        console.log(`${i + 1}. Line ${line}: ${member.kind} ${name}`);
      });
      
      break;
    }
  }
}