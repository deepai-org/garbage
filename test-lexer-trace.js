// Simulate the exact lexer logic
const source = "'\\\\' test";
let position = 0;

console.log('Source:', source);
console.log('Characters:');
for (let i = 0; i < source.length; i++) {
  console.log(`  [${i}] '${source[i]}'`);
}

// Start scanning string
const quote = "'";
position = 1; // After opening quote
let value = quote;

console.log('\\nScanning string...');
while (position < source.length) {
  console.log(`\\nPosition ${position}: char='${source[position]}'`);
  
  if (source[position] === quote) {
    // Count consecutive backslashes before the quote
    let backslashCount = 0;
    let checkPos = position - 1;
    
    console.log('  Found quote, checking for backslashes...');
    while (checkPos >= 0 && source[checkPos] === '\\') {
      backslashCount++;
      checkPos--;
      console.log(`    checkPos=${checkPos}, char='${source[checkPos]}', backslashCount=${backslashCount}`);
    }
    
    console.log(`  Total backslashes: ${backslashCount}`);
    console.log(`  Backslash count % 2 = ${backslashCount % 2}`);
    
    if (backslashCount % 2 === 0) {
      value += source[position];
      position++;
      console.log('  -> String ends here');
      break;
    } else {
      console.log('  -> Quote is escaped, continuing');
    }
  }
  
  value += source[position];
  position++;
}

console.log('\\nFinal string value:', value);
console.log('Remaining source:', source.substring(position));