# Test Update Plan: AST Verification

## Executive Summary

**79 tests (33.6%)** currently have weak verification that only checks if parsing doesn't throw errors. These tests don't verify that angle brackets are correctly disambiguated between JSX, generics, and comparisons.

## Current Status

| Category | Total Tests | Weak Tests | Need Update |
|----------|------------|------------|-------------|
| **Total** | 235 | 79 | 33.6% |
| JSX Tests | 60 | 52 | 86.7% |
| Advanced Polyglot | 25 | 20 | 80.0% |
| Other Tests | 150 | 7 | 4.7% |

## Angle Bracket Disambiguation Coverage

### Tests with Angle Brackets: 235
- **Properly verified:** 163 (69.4%) ✅
- **Weak verification:** 72 (30.6%) ❌

### Pattern Distribution
1. **JSX Elements/Components:** 87 tests
2. **Numeric Comparisons:** 19 tests
3. **Generic Types:** 23 tests
4. **Channel Operations:** 9 tests
5. **Mixed Patterns:** 15 tests

## Priority Files to Update

### 🔴 Critical (>10 weak tests)
1. **parser-polyglot-advanced.test.ts** - 20 weak tests
   - Mixed async/concurrent patterns
   - Complex pattern matching
   - Extreme operator mixing
   - Contains channels, generics, comparisons

2. **jsx-edge-cases.test.ts** - 12 weak tests  
   - JSX vs less-than disambiguation
   - Generic vs JSX disambiguation
   - Critical for angle bracket verification

3. **jsx-fragments-nested.test.ts** - 10 weak tests
   - Fragment syntax
   - Nested JSX structures

4. **jsx-polyglot.test.ts** - 10 weak tests
   - JSX with various language features
   - Mixed paradigms

5. **jsx-typescript.test.ts** - 10 weak tests
   - Generic components
   - Type assertions in JSX

### 🟡 Medium Priority (2-5 weak tests)
6. **parser-comprehensive.test.ts** - 5 weak tests
7. **parser-polyglot.test.ts** - 4 weak tests
8. **parser-polyglot-showcase.test.ts** - 3 weak tests

### 🟢 Low Priority (<2 weak tests)
9. **parser.test.ts** - 2 weak tests
10. **simple-showcase.test.ts** - 2 weak tests
11. **parser-real-world.test.ts** - 1 weak test

## Update Strategy

### For Each Weak Test:

#### Current (Weak) Pattern:
```typescript
test('parses something', () => {
    const code = `...`;
    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1); // ❌ Weak!
});
```

#### Updated (Strong) Pattern:
```typescript
test('parses something', () => {
    const code = `...`;
    const ast = parseCode(code);
    
    // Verify structure
    const node = ast.body[0] as AST.SpecificType;
    expect(node.kind).toBe('SpecificType');
    
    // For angle brackets, verify interpretation:
    // - JSX: expect(jsx.kind).toBe('JSXElement')
    // - Generic: expect(type.kind).toBe('GenericType')
    // - Comparison: expect(expr.op).toBe('<')
});
```

## Specific Verification Needed

### JSX Tests Must Verify:
- `kind === 'JSXElement'` or `'JSXFragment'`
- Opening/closing tag names match
- Attributes are parsed correctly
- Children are proper AST nodes

### Generic Type Tests Must Verify:
- `kind === 'GenericType'`
- Base type name
- Type arguments array
- Nested generics (e.g., `Vec<Result<T, E>>`)

### Comparison Tests Must Verify:
- `kind === 'Binary'`
- `op` is `'<'`, `'>'`, `'<='`, or `'>='`
- Left and right operands

### Channel Tests Must Verify:
- Channel send: `op === '<-'` with correct operands
- Channel receive: Unary `<-` operator

## Implementation Order

1. **Week 1:** Update parser-polyglot-advanced.test.ts (highest complexity)
2. **Week 2:** Update JSX test files (jsx-edge-cases, jsx-fragments, etc.)
3. **Week 3:** Update remaining polyglot tests
4. **Week 4:** Update low-priority tests

## Success Metrics

- [ ] All 79 weak tests updated to verify AST structure
- [ ] 100% of angle bracket uses have explicit verification
- [ ] No test relies solely on "doesn't throw" checks
- [ ] Each disambiguation case has at least one explicit test

## Example Updates Required

### Mixed Async Pattern Test
```typescript
// Current: Only checks ast.body.length >= 1
// Needs to verify:
- Stream<T> parsed as GenericType
- Result<Vec<T>, Error> parsed as nested GenericType  
- i < 10 parsed as Binary comparison
- <-ch parsed as channel receive
- ch <- item parsed as channel send
```

### JSX Edge Case Test
```typescript
// Current: Only checks no error thrown
// Needs to verify:
- <Button> parsed as JSXElement
- Array<string> parsed as GenericType
- x < 5 parsed as Binary operator
```

## Notes

- Tests that already use `as AST.*` casts and check `.kind` are considered strong
- Tests checking only `.toBeDefined()` or `.toHaveLength()` are weak
- Mixed tests (have both weak and strong checks) need review
- Focus on angle bracket disambiguation as it's the most complex parser feature