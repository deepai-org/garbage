const { Lexer } = require('./dist/lexer');

// Test various heredoc cases
const tests = [
  { name: 'Simple', code: 's := <<EOF\nhello\nEOF' },
  { name: 'Empty', code: 's := <<EOF\nEOF' },
  { name: 'Multi-line', code: 's := <<DOC\nline1\nline2\nline3\nDOC' },
  { name: 'With indent', code: 's := <<END\n  indented\n  content\nEND' },
];

for (const test of tests) {
  console.log(`\nTesting ${test.name}:`);
  try {
    const lexer = new Lexer(test.code);
    const tokens = lexer.tokenize();
    console.log(`  ✅ Tokens: ${tokens.length}`);
    
    // Show string token
    const stringToken = tokens.find(t => t.type === 'StringLiteral');
    if (stringToken) {
      console.log(`  String value length: ${stringToken.value.length}`);
    }
  } catch (e) {
    console.log(`  ❌ Error: ${e.message}`);
  }
}