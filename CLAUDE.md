# Claude Development Guidelines

## Project Overview
PolyScript is a universal parser that handles multiple programming language syntaxes in a single file.

## Current Status
- **342/354 tests passing (96.6% pass rate)**
- Major improvements in type parsing and multi-paradigm support
- 12 tests failing - edge cases with specific language combinations

## Quick Debugging Commands
```bash
npm test                # Run all tests
npm run build          # Build TypeScript
node test-*.js         # Run specific debug test
```

## Creating Debug Tests
When a test fails, immediately create a minimal test file:
```javascript
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `[failing code here]`;
const lexer = new Lexer(code);
const tokens = lexer.tokenize();
const parser = new Parser(tokens);
const ast = parser.parse();
console.log('AST nodes:', ast.body.length);
```

## Key Parser Issues & Solutions

### Virtual Semicolons
- Skip them in pattern matching: `while (this.peek().virtualSemi) this.advance()`
- They're auto-inserted by lexer, handle carefully

### Infinite Loops
- Always ensure loops either consume a token or break
- Add safeguards: `if (this.current === beforePos) this.advance()`

### Context-Dependent Tokens
- `<` can be comparison or generic start - check next token
- `:` can be type annotation, case separator, or Python block start
- `.` triggers MemberAccess mode where keywords become identifiers

### Parser Structure
- Main flow: `parse()` → `parseTopLevel()` → `parseStatement()` or `parseDeclaration()`
- Function bodies use `parseBlock()`, not `parseTopLevel()`
- `braceDepth` tracks nesting for proper `}` handling

## Lexer Mode Stack
The lexer has 5 modes that change tokenization behavior:

1. **Normal** - Default mode
2. **MemberAccess** - After `.`, keywords → identifiers
3. **BashCondition** - Inside `[ ]` for bash tests
4. **Decorator** - After `@`, keywords → identifiers  
5. **StringTemplate** - For special string literals

## Recently Fixed Issues

### Rust Type System Support
- Added `DynType` for trait objects (`dyn Trait`)
- Handle associated type constraints in generics (`Item = V`)
- Fixed tuple type parsing `(T, U)` in nested generics

### Function Declaration Improvements  
- Fixed `fn` with return type arrow (`->`) being parsed as lambda
- Proper handling of complex nested generic signatures

### Class Declaration Enhancements
- Added support for `with` clause for mixins/traits
- Fixed decorator parsing with complex inheritance chains
- Improved generic parameter handling

### Ruby Block Support
- Added `do...end` block parsing after method calls
- Fixed `def...end` function parsing with proper nesting

## Remaining Failures (12 tests)

### Current Issues to Investigate
1. **Comparison chain parsing** - Possible issue with chained comparisons
2. **Specific edge cases** in mixed language features
3. **Test expectation mismatches** vs actual parsing errors

### Next Steps
1. Analyze each failing test individually
2. Create minimal reproducible test cases
3. Fix issues in order of impact

## Detailed Implementation Plans

See these documents for comprehensive implementation details:
- **FULL-COMPATIBILITY-PLAN.md** - Complete 3-week roadmap
- **VIRTUAL-SEMICOLON-FIX.md** - Step-by-step lexer fix guide
- **COMPATIBILITY-ROADMAP.md** - Prioritized quick wins

## Debug Workflow
1. **Isolate** - Extract failing code from test
2. **Simplify** - Reduce to minimal case
3. **Inspect** - Check tokens with: `tokens.forEach(t => console.log(t))`
4. **Trace** - Add logging to suspicious parser methods
5. **Fix** - Make minimal change
6. **Verify** - Test variations before running full suite