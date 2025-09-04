# Remaining Parse Errors in parser.ts

## Current Status
- **379 total parse errors** (down from 976 initially)
- **904 AST nodes generated** 
- **99.96% of file parsed** (5528 of 5530 lines)
- **100% test pass rate** (175/175 tests)

## Most Common Error Patterns

### 1. Reserved Word as Parameter Name (38 errors)
```typescript
// FAILS: 'type' is treated as keyword, not parameter name
function createToken(type: TokenType, value: string) { }

// Current workaround needed:
function createToken(tokenType: TokenType, value: string) { }
```

### 2. Non-null Assertion Operator `!` (45+ errors)
```typescript
// FAILS: Parser doesn't recognize ! as postfix operator
return { path: path!, alias: name! };
const line = this.previous()!.value;

// Current workaround:
return { path: path, alias: name };
```

### 3. Type Predicates / Type Guards (15 errors)
```typescript
// FAILS: 'is' keyword not recognized in return type
function isIdentifier(node: any): node is AST.Identifier { }

// Current workaround:
function isIdentifier(node: any): boolean { }
```

### 4. Escaped Characters in Case Statements (10 errors)
```typescript
// FAILS: Backslash confuses parser
switch(char) {
  case '\\': return '\\';
  case '\n': return '\n';
}
```

### 5. Optional Object Type in Parameters (12 errors)
```typescript
// FAILS: Complex type annotations in parameters
function foo(options?: { recursive?: boolean }): void { }

// Works: Simple types
function foo(options?: Options): void { }
```

### 6. Property Names Same as Keywords (20+ errors)
```typescript
// FAILS: When property name is a keyword
const obj = {
  type: TokenType.Keyword,  // 'type' is keyword
  this: value,              // 'this' is keyword
  return: true              // 'return' is keyword
};
```

## Impact Analysis

### High Impact Issues (affecting many lines):
1. **Reserved words as identifiers** - 58 instances
2. **Non-null assertion `!`** - 45+ instances  
3. **Semicolon handling in complex contexts** - 66 instances

### Medium Impact Issues:
1. **Type predicates (`is` keyword)** - 15 instances
2. **Complex optional parameters** - 12 instances
3. **Escaped strings in switch/case** - 10 instances

### Low Impact Issues:
1. **Conditional types** - 2 instances
2. **Type-only imports** - 0 instances (not used)
3. **Namespace declarations** - 0 instances (not used)

## Error Distribution by File Section

- **Lines 1-500**: Class definitions, mostly parameter name issues
- **Lines 500-2000**: Parser methods, mix of all error types
- **Lines 2000-4000**: Complex parsing logic, many `!` assertions
- **Lines 4000-5530**: Helper methods, mostly clean

## Recommendations for Fixes

### Quick Wins (would eliminate 100+ errors):
1. Allow keywords as parameter names in function signatures
2. Support non-null assertion operator `!`
3. Better semicolon handling in object literals

### Medium Effort (would eliminate 50+ errors):
1. Support type predicates (`x is Type`)
2. Handle escaped characters in string literals
3. Allow keywords as property names in objects

### Lower Priority (TypeScript-specific):
1. Conditional types
2. Mapped types
3. Template literal types
4. Intersection/Union type operators