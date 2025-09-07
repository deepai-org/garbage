const { Lexer } = require('./dist/lexer');

// Test various JSX patterns with generics
const tests = [
  '<Component<Props> />',
  '<Component<Props> attr="val" />',
  '<Component<Props>>content</Component>',
  'Result<Vec<T>, Error>',  // This should NOT be JSX
  'Option<Component<Props>>',  // This should NOT be JSX
];

tests.forEach(code => {
  console.log('\nCode:', code);
  
  // Simulate what the lexer would see after '<'
  const afterLessThan = code.substring(1);
  const match = afterLessThan.match(/^([A-Z][a-zA-Z0-9]*)/);
  
  if (match) {
    const identifier = match[1];
    const afterId = afterLessThan.substring(identifier.length);
    console.log('  Identifier:', identifier);
    console.log('  After identifier:', afterId.substring(0, 10));
    
    // Check patterns
    if (afterId.startsWith('<')) {
      console.log('  → Starts with <, checking further...');
      
      // Try to find the end of generic params (balancing < and >)
      let depth = 0;
      let i = 0;
      for (; i < afterId.length; i++) {
        if (afterId[i] === '<') depth++;
        else if (afterId[i] === '>') {
          depth--;
          if (depth === 0) break;
        }
      }
      
      if (i < afterId.length) {
        const afterGeneric = afterId.substring(i + 1);
        console.log('  After generic params:', afterGeneric.substring(0, 10));
        
        // JSX indicators after generic params
        if (afterGeneric.match(/^\s*(\/?>|[a-zA-Z_])/)) {
          console.log('  → LIKELY JSX (has attributes or self-closing)');
        } else if (afterGeneric.startsWith('>')) {
          console.log('  → LIKELY JSX (opening tag with content)');
        } else {
          console.log('  → LIKELY GENERIC TYPE');
        }
      }
    } else if (afterId.match(/^(\s+[a-zA-Z]|\/?>|>)/)) {
      console.log('  → LIKELY JSX (normal JSX pattern)');
    }
  }
});