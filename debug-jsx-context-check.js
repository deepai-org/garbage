const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `<Component<Props> />`;

console.log('Testing JSX context check...\n');
console.log('Code:', code, '\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('First token:', tokens[0].type, tokens[0].value);

const parser = new Parser(tokens);

// Trace context check
const origIsInJSX = parser.isInJSXExpressionContext;
parser.isInJSXExpressionContext = function() {
  const result = origIsInJSX.call(this);
  console.log('isInJSXExpressionContext() =>', result);
  return result;
};

// Trace JSX element check
const origIsJSXElem = parser.isJSXElement; 
parser.isJSXElement = function() {
  console.log('isJSXElement() called, current token:', this.peek()?.type, this.peek()?.value);
  const result = origIsJSXElem.call(this);
  console.log('isJSXElement() =>', result);
  return result;
};

const ast = parser.parse();

console.log('\nAST body length:', ast.body.length);
console.log('Errors:', parser.errors.map(e => e.message));