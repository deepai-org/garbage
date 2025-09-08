const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `type Process = (input: string, options?: Config) => Result;`;
console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('\nTokens:');
tokens.forEach((t, i) => {
  console.log(`  ${i}: ${t.type} "${t.value}"`);
});

const parser = new Parser(tokens);
const ast = parser.parse();

const typeDecl = ast.body[0];
console.log('\nTypeDecl found:', typeDecl.kind);
console.log('Definition kind:', typeDecl.definition.kind);

if (typeDecl.definition.kind === 'FuncType') {
  console.log('Parameters:');
  typeDecl.definition.params.forEach((p, i) => {
    console.log(`  ${i}:`, {
      name: p.name?.name,
      type: p.type?.kind,
      optional: p.optional
    });
  });
}