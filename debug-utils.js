#!/usr/bin/env node

const { Parser } = require('./dist/parser');
const { Lexer } = require('./dist/lexer');
const { parseWithTrace } = require('./dist/parser-debug');
const fs = require('fs');

// Quick test runner for debugging
function quickTest(code, options = {}) {
  console.log('Testing:', code);
  console.log('─'.repeat(50));
  
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  if (options.showTokens) {
    console.log('Tokens:', tokens.map(t => t.value).join(' '));
  }
  
  const parser = new Parser(tokens);
  const ast = parser.parse();
  
  console.log('Errors:', parser.errors.length);
  console.log('AST items:', ast.body.length);
  
  if (parser.errors.length > 0) {
    console.log('First error:', parser.errors[0].message);
    console.log('At token:', parser.errors[0].token?.value);
  }
  
  if (options.showAst && ast.body.length > 0) {
    console.log('First AST item:', JSON.stringify(ast.body[0], null, 2));
  }
  
  return { ast, errors: parser.errors };
}

// Test multiple variations quickly
function testVariations(baseCode, variations, options = {}) {
  const results = [];
  
  for (const [name, code] of Object.entries(variations)) {
    console.log(`\n### ${name} ###`);
    try {
      const result = quickTest(code, options);
      results.push({ name, success: result.errors.length === 0, ...result });
    } catch (e) {
      console.log('Exception:', e.message);
      results.push({ name, success: false, error: e.message });
    }
  }
  
  console.log('\n=== SUMMARY ===');
  results.forEach(r => {
    console.log(`${r.success ? '✓' : '✗'} ${r.name}`);
  });
  
  return results;
}

// Compare parsing between two versions
function diffParse(code, Parser1, Parser2) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  const p1 = new Parser1(tokens);
  const ast1 = p1.parse();
  
  const p2 = new Parser2(tokens);
  const ast2 = p2.parse();
  
  console.log('Parser 1 errors:', p1.errors.length);
  console.log('Parser 2 errors:', p2.errors.length);
  console.log('AST 1 items:', ast1.body.length);
  console.log('AST 2 items:', ast2.body.length);
  
  // Simple diff
  if (JSON.stringify(ast1) !== JSON.stringify(ast2)) {
    console.log('ASTs differ!');
    // Could add more detailed diff here
  } else {
    console.log('ASTs are identical');
  }
}

// Find failing token position
function findFailurePoint(code) {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  
  // Try parsing progressively more tokens
  for (let i = 1; i <= tokens.length; i++) {
    const subset = tokens.slice(0, i);
    const parser = new Parser(subset);
    
    try {
      const ast = parser.parse();
      if (parser.errors.length > 0) {
        console.log(`First error at token ${i-1}: ${tokens[i-1]?.value}`);
        console.log('Error:', parser.errors[0].message);
        return i - 1;
      }
    } catch (e) {
      console.log(`Exception at token ${i-1}: ${tokens[i-1]?.value}`);
      console.log('Error:', e.message);
      return i - 1;
    }
  }
  
  console.log('No errors found');
  return -1;
}

// Export for use in other scripts
module.exports = {
  quickTest,
  testVariations,
  diffParse,
  findFailurePoint,
  parseWithTrace
};

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  node debug-utils.js test "code"');
    console.log('  node debug-utils.js trace "code"');
    console.log('  node debug-utils.js find-error "code"');
    console.log('  node debug-utils.js file <filename>');
    process.exit(1);
  }
  
  const command = args[0];
  const input = args[1];
  
  switch (command) {
    case 'test':
      quickTest(input, { showTokens: true, showAst: true });
      break;
      
    case 'trace':
      parseWithTrace(input);
      break;
      
    case 'find-error':
      findFailurePoint(input);
      break;
      
    case 'file':
      const code = fs.readFileSync(input, 'utf8');
      quickTest(code, { showTokens: false, showAst: false });
      break;
      
    default:
      console.log('Unknown command:', command);
  }
}