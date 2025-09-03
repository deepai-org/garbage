# Strategic Parser & Lexer Architecture Improvements

## Core Problems Analysis
The 16 failing tests share common patterns:
1. Context-sensitive tokens (keywords vs identifiers)
2. Multi-language syntax modes (Bash inside JS, Python inside Ruby)
3. Special literal formats (f-strings, heredocs, decorators)
4. Complex operator precedence across paradigms
5. Pipeline composition patterns

## Proposed Architectural Changes

### 1. Context-Aware Lexer with Mode Stack

**Problem**: Currently lexer is stateless - `type` is always a keyword, `[` always means array.

**Solution**: Implement a lexer mode stack that changes behavior based on context:

```typescript
class Lexer {
  private modeStack: LexerMode[] = [LexerMode.Normal];
  
  enum LexerMode {
    Normal,           // Default mode
    MemberAccess,     // After . or ?. - everything is identifier
    BashCondition,    // Inside [ ] - bash syntax rules
    StringTemplate,   // Inside template literal
    Decorator,        // After @ - special rules
    TypeContext,      // After : or < in generics
    Regex,           // Inside / /
    Heredoc          // Inside <<EOF ... EOF
  }
  
  private scanToken() {
    const mode = this.modeStack[this.modeStack.length - 1];
    
    switch (mode) {
      case LexerMode.MemberAccess:
        // EVERYTHING is an identifier here
        return this.scanIdentifierOnly();
        
      case LexerMode.BashCondition:
        // Special bash tokens: -lt, -ne, $var, etc.
        return this.scanBashToken();
        
      case LexerMode.Decorator:
        // Handle decorator-specific syntax
        return this.scanDecoratorToken();
    }
  }
}
```

**Benefits**:
- Fixes member access (obj.type)
- Enables bash conditionals
- Allows context-specific keywords
- Supports decorator syntax

### 2. Parser with Language Mode Hints

**Problem**: Parser doesn't know when to expect Python vs Ruby vs JS syntax.

**Solution**: Add language hints that cascade down parse tree:

```typescript
class Parser {
  private languageHint: LanguageMode = LanguageMode.Polyglot;
  
  enum LanguageMode {
    Polyglot,    // Mixed (default)
    JavaScript,  // async/await, =>
    Python,      // : blocks, comprehensions
    Ruby,        // do/end, ||blocks||
    Go,          // := and channels
    Bash,        // Special conditionals
  }
  
  private parseStatement() {
    // Comment-based hints
    if (this.lastComment?.includes("python")) {
      this.pushLanguageHint(LanguageMode.Python);
    }
    
    // Keyword-based detection
    if (this.check("def") || this.check("elif")) {
      this.pushLanguageHint(LanguageMode.Python);
    }
    
    // Use hint for parsing decisions
    if (this.languageHint === LanguageMode.Python && this.check("[")) {
      return this.tryComprehension() || this.parseArrayLiteral();
    }
  }
}
```

### 3. Two-Phase Parsing for Complex Constructs

**Problem**: Some constructs need lookahead beyond what's practical (match in pipes, comprehensions).

**Solution**: Parse ambiguous constructs into intermediate nodes, then resolve in second pass:

```typescript
// First pass - parse into ambiguous nodes
interface AmbiguousExpr extends AST.Expr {
  kind: "Ambiguous";
  variants: {
    array?: AST.ArrayLiteral;
    comprehension?: AST.Comprehension;
    bashCondition?: AST.BashCondition;
  };
}

// Second pass - resolve based on context
class SemanticResolver {
  resolve(ast: AST.Program) {
    // Look at pipe operators to determine if RHS is match expression
    // Look at 'for' keyword to determine if [ ] is comprehension
    // Look at $ prefix to determine bash context
  }
}
```

### 4. Unified Pipeline/Composition Handler

**Problem**: Pipe operator needs special handling for match, lambdas, and other constructs.

**Solution**: Make pipe operator trigger special parsing mode:

```typescript
private parsePipeExpression(left: AST.Expr): AST.Expr {
  this.consume("|>");
  
  // Special cases for RHS of pipe
  if (this.check("match")) {
    return this.parseMatchWithImplicitDiscriminant(left);
  }
  
  if (this.check("async")) {
    return this.parseAsyncLambdaWithImplicitArg(left);
  }
  
  if (this.check("_")) {
    // Placeholder syntax: data |> _.method()
    return this.parsePlaceholderExpression(left);
  }
  
  // Normal function/expression
  const right = this.parsePrimary();
  return { kind: "Pipe", left, right };
}
```

### 5. String Literal Factory System

**Problem**: Many string types (f"", r"", b"", @"", <<EOF) need different parsing.

**Solution**: Detect string type at lex time, use appropriate parser:

```typescript
class StringLiteralFactory {
  static create(prefix: string, quote: string): StringScanner {
    switch(prefix) {
      case 'f': return new FStringScanner();    // f"hello {name}"
      case 'r': return new RawStringScanner();   // r"\n is literal"
      case 'b': return new ByteStringScanner();  // b"bytes"
      case '@': return new VerbatimScanner();    // @"C:\path"
      default: return new BasicStringScanner();
    }
  }
}

// In lexer
if (this.peek() === '"' || this.peek() === "'") {
  const prefix = this.captureStringPrefix(); // f, r, b, @, etc
  const scanner = StringLiteralFactory.create(prefix, this.peek());
  return scanner.scan(this);
}
```

### 6. Comprehension and Generator Unification

**Problem**: List/set/dict comprehensions and generators have similar syntax but different semantics.

**Solution**: Parse into unified comprehension node, differentiate by brackets:

```typescript
interface Comprehension extends AST.Expr {
  kind: "Comprehension";
  type: "list" | "set" | "dict" | "generator";
  expression: AST.Expr;
  iterators: ComprehensionIterator[];
  conditions: AST.Expr[];
}

private parseComprehension(): Comprehension | null {
  const start = this.current;
  const opener = this.previous()?.value; // '[', '{', '('
  
  // Try to parse comprehension syntax
  const expr = this.parseExpression();
  if (!this.check("for")) {
    this.current = start;
    return null;
  }
  
  // Parse: for x in items if condition
  const iterators = this.parseComprehensionIterators();
  
  const type = opener === '[' ? "list" :
               opener === '{' ? (this.hasKeyValue ? "dict" : "set") :
               "generator";
  
  return { kind: "Comprehension", type, expression: expr, iterators };
}
```

## Implementation Priority

### Phase 1: Context-Aware Lexer (Biggest Impact)
- Fixes member access keywords ✓
- Enables bash conditionals
- Supports decorators
- **Estimated impact: +6 tests**

### Phase 2: Pipeline Handler
- Fixes match in pipes
- Handles placeholder syntax
- **Estimated impact: +3 tests**

### Phase 3: String Literal Factory
- All special string types
- Heredocs
- **Estimated impact: +4 tests**

### Phase 4: Comprehension Unification
- List/set/dict comprehensions
- Generator expressions
- **Estimated impact: +3 tests**

## Code Organization Benefits

This architecture also provides:
1. **Better error messages** - Mode stack shows parsing context
2. **Easier debugging** - Clear mode transitions
3. **Extensibility** - New languages just add modes
4. **Performance** - Two-phase only when needed
5. **Maintainability** - Separated concerns

## Migration Strategy

1. Start with lexer modes (non-breaking)
2. Add parser hints gradually
3. Introduce two-phase for ambiguous cases only
4. Keep backward compatibility throughout