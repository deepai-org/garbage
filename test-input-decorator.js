const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `class Component {
  @Input() title: string;
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
console.log('\nTokens:');
tokens.forEach((t, i) => {
  console.log(`  ${i}: ${t.type} "${t.value}"`);
});

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const classDecl = ast.body[0];
  console.log('\nClass found:', classDecl.name.name);
  console.log('Members:', classDecl.members.length);
  classDecl.members.forEach((m, i) => {
    console.log(`  ${i}: ${m.kind} "${m.name?.name}"`);
  });
} catch (e) {
  console.error('\nError:', e.message);
  console.error('Stack:', e.stack);
}