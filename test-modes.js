// Test lexer modes
const { Lexer } = require('./dist/lexer');

function testLexerMode(code, description) {
  console.log(`\n${description}:`);
  console.log(`Code: ${code}`);
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  const filtered = tokens.filter(t => t.type !== 'Whitespace' && t.type !== 'VirtualSemi');
  filtered.forEach(token => {
    console.log(`  ${token.type}: "${token.value}"`);
  });
}

// Test MemberAccess mode - keywords after dot should be identifiers
testLexerMode('obj.type', 'MemberAccess: keyword after dot');
testLexerMode('foo.if.else.while', 'MemberAccess: multiple keywords');
testLexerMode('arr.for', 'MemberAccess: for keyword');
testLexerMode('data.class.method()', 'MemberAccess: class keyword');

// Test Decorator mode
testLexerMode('@decorator', 'Decorator: simple decorator');
testLexerMode('@async', 'Decorator: async keyword as decorator');
testLexerMode('@if', 'Decorator: if keyword as decorator');

// Test normal mode (keywords should remain keywords)
testLexerMode('if (true)', 'Normal: if as keyword');
testLexerMode('class Foo', 'Normal: class as keyword');

// Test bash conditionals
testLexerMode('if [ $x -eq 5 ]', 'Bash: conditional with variable');
testLexerMode('while [ "test" = "test" ]', 'Bash: string comparison');
testLexerMode('if [ -f file.txt ]', 'Bash: file test');