const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `class Bar {
  volatile x: number;
  synchronized method() {}
}`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens:');
tokens.forEach((t, i) => {
  if (t.type !== 'EOF') {
    console.log(`  ${i}: ${t.type} "${t.value}"`);
  }
});

try {
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('\nParsed! Class members:');
  const cls = ast.body[0];
  if (cls.members) {
    cls.members.forEach((m, i) => {
      console.log(`  ${i}: ${m.kind} "${m.name?.name || '(no name)'}"`, 
                  m.tokens ? `[Unknown with ${m.tokens.length} tokens]` : '');
    });
  }
  
  console.log('\nFull AST:');
  console.log(JSON.stringify(ast, null, 2));
} catch (e) {
  console.error('\nError:', e.message);
}