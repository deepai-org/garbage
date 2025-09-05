const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test the exact declaration that fails
const code = `
class Parser {
  private parseType(): AST.TypeNode {
    let type = this.parseSimpleType();
    return type;
  }
  
  private parseSimpleType(): AST.TypeNode {
    const start = this.current;
    return { kind: "SimpleType" };
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('=== Tokens around parseSimpleType declaration ===');
let foundSimple = false;
tokens.forEach((t, i) => {
  if (t.value === 'parseSimpleType' && !foundSimple) {
    foundSimple = true;
    console.log('\nTokens for parseSimpleType:');
    for (let j = i - 2; j < Math.min(i + 8, tokens.length); j++) {
      if (tokens[j].type !== 'VirtualSemi') {
        const marker = j === i + 2 && tokens[j].value === ':' ? ' <-- This colon' : '';
        console.log(`  [${j}] ${tokens[j].type}:${tokens[j].value}${marker}`);
      }
    }
  }
});

const parser = new Parser(tokens);

try {
  const ast = parser.parse();
  
  let classNode = ast.body[0];
  if (classNode?.kind === 'ExportDecl') {
    classNode = classNode.declaration;
  }
  
  console.log(`\nClass members parsed: ${classNode.members?.length}`);
  classNode.members?.forEach(m => {
    if (m.kind === 'Method') {
      console.log(`  - ${m.name?.name}`);
    }
  });
  
  console.log(`\nParse errors: ${parser.errors.length}`);
  parser.errors.forEach(e => {
    console.log(`  - ${e.message}`);
  });
} catch (e) {
  console.log(`\nParse failed: ${e.message}`);
}