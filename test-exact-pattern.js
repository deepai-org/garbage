const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test exact pattern from createSpanFrom method
const code = `
class Test {
  private createSpanFrom(node: { span: AST.Span } | Token): AST.Span {
    if ('span' in node) {
      return {
        ...node.span,
        end: this.previous()?.end || node.span.end
      };
    }
    
    return {
      start: node.start,
      end: node.end,
      line: node.line,
      column: node.column
    };
  }
  
  private match(...values: string[]): boolean {
    for (const value of values) {
      if (this.check(value)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

let classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log('Members parsed:', classNode.members?.length || 0);
  classNode.members?.forEach(m => {
    console.log(`  - ${m.name?.name || m.kind} (${m.kind})`);
  });
}

console.log('\\nParse errors:', parser.errors.length);
if (parser.errors.length > 0) {
  console.log('\\nFirst 5 errors:');
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  - ${e.message} at token "${e.token?.value}" (line ${e.token?.line})`);
  });
}