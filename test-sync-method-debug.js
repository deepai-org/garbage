const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `class Test {
  synchronized foo() {}
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.slice(0, 10).forEach((t, i) => {
  console.log(`  ${i}: ${t.type} "${t.value}"`);
});

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const cls = ast.body[0];
  console.log('\nMembers:');
  cls.members.forEach((m, i) => {
    console.log(`  ${i}: ${m.kind} "${m.name?.name}"`, 
                m.unknownModifiers ? `unknown=${JSON.stringify(m.unknownModifiers)}` : '');
  });
} catch (e) {
  console.error('Error:', e.message);
}