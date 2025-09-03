# Claude Development Guidelines

## Project Overview
PolyScript is a universal parser that handles multiple programming language syntaxes in a single file.

## Key Architecture Points

### Parser Structure
- The parser uses recursive descent parsing with a `parseTopLevel()` -> `parseStatement()` or `parseDeclaration()` flow
- Virtual semicolons are automatically inserted by the lexer and must be handled carefully in parsing logic
- The parser supports multiple language constructs (switch/match, case/esac, various loop styles, etc.)

## Common Issues and Solutions

### 1. Virtual Semicolons in Pattern Matching
**Problem**: Virtual semicolons can interfere with pattern matching constructs, especially in match expressions.
**Solution**: Always skip virtual semicolons at the beginning of parsing loops and methods that parse patterns.

### 2. Expression Parsing in Match Cases
**Problem**: The comma operator in expressions conflicts with comma-separated match cases.
**Solution**: In match case bodies, parse at a lower precedence level (not full expressions) to avoid consuming the comma that separates cases.

### 3. Empty AST with Complex Code
**Debugging Steps**:
1. Check if tokens are being generated correctly with a simple lexer test
2. Test with progressively simpler code to isolate the issue
3. Check for infinite loops by adding iteration counters
4. Verify that `parseTopLevel()` is returning statements/declarations properly

### 4. Parser State Management
- After consuming tokens in a switch/match, ensure the parser position is correct
- When backtracking (e.g., lookahead that fails), restore the parser position
- Be careful with methods that might consume more tokens than expected

### 5. Function Declaration Keywords
**Problem**: Functions can be declared with various keywords (`fn`, `fun`, `function`, `def`) that aren't recognized.
**Solution**: Ensure all function keywords are included in `isDeclStart()` method so they're treated as declarations.

### 6. Function Type Arrows
**Problem**: Function types can use either `=>` or `->` arrows depending on the language.
**Solution**: Check for both arrow types when parsing function types in `parseSimpleType()`.

### 7. Lambda Expression Variants
**Problem**: Lambda expressions have multiple syntaxes:
- Single parameter without parentheses: `x => expr`
- Async lambdas: `async () => expr`
- Immediately invoked: `(() => expr)()`
**Solution**: 
- Handle single-param lambdas in `parseExpression()` after parsing identifier
- Add `async` lambda support in `parsePrimary()`
- Create dedicated `parseAsyncLambda()` method

### 8. Go-style Syntax in Polyglot Code
**Problem**: Go syntax differs from C-style in several ways:
- `make(chan T, size)` for channel creation
- `for i := 0; i < 10; i++` without parentheses
- `go async () => {}` for concurrent async functions
**Solution**:
- Special-case `make()` function calls to parse type as first argument
- Check for Go-style for loops by detecting `identifier :=` pattern
- Allow `async` after `go` keyword in expression context

## Testing Strategy
- Always test with both simple and complex cases
- Test edge cases like:
  - Empty match/switch bodies
  - Single case vs multiple cases
  - Wildcard patterns (`_`)
  - Cases with and without trailing commas
  - Nested constructs (match inside match, case inside match, etc.)

## Running Tests
```bash
npm test                    # Run all tests
npm run build              # Build TypeScript
npm run lint               # Run linter (if configured)
npm run typecheck          # Run type checking (if configured)
```

## Debugging Tips
1. Create minimal reproduction test files (e.g., `test-debug.js`)
2. Use console.log debugging in parser methods to track token consumption
3. Check token positions before and after parsing methods
4. When tests fail with "Expected >= N, Received: 0", it usually means the parser is silently failing or returning null

## Debugging Workflow with Tools

### Quick Debug Tools Available
The project includes powerful debugging utilities in `debug-utils.js` and `test-patterns.js`:

#### 1. Quick Testing (`debug-utils.js`)
```bash
# Test a code snippet instantly
node debug-utils.js test "fn test<T>() { return T }"

# Find exact failure point in code
node debug-utils.js find-error "complex code here"

# Test a file
node debug-utils.js file mytest.js
```

#### 2. Pattern Testing (`test-patterns.js`)
```bash
# Test all lambda patterns
node test-patterns.js lambda

# Test for loop variations
node test-patterns.js for

# Test all patterns
node test-patterns.js all
```

