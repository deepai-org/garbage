# Ultimate Universal Parser Implementation Plan

## Vision
Create the most sophisticated universal parser that correctly handles ALL language constructs across JavaScript, TypeScript, JSX, Python, Ruby, Go, Rust, and more - with full context awareness and zero ambiguity.

## Current State → Target State
- **Current**: 302/317 tests (95.3%) - Stateless lexer, limited lookahead
- **Target**: 317/317 tests (100%) + extended polyglot support
- **Ultimate Goal**: Parse any valid code from any supported language in a single file

## Phase 1: Context-Aware Lexer Revolution (Days 1-4)

### Day 1: Lexer Context Architecture
```typescript
// src/lexer-context.ts
export interface LexerContext {
  // Language contexts
  languageStack: LanguageMode[];
  
  // JSX tracking
  jsxDepth: number;
  jsxTagStack: string[];  // Track opening tags for validation
  inJSXText: boolean;
  inJSXAttribute: boolean;
  
  // Type context
  inTypeAnnotation: boolean;
  typeDepth: number;
  genericDepth: number;
  
  // Expression context  
  parenDepth: number;
  braceDepth: number;
  bracketDepth: number;
  
  // Special modes
  inTemplateString: boolean;
  inRegex: boolean;
  inComment: boolean;
  
  // Position tracking
  position: ContextPosition;
}

export interface ContextPosition {
  afterReturn: boolean;
  afterNew: boolean;
  afterYield: boolean;
  afterAwait: boolean;
  afterType: boolean;
  afterConst: boolean;
  afterLet: boolean;
  afterVar: boolean;
  afterClass: boolean;
  afterInterface: boolean;
  afterFunction: boolean;
  afterArrow: boolean;
  afterDot: boolean;
  afterComma: boolean;
  afterColon: boolean;
  afterEquals: boolean;
  afterOperator: boolean;
}

export class ContextTracker {
  private context: LexerContext;
  private history: LexerContext[] = [];
  
  push(update: Partial<LexerContext>): void {
    this.history.push({...this.context});
    this.context = {...this.context, ...update};
  }
  
  pop(): void {
    if (this.history.length > 0) {
      this.context = this.history.pop()!;
    }
  }
  
  isInJSX(): boolean {
    return this.context.jsxDepth > 0;
  }
  
  isInType(): boolean {
    return this.context.inTypeAnnotation || this.context.genericDepth > 0;
  }
  
  shouldPreserveWhitespace(): boolean {
    return this.context.inJSXText || this.context.inTemplateString;
  }
  
  canBeRegex(): boolean {
    const pos = this.context.position;
    return pos.afterReturn || pos.afterOperator || pos.afterEquals || 
           pos.afterComma || this.context.parenDepth > 0;
  }
  
  canBeJSX(): boolean {
    const pos = this.context.position;
    return !this.context.inTypeAnnotation && 
           (pos.afterReturn || pos.afterEquals || pos.afterArrow);
  }
}
```

