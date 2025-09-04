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
      console.log('Found Parser class!');
      console.log('Class has', classDecl.members?.length || 0, 'members');
      
      // Check if there are any members
      if (!classDecl.members || classDecl.members.length === 0) {
        console.log('WARNING: Parser class body appears empty!');
        
        // Let's check where the class parsing stopped
        const classStart = tokens.findIndex(t => t.value === 'Parser');
        const braceAfterParser = tokens.findIndex((t, i) => i > classStart && t.value === '{');
        console.log('Class starts at token', classStart);
        console.log('Opening brace at token', braceAfterParser);
        
        // Check what happens after the brace
        console.log('\nTokens after class opening:');
        for (let i = braceAfterParser; i < Math.min(braceAfterParser + 10, tokens.length); i++) {
          console.log(`  [${i}] ${tokens[i].type}:${tokens[i].value}`);
        }
      }
    }
  }
}