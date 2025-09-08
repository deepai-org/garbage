const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `class Shape {
  area(): number;
  perimeter(): number;
}`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  console.log('\nTokens:');
  tokens.slice(0, 15).forEach((t, i) => {
    console.log(`  ${i}: ${t.type} "${t.value}"`);
  });
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nParsed!');
  const cls = ast.body[0];
  console.log('Class kind:', cls.kind);
  console.log('Members:', cls.members?.length);
  if (cls.members) {
    cls.members.forEach((m, i) => {
      console.log(`  ${i}: ${m.kind} "${m.name?.name}" body=${m.body ? 'YES' : 'NO'}`);
    });
  }
} catch (e) {
  console.error('\nError:', e.message);
}