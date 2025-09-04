const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Test constructor with parameter properties
const code = `
export class ParseError extends Error {
  constructor(
    message: string,
    public token: Token,
    public quickFix?: string
  ) {
    super(message);
  }
}
`;

console.log('Testing constructor with parameter properties:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('\nTokens for constructor parameters:');
let inConstructor = false;
let parenCount = 0;
tokens.forEach((t, i) => {
  if (t.value === 'constructor') {
    inConstructor = true;
    console.log('Found constructor at token', i);
  }
  if (inConstructor && t.value === '(') {
    parenCount++;
  }
  if (inConstructor && t.value === ')') {
    parenCount--;
    if (parenCount === 0) {
      inConstructor = false;
    }
  }
  if (inConstructor && t.type !== 'VirtualSemi') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
  }
});

const parser = new Parser(tokens);
const ast = parser.parse();

const exportNode = ast.body[0];
if (exportNode?.kind === 'ExportDecl') {
  const classNode = exportNode.declaration;
  if (classNode?.kind === 'ClassDecl') {
    console.log(`\nClass has ${classNode.members?.length || 0} members`);
    if (classNode.members?.[0]?.kind === 'Constructor') {
      const ctor = classNode.members[0];
      console.log(`Constructor has ${ctor.params?.length || 0} parameters`);
      ctor.params?.forEach((p, i) => {
        console.log(`  ${i}: ${p.name?.name} (visibility: ${p.visibility || 'none'})`);
      });
    }
  }
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}