const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test method with return type annotation
const testCases = [
  {
    name: "Simple method with return type",
    code: `
      class Test {
        private getValue(): string {
          return "test";
        }
      }
    `
  },
  {
    name: "Method with no params and return type",
    code: `
      class Parser {
        private parseSimpleType(): AST.TypeNode {
          const node = this.parseType();
          return node;
        }
      }
    `
  },
  {
    name: "Multiple methods with return types",
    code: `
      class Parser {
        private isType(): boolean {
          return true;
        }
        
        private getToken(): Token {
          return this.peek();
        }
      }
    `
  }
];

testCases.forEach(test => {
  console.log(`\n=== ${test.name} ===`);
  
  const lexer = new Lexer(test.code);
  const tokens = lexer.tokenize();
  
  // Show tokens around return type
  console.log('Tokens around return type:');
  let foundParen = false;
  tokens.forEach((t, i) => {
    if (t.value === ')' && tokens[i+1]?.value === ':') {
      console.log('  Found ) : pattern at token', i);
      for (let j = i - 2; j <= i + 5; j++) {
        if (tokens[j] && tokens[j].type !== 'VirtualSemi' && tokens[j].type !== 'EOF') {
          console.log(`    [${j}] ${tokens[j].type}:${tokens[j].value}`);
        }
      }
      foundParen = true;
    }
  });
  
  const parser = new Parser(tokens);
  
  try {
    const ast = parser.parse();
    
    // Find the class
    let classNode = ast.body[0];
    if (classNode?.kind === 'ExportDecl') {
      classNode = classNode.declaration;
    }
    
    if (classNode?.kind === 'ClassDecl') {
      console.log(`\nClass has ${classNode.members?.length || 0} members`);
      classNode.members?.forEach(m => {
        if (m.kind === 'Method') {
          const returnType = m.type ? 'has return type' : 'no return type';
          console.log(`  - ${m.name?.name} (${returnType})`);
        }
      });
    }
    
    console.log(`\nParse errors: ${parser.errors.length}`);
    if (parser.errors.length > 0) {
      parser.errors.forEach(e => {
        console.log(`  - ${e.message}`);
      });
    }
  } catch (e) {
    console.log(`\nParse failed: ${e.message}`);
  }
});