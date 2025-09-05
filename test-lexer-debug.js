const fs = require('fs');

// Create a simple debug version
const code = "'\\\\' test";
console.log('Input:', code);
console.log('Char codes:');
for (let i = 0; i < code.length; i++) {
  console.log(`  [${i}] '${code[i]}' = ${code.charCodeAt(i)}`);
}

// Simulate the lexer logic
let position = 0;
const quote = "'";

// Start after the opening quote
position = 1;

while (position < code.length) {
  const char = code[position];
  console.log(`\\nPosition ${position}: char='${char}'`);
  
  if (char === quote) {
    // Count backslashes
    let backslashCount = 0;
    let checkPos = position - 1;
    while (checkPos >= 0 && code[checkPos] === '\\\\') {
      backslashCount++;
      checkPos--;
    }
    console.log(`  Found quote. Backslash count before: ${backslashCount}`);
    console.log(`  Even number? ${backslashCount % 2 === 0}`);
    
    if (backslashCount % 2 === 0) {
      console.log('  -> String ends here');
      break;
    } else {
      console.log('  -> Quote is escaped, continue');
    }
  }
  
  position++;
}