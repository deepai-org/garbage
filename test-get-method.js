const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `class Container {
  get(index: int): T {
    return this.items[index]
  }
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('\nTokens around get:');
for (let i = 0; i < tokens.length; i++) {
  if (tokens[i].value === 'get' || (i > 0 && tokens[i-1].value === 'get')) {
    console.log(`  ${i}: ${tokens[i].type} "${tokens[i].value}"`);
  }
}

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const classDecl = ast.body[0];
  console.log('\nClass members:');
  classDecl.members.forEach((m, i) => {
    console.log(`  ${i}: ${m.kind} "${m.name?.name}"`, m.params ? `with ${m.params.length} params` : '');
  });
} catch (e) {
  console.error('\nError:', e.message);
}