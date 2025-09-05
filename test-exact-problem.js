const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the exact problematic code from parseType
const code = `
class Test {
  private parseType(): AST.TypeNode {
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      const paramName = this.advance();
      
      if (this.peek().value === "is") {
        this.advance();
        const predicateType = this.parseSimpleType();
        
        return {
          kind: "PredicateType",
          param: { 
            kind: "Identifier", 
            name: paramName.value, 
            span: this.createSpan(checkpoint, checkpoint) 
          },
          type: predicateType,
          span: this.createSpan(checkpoint, this.current - 1)
        } as any;
      }
    }
    return { kind: "SimpleType" };
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  let classNode = ast.body[0];
  
  console.log('Members parsed:', classNode.members?.length || 0);
  console.log('Parse errors:', parser.errors.length);
  
  if (parser.errors.length > 0) {
    console.log('\nErrors:');
    parser.errors.forEach(e => {
      const token = e.token ? ` at '${e.token.value}'` : '';
      console.log(`  - ${e.message}${token}`);
    });
  }
} catch (e) {
  console.log('Parse failed:', e.message);
}