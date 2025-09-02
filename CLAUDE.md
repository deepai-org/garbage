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