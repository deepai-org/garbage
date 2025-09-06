# Failing Tests Analysis - 319/327 Passing (97.6%)

## Summary
8 tests failing across 4 main categories:

## 1. TypeScript Compilation Errors (4 test files)
These tests have TypeScript compilation errors preventing them from running:

### Files with TS errors:
- `test/parser-polyglot-updated.test.ts`
- `test/parser-updated.test.ts` 
- `test/parser-polyglot-advanced-updated.test.ts`
- `test/parser-polyglot-showcase-updated.test.ts`

### Common issues:
- Property 'body' does not exist on type 'ClassDecl'
- Property 'finally' does not exist on type 'Try'
- Property 'pattern' does not exist on type 'MatchArm' (should be 'patterns')
- Property 'name' does not exist on type 'ShortDecl'
- Missing 'For' export in AST namespace

**Fix needed**: Update test files to match current AST types

## 2. Generic Type Recognition Issues (2 tests)

### `test/jsx-typescript-updated.test.ts` - "should parse ref types"
- **Code**: `React.forwardRef<HTMLInputElement, InputProps>((props, ref) => ...)`
- **Issue**: Parser not recognizing generics in member access calls
- **Expected**: 1+ generic types
- **Actual**: 0 generic types found

### `test/angle-bracket-verification.test.ts` - "handles all angle bracket types"
- **Code**: Complex expression with multiple generic types
- **Issue**: Missing one generic type
- **Expected**: 2 generic types
- **Actual**: 1 generic type (Stream<T>)

**Fix needed**: Improve generic type parsing in call expressions with member access

## 3. Ruby Syntax Issues (1 test)

### `test/jsx-polyglot-updated.test.ts` - "should parse JSX with Ruby blocks"
- **Code**: Ruby `def` with JSX and `end` keyword
- **Issue**: Final `end` parsed as separate expression statement
- **Expected**: 1 AST node (FuncDecl)
- **Actual**: 2 AST nodes (FuncDecl + ExprStmt with "end")

**Fix needed**: Proper handling of Ruby `end` keyword to close function definitions

## 4. Mixed Paradigm Issues (3 tests)

### `test/jsx-polyglot-updated.test.ts`
- "should parse JSX with Python decorators" - Likely decorator parsing issue
- "should parse JSX with C# properties" - Property syntax recognition
- "should parse JSX with defer and using" - Resource management syntax

### `test/parser-polyglot-advanced-fixed.test.ts`
- "parses complex pattern matching" - Pattern matching across languages

### `test/parser-polyglot-advanced.test.ts` 
- "parses mixed type systems and generics" - Complex type system interactions

**Fix needed**: Better integration of language-specific features with JSX

## Priority Fixes

1. **High Priority**: Fix TypeScript compilation errors in test files (quick wins)
2. **Medium Priority**: Fix Ruby `end` keyword handling 
3. **Medium Priority**: Improve generic type recognition in method calls
4. **Low Priority**: Mixed paradigm edge cases

## Next Steps

1. Fix test compilation errors first (easy wins)
2. Address Ruby end keyword issue
3. Improve generic type parsing for method calls like `React.forwardRef<T>`
4. Handle remaining mixed-paradigm edge cases