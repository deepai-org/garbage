const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testInterface(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const interfaceDecl = ast.body[0];
    console.log('Declaration kind:', interfaceDecl.kind);
    
    if (interfaceDecl.kind === 'InterfaceDecl') {
      console.log('Interface name:', interfaceDecl.name.name);
      console.log('Members:');
      
      interfaceDecl.members.forEach(member => {
        if (member.kind === 'Method') {
          const params = member.params ? 
            member.params.map(p => p.name.name + (p.type ? ': ' + p.type.kind : '')).join(', ') : '';
          const returnType = member.returnType ? member.returnType.kind : 'void';
          const generics = member.genericParams ? 
            '<' + member.genericParams.map(g => g.name).join(', ') + '>' : '';
          console.log(`  - ${member.name.name}${generics}(${params}): ${returnType} [Method]`);
        } else {
          const optional = member.optional ? '?' : '';
          const typeKind = member.type ? member.type.kind : 'unknown';
          console.log(`  - ${member.name.name}${optional}: ${typeKind} [Property]`);
        }
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
  }
}

// Test various interface forms
testInterface(`
interface Calculator {
  add(a: number, b: number): number;
  multiply(x: number, y: number): number;
  value: number;
}`, 'Interface with methods and properties');

testInterface(`
interface Service {
  fetch<T>(url: string): Promise<T>;
  post<T, R>(url: string, data: T): Promise<R>;
  timeout?: number;
}`, 'Interface with generic methods');

testInterface(`
interface EventEmitter {
  on(event: string, handler: Function): void;
  off(event: string, handler: Function): void;
  emit(event: string): boolean;
  listeners: Map<string, Function[]>;
}`, 'Mixed interface members');