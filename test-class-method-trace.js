const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

// Minimal test case showing the issue
const code = `
class Parser {
  private currentToken: Token;
  
  private parseFuncDecl(async = false, unsafe = false): FuncDecl {
    const name = this.parseIdentifier();
    return { kind: "FuncDecl", name };
  }
  
  private parseOther(): void {
    console.log("test");
  }
}
`;

console.log('Testing class with keyword default parameters:');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();

// Show tokens for the method
console.log('\nTokens for parseFuncDecl line:');
let inMethod = false;
tokens.forEach((t, i) => {
  if (t.value === 'parseFuncDecl') {
    inMethod = true;
    console.log(`\nStarting at token ${i}:`);
  }
  if (inMethod && t.value !== undefined && t.type !== 'VirtualSemi') {
    console.log(`  [${i}] ${t.type}:${t.value}`);
    if (t.value === '{') {
      console.log('  (method body starts)');
      inMethod = false;
    }
  }
});

const parser = new Parser(tokens);

// Monkey-patch to add logging
const originalParseParameterList = parser.parseParameterList.bind(parser);
parser.parseParameterList = function() {
  console.log('\n>>> Entering parseParameterList');
  try {
    const result = originalParseParameterList();
    console.log(`<<< parseParameterList succeeded, got ${result.length} params`);
    return result;
  } catch (e) {
    console.log(`<<< parseParameterList failed: ${e.message}`);
    throw e;
  }
};

const originalParseParameter = parser.parseParameter?.bind(parser);
if (originalParseParameter) {
  parser.parseParameter = function() {
    const token = this.peek();
    console.log(`  >> parseParameter at token: ${token.type}:${token.value}`);
    try {
      const result = originalParseParameter.call(this);
      console.log(`  << parseParameter succeeded: ${result.name?.name}`);
      return result;
    } catch (e) {
      console.log(`  << parseParameter failed: ${e.message}`);
      throw e;
    }
  };
}

console.log('\n=== Starting parse ===');
const ast = parser.parse();

const classNode = ast.body[0];
if (classNode?.kind === 'ClassDecl') {
  console.log(`\nClass has ${classNode.members?.length || 0} members:`);
  classNode.members?.forEach((m, i) => {
    const name = m.name?.name || m.kind || 'Unknown';
    console.log(`  ${i}: ${name} (${m.kind})`);
  });
}

console.log(`\nParse errors: ${parser.errors.length}`);
if (parser.errors.length > 0) {
  console.log('Errors:');
  parser.errors.forEach(e => {
    console.log(`  ${e.message}`);
  });
}