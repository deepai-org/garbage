const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `<Component<Props> />`;

console.log('Testing JSX with generic component parsing...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('Tokens:');
tokens.forEach((t, i) => {
  console.log(`  [${i}] ${t.type}: "${t.value}"`);
});

console.log('\n--- Parsing ---');
const parser = new Parser(tokens);

// Trace isJSXElement
const origIsJSX = parser.isJSXElement;
parser.isJSXElement = function() {
  const result = origIsJSX.call(this);
  console.log('isJSXElement() =>', result);
  return result;
};

const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Errors:', parser.errors.map(e => e.message));

if (ast.body.length > 0 && ast.body[0].kind === 'ExprStmt') {
  const expr = ast.body[0].expr;
  console.log('\nExpression kind:', expr?.kind);
  if (expr?.kind === 'JSXElement') {
    console.log('JSX element name:', expr.openingElement?.name?.name);
    console.log('Self-closing:', expr.openingElement?.selfClosing);
  }
}