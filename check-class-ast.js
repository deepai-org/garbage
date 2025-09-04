const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simple test of class parsing
const code = `
export class Parser {
  private tokens: Token[] = [];
  private current = 0;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => 
      t.type !== TokenType.Comment
    );
  }
  
  private parseStatement(): AST.Stmt {
    return null;
  }
}
`;

console.log('Testing basic class parsing:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('AST nodes:', ast.body.length);
ast.body.forEach((node, i) => {
  console.log(`  ${i}: ${node.kind}`);
  if (node.kind === 'ExportDecl' && node.declaration) {
    console.log(`    -> ${node.declaration.kind}`);
    if (node.declaration.kind === 'ClassDecl') {
      console.log(`       Members: ${node.declaration.members?.length || 0}`);
    }
  }
});

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  ${e.message} at token '${e.token.value}'`);
  });
}