### Day 2: Integrate Context into Lexer
```typescript
// Modify src/lexer.ts
class Lexer {
  private context: ContextTracker;
  
  tokenize(): Token[] {
    this.context = new ContextTracker();
    const tokens: Token[] = [];
    
    while (!this.isAtEnd()) {
      // Update position context based on last token
      this.updatePositionContext();
      
      // Choose tokenization strategy based on context
      const token = this.nextTokenWithContext();
      
      // Update depth tracking
      this.updateDepthTracking(token);
      
      // Update language mode if needed
      this.updateLanguageMode(token);
      
      tokens.push(token);
    }
    
    return tokens;
  }
  
  private nextTokenWithContext(): Token {
    // Preserve whitespace in JSX text
    if (this.context.shouldPreserveWhitespace()) {
      return this.lexWithWhitespace();
    }
    
    // Skip whitespace normally
    this.skipWhitespace();
    
    const char = this.peek();
    
    // Context-aware tokenization
    if (char === '<') {
      return this.lexAngleBracket();
    }
    
    if (char === '/') {
      if (this.context.canBeRegex()) {
        return this.lexRegex();
      } else if (this.context.isInJSX() && this.peekNext() === '>') {
        return this.lexJSXSelfClose();
      }
      return this.lexOperator();
    }
    
    // ... rest of tokenization
  }
  
  private lexAngleBracket(): Token {
    const start = this.position;
    
    // Look ahead to disambiguate
    if (this.context.canBeJSX() && this.looksLikeJSX()) {
      this.context.push({ jsxDepth: this.context.jsxDepth + 1 });
      return this.createToken(TokenType.JSXTagStart, '<', start);
    }
    
    if (this.context.isInType() || this.looksLikeGeneric()) {
      this.context.push({ genericDepth: this.context.genericDepth + 1 });
      return this.createToken(TokenType.GenericStart, '<', start);
    }
    
    // Default to operator
    return this.createToken(TokenType.Operator, '<', start);
  }
  
  private looksLikeJSX(): boolean {
    // Sophisticated lookahead
    const saved = this.position;
    this.advance(); // skip <
    
    // Check for fragment
    if (this.peek() === '>') {
      this.position = saved;
      return true;
    }
    
    // Check for closing tag
    if (this.peek() === '/') {
      this.advance();
      const hasIdentifier = this.isAlpha(this.peek());
      this.position = saved;
      return hasIdentifier;
    }
    
    // Check for component/element name
    if (!this.isAlpha(this.peek())) {
      this.position = saved;
      return false;
    }
    
    // Skip identifier
    while (this.isAlphaNumeric(this.peek())) {
      this.advance();
    }
    
    // Check what follows
    const next = this.peek();
    const result = next === '>' || next === '/' || next === ' ' || 
                   next === '\n' || next === '\t' || this.isAlpha(next);
    
    this.position = saved;
    return result;
  }
}
```

### Day 3: JSX Text Tokenization
```typescript
// Special handling for JSX text content
private lexJSXText(): Token[] {
  const tokens: Token[] = [];
  let buffer = '';
  let start = this.position;
  
  while (!this.isAtEnd()) {
    const char = this.peek();
    
    // Check for JSX boundaries
    if (char === '<' || char === '{') {
      // Flush buffer as JSXText token
      if (buffer.length > 0) {
        tokens.push(this.createToken(TokenType.JSXText, buffer, start));
      }
      break;
    }
    
    // Accumulate all characters including whitespace
    buffer += char;
    this.advance();
  }
  
  if (buffer.length > 0) {
    tokens.push(this.createToken(TokenType.JSXText, buffer, start));
  }
  
  return tokens;
}
```

### Day 4: Type Context Tracking
```typescript
// Track when we enter/exit type annotation contexts
private updateTypeContext(token: Token): void {
  // Enter type context
  if (token.value === ':' && !this.context.isInJSX()) {
    this.context.push({ inTypeAnnotation: true });
  }
  
  if (token.value === 'type' || token.value === 'interface') {
    this.context.push({ inTypeAnnotation: true });
  }
  
  if (token.value === 'as') {
    this.context.push({ inTypeAnnotation: true });
  }
  
  // Exit type context
  if (this.context.inTypeAnnotation) {
    if (token.value === ';' || token.value === '{' || 
        token.value === '=' || token.value === '=>') {
      this.context.push({ inTypeAnnotation: false });
    }
  }
}
```

## Phase 2: Parser Intelligence Upgrade (Days 5-8)

