const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `abstract class Shape {
  abstract area(): number;
  abstract perimeter(): number;
}`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nParsed!');
  if (ast.body.length > 0) {
    const cls = ast.body[0];
    console.log('Class kind:', cls.kind);
    console.log('Members:', cls.members?.length);
    if (cls.members) {
      cls.members.forEach((m, i) => {
        console.log(`  ${i}: ${m.kind} "${m.name?.name}"`);
      });
    }
  }
} catch (e) {
  console.error('\nError:', e.message);
}