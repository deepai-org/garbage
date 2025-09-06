# PolyScript Test Guidelines

## Overview
This document provides guidelines for writing strong, maintainable tests for the PolyScript parser that verify actual AST structure rather than just checking for parse errors.

## Test Philosophy

### ❌ Weak Tests (Avoid)
```typescript
it('should parse JSX', () => {
    const code = `<Component />`;
    expect(() => parser.parse()).not.toThrow();
});
```

### ✅ Strong Tests (Preferred)
```typescript
it('should parse JSX', () => {
    const code = `<Component />`;
    const ast = parseCode(code);
    
    // Verify AST structure
    expect(ast.body).toHaveLength(1);
    const jsx = (ast.body[0] as AST.ExprStmt).expr as AST.JSXElement;
    verifyJSXElement(jsx, 'Component', { selfClosing: true });
});
```

## Test Helper Infrastructure

### 1. Core Verification Helpers (`test/helpers/ast-verifiers.ts`)

#### JSX Verification
```typescript
verifyJSXElement(node, 'Component', {
    selfClosing: true,
    attributeCount: 2,
    childCount: 3
});

verifyJSXFragment(node, childCount);
verifyJSXAttribute(attr, 'className', 'string');
```

#### Type Verification
```typescript
verifyGenericType(node, 'Array', 1);  // Array<T>
verifyInterfaceDecl(node, 'Props', { propertyCount: 3 });
```

#### Operator Verification
```typescript
verifyComparison(node, '<', 'x', 5);  // x < 5
verifyChannelSend(node, 'ch', 'value');  // ch <- value
verifyChannelReceive(node, 'ch');  // <- ch
```

### 2. Pattern Matchers (`test/helpers/pattern-matchers.ts`)

```typescript
// Find specific node types
const jsxElements = findJSXElements(ast);
const genericTypes = findGenericTypes(ast);
const comparisons = findComparisons(ast);

// Analyze angle bracket usage
const usage = findAllAngleBracketUsages(ast);
const stats = analyzeAngleBrackets(ast);
```

### 3. Comprehensive Verification

```typescript
verifyAngleBrackets(ast, {
    jsx: [
        { tag: 'Button', selfClosing: true },
        { tag: 'div', selfClosing: false }
    ],
    generics: [
        { base: 'Array', argCount: 1 },
        { base: 'Result', argCount: 2 }
    ],
    comparisons: [
        { op: '<', left: 'x', right: 5 },
        { op: '>', left: 'y', right: 3 }
    ],
    channels: {
        sends: 1,
        receives: 2
    }
});
```

## Writing New Tests

### 1. Setup
```typescript
import { Lexer } from '../src/lexer';
import { Parser } from '../src/parser';
import * as AST from '../src/ast';

// Import helpers
import {
  verifyJSXElement,
  verifyGenericType,
  verifyAngleBrackets,
  // ... other helpers
} from './helpers/ast-verifiers';

import {
  findJSXElements,
  findAllAngleBracketUsages,
  analyzeAngleBrackets,
  // ... other matchers
} from './helpers/pattern-matchers';

function parseCode(code: string): AST.Program {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}
```

### 2. Test Structure
```typescript
describe('Feature Category', () => {
    it('should parse specific pattern', () => {
        const code = `...`;
        const ast = parseCode(code);
        
        // ✅ STRONG: Document what you're verifying
        
        // 1. Verify top-level structure
        expect(ast.body).toHaveLength(1);
        
        // 2. Verify specific nodes
        const node = ast.body[0] as AST.SomeType;
        expect(node.kind).toBe('SomeType');
        
        // 3. Use verification helpers
        verifyJSXElement(node, 'Component');
        
        // 4. Verify angle bracket disambiguation
        const usage = findAllAngleBracketUsages(ast);
        expect(usage.jsx.elements.length).toBe(1);
        expect(usage.comparisons.lessThan.length).toBe(0);
    });
});
```

## Angle Bracket Disambiguation

