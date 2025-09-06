# Root Cause Analysis of Failing Tests

## Summary: 12 Tests Failing Across 8 Test Files

### 1. **test/jsx-typescript-updated.test.ts** (1 failure)
**Test**: "should parse ref types"
**Root Cause**: Generic types not being recognized in ref forwarding
- Expected: ≥1 generic type found
- Actual: 0 generic types found
- **Issue**: `React.forwardRef<T1, T2>()` generics not fully captured after member access

---

### 2. **test/parser-polyglot-updated.test.ts** (2 failures)

**Test 1**: "parses mixed error handling patterns"
**Root Cause**: `defer` statements not recognized
- Expected: ≥1 defer statement
- Actual: 0 defer statements found
- **Issue**: Go's `defer` keyword not implemented in parser

**Test 2**: "parses pattern matching with ranges"
**Root Cause**: Missing switch case in pattern matching
- Expected: ≥3 cases in switch
- Actual: 2 cases
- **Issue**: Range pattern `1..10` might be consuming/skipping a case

---

### 3. **test/parser-polyglot-advanced.test.ts** (1 failure)
**Test**: "parses mixed type systems and generics"
**Root Cause**: Missing statement in AST
- Expected: ≥5 body statements
- Actual: 4 statements
- **Issue**: One statement is being merged or lost during parsing

---

### 4. **test/parser-polyglot-advanced-updated.test.ts** (3 failures)

**Test 1**: Variable declaration type mismatch
**Root Cause**: Go short declaration parsed differently
- Expected: `VarDecl` 
- Actual: `ShortDecl`
- **Issue**: `:=` creates ShortDecl, test expects VarDecl

**Test 2**: Class with C# properties parsed incorrectly
**Root Cause**: C# property syntax not recognized
- Expected: `ClassDecl`
- Actual: `ExprStmt`
- **Issue**: `public string Title { get; set; }` not parsed as class member

**Test 3**: Decorator on function parsed incorrectly
**Root Cause**: Decorator + function combination issue
- Expected: `FuncDecl`
- Actual: `ExprStmt`
- **Issue**: `@decorator\nfunction foo()` not linking decorator to function

---

### 5. **test/jsx-polyglot-updated.test.ts** (4 failures)

**Test 1**: Ruby block with JSX
**Root Cause**: Ruby `do...end` block creating extra statement
- Expected: 1 body item
- Actual: 2 items (function + "end" as identifier)
- **Issue**: `end` keyword treated as separate statement

**Test 2**: Class with decorators parsed as function
**Root Cause**: Decorator before class not handled correctly
- Expected: `ClassDecl`
- Actual: `FuncDecl`
- **Issue**: `@observer class` pattern not recognized

**Test 3**: C# properties in class creating multiple statements
**Root Cause**: C# property syntax splitting into multiple fields
- Expected: 1 body item (ClassDecl)
- Actual: 3 items (ClassDecl + 2 ExprStmt)
- **Issue**: `public string Title { get; set; }` parsed as separate statements

**Test 4**: Resource management with `using` statement
**Root Cause**: C# `using` statement not implemented
- Expected: Defined using statement
- Actual: undefined
- **Issue**: `using` keyword not recognized as resource management

---

### 6. **test/angle-bracket-verification.test.ts** (1 failure)
**Test**: Angle bracket usage verification
**Root Cause**: Missing generic type in complex expression
- Expected: 2 generic types
- Actual: 1 generic type
- **Issue**: Second generic in chained/nested context not captured

---

### 7. **test/parser-updated.test.ts** (1 failure)
**Test**: TypeScript compilation error
**Root Cause**: AST property name mismatch
- **Issue**: `ifStmt.arms[0].condition` doesn't exist - should be `test` or similar

---

### 8. **test/parser-polyglot-showcase-updated.test.ts** (1 failure)
**Test**: Generic parameters on async method
**Root Cause**: Generic params property undefined
- Expected: `genericParams` defined with 'T'
- Actual: undefined
- **Issue**: Async methods not preserving generic parameters

---

## Categories of Root Causes

### 1. **Missing Language Features** (4 failures)
- Go `defer` statements
- C# `using` statements for resource management
- C# property syntax `{ get; set; }`
- Ruby `do...end` blocks

### 2. **Generic Type Recognition** (3 failures)
- Generics after member access not captured
- Nested/chained generics missed
- Async methods losing generic parameters

### 3. **Decorator Handling** (2 failures)
- Decorators before classes parsed incorrectly
- Decorator + declaration linking broken

### 4. **AST Type Mismatches** (2 failures)
- Go `:=` creates ShortDecl vs expected VarDecl
- Test property names don't match AST structure

### 5. **Pattern/Range Parsing** (1 failure)
- Range patterns in switch/match may be consuming extra cases

## Priority Fixes

1. **Quick Win**: Fix AST property name in test (1 failure)
2. **Medium**: Fix decorator + class/function linking (2 failures)
3. **Medium**: Improve generic type detection after member access (3 failures)
4. **Large**: Implement missing language features (4 failures)
5. **Large**: Fix Ruby block parsing (1 failure)