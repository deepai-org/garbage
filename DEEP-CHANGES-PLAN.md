# Deep Architectural Changes Plan for 100% Test Compatibility

## Current Status
- **302/317 tests passing (95.3%)**
- **15 failures remaining** across 4 categories:
  - Angle Bracket Disambiguation: 5 unique failures
  - TypeScript/JSX Integration: 5 unique failures  
  - Complex Polyglot Patterns: 3 unique failures
  - JSX Edge Cases: 2 unique failures

## Root Cause Analysis

### 1. Lexer Limitations
The lexer currently operates in a mostly stateless manner, which causes:
- Loss of context between JSX tags and content
- Inability to distinguish type annotations from expressions
- Whitespace handling issues in JSX text
- No awareness of nesting depth for generics vs JSX

### 2. Parser Lookahead Constraints
Single-token lookahead is insufficient for:
- Distinguishing `<Type>` from `<Component>`
- Identifying generic function calls vs JSX elements
- Detecting type assertions vs comparisons

### 3. AST Representation Gaps
Missing or incomplete AST nodes for:
- Destructuring patterns (currently stored as strings)
- Qualified types (React.FC, JSX.Element)
- TypeScript-specific constructs (keyof, typeof, infer)

## Implementation Plan

### Phase 1: Context-Aware Lexer (Days 1-3)

#### Day 1: Lexer State Management
```typescript
// Add to lexer.ts
interface LexerContext {
  jsxDepth: number;        // Track JSX nesting level
  genericDepth: number;    // Track generic type nesting
  inTypeContext: boolean;  // Are we in a type annotation?
  inJSXText: boolean;      // Are we between JSX tags?
  languageMode: LanguageMode; // Current language context
}

enum LanguageMode {
  JavaScript,
  TypeScript, 
  JSX,
  Python,
  Ruby,
  Go,
  Rust
}
```

#### Day 2: JSX Context Tracking
- Implement `enterJSX()` and `exitJSX()` methods
- Track JSX depth on `<` and `>` tokens
- Preserve ALL whitespace when `inJSXText` is true
- Create proper JSXText tokens with original spacing

#### Day 3: Type Context Detection
- Set `inTypeContext` after `:`, `type`, `interface`, `as`
- Clear on statement boundaries
- Use context to guide angle bracket interpretation

### Phase 2: Enhanced Parser Lookahead (Days 4-6)

#### Day 4: Multi-Token Lookahead
```typescript
// Add to parser.ts
private lookahead(n: number): Token | null {
  const pos = this.current + n;
  return pos < this.tokens.length ? this.tokens[pos] : null;
}

private isJSXStart(): boolean {
  // Look for patterns like < Identifier (props) or < Identifier />
  const t1 = this.peek();
  const t2 = this.lookahead(1);
  const t3 = this.lookahead(2);
  
  if (t1.value !== '<') return false;
  
  // Check for JSX patterns
  if (t2?.type === TokenType.Identifier) {
    // Look for self-closing /> or attributes
    if (t3?.value === '/' || t3?.value === '>') return true;
    if (t3?.type === TokenType.Identifier) {
      const t4 = this.lookahead(3);
      if (t4?.value === '=') return true; // attribute
    }
  }
  
  return false;
}
```

#### Day 5: Angle Bracket Disambiguation
- Implement heuristics for `<` disambiguation:
  - After `=`, `(`, `return` → likely JSX or comparison
  - After type keywords → likely generic
  - Before `/` → likely JSX closing tag
  - Followed by uppercase identifier → likely JSX

#### Day 6: Context-Sensitive Parsing
- Use lexer context in parser decisions
- Pass context through parsing methods
- Handle mode-specific operator precedence

### Phase 3: AST Enhancements (Days 7-9)

#### Day 7: Destructuring Pattern Nodes
```typescript
// Add to ast.ts
export interface ObjectPattern {
  kind: "ObjectPattern";
  properties: ObjectPatternProperty[];
  span: Span;
}

export interface ArrayPattern {
  kind: "ArrayPattern";
  elements: (Pattern | null)[];
  span: Span;
}

export type Pattern = Identifier | ObjectPattern | ArrayPattern;
```

#### Day 8: TypeScript Type Nodes
```typescript
// Add to ast.ts
export interface QualifiedType {
  kind: "QualifiedType";
  namespace: Identifier;
  name: Identifier;
  args?: TypeNode[];
  span: Span;
}

export interface TypeofType {
  kind: "TypeofType";
  expr: Expression;
  span: Span;
}

export interface KeyofType {
  kind: "KeyofType";
  type: TypeNode;
  span: Span;
}
```

#### Day 9: Integration & Testing
- Update parser to create new AST nodes
- Ensure backward compatibility
- Run test suite after each change

### Phase 4: Polyglot Improvements (Days 10-11)

#### Day 10: Language Mode Stack
```typescript
class Parser {
  private modeStack: LanguageMode[] = [LanguageMode.JavaScript];
  
  private pushMode(mode: LanguageMode) {
    this.modeStack.push(mode);
  }
  
  private popMode() {
    if (this.modeStack.length > 1) {
      this.modeStack.pop();
    }
  }
  
  private currentMode(): LanguageMode {
    return this.modeStack[this.modeStack.length - 1];
  }
}
```

#### Day 11: Mode-Specific Parsing
- Define operator precedence per language
- Handle mode transitions at boundaries
- Support embedded language blocks

### Phase 5: Final Polish (Days 12-15)

#### Day 12-13: Edge Case Fixes
- Fix specific test failures one by one
- Add regression tests for each fix
- Ensure no new failures introduced

#### Day 14: Performance Optimization
- Profile parser performance
- Optimize hot paths
- Reduce unnecessary allocations

#### Day 15: Documentation & Cleanup
- Document new AST nodes
- Update parser documentation
- Clean up debug code
- Final test run

## Success Metrics

### Week 1 Target
- Context-aware lexer complete
- JSX whitespace preservation working
- **Expected: 305/317 tests (96.2%)**

### Week 2 Target  
- Multi-token lookahead implemented
- Angle bracket disambiguation working
- Destructuring patterns parsed
- **Expected: 312/317 tests (98.4%)**

### Week 3 Target
- All TypeScript types supported
- Polyglot modes working
- All edge cases fixed
- **Target: 317/317 tests (100.0%)**

## Risk Mitigation

### Backward Compatibility
- Keep all existing AST nodes unchanged
- Add new nodes as extensions
- Use feature flags if needed

### Performance Impact
- Benchmark before/after each phase
- Keep lookahead minimal
- Cache context calculations

### Test Coverage
- Add tests for each new feature
- Run full suite after each change
- Keep CI green throughout

## Alternative Approaches

If the deep changes prove too risky or time-consuming:

### Option A: Pragmatic Fixes (3-5 days)
- Add special cases for failing tests
- Use heuristics instead of full context
- Accept 98% compatibility as good enough

### Option B: Two-Pass Parsing (5-7 days)
- First pass: Identify JSX/Type regions
- Second pass: Parse with context
- Simpler but slower approach

### Option C: Hybrid Lexer/Parser (7-10 days)
- Move some parsing logic to lexer
- Create higher-level tokens (JSXElement, TypeAnnotation)
- Simplify parser at cost of lexer complexity

## Conclusion

The deep architectural changes will require approximately 15 working days to achieve 100% test compatibility. The phased approach allows for incremental progress with measurable milestones. The key insight is that the lexer needs to be context-aware, and the parser needs better lookahead capabilities to handle the ambiguous syntax of modern JavaScript/TypeScript with JSX.