### Debugging Process for Failing Tests

#### Step 1: Isolate the Problem
When a test fails with "Expected >= N, Received: 0":
1. Extract the test code from the failing test
2. Use `quickTest()` to reproduce the issue
3. Progressively simplify until you find the minimal failing case

Example:
```javascript
const { quickTest, findFailurePoint } = require('./debug-utils');

// Start with the full failing code
const code = `complex nested code...`;
quickTest(code); // See if it fails

// Use findFailurePoint to locate exact issue
findFailurePoint(code); // Shows which token causes failure
```

#### Step 2: Test Variations
Use `testVariations()` to test multiple patterns at once:
```javascript
const { testVariations } = require('./debug-utils');

testVariations('async patterns', {
  'Async block': 'async { await foo() }',
  'Async lambda': 'async () => { }',
  'Go async': 'go async () => { }'
});
```

#### Step 3: Identify Parser Path
1. Check if it's a declaration or statement issue
2. Test in expression position vs statement position
3. Verify token types are correct

Example debugging session:
```bash
# Test standalone fails
node debug-utils.js test "async { }" 
# Error: Expected function declaration

# Test in expression works
node debug-utils.js test "let x = async { }"
# Success!

# Conclusion: Issue is in statement/declaration parsing
```

#### Step 4: Fix and Verify
1. Locate the relevant parsing method
2. Add support for the pattern
3. Test with variations to ensure no regressions
4. Run pattern test suite to verify

### Common Debugging Patterns

#### "Expected identifier" Errors
- Usually means a keyword isn't recognized in that context
- Check `isDeclStart()` for declarations
- Check `parsePrimary()` for expressions

#### "Expected ')' after X" Errors
- Often means a method is consuming too many tokens
- Check if methods like `parseShortDecl()` are consuming semicolons
- Verify parenthesis matching in complex expressions

#### Silent Failures (Empty AST)
- Parser is catching and suppressing errors
- Check `parse()` method's error array: `parser.errors`
- Use `findFailurePoint()` to locate exact position

### Testing After Changes
After making parser changes:
```bash
# Quick regression check
node test-patterns.js all

# Run full test suite
npm test

# Test specific patterns that were fixed
node debug-utils.js test "your fixed pattern"
```

## Recent Fixes and Patterns

### Issue #9: Python-style Try-Except
**Problem**: Python uses `try:` and `except:` with colons instead of braces.
**Solution**: Modified `parseTry()` to handle both styles:
- Check for `:` after try/except keywords
- Support `except Exception as e:` pattern
- Handle indented blocks or single statements after colons

### Issue #10: Python-style With Statements
**Problem**: Python uses `with context as var:` syntax.
**Solution**: Modified `parseUsing()` to handle:
- `with expr as var:` pattern
- Indented blocks after colon
- Both traditional using and Python-style with

### Debugging Complex Nested Code
When debugging extreme nesting (like test-extreme.js):
1. Test each language construct separately first
2. Build up complexity gradually
3. Check for token consumption issues between different syntax styles
4. Verify indentation handling for mixed styles

### Issue #11: Infinite Loops in Error Recovery
**Problem**: Error recovery mechanisms in parser methods can cause infinite loops when tokens aren't consumed properly.
**Solution**: Incrementally add error recovery features to identify problematic ones:
- ✅ Trailing comma tolerance (safe)
- ❌ Enhanced synchronization with more stop tokens (causes loops)
- ✅ Synthetic token helpers (createMissingExpr, createMissingIdentifier)
- ✅ `must()` method for optional error recovery
- ❌ Error recovery in `parsePrimary` returning missing expressions (causes loops)
- ✅ Error recovery in `parseIdentifier` with proper token advancement

**Key Insight**: Error recovery should only advance tokens when truly necessary, and should avoid creating synthetic tokens in primary expression parsing.

### Issue #12: Class Member Parsing
**Problem**: Initial fix just skipped class bodies with brace counting, losing important structure.
**Solution**: Implemented proper `parseClassMember()` to handle:
- Properties and methods
- Ruby-style `def...end` methods
- Block parameters with `&` prefix
- Spread parameters with `...` prefix
- Python-style methods with colons

