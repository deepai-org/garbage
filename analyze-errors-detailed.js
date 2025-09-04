const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

// Parse the parser itself
const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');

console.log('Analyzing remaining parse errors in detail...\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Group errors by pattern
const errorPatterns = {
  'TypeScript type syntax': [],
  'Interface/property syntax': [],
  'Semicolon issues': [],
  'Case/switch syntax': [],
  'Type guards': [],
  'Other': []
};

// Categorize each error with code context
parser.errors.forEach(e => {
  const line = e.token.line - 1;
  const codeSnippet = lines[line] ? lines[line].trim() : '';
  const errorInfo = {
    message: e.message,
    token: e.token.value,
    line: e.token.line,
    code: codeSnippet
  };
  
  // Categorize by pattern
  if (e.message.includes('type') || e.token.value === 'type' || 
      e.token.value === 'interface' || e.token.value === 'readonly' ||
      e.token.value === '?' || e.message.includes('Type')) {
    errorPatterns['TypeScript type syntax'].push(errorInfo);
  } else if (e.message.includes('property') || e.message.includes('object') ||
             e.message.includes('}') && codeSnippet.includes(':')) {
    errorPatterns['Interface/property syntax'].push(errorInfo);
  } else if (e.token.value === ';' || e.message.includes(';')) {
    errorPatterns['Semicolon issues'].push(errorInfo);
  } else if (e.message.includes('case') || e.message.includes('switch')) {
    errorPatterns['Case/switch syntax'].push(errorInfo);
  } else if (codeSnippet.includes(' is ') || codeSnippet.includes('typeof')) {
    errorPatterns['Type guards'].push(errorInfo);
  } else {
    errorPatterns['Other'].push(errorInfo);
  }
});

// Show examples from each category
console.log('ERROR CATEGORIES WITH EXAMPLES:');
console.log('================================\n');

Object.entries(errorPatterns).forEach(([category, errors]) => {
  if (errors.length === 0) return;
  
  console.log(`${category} (${errors.length} errors):`);
  console.log('-'.repeat(50));
  
  // Show up to 5 unique examples
  const seen = new Set();
  let shown = 0;
  
  for (const error of errors) {
    const key = `${error.message}|${error.code}`;
    if (!seen.has(key) && shown < 5) {
      seen.add(key);
      shown++;
      console.log(`  Line ${error.line}: ${error.message}`);
      console.log(`    Token: '${error.token}'`);
      console.log(`    Code: ${error.code}`);
      console.log();
    }
  }
  
  if (errors.length > 5) {
    console.log(`  ... and ${errors.length - 5} more\n`);
  }
  console.log();
});

// Find specific problematic patterns
console.log('\nSPECIFIC PROBLEMATIC PATTERNS:');
console.log('================================\n');

// Find type assertions
const typeAssertions = parser.errors.filter(e => 
  lines[e.token.line - 1] && lines[e.token.line - 1].includes(' as ')
);
if (typeAssertions.length > 0) {
  console.log(`Type assertions (${typeAssertions.length} instances):`);
  typeAssertions.slice(0, 3).forEach(e => {
    console.log(`  Line ${e.token.line}: ${lines[e.token.line - 1].trim()}`);
  });
  console.log();
}

// Find type predicates
const typePredicates = parser.errors.filter(e => 
  lines[e.token.line - 1] && lines[e.token.line - 1].includes(' is ')
);
if (typePredicates.length > 0) {
  console.log(`Type predicates (${typePredicates.length} instances):`);
  typePredicates.slice(0, 3).forEach(e => {
    console.log(`  Line ${e.token.line}: ${lines[e.token.line - 1].trim()}`);
  });
  console.log();
}

// Find readonly properties
const readonlyProps = parser.errors.filter(e => 
  lines[e.token.line - 1] && lines[e.token.line - 1].includes('readonly')
);
if (readonlyProps.length > 0) {
  console.log(`Readonly properties (${readonlyProps.length} instances):`);
  readonlyProps.slice(0, 3).forEach(e => {
    console.log(`  Line ${e.token.line}: ${lines[e.token.line - 1].trim()}`);
  });
  console.log();
}

// Find optional properties
const optionalProps = parser.errors.filter(e => 
  lines[e.token.line - 1] && lines[e.token.line - 1].match(/\w\?:/)
);
if (optionalProps.length > 0) {
  console.log(`Optional properties (${optionalProps.length} instances):`);
  optionalProps.slice(0, 3).forEach(e => {
    console.log(`  Line ${e.token.line}: ${lines[e.token.line - 1].trim()}`);
  });
  console.log();
}

// Find interface properties
const interfaceProps = parser.errors.filter(e => 
  e.message.includes('Expected') && 
  lines[e.token.line - 1] && 
  lines[e.token.line - 1].match(/^\s*(readonly\s+)?(\w+\??):/)
);
if (interfaceProps.length > 0) {
  console.log(`Interface properties (${interfaceProps.length} instances):`);
  interfaceProps.slice(0, 3).forEach(e => {
    console.log(`  Line ${e.token.line}: ${lines[e.token.line - 1].trim()}`);
  });
  console.log();
}

console.log('\nSUMMARY:');
console.log('========');
console.log(`Total errors: ${parser.errors.length}`);
console.log(`Total AST nodes: ${ast.body.length}`);