### Day 5: Enhanced Lookahead System
```typescript
// src/parser-lookahead.ts
export class LookaheadParser extends Parser {
  // Multi-token lookahead with caching
  private lookaheadCache = new Map<number, Token>();
  
  protected lookahead(n: number): Token | null {
    if (this.lookaheadCache.has(n)) {
      return this.lookaheadCache.get(n)!;
    }
    
    const pos = this.current + n;
    if (pos >= this.tokens.length) return null;
    
    const token = this.tokens[pos];
    this.lookaheadCache.set(n, token);
    return token;
  }
  
  protected clearLookaheadCache(): void {
    this.lookaheadCache.clear();
  }
  
  // Pattern matching helpers
  protected matchesPattern(...pattern: string[]): boolean {
    for (let i = 0; i < pattern.length; i++) {
      const token = this.lookahead(i);
      if (!token || token.value !== pattern[i]) {
        return false;
      }
    }
    return true;
  }
  
  // Check if upcoming tokens form a JSX element
  protected isUpcomingJSX(): boolean {
    // <Component prop="value">
    if (this.matchesPattern('<', 'Identifier')) {
      const t3 = this.lookahead(2);
      if (t3?.value === '>' || t3?.value === '/') return true;
      if (t3?.type === TokenType.Identifier) {
        const t4 = this.lookahead(3);
        if (t4?.value === '=') return true;
      }
    }
    
    // <div>
    if (this.matchesPattern('<', 'div', '>')) return true;
    
    // <>
    if (this.matchesPattern('<', '>')) return true;
    
    return false;
  }
  
  // Check if upcoming tokens form a generic
  protected isUpcomingGeneric(): boolean {
    // Array<T>
    if (this.matchesPattern('<', 'Identifier', '>')) {
      // But not <div> or <Div>
      const name = this.lookahead(1)?.value || '';
      if (this.isHTMLTag(name)) return false;
      if (/^[A-Z]/.test(name)) return false; // Components
      return true;
    }
    
    // Function<T, U>
    if (this.matchesPattern('<', 'Identifier', ',')) return true;
    
    return false;
  }
}
```

### Day 6: Destructuring Pattern AST
```typescript
// src/ast.ts additions
export interface ObjectPattern {
  kind: "ObjectPattern";
  properties: ObjectPatternProperty[];
  span: Span;
}

export interface ObjectPatternProperty {
  kind: "ObjectPatternProperty";
  key: Identifier;
  value: Pattern;
  shorthand: boolean;
  computed: boolean;
  span: Span;
}

export interface ArrayPattern {
  kind: "ArrayPattern";
  elements: (Pattern | null)[];  // null for holes [a, , c]
  span: Span;
}

export interface RestElement {
  kind: "RestElement";
  argument: Pattern;
  span: Span;
}

export interface AssignmentPattern {
  kind: "AssignmentPattern";
  left: Pattern;
  right: Expression;
  span: Span;
}

export type Pattern = 
  | Identifier 
  | ObjectPattern 
  | ArrayPattern 
  | RestElement 
  | AssignmentPattern;

// Update Param to use Pattern
export interface Param {
  pattern: Pattern;  // Changed from name: Identifier
  type?: TypeNode;
  defaultValue?: Expression;
  // ... rest of fields
}
```

### Day 7: Destructuring Parser Implementation
```typescript
// src/parser.ts additions
private parsePattern(): Pattern {
  if (this.check('{')) {
    return this.parseObjectPattern();
  }
  
  if (this.check('[')) {
    return this.parseArrayPattern();
  }
  
  if (this.match('...')) {
    return this.parseRestElement();
  }
  
  // Simple identifier
  const id = this.parseIdentifier();
  
  // Check for default value (assignment pattern)
  if (this.match('=')) {
    const defaultValue = this.parseAssignmentExpression();
    return {
      kind: "AssignmentPattern",
      left: id,
      right: defaultValue,
      span: this.createSpanFrom(id)
    };
  }
  
  return id;
}

private parseObjectPattern(): ObjectPattern {
  const start = this.current;
  this.consume('{', "Expected '{'");
  
  const properties: ObjectPatternProperty[] = [];
  
  while (!this.check('}') && !this.isAtEnd()) {
    if (this.match('...')) {
      // Rest element in object pattern
      const rest = this.parseRestElement();
      properties.push({
        kind: "ObjectPatternProperty",
        key: { kind: "Identifier", name: "...", span: rest.span },
        value: rest,
        shorthand: false,
        computed: false,
        span: rest.span
      });
      break; // Rest must be last
    }
    
    let key: Identifier;
    let computed = false;
    
    // Computed property [key]: value
    if (this.match('[')) {
      computed = true;
      key = this.parseIdentifier(); // Simplified - should be expression
      this.consume(']', "Expected ']'");
    } else {
      key = this.parseIdentifier();
    }
    
    let value: Pattern = key;
    let shorthand = true;
    
    // Long form { key: value }
    if (this.match(':')) {
      shorthand = false;
      value = this.parsePattern();
    }
    
    // Default value { key = defaultValue }
    if (this.match('=')) {
      const defaultValue = this.parseAssignmentExpression();
      value = {
        kind: "AssignmentPattern",
        left: value,
        right: defaultValue,
        span: this.createSpanFrom(value)
      };
    }
    
    properties.push({
      kind: "ObjectPatternProperty",
      key,
      value,
      shorthand,
      computed,
      span: this.createSpanFrom(key)
    });
    
    if (!this.match(',')) break;
  }
  
  this.consume('}', "Expected '}'");
  
  return {
    kind: "ObjectPattern",
    properties,
    span: this.createSpan(start, this.current - 1)
  };
}

private parseArrayPattern(): ArrayPattern {
  const start = this.current;
  this.consume('[', "Expected '['");
  
  const elements: (Pattern | null)[] = [];
  
  while (!this.check(']') && !this.isAtEnd()) {
    // Hole in array pattern [a, , c]
    if (this.check(',')) {
      elements.push(null);
      this.advance();
      continue;
    }
    
    elements.push(this.parsePattern());
    
    if (!this.match(',')) break;
  }
  
  this.consume(']', "Expected ']'");
  
  return {
    kind: "ArrayPattern",
    elements,
    span: this.createSpan(start, this.current - 1)
  };
}
```

