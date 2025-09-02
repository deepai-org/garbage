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

## Common Patterns in This Codebase
- Guard patterns: `Some(x) if x > 0 =>`
- Wildcard patterns: `_ =>`  
- Multiple pattern alternatives: `None | null | undefined =>`
- Destructuring patterns: `[head, ...tail] =>`, `{type: "user", name} =>`