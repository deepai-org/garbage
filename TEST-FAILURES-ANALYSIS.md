# Test Failures Analysis

## Summary
- **Total Tests**: 354
- **Passing**: 344 (97.2%)
- **Failing**: 10 (2.8%)

## Failure Categories

### 1. Missing Language Features (3 failures)

#### `defer` Statement (Go-style)
- **Test**: `parses mixed error handling patterns`
- **Issue**: `defer` keyword not implemented
- **Impact**: Go-style error handling patterns incomplete
- **Fix**: Add `defer` statement parsing

#### `panic` Expression  
- **Test**: `parses mixed error handling patterns`
- **Issue**: `panic` not recognized as a keyword/expression
- **Impact**: Go panic/recover pattern not supported
- **Fix**: Add `panic` as a builtin function call

#### `impl` Block (Rust-style)
- **Test**: `parses mixed class and trait definitions`
- **Issue**: `impl Display for Container<T>` parsed as separate statements
- **Expected**: Single class with impl blocks inside
- **Fix**: Add `impl` block parsing for trait implementations

### 2. Incomplete Parsing (3 failures)

#### Switch/Case Missing Cases
- **Test**: `parses Bash-style with modern JavaScript`
- **Issue**: Switch statement only parsing 2 cases instead of 3
- **Problem**: One case is being skipped or merged
- **Fix**: Debug switch case parsing logic

#### JSX in Ternary
- **Test**: `should parse JSX in ternary`
- **Issue**: ConstDecl has undefined `values` property
- **Problem**: Variable declaration not parsing correctly
- **Fix**: Check const declaration parsing with JSX expressions

#### Type Assertions in JSX Context
- **Test**: `handles all angle bracket types in one expression`  
- **Issue**: Type assertion `<Result<Vec<T>, Error>>` not parsed correctly
- **Problem**: Ambiguity between JSX and type assertion
- **Fix**: Better disambiguation logic for angle brackets

### 3. Complex Multi-Paradigm Code (4 failures)

#### Web Server Example
- **Tests**: `parses multi-paradigm web server` (2 test suites)
- **Issue**: Complex combination of decorators, async, generics failing
- **Fix**: Improve interaction between different language features

#### Concurrent Task Orchestrator
- **Test**: `parses concurrent task orchestrator`
- **Issue**: Channel operations with generics not parsing correctly
- **Fix**: Better channel syntax support with complex types

#### Reactive State Management
- **Test**: `parses reactive state management system`
- **Issue**: Observable patterns and operators not recognized
- **Fix**: Add support for reactive programming constructs

### 4. Edge Cases (1 failure)

#### Mixed Type Systems
- **Test**: `parses mixed type systems and generics`
- **Issue**: Complex nested generic constraints failing
- **Problem**: `where T: Display` constraints not parsed
- **Fix**: Add generic constraint parsing

## Priority Fixes (by impact and effort)

### High Priority (Quick Wins)
1. **Add `defer` statement** (1 hour)
   - Simple statement type addition
   - Fixes 1 test

2. **Fix const declaration values** (1 hour)
   - Bug fix in variable declaration parsing
   - Fixes JSX ternary test

### Medium Priority (Moderate Effort)
3. **Add `impl` blocks** (2-3 hours)
   - New block type for trait implementations
   - Fixes class/trait test

4. **Fix switch case parsing** (2 hours)
   - Debug why cases are missing
   - Fixes Bash-style test

### Low Priority (Complex)
5. **Generic constraints** (3-4 hours)
   - Add `where` clause parsing
   - Complex type system feature

6. **Observable/Reactive patterns** (4+ hours)
   - New paradigm support
   - Affects showcase tests

## Implementation Order

1. Start with `defer` - easiest win
2. Fix const declaration bug
3. Add `impl` blocks
4. Debug switch cases
5. Consider deferring complex multi-paradigm tests

This would bring us to ~348/354 (98.3%) pass rate with minimal effort.