### Day 8: Type System Completions
```typescript
// src/ast.ts - Advanced TypeScript types
export interface QualifiedType {
  kind: "QualifiedType";
  namespace: TypeNode;
  name: Identifier;
  span: Span;
}

export interface TypeofType {
  kind: "TypeofType";
  expression: Expression;
  span: Span;
}

export interface KeyofType {
  kind: "KeyofType";
  type: TypeNode;
  span: Span;
}

export interface InferType {
  kind: "InferType";
  name: Identifier;
  span: Span;
}

export interface ConditionalType {
  kind: "ConditionalType";
  checkType: TypeNode;
  extendsType: TypeNode;
  trueType: TypeNode;
  falseType: TypeNode;
  span: Span;
}

export interface MappedType {
  kind: "MappedType";
  parameter: Identifier;
  constraint: TypeNode;
  nameType?: TypeNode;
  valueType: TypeNode;
  optional?: boolean;
  readonly?: boolean;
  span: Span;
}

export interface IndexedAccessType {
  kind: "IndexedAccessType";
  objectType: TypeNode;
  indexType: TypeNode;
  span: Span;
}

export interface TupleType {
  kind: "TupleType";
  elements: TypeNode[];
  span: Span;
}

// Parser implementation
private parseQualifiedType(): QualifiedType {
  const start = this.current;
  let namespace: TypeNode = this.parseSimpleType();
  
  while (this.match('.')) {
    const name = this.parseIdentifier();
    namespace = {
      kind: "QualifiedType",
      namespace,
      name,
      span: this.createSpanFrom(namespace)
    };
  }
  
  return namespace as QualifiedType;
}
```

## Phase 3: Language Mode System (Days 9-10)

### Day 9: Language Mode Stack
```typescript
// src/language-modes.ts
export enum LanguageMode {
  JavaScript = "javascript",
  TypeScript = "typescript",
  JSX = "jsx",
  TSX = "tsx",
  Python = "python",
  Ruby = "ruby",
  Go = "go",
  Rust = "rust",
  Bash = "bash",
  SQL = "sql"
}

export interface LanguageModeContext {
  mode: LanguageMode;
  startToken: number;
  endToken?: number;
  depth: number;
}

export class LanguageModeManager {
  private modeStack: LanguageModeContext[] = [];
  private currentMode: LanguageMode = LanguageMode.TypeScript;
  
  enterMode(mode: LanguageMode, startToken: number): void {
    this.modeStack.push({
      mode: this.currentMode,
      startToken,
      depth: 0
    });
    this.currentMode = mode;
  }
  
  exitMode(endToken: number): void {
    if (this.modeStack.length > 0) {
      const context = this.modeStack.pop()!;
      context.endToken = endToken;
      this.currentMode = context.mode;
    }
  }
  
  getCurrentMode(): LanguageMode {
    return this.currentMode;
  }
  
  getOperatorPrecedence(op: string): number {
    // Mode-specific operator precedence
    switch (this.currentMode) {
      case LanguageMode.Python:
        return this.getPythonPrecedence(op);
      case LanguageMode.Ruby:
        return this.getRubyPrecedence(op);
      default:
        return this.getJavaScriptPrecedence(op);
    }
  }
  
  isStatementTerminator(token: Token): boolean {
    switch (this.currentMode) {
      case LanguageMode.Python:
      case LanguageMode.Ruby:
        return token.value === '\n' && !this.isLineContinuation();
      case LanguageMode.Go:
        return token.value === ';' || (token.value === '\n' && !this.isLineContinuation());
      default:
        return token.value === ';';
    }
  }
}
```

