const { Lexer } = require('./dist/lexer');

// Test how Pattern::Regex is tokenized
const code = `match value {
  Pattern::Regex(r) => r.test(input)
  Err(e) => throw e
}`;

console.log('Testing Pattern::Regex tokenization...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();

console.log('All tokens:');
for (let i = 0; i < Math.min(20, tokens.length); i++) {
    console.log(`[${i}] "${tokens[i].value}" (${tokens[i].type})`);
}