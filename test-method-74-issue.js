const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Simplified version of what appears around member 73-74
const code = `
class Parser {
  // Member 73 - parseType method
  private parseType(): AST.TypeNode {
    let type = this.parseSimpleType();
    
    // Handle union types
    if (this.match("|")) {
      const types = [type];
      do {
        types.push(this.parseSimpleType());
      } while (this.match("|"));
      
      type = {
        kind: "UnionType",
        types,
        span: this.createSpanFrom(types[0])
      };
    }
    
    return type;
  }
  
  // Member 74 - parseTemplateLiteral method
  private parseTemplateLiteral(): AST.StringLiteral {
    const token = this.advance();
    return {
      kind: "StringLiteral",
      parts: [],
      span: this.createSpanFrom(token)
    };
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens around the critical point
console.log('=== Tokens around parseType return type ===');
let foundParseType = false;
tokens.forEach((t, i) => {
  if (t.value === 'parseType' && !foundParseType) {
    foundParseType = true;
    console.log('\nTokens for parseType method:');
    for (let j = i; j < Math.min(i + 10, tokens.length); j++) {
      if (tokens[j].type !== 'VirtualSemi') {
        console.log(`  [${j}] ${tokens[j].type}:${tokens[j].value}`);
      }
    }
  }
});

const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  // Find the class
  let classNode = ast.body[0];
  if (classNode?.kind === 'ClassDecl') {
    console.log(`\nClass has ${classNode.members?.length || 0} members`);
    classNode.members?.forEach((m, idx) => {
      if (m.kind === 'Method') {
        const returnType = m.type ? 'has return type' : 'no return type';
        console.log(`  Member ${idx}: ${m.name?.name} (${returnType})`);
      }
    });
  }
  
  console.log(`\nParse errors: ${parser.errors.length}`);
  parser.errors.slice(0, 5).forEach(e => {
    console.log(`  - ${e.message}`);
  });
} catch (e) {
  console.log(`\nParse failed: ${e.message}`);
}