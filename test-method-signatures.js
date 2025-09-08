const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

function testMethodSignatures(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  try {
    const lexer = new Lexer(code);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();
    
    const stmt = ast.body[0];
    if (stmt.kind === 'ClassDecl') {
      console.log('Class found:', stmt.name.name);
      console.log('Members:');
      stmt.members.forEach((member, i) => {
        if (member.kind === 'Method') {
          console.log(`  ${i}: Method "${member.name?.name || '<anonymous>'}":`);
          console.log(`      Parameters: ${member.params ? member.params.length : 0}`);
          console.log(`      Return type: ${member.type ? member.type.kind : 'none'}`);
          console.log(`      Has body: ${member.body ? 'yes' : 'no'}`);
        } else if (member.kind === 'Field') {
          console.log(`  ${i}: Field "${member.name?.name || '<anonymous>'}":`);
          console.log(`      Type: ${member.type ? member.type.kind : 'none'}`);
          console.log(`      Has value: ${member.value ? 'yes' : 'no'}`);
        } else {
          console.log(`  ${i}: ${member.kind}`);
        }
      });
    } else if (stmt.kind === 'InterfaceDecl') {
      console.log('Interface found:', stmt.name.name);
      console.log('Members:');
      stmt.members.forEach((member, i) => {
        console.log(`  ${i}: ${member.kind} "${member.name?.name || '<anonymous>'}":`);
        if (member.params) {
          console.log(`      Parameters: ${member.params.length}`);
          member.params.forEach((p, j) => {
            const name = p.name?.kind === 'Identifier' ? p.name.name : '<pattern>';
            console.log(`        ${j}: ${name}`);
          });
        }
        if (member.returnType) {
          console.log(`      Return type: ${member.returnType.kind}`);
        } else if (member.type) {
          console.log(`      Type: ${member.type.kind}`);
        }
      });
    }
  } catch (e) {
    console.error('Error:', e.message);
    if (e.message.includes('method')) {
      console.error('Note: Method signature parsing issue detected');
    }
  }
}

// Test various method signature scenarios
console.log('=== Testing Method Signatures in Classes ===');

// TypeScript-style method signatures (no implementation)
testMethodSignatures(`class Calculator {
  add(a: number, b: number): number;
  multiply(x: number, y: number): number;
  divide(dividend: number, divisor: number): number;
}`, 'Method signatures without implementation');

// Mixed methods with and without implementation
testMethodSignatures(`class Service {
  connect(url: string): Promise<void>;
  
  disconnect(): void {
    console.log("Disconnecting");
  }
  
  send(data: any): boolean;
}`, 'Mixed signatures and implementations');

// Complex method signatures
testMethodSignatures(`class Advanced {
  process<T>(input: T, transform: (x: T) => T): T;
  batch(items: string[], options?: BatchOptions): Result[];
  async fetch(id: number): Promise<Data>;
}`, 'Complex method signatures');

// Interface with method signatures
testMethodSignatures(`interface ICalculator {
  add(a: number, b: number): number;
  subtract(a: number, b: number): number;
  multiply(a: number, b: number): number;
  divide(a: number, b: number): number;
}`, 'Interface method signatures');