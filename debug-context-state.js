const { Lexer } = require('./dist/lexer');

const code = `<Result<Vec<T>, Error>>`;
const lexer = new Lexer(code);

// Manually step through tokenization to see context state
const tokens = [];
while (!lexer.isAtEnd()) {
  const pos = lexer.position;
  const char = lexer.source[pos];
  
  // Check context before processing this character
  const inJSX = lexer.context.isInJSX();
  const inJSXText = lexer.context.isInJSXText();
  const shouldPreserve = lexer.context.shouldPreserveWhitespace();
  
  // Get the next token
  const tokensBefore = lexer.tokens.length;
  lexer.scanToken();
  const tokensAfter = lexer.tokens.length;
  
  if (tokensAfter > tokensBefore) {
    const newToken = lexer.tokens[tokensAfter - 1];
    console.log(`Pos ${pos}: char='${char}' -> Token: ${newToken.type}:${newToken.value} (inJSX=${inJSX}, inJSXText=${inJSXText}, preserve=${shouldPreserve})`);
  }
}

console.log('\nFinal tokens:');
lexer.tokens.forEach((t, i) => {
  console.log(`${i}: ${t.type}:${t.value}`);
});