### Day 10: Mode-Specific Parsing
```typescript
// Parser extensions for different modes
private parseStatement(): Statement {
  const mode = this.modeManager.getCurrentMode();
  
  switch (mode) {
    case LanguageMode.Python:
      return this.parsePythonStatement();
    case LanguageMode.Ruby:
      return this.parseRubyStatement();
    case LanguageMode.Go:
      return this.parseGoStatement();
    default:
      return this.parseJavaScriptStatement();
  }
}

private parsePythonStatement(): Statement {
  // Python-specific statement parsing
  if (this.match('def')) {
    return this.parsePythonFunction();
  }
  
  if (this.match('class')) {
    return this.parsePythonClass();
  }
  
  if (this.match('import', 'from')) {
    return this.parsePythonImport();
  }
  
  if (this.match('if', 'elif', 'else')) {
    return this.parsePythonConditional();
  }
  
  if (this.match('for', 'while')) {
    return this.parsePythonLoop();
  }
  
  if (this.match('with')) {
    return this.parsePythonWith();
  }
  
  if (this.match('try', 'except', 'finally')) {
    return this.parsePythonTryCatch();
  }
  
  // Fall back to expression statement
  return this.parseExpressionStatement();
}
```

## Phase 4: Fix Remaining Test Failures (Days 11-13)

### Day 11: Angle Bracket Edge Cases
```typescript
// Enhanced disambiguation for complex cases
private parseComplexAngleBracket(): Expression {
  // Handle: a < b && c > d ? e<f> : g<h>()
  
  // Save position for backtracking
  const checkpoint = this.current;
  const contextCheckpoint = this.context.snapshot();
  
  // Try parsing as comparison first
  try {
    const left = this.parseShiftExpression();
    
    if (this.match('<', '>', '<=', '>=')) {
      const op = this.previous().value;
      const right = this.parseShiftExpression();
      
      // Check if this makes sense as comparison
      if (this.isValidComparison(left, right)) {
        return {
          kind: "Binary",
          left,
          op,
          right,
          span: this.createSpanFrom(left)
        };
      }
    }
  } catch (e) {
    // Comparison failed, try as JSX/generic
  }
  
  // Restore and try as JSX
  this.current = checkpoint;
  this.context.restore(contextCheckpoint);
  
  if (this.isUpcomingJSX()) {
    return this.parseJSXElement();
  }
  
  // Try as generic function call
  if (this.isUpcomingGeneric()) {
    return this.parseGenericCall();
  }
  
  // Default to comparison
  return this.parseBinaryExpression();
}
```

### Day 12: TypeScript/JSX Integration
```typescript
// Handle React.FC<Props> and JSX.Element
private parseReactTypes(): TypeNode {
  if (this.matchesPattern('React', '.', 'FC')) {
    this.advance(); // React
    this.advance(); // .
    this.advance(); // FC
    
    let args: TypeNode[] = [];
    if (this.match('<')) {
      args = this.parseTypeArguments();
    }
    
    return {
      kind: "QualifiedType",
      namespace: {
        kind: "SimpleType",
        id: { kind: "Identifier", name: "React" }
      },
      name: { kind: "Identifier", name: "FC" },
      args,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  if (this.matchesPattern('JSX', '.', 'Element')) {
    // Similar handling for JSX.Element
  }
}
```

