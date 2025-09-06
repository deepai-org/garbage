# Claude Development Guidelines

## Project Overview
PolyScript is a universal parser that handles multiple programming language syntaxes in a single file.

## Current Status
- **287/307 tests passing (93.5% pass rate)**
- JSX/TSX support implemented
- 20 tests failing - mainly due to virtual semicolon issue in JSX

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

### parseBeginBlock Infinite Loop
- Rescue clause body parsing wasn't checking for position advancement
- Fixed by adding: `if (this.current === beforePos) this.advance()`

### Template Literal Escaping
- Test files had escaped backticks causing parser hangs
- Solution: Use proper string concatenation instead

### Bash Conditionals
- Added `parseBashTestExpression()` for `[ ]` patterns
- Skip semicolon before `do` in bash loops

## Path to Full Compatibility (20 remaining failures)

### Priority Fixes (by impact)

#### 🔴 Critical: Virtual Semicolon in JSX (19 failures)
**Problem**: Lexer inserts virtual semicolons after `}` in JSX children
```jsx
<div>
    {expr}    // <- Virtual semicolon breaks parsing here
    <span>test</span>
</div>
```
**Solution**: Add JSX context tracking to lexer
- Effort: 2-3 days
- File: `src/lexer.ts`
- Impact: Fixes ~95% of JSX failures

#### 🟡 Quick Win: Class Generic Parameters (4 failures)
**Problem**: Classes use `typeParams` instead of `genericParams`
**Solution**: Rename property or add both
- Effort: 1 hour
- Files: `src/parser.ts`, `src/ast.ts`

#### 🟡 Quick Win: Package Declarations (1-2 failures)
**Problem**: `package main;` not recognized
**Solution**: Add package declaration parsing
- Effort: 2 hours
- Files: `src/parser.ts`, `src/ast.ts`

#### 🟢 Minor: Decorator & AST Mismatches (2-3 failures)
**Solution**: Update compatibility layer
- Effort: 2-3 hours
- File: `test/helpers/ast-compat.ts`

### Implementation Schedule
- **Day 1**: Quick wins (genericParams, package) → 291/307 tests (95%)
- **Day 2-3**: Virtual semicolon fix → 306/307 tests (99.7%)
- **Day 4**: Final polish → 307/307 tests (100%)

**Total effort: 3-4 days to achieve 100% compatibility**

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