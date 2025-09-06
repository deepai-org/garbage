const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simple JavaScript transpiler that removes all type annotations
class SimpleJSTranspiler {
  constructor() {
    this.output = '';
    this.indentLevel = 0;
  }
  
  emit(text) {
    this.output += text;
  }
  
  emitLine(text = '') {
    this.output += text + '\n';
  }
  
  transpile(ast) {
    console.log('AST:', JSON.stringify(ast, null, 2));
    return this.output;
  }
}

const code = `
class Parser {
  tokens: Token[];
  current: number;
  
  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.current = 0;
  }
  
  advance(): Token {
    return this.tokens[this.current++];
  }
}
`;

console.log('Input TypeScript:');
console.log(code);

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

console.log('\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  - ${e.message}`);
  });
} else {
  const transpiler = new SimpleJSTranspiler();
  transpiler.transpile(ast);
}