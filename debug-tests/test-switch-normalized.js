const { Lexer } = require('../dist/lexer');
const { Parser } = require('../dist/parser');

// Import normalization
function normalizeSwitchStmt(stmt) {
  if (!stmt) return stmt;
  
  let result = stmt;
  
  // Map discriminant to expr if needed
  if (stmt.discriminant && !stmt.expr) {
    result = {
      ...result,
      expr: stmt.discriminant
    };
  }
  
  // If there's a separate defaultCase, merge it into cases array
  if (stmt.defaultCase && stmt.cases) {
    const cases = [...stmt.cases];
    // Add default case to the array with isDefault flag
    cases.push({
      ...stmt.defaultCase,
      isDefault: true,
      value: null,
      patterns: []
    });
    result = {
      ...result,
      cases
    };
  }
  
  return result;
}

const code = `switch (x) {
  case 1:
    y = 'one';
    break;
  default:
    y = 'other';
}`;

console.log('Testing normalized switch...\n');

const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);

try {
    const ast = parser.parse();
    const switchStmt = ast.body[0];
    
    console.log('Raw defaultCase:', JSON.stringify(switchStmt.defaultCase, null, 2));
    
    const normalized = normalizeSwitchStmt(switchStmt);
    console.log('\nNormalized cases:', normalized.cases.length);
    
    const defaultCase = normalized.cases.find(c => c.isDefault);
    console.log('\nDefault case found:', !!defaultCase);
    if (defaultCase) {
        console.log('Default case structure:');
        console.log('  Has body:', !!defaultCase.body);
        console.log('  Body type:', typeof defaultCase.body);
        console.log('  Body:', JSON.stringify(defaultCase.body, null, 2));
    }
} catch (e) {
    console.log('Parse error:', e.message);
}