### Day 13: Polyglot Edge Cases
```typescript
// Handle mixed language constructs
private parsePolyglotExpression(): Expression {
  // Example: Go channel + JavaScript async
  // go func() { ch <- value }()
  
  if (this.match('go')) {
    this.modeManager.enterMode(LanguageMode.Go, this.current);
    const expr = this.parseGoRoutine();
    this.modeManager.exitMode(this.current);
    return expr;
  }
  
  // Ruby block + JavaScript arrow function
  // array.map { |x| x * 2 }.filter(x => x > 5)
  
  if (this.isRubyBlock()) {
    this.modeManager.enterMode(LanguageMode.Ruby, this.current);
    const block = this.parseRubyBlock();
    this.modeManager.exitMode(this.current);
    
    // Continue with JavaScript method chain
    return this.parseMethodChain(block);
  }
}
```

## Phase 5: Testing & Polish (Days 14-15)

### Day 14: Comprehensive Testing
```typescript
// test/context-aware.test.ts
describe('Context-Aware Parsing', () => {
  test('handles deeply nested JSX with generics', () => {
    const code = `
      <Component<Props>
        render={(props: Props) => (
          <div>
            {items.map<Item>(item => 
              <Item<ItemProps> key={item.id} />
            )}
          </div>
        )}
      />
    `;
    
    const ast = parse(code);
    expect(ast).toMatchSnapshot();
  });
  
  test('handles mixed language modes', () => {
    const code = `
      const query = sql\`SELECT * FROM users WHERE id = \${userId}\`;
      const result = await db.query(query);
      
      const processed = result.map { |row|
        User.new(row[:id], row[:name])
      }.select(&:active?)
    `;
    
    const ast = parse(code);
    expect(ast.body).toHaveLength(3);
  });
});
```

### Day 15: Performance & Documentation
```typescript
// Optimize hot paths
class OptimizedLexer extends ContextAwareLexer {
  // Cache frequently accessed context checks
  private jsxCache = new Map<number, boolean>();
  private typeCache = new Map<number, boolean>();
  
  isInJSX(): boolean {
    const pos = this.position;
    if (this.jsxCache.has(pos)) {
      return this.jsxCache.get(pos)!;
    }
    
    const result = super.isInJSX();
    this.jsxCache.set(pos, result);
    return result;
  }
}

// Document all context rules
/**
 * Context Rules Documentation
 * 
 * JSX Context:
 * - Entered: After < followed by uppercase letter or HTML tag
 * - Exited: After matching closing tag
 * - Special: Preserves all whitespace in text content
 * 
 * Type Context:
 * - Entered: After :, type, interface, as keywords
 * - Exited: At statement boundary or = sign
 * - Special: < and > are generics, not comparisons
 * 
 * ...
 */
```

## Implementation Schedule

### Week 1: Foundation (Days 1-5)
- ✅ Context-aware lexer
- ✅ JSX/Type context tracking
- ✅ Enhanced lookahead
- **Milestone**: 305/317 tests passing

### Week 2: Intelligence (Days 6-10)
- ✅ Destructuring patterns
- ✅ Advanced TypeScript types
- ✅ Language mode system
- **Milestone**: 312/317 tests passing

### Week 3: Completion (Days 11-15)
- ✅ Fix edge cases
- ✅ Polyglot support
- ✅ Testing & optimization
- **Milestone**: 317/317 tests passing (100%)

## Success Metrics

1. **All 317 tests passing**
2. **Performance**: < 100ms to parse 10,000 lines
3. **Memory**: < 50MB for large files
4. **Accuracy**: 100% correct AST for all valid code
5. **Error Recovery**: Graceful handling of invalid code

## Extended Goals (Beyond 100%)

1. **SQL Template Literals**: Parse SQL inside template strings
2. **GraphQL Support**: Parse GraphQL queries
3. **CSS-in-JS**: Parse styled-components
4. **Markdown Code Blocks**: Parse code inside markdown
5. **Configuration Languages**: YAML, TOML, JSON5
6. **WebAssembly Text Format**: WAT syntax
7. **Shell Scripts**: Full bash/zsh support
8. **Regular Expression AST**: Parse regex patterns into AST

## Conclusion

This plan will transform PolyScript from a good universal parser into the ULTIMATE polyglot parser. The context-aware architecture ensures we can handle any ambiguity, the language mode system allows seamless mixing of languages, and the comprehensive AST supports every construct imaginable.

Total effort: 15 working days
Result: The most powerful universal parser ever created!