# Test Improvement Plan for PolyScript Parser

## Executive Summary

We need to upgrade 79 weak tests (33.6%) that currently only verify parsing doesn't throw errors. These tests fail to verify correct AST structure, particularly for angle bracket disambiguation between JSX, generics, and comparisons.

## Goals

1. **100% AST Verification** - Every test must verify the actual AST structure produced
2. **Angle Bracket Coverage** - All `<` and `>` uses must have explicit disambiguation checks
3. **Maintainable Testing** - Create reusable helpers to make tests readable and consistent
4. **Regression Prevention** - Ensure changes can't break parsing without test failures

## Phase 1: Test Infrastructure (Week 1)

### 1.1 Create Test Helpers Library
**File:** `test/helpers/ast-verifiers.ts`

```typescript
// Reusable verification functions
export const verifyJSXElement = (node: any, expectedTag: string) => {
  expect(node.kind).toBe('JSXElement');
  expect(node.openingElement.name.name).toBe(expectedTag);
};

export const verifyGenericType = (node: any, baseName: string, argCount: number) => {
  expect(node.kind).toBe('GenericType');
  expect(node.base.name).toBe(baseName);
  expect(node.args).toHaveLength(argCount);
};

export const verifyBinaryOp = (node: any, op: string) => {
  expect(node.kind).toBe('Binary');
  expect(node.op).toBe(op);
};

export const verifyChannelOp = (node: any, type: 'send' | 'receive') => {
  if (type === 'send') {
    expect(node.kind).toBe('Binary');
    expect(node.op).toBe('<-');
  } else {
    expect(node.kind).toBe('Unary');
    expect(node.op).toBe('<-');
  }
};
```

### 1.2 Create Pattern Matchers
**File:** `test/helpers/pattern-matchers.ts`

```typescript
// Find specific patterns in AST
export const findJSXElements = (ast: AST.Program): AST.JSXElement[] => {
  // Recursive search for JSX nodes
};

export const findGenericTypes = (ast: AST.Program): AST.GenericType[] => {
  // Recursive search for generic type nodes
};

export const findComparisons = (ast: AST.Program): AST.Binary[] => {
  // Find all comparison operators
};
```

### 1.3 Create Disambiguation Verifier
**File:** `test/helpers/angle-bracket-verifier.ts`

```typescript
export interface AngleBracketExpectation {
  code: string;
  expectations: {
    jsx?: string[];        // ['Button', 'div']
    generics?: string[];   // ['Array', 'Map']
    comparisons?: number;  // Count of < > operators
    channels?: { send?: number; receive?: number };
  };
}

export const verifyAngleBrackets = (
  code: string, 
  expectations: AngleBracketExpectation['expectations']
) => {
  const ast = parseCode(code);
  
  if (expectations.jsx) {
    const jsxElements = findJSXElements(ast);
    expect(jsxElements.map(e => e.openingElement.name))
      .toEqual(expect.arrayContaining(expectations.jsx));
  }
  
  if (expectations.generics) {
    const genericTypes = findGenericTypes(ast);
    expect(genericTypes.map(g => g.base.name))
      .toEqual(expect.arrayContaining(expectations.generics));
  }
  
  // ... etc
};
```

## Phase 2: Critical Test Updates (Week 1-2)

### 2.1 parser-polyglot-advanced.test.ts (20 tests)

**Priority:** 🔴 CRITICAL - Most complex mixed syntax

#### Example Update: Mixed Async/Concurrent Test

