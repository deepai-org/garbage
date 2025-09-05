const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test various method declaration patterns
const tests = [
  {
    name: "Simple method with return type",
    code: `class Test {
      private test(): string {
        return "test";
      }
    }`
  },
  {
    name: "Method with AST.Type return",
    code: `class Test {
      private test(): AST.TypeNode {
        return { kind: "SimpleType" };
      }
    }`
  },
  {
    name: "Method with complex body",
    code: `class Test {
      private test(): AST.TypeNode {
        if (this.peek().value === "is") {
          return { kind: "PredicateType" } as any;
        }
        return { kind: "SimpleType" };
      }
    }`
  },
  {
    name: "Two methods in sequence",
    code: `class Test {
      private first(): AST.TypeNode {
        return { kind: "SimpleType" };
      }
      private second(): AST.TypeNode {
        return { kind: "SimpleType" };
      }
    }`
  }
];

tests.forEach(test => {
  console.log(`\n=== ${test.name} ===`);
  
  const lexer = new Lexer(test.code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  
  try {
    const ast = parser.parse();
    let classNode = ast.body[0];
    if (classNode?.kind === 'ClassDecl') {
      console.log(`Members parsed: ${classNode.members?.length}`);
      console.log(`Errors: ${parser.errors.length}`);
      if (parser.errors.length > 0) {
        console.log(`First error: ${parser.errors[0].message}`);
      }
    }
  } catch (e) {
    console.log(`Parse failed: ${e.message}`);
    console.log(`Errors: ${parser.errors.length}`);
  }
});