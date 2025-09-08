const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `class Container {
  get(index: int): T {
    return this.items[index]
  }
  
  set(value: T): void {
    this.value = value
  }
  
  get value(): T {
    return this._value
  }
  
  set value(v: T) {
    this._value = v
  }
}`;

console.log('Code:', code);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  const classDecl = ast.body[0];
  console.log('\nClass members:');
  classDecl.members.forEach((m, i) => {
    const params = m.params ? ` (${m.params.length} params)` : '';
    console.log(`  ${i}: ${m.kind} "${m.name?.name}"${params}`);
  });
} catch (e) {
  console.error('\nError:', e.message);
  console.error('At:', e.token);
}