The parser must correctly distinguish between:
- **JSX Elements**: `<Component />`, `<div>text</div>`
- **TypeScript Generics**: `Array<string>`, `func<T>()`
- **Comparison Operators**: `x < 5`, `y > 3`
- **Channel Operations**: `ch <- value`, `<- ch`
- **Shift Operators**: `x << 2`, `y >> 1`

### Testing Disambiguation
```typescript
it('should disambiguate angle brackets', () => {
    const code = `
        const jsx = <Button />;
        const generic: Array<string> = [];
        const comparison = x < 5;
        const channel = <- ch;
    `;
    
    const ast = parseCode(code);
    
    verifyAngleBrackets(ast, {
        jsx: [{ tag: 'Button' }],
        generics: [{ base: 'Array', argCount: 1 }],
        comparisons: [{ op: '<', left: 'x', right: 5 }],
        channels: { receives: 1 }
    });
    
    const stats = analyzeAngleBrackets(ast);
    console.log(`Found: ${stats.summary}`);
});
```

## Common Patterns

### Testing JSX with Attributes
```typescript
const jsx = jsxElements[0];
verifyJSXElement(jsx, 'Input', { attributeCount: 3 });

// Verify specific attributes
const attrs = jsx.openingElement.attributes;
const className = attrs.find(a => 
    a.kind === 'JSXAttribute' && a.name.name === 'className'
);
expect(className).toBeDefined();
```

### Testing Nested Structures
```typescript
// Find nested JSX
const allJSX = findJSXElements(ast);
const tagNames = allJSX.map(el => {
    const name = el.openingElement.name;
    return name.kind === 'JSXIdentifier' ? name.name : '';
});
expect(tagNames).toContain('div');
expect(tagNames).toContain('span');
```

### Testing Generic Types
```typescript
const generics = findGenericTypes(ast);
const arrayType = generics.find(g => 
    g.base.name === 'Array'
);
verifyGenericType(arrayType, 'Array', 1);
```

## Migration Checklist

When updating a test from weak to strong verification:

1. ✅ Replace `expect(() => parser.parse()).not.toThrow()` with AST verification
2. ✅ Verify the `ast.body` length and structure
3. ✅ Check specific node kinds match expectations
4. ✅ Use verification helpers for complex structures
5. ✅ Test angle bracket disambiguation where relevant
6. ✅ Add comments marking strong verification sections with `✅ STRONG:`
7. ✅ Consider edge cases and error conditions

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- jsx-basic.test.ts

# Run updated tests with strong verification
npm test -- --testNamePattern="UPDATED"

# Run with coverage
npm test -- --coverage
```

## Test Coverage Goals

- **Parsing Success**: 100% of valid syntax should parse
- **AST Verification**: 80%+ of tests should verify AST structure
- **Angle Brackets**: 100% disambiguation accuracy
- **Edge Cases**: All known edge cases should have tests

## Debugging Tips

1. **Print AST Structure**
```typescript
console.log(JSON.stringify(ast, null, 2));
```

2. **Check Token Stream**
```typescript
const tokens = lexer.tokenize();
tokens.forEach(t => console.log(`${t.type}: ${t.value}`));
```

3. **Trace Parsing**
```typescript
// Add logging to parser methods
console.log(`Parsing: ${this.peek().value}`);
```

4. **Use Test Helpers**
```typescript
const usage = findAllAngleBracketUsages(ast);
console.log('Angle brackets:', usage);
```

## Contributing

When adding new test helpers:
1. Add to appropriate helper file
2. Export from the file
3. Document with JSDoc comments
4. Add examples to this guide
5. Use in at least one test

## Summary

Strong tests are essential for maintaining parser quality. They:
- Verify actual AST structure, not just parse success
- Ensure angle bracket disambiguation works correctly
- Catch regressions early
- Serve as documentation for expected behavior
- Build confidence in the parser's correctness

Always write tests that would catch real bugs, not just tests that pass.