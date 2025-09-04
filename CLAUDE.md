# Claude Development Guidelines

## Project Overview
PolyScript is a universal parser that handles multiple programming language syntaxes in a single file.

## Current Status
- **165/175 tests passing (94.3% pass rate)**
- Up from 82.3% at start
- 10 tests failing in advanced polyglot scenarios

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

## Remaining Failures (10 tests)

### Actually Working Features
Despite test failures, these actually parse correctly:
- Basic comprehensions (list/dict/set/generator)
- Generator functions (`function*`, `yield`, `yield*`)
- Most string literals (f-strings, raw strings, triple quotes, etc.)

### True Failures Causing Test Errors
1. **Heredoc strings** (`<<EOF...EOF`) - Tokenized as operators, not strings
2. **Match inside comprehensions** - Complex nested pattern not handled
3. **Force unwrap operator** (`!.`) - Tokenized but not parsed correctly
4. **Chained special operators** (`->`, `::`, `..`, `.?`) - Missing parser support
5. **Mixed language constructs** - Extreme nesting of different paradigms

## Debug Workflow
1. **Isolate** - Extract failing code from test
2. **Simplify** - Reduce to minimal case
3. **Inspect** - Check tokens with: `tokens.forEach(t => console.log(t))`
4. **Trace** - Add logging to suspicious parser methods
5. **Fix** - Make minimal change
6. **Verify** - Test variations before running full suite