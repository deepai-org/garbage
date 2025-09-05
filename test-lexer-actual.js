const { Lexer } = require('./dist/lexer');

class DebugLexer extends Lexer {
  scanString(quote) {
    console.log('\\n=== scanString called with quote:', quote);
    const start = this.position - 1;
    console.log('Start position:', start);
    
    let value = quote;
    let iterations = 0;
    
    while (!this.isAtEnd()) {
      iterations++;
      const char = this.peek();
      console.log(`\\nIteration ${iterations}: pos=${this.position}, char='${char}'`);
      
      if (char === quote) {
        // Count consecutive backslashes before the quote
        let backslashCount = 0;
        let checkPos = this.position - 1;
        console.log('  Found quote, counting backslashes...');
        while (checkPos >= 0 && this.source[checkPos] === '\\\\') {
          backslashCount++;
          checkPos--;
          console.log(`    checkPos=${checkPos}, backslashCount=${backslashCount}`);
        }
        console.log(`  Total backslashes: ${backslashCount}`);
        
        // If even number of backslashes (including 0), the quote is not escaped
        if (backslashCount % 2 === 0) {
          value += this.advance();
          console.log('  -> String ends here');
          break;
        } else {
          console.log('  -> Quote is escaped');
        }
      }
      
      if (char === '\\n') {
        console.log('  -> Found newline, unterminated string');
        break;
      }
      
      value += this.advance();
      
      if (iterations > 20) {
        console.log('Too many iterations, stopping');
        break;
      }
    }
    
    console.log('\\nFinal value:', value);
    console.log('Final position:', this.position);
    
    // Call parent's addTokenEx
    this.addTokenEx(this.constructor.TokenType.StringLiteral, value, start, this.position, start, 0);
  }
}

const code = "'\\\\\\\\' test";
console.log('Input:', code);

const lexer = new DebugLexer(code);
lexer.tokenize();