### Issue #13: Missing `this` and `super` Support
**Problem**: `this` and `super` keywords weren't recognized in expression context.
**Solution**: Added handling in `parsePrimary()`:
```typescript
if (this.match("this", "super")) {
  const token = this.previous()!;
  return {
    kind: "Identifier",
    name: token.value,
    span: this.createSpanFrom(token)
  };
}
```

### Issue #14: Generic Type Parsing vs Comparison Operators
**Problem**: Parser tried to parse `< 10` as generic type arguments in expressions like `i < 10`.
**Solution**: Added context check before attempting generic parsing - skip if `<` is followed by a numeric literal.

### Issue #15: Virtual Semicolon Insertion Bug
**Problem**: Lexer wasn't inserting virtual semicolons between statements at different indentation levels.
**Root Cause**: `shouldSuppressVirtualSemi` was comparing `next.indentCol` with `this.currentIndent` instead of `current.indentCol`.
**Solution**: Fixed comparison to use `current.indentCol` for proper indentation-based semicolon insertion.
**Impact**: Fixed select statements with both case and default branches, and async/concurrent pattern tests.

### Issue #16: Multiline Chaining Support
**Problem**: Virtual semicolons were breaking multiline method/operator chains.
**Solution**: Enhanced `shouldSuppressVirtualSemi` to check if next line starts with continuation operators (`?.`, `|>`, `..`, `::`, `||`, `&&`, etc.).
**Impact**: Allows multiline chaining patterns common in functional and fluent APIs.

### Issue #17: Assert Statement Support
**Problem**: Python-style `assert` statements weren't recognized.
**Solution**: Added `parseAssert()` method that handles `assert condition, "message"` syntax.
**Impact**: Enables testing assertion patterns from multiple languages.

### Issue #18: This/Super Member Access
**Problem**: `this` and `super` keywords weren't properly handling member access (e.g., `this.prop`).
**Root Cause**: They were returning directly from `parsePrimary` without going through `parsePostfix`.
**Solution**: Changed to call `parsePostfix(id)` after creating the identifier.
**Impact**: Fixed property access on `this` and `super` keywords.

### Current Pass Rate
- 157/173 tests passing (91% pass rate)
- Up from 82.3% (142/173) at start
- Fixed issues but some tests still fail due to complex unsupported features

### Remaining Complex Features (15 failing tests)
The remaining failures involve features that require significant parser/lexer extensions:

1. **Match as Expression** - Currently `match` only works as a statement, not in expression context after pipes
2. **Special Access Operators** - `!.` (force unwrap), `->` (pointer), `::` (static), `.?` (safe navigation)
3. **Bash-style Syntax** - `while [ condition ]; do...done`, `if [ test ]; then...fi`
4. **Extended String Literals** - C# interpolated (`$"`), verbatim (`@"`), heredocs (`<<EOF`)
5. **Complex Comprehensions** - Nested match expressions inside list comprehensions

These features are used in the polyglot showcase tests that demonstrate extreme language mixing.

## Effective Debugging Strategies

### What Makes Debugging FASTER

#### 1. Create Minimal Test Files Immediately
Instead of debugging in the full test suite, create small test files (`test-*.js`) that isolate the exact problem:
```javascript
// Good: Isolate the exact failing pattern
test(`select { case x: continue; default: await foo() }`, "Specific case");
```
This is 10x faster than running the full test suite repeatedly.

#### 2. Binary Search with Progressive Complexity
Start with the simplest case and progressively add complexity:
```javascript
test(`fn test() { }`, "Step 1: Basic");
test(`fn test() { for i := 0; i < 10; i++ { } }`, "Step 2: Add for loop");
test(`fn test() { /* previous + more */ }`, "Step 3: Add next feature");
```
This quickly identifies which specific addition breaks the parser.

#### 3. Token Inspection for Parser Issues
When parsing fails mysteriously, always inspect the tokens first:
```javascript
tokens.forEach((t, i) => {
  if (t.type !== 'Whitespace') {
    console.log(`[${i}] ${t.type}: "${t.value}" virtualSemi=${t.virtualSemi}`);
  }
});
```
Virtual semicolons and unexpected token types are often the culprit.

#### 4. Trace Parser Method Calls
Add temporary logging to trace which parser methods are called:
```javascript
const originalMethod = parser.parseSelectStatement.bind(parser);
parser.parseSelectStatement = function() {
  console.log('parseSelectStatement called, current:', this.peek().value);
  return originalMethod();
};
```

