const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `const element = <Component<Props> data={items}>
  {items.map(item => <Item<T> key={item.id} />)}
</Component>;`;

console.log('Testing JSX with generic components...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  if (t.value === '<' || t.value === '>' || t.type === 'JSXTagStart' || t.type === 'JSXTagEnd' || t.type === 'Identifier') {
    console.log(`  [${i}] ${t.type}: "${t.value}"`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Errors:', parser.errors.map(e => e.message));

if (ast.body.length > 0) {
  const stmt = ast.body[0];
  console.log('\nFirst statement kind:', stmt.kind);
  if (stmt.kind === 'VarDecl') {
    console.log('VarDecl declarations:', stmt.declarations?.length);
    if (stmt.declarations && stmt.declarations[0]) {
      const decl = stmt.declarations[0];
      console.log('First declaration init kind:', decl.init?.kind);
    }
  }
}