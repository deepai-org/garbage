// Test the lookahead logic
function peekPastGenericParams(source, startPos) {
  let pos = startPos;
  if (source[pos] !== '<') return pos;
  
  let depth = 1;
  pos++; // Skip initial '<'
  
  while (pos < source.length && depth > 0) {
    const char = source[pos];
    if (char === '<') {
      depth++;
    } else if (char === '>') {
      depth--;
    }
    pos++;
  }
  
  return pos; // Position after the closing '>'
}

const tests = [
  { code: '<Component<Props> data={items} />', start: 10 },  // Position after "Component"
  { code: 'Result<Vec<T>, Error>', start: 6 },  // Position after "Result"
];

tests.forEach(test => {
  console.log('\nCode:', test.code);
  console.log('Looking at position', test.start, '(char: "' + test.code[test.start] + '")');
  
  const endPos = peekPastGenericParams(test.code, test.start);
  console.log('End position:', endPos, '(char: "' + test.code[endPos] + '")');
  console.log('After generic:', test.code.substring(endPos, endPos + 5));
});