#### 5. Test Individual Parser Methods
Test parser methods in isolation when possible:
```javascript
const body = parser.parseCaseBody();  // Test specific method directly
```

### What Makes Debugging SLOWER

#### 1. Running Full Test Suite for Every Change
- Full suite takes ~1-2 seconds, individual test takes ~50ms
- Create focused test files instead

#### 2. Not Checking Error Details
- Don't just check if parsing failed - check WHICH error and WHERE
- `parser.errors[0].token` often reveals the exact problem location

#### 3. Trying to Fix Multiple Issues at Once
- Fix one issue, verify it works, then move to the next
- Multiple simultaneous changes make it hard to identify what helped

#### 4. Not Using Incremental Testing
- Don't jump straight to complex nested code
- Build up complexity step by step to find the breaking point

#### 5. Ignoring Token Boundaries
- Many issues are about where tokens start/end, not the parsing logic
- Check `wsBefore`, `virtualSemi`, and token positions

### Debugging Workflow Pattern

1. **Reproduce** - Extract failing code from test suite
2. **Simplify** - Reduce to minimal failing case  
3. **Inspect** - Check tokens, not just parse result
4. **Trace** - Add logging at suspicious points
5. **Fix** - Make minimal change
6. **Verify** - Test fix with variations
7. **Regress** - Run full suite only after fix works

### Common Parser Pitfalls

1. **Infinite Loops in Error Recovery**
   - Solution: Ensure every loop iteration either consumes a token or breaks
   
2. **Context-Dependent Parsing**
   - `<` can be comparison or generic start
   - `:` can be type annotation, case separator, or Python-style block start
   - Solution: Look ahead to disambiguate

3. **Virtual Semicolon Handling**
   - Often need to skip them: `while (this.peek().virtualSemi) this.advance()`
   - But sometimes they're significant for statement termination

4. **Parser Method Return Values**
   - Some methods return null on failure, others throw
   - Always check what a method returns when it can't parse

### Successfully Implemented Features
- ✅ Generic functions and type parameters
- ✅ Function type arrows (both `->` and `=>`)
- ✅ Single-parameter lambdas without parentheses  
- ✅ Async lambdas with postfix operations (calls, etc.)
- ✅ Go-style make() with optional size
- ✅ Go-style for loops without parentheses
- ✅ Channel send operator (`ch <- value`)
- ✅ Channel receive operator (`<-ch`)
- ✅ Select statements for Go channels
- ✅ Async for await patterns
- ✅ Python-style try-except with colons
- ✅ Python-style with statements  
- ✅ Ruby-style begin/rescue/ensure/end blocks
- ✅ Ruby-style def...end functions
- ✅ While loops with assignment in condition

### Known Limitations (Lexer Issues)
These require lexer changes and are beyond parser scope:
- Numeric literals with unit suffixes (100ms, 500KB)
- Multi-line select statements with virtual semicolons
- Heredoc strings (<<EOF...EOF)

### Remaining Complex Edge Cases
The 19 failing tests involve highly complex polyglot scenarios that mix multiple language paradigms in ways that create parsing ambiguities or require extensive context awareness.

## Common Patterns in This Codebase

### Pattern Matching
- Guard patterns: `Some(x) if x > 0 =>`
- Wildcard patterns: `_ =>`  
- Multiple pattern alternatives: `None | null | undefined =>`
- Destructuring patterns: `[head, ...tail] =>`, `{type: "user", name} =>`

### Function Types
- Chained/curried functions: `A -> B -> C` (right-associative)
- Function types with either arrow: `(A, B) -> C` or `(A, B) => C`
- Generic functions: `fn curry<A, B, C>(f: (A, B) -> C)`
- Async lambdas: `async () => { ... }`

### Go-style Patterns
- Channel creation: `make(chan T, 100)`
- Go routines with async: `go async () => { ... }`
- For loops without parens: `for i := 0; i < 10; i++ { ... }`
- Channel operations: `<-ch` (receive), `ch <- value` (send)

### Mixed Paradigm Patterns
- Combining Go and JavaScript: `go async () => { await something() }`
- Type parameters with multiple syntaxes: `Vec<T>`, `Result<Vec<T>, Error>`