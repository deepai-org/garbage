const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
const assertion = <Type>value;
const jsx = <Type />;
`;

console.log('Code:', code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  console.log('\n✓ Parsed');
  console.log('Statements:', ast.body.length);
  
  ast.body.forEach((stmt, i) => {
    console.log(`\nStatement ${i}:`, stmt.kind);
    if (stmt.kind === 'VarDecl' && stmt.values?.length > 0) {
      const val = stmt.values[0];
      console.log('  Value kind:', val.kind);
      if (val.kind === 'Cast') {
        console.log('  -> Type assertion');
      } else if (val.kind === 'JSXElement') {
        console.log('  -> JSX element');
        const tag = val.openingElement?.name?.name;
        console.log('  -> Tag:', tag);
      }
    }
  });
} catch (e) {
  console.log('\n✗ Parse error:', e.message);
}
