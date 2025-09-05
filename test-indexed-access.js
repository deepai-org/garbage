const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test indexed access type
const code = `
class Test {
  private getFlags(): AST.StringLiteral["flags"] {
    return {};
  }
  
  private getNext(): string {
    return "next";
  }
}
`;

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('=== Tokens for indexed access type ===');
let foundBracket = false;
tokens.forEach((t, i) => {
  if (t.value === 'StringLiteral' && tokens[i+1]?.value === '[') {
    console.log('\nFound indexed access pattern:');
    for (let j = i; j < Math.min(i + 6, tokens.length); j++) {
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
        const hasType = m.type ? 'has return type' : 'no return type';
        console.log(`  Member ${idx}: ${m.name?.name} (${hasType})`);
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