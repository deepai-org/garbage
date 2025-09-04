const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');
const fs = require('fs');

const code = fs.readFileSync('./src/parser.ts', 'utf8');
const lines = code.split('\n');
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();

// Group errors by pattern
const patterns = {
  'class properties with semicolons': [],
  'optional parameters': [],
  'readonly modifiers': [],
  'type aliases': [],
  'private/public modifiers': [],
  'other': []
};

parser.errors.forEach(e => {
  // Find the actual line by looking at the token
  const tokenLine = e.token?.line || 0;
  const line = lines[tokenLine - 1] || '';
  const trimmed = line.trim();
  
  if (trimmed.includes('public') || trimmed.includes('private') || trimmed.includes('protected')) {
    if (trimmed.includes('?:') || trimmed.includes('?;')) {
      patterns['optional parameters'].push({ error: e, line: trimmed });
    } else if (trimmed.includes('readonly')) {
      patterns['readonly modifiers'].push({ error: e, line: trimmed });
    } else {
      patterns['private/public modifiers'].push({ error: e, line: trimmed });
    }
  } else if (trimmed.startsWith('type ') && !trimmed.includes('typeof')) {
    patterns['type aliases'].push({ error: e, line: trimmed });
  } else if (e.message.includes("Expected ')' after parameters") && trimmed.includes(';')) {
    patterns['class properties with semicolons'].push({ error: e, line: trimmed });
  } else if (trimmed.includes('?:')) {
    patterns['optional parameters'].push({ error: e, line: trimmed });
  } else {
    patterns['other'].push({ error: e, line: trimmed });
  }
});

console.log('ERROR PATTERNS ANALYSIS:');
console.log('========================\n');

Object.entries(patterns).forEach(([pattern, errors]) => {
  if (errors.length > 0) {
    console.log(`${pattern}: ${errors.length} errors`);
    console.log('  Examples:');
    errors.slice(0, 3).forEach(({ error, line }) => {
      const lineNum = error.token?.line || error.line;
      console.log(`    Line ${lineNum}: ${line.substring(0, 60)}...`);
    });
    console.log();
  }
});