```typescript
test('parses mixed async/concurrent patterns', () => {
  const code = `
    async fn processStream<T>(input: Stream<T>) -> Result<Vec<T>, Error> {
      ch := make(chan T, 100)
      for i := 0; i < 10; i++ {
        go async () => {
          while item := <-ch {
            processed := await transform(item)
          }
        }()
      }
      ch <- item
    }
  `;
  
  const ast = parseCode(code);
  
  // Verify function structure
  const func = ast.body[0] as AST.FuncDecl;
  expect(func.kind).toBe('FuncDecl');
  expect(func.async).toBe(true);
  
  // Verify generic parameter <T>
  verifyGenericType(func.genericParams[0], 'T', 0);
  
  // Verify parameter type Stream<T>
  verifyGenericType(func.params[0].type, 'Stream', 1);
  
  // Verify return type Result<Vec<T>, Error>
  const returnType = func.returnType as AST.GenericType;
  verifyGenericType(returnType, 'Result', 2);
  verifyGenericType(returnType.args[0], 'Vec', 1);
  
  // Verify comparison in loop (i < 10)
  const forLoop = findInBody(func.body, 'For');
  verifyBinaryOp(forLoop.condition, '<');
  
  // Verify channel operations
  const channelReceive = findInBody(func.body, node => 
    node.kind === 'Unary' && node.op === '<-'
  );
  expect(channelReceive).toBeDefined();
  
  const channelSend = findInBody(func.body, node =>
    node.kind === 'Binary' && node.op === '<-'
  );
  expect(channelSend).toBeDefined();
});
```

### 2.2 JSX Edge Cases (12 tests)

**Priority:** 🔴 CRITICAL - Disambiguation edge cases

#### Example Update: JSX vs Less-than

```typescript
test('should disambiguate JSX vs less-than operator', () => {
  const code = `
    const a = x < 5;
    const b = <Button />;
    const c = Array<string>;
  `;
  
  verifyAngleBrackets(code, {
    comparisons: 1,      // x < 5
    jsx: ['Button'],     // <Button />
    generics: ['Array']  // Array<string>
  });
  
  const ast = parseCode(code);
  
  // Verify each statement explicitly
  const [stmt1, stmt2, stmt3] = ast.body;
  
  // Statement 1: x < 5 is comparison
  const expr1 = (stmt1 as AST.VarDecl).init;
  verifyBinaryOp(expr1, '<');
  
  // Statement 2: <Button /> is JSX
  const expr2 = (stmt2 as AST.VarDecl).init;
  verifyJSXElement(expr2, 'Button');
  
  // Statement 3: Array<string> is generic
  const expr3 = (stmt3 as AST.VarDecl).init;
  verifyGenericType(expr3, 'Array', 1);
});
```

## Phase 3: Systematic Updates (Week 2-3)

### 3.1 Update Strategy by Pattern Type

#### JSX Tests (52 tests)
```typescript
// Before
expect(() => parser.parse()).not.toThrow();

// After
const jsx = stmt.expr as AST.JSXElement;
expect(jsx.kind).toBe('JSXElement');
expect(jsx.openingElement.name.name).toBe('Button');
```

#### Generic Type Tests (14 tests)
```typescript
// Before
expect(ast.body.length).toBeGreaterThan(0);

// After
const type = decl.type as AST.GenericType;
expect(type.kind).toBe('GenericType');
expect(type.base.name).toBe('Map');
expect(type.args).toHaveLength(2);
```

#### Comparison Tests (19 tests)
```typescript
// Before
expect(ast).toBeDefined();

// After
const comparison = expr as AST.Binary;
expect(comparison.kind).toBe('Binary');
expect(comparison.op).toBe('<');
expect(comparison.left.kind).toBe('Identifier');
expect(comparison.right.kind).toBe('NumericLiteral');
```

### 3.2 File Update Order

1. **Week 2 Sprint 1:**
   - parser-polyglot-advanced.test.ts (20 tests)
   - jsx-edge-cases.test.ts (12 tests)

2. **Week 2 Sprint 2:**
   - jsx-fragments-nested.test.ts (10 tests)
   - jsx-polyglot.test.ts (10 tests)
   - jsx-typescript.test.ts (10 tests)

3. **Week 3:**
   - parser-comprehensive.test.ts (5 tests)
   - parser-polyglot.test.ts (4 tests)
   - parser-polyglot-showcase.test.ts (3 tests)
   - Remaining files (5 tests)

## Phase 4: Verification Suite (Week 3)

### 4.1 Create Comprehensive Verification Tests
**File:** `test/angle-bracket-verification.test.ts`

```typescript
describe('Angle Bracket Disambiguation Verification', () => {
  describe('JSX vs Comparison', () => {
    test.each([
      ['<div />', 'JSXElement', 'div'],
      ['x < 5', 'Binary', '<'],
      ['<Component />', 'JSXElement', 'Component'],
      ['a < b', 'Binary', '<']
    ])('correctly parses %s as %s', (code, expectedKind, detail) => {
      const ast = parseCode(code);
      const expr = (ast.body[0] as AST.ExprStmt).expr;
      expect(expr.kind).toBe(expectedKind);
      // Additional verification based on type
    });
  });
  
  describe('Generic vs JSX', () => {
    test.each([
      ['let x: Array<T>', 'GenericType', 'Array'],
      ['<Array />', 'JSXElement', 'Array'],
      ['Map<K, V>', 'GenericType', 'Map'],
      ['<Map key={1} />', 'JSXElement', 'Map']
    ])('correctly parses %s as %s', (code, expectedKind, detail) => {
      // Verification logic
    });
  });
  
  describe('Complex Mixed Cases', () => {
    test('handles all three in one expression', () => {
      const code = `
        const result = x < 5 ? <Button<T> /> : Array<string>;
      `;
      
      verifyAngleBrackets(code, {
        comparisons: 1,
        jsx: ['Button'],
        generics: ['Array']
      });
    });
  });
});
```

### 4.2 Create Regression Tests
**File:** `test/angle-bracket-regression.test.ts`

```typescript
describe('Angle Bracket Regression Tests', () => {
  // Specific cases that have broken before
  test('JSX closing tag with division', () => {
    const code = '</div>';
    // Should not be parsed as regex /div>
  });
  
  test('Channel operations', () => {
    const code = 'ch <- value; result := <-ch';
    // Verify both send and receive
  });
  
  test('Nested generics', () => {
    const code = 'Result<Vec<Option<T>>, Error>';
    // Verify deep nesting
  });
});
```

## Phase 5: Validation & Documentation (Week 4)

### 5.1 Create Test Coverage Report
```bash
# Script to analyze test coverage
npm run test:coverage:angle-brackets
```

### 5.2 Create Test Guidelines
**File:** `test/TESTING-GUIDELINES.md`

```markdown
# Testing Guidelines

## Required Verifications

### For Any Test with Angle Brackets:
1. Verify AST node types (kind)
2. Check operator/element names
3. Validate nested structures

### Never Use:
- expect(() => parse()).not.toThrow()
- expect(ast.body.length).toBeGreaterThan(0)
- expect(ast).toBeDefined()

### Always Use:
- Type assertions: as AST.SpecificType
- Kind checks: expect(node.kind).toBe('...')
- Structure validation: verify children, attributes, etc.
```

## Success Metrics

- [ ] 0 tests using only `.not.toThrow()` pattern
- [ ] 100% of angle bracket uses have explicit verification
- [ ] All 79 weak tests upgraded to strong verification
- [ ] Test helper library reduces code duplication by 50%
- [ ] New regression test suite prevents future issues
- [ ] Average test provides 5+ specific AST assertions

## Timeline

| Week | Phase | Deliverables |
|------|-------|-------------|
| 1 | Infrastructure | Test helpers, pattern matchers, verifiers |
| 1-2 | Critical Updates | 32 highest-priority tests updated |
| 2-3 | Systematic Updates | Remaining 47 tests updated |
| 3 | Verification Suite | New comprehensive test suite |
| 4 | Validation | Coverage report, guidelines, review |

## Implementation Notes

1. **Start with helpers** - Don't update tests until helpers are ready
2. **Batch similar tests** - Update all JSX tests together for consistency
3. **Run after each update** - Ensure no regressions
4. **Document patterns** - Create examples for future tests
5. **Review in groups** - Have related tests reviewed together

## Risk Mitigation

- **Risk:** Breaking existing functionality
  - **Mitigation:** Run full suite after each file update
  
- **Risk:** Inconsistent verification patterns
  - **Mitigation:** Use standardized helpers
  
- **Risk:** Missing edge cases
  - **Mitigation:** Create comprehensive verification suite
  
- **Risk:** Time overrun
  - **Mitigation:** Prioritize critical tests first