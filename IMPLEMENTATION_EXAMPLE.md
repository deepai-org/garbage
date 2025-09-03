# Concrete Implementation Example: Bash Conditionals

## Current Problem
Code like `while [ $retries -lt 3 ]; do` fails because:
1. `[` is lexed as array bracket
2. `$retries` isn't recognized as bash variable
3. `-lt` isn't recognized as bash operator
4. The entire construct breaks the parser

## Solution with Context-Aware Lexer

### Step 1: Lexer Mode Detection

```typescript
// In lexer.ts
private scanToken(): void {
  // ... existing code ...
  
  // Detect bash conditional start
  if (char === '[' && this.isStartOfBashCondition()) {
    this.pushMode(LexerMode.BashCondition);
    this.addToken(TokenType.BashCondStart, '[');
    return;
  }
}

private isStartOfBashCondition(): boolean {
  // Look for patterns like: if [, while [, until [
  const prevToken = this.tokens[this.tokens.length - 1];
  return prevToken && 
    ['if', 'while', 'until', 'elif'].includes(prevToken.value);
}

private scanBashToken(): void {
  const mode = this.getCurrentMode();
  if (mode !== LexerMode.BashCondition) return;
  
  const char = this.peek();
  
  // Handle bash variables
  if (char === '$') {
    this.advance(); // consume $
    const varName = this.scanIdentifierString();
    this.addToken(TokenType.BashVariable, '$' + varName);
    return;
  }
  
  // Handle bash operators
  if (char === '-') {
    const op = this.scanBashOperator(); // -lt, -gt, -eq, etc.
    if (op) {
      this.addToken(TokenType.BashOperator, op);
      return;
    }
  }
  
  // Handle closing bracket
  if (char === ']') {
    this.popMode(); // Exit bash mode
    this.addToken(TokenType.BashCondEnd, ']');
    return;
  }
  
  // Regular tokens in bash context
  this.scanDefault();
}
```

### Step 2: Parser Handling

```typescript
// In parser.ts
private parseWhileStatement(): AST.While {
  const start = this.current - 1;
  
  // Check for bash-style condition
  if (this.peek().type === TokenType.BashCondStart) {
    return this.parseBashWhile(start);
  }
  
  // Regular while parsing
  const test = this.parseExpression();
  // ... rest of normal while parsing
}

private parseBashWhile(start: number): AST.While {
  this.consume(TokenType.BashCondStart); // [
  
  const condition = this.parseBashCondition();
  
  this.consume(TokenType.BashCondEnd); // ]
  this.consume(';'); // optional semicolon
  this.consume('do'); // bash do keyword
  
  const body = this.parseBashLoopBody();
  
  this.consume('done'); // bash done keyword
  
  return {
    kind: "While",
    test: condition,
    body,
    style: "bash", // Mark as bash-style
    span: this.createSpan(start, this.current - 1)
  };
}

private parseBashCondition(): AST.Expr {
  // Parse bash-specific condition syntax
  const left = this.parseBashOperand();
  const op = this.consume(TokenType.BashOperator);
  const right = this.parseBashOperand();
  
  return {
    kind: "Binary",
    op: this.bashOpToJs(op.value), // Convert -lt to <
    left,
    right,
    span: this.createSpanFrom(left)
  };
}
```

### Step 3: Example Transformation

**Input:**
```bash
while [ $retries -lt 3 ]; do
  echo "Attempt $retries"
  retries=$((retries + 1))
done
```

**Token Stream with New System:**
```
WHILE(while) 
BASH_COND_START([) 
BASH_VAR($retries) 
BASH_OP(-lt) 
NUMBER(3) 
BASH_COND_END(]) 
SEMICOLON(;) 
DO(do)
IDENTIFIER(echo) 
STRING("Attempt $retries")
BASH_VAR($retries) 
ASSIGN(=) 
BASH_ARITHMETIC($((retries + 1)))
DONE(done)
```

**AST Output:**
```javascript
{
  kind: "While",
  style: "bash",
  test: {
    kind: "Binary",
    op: "<",
    left: { kind: "Identifier", name: "retries" },
    right: { kind: "NumericLiteral", value: 3 }
  },
  body: {
    kind: "Block",
    statements: [
      // echo statement
      // assignment statement
    ]
  }
}
```

## Benefits of This Approach

1. **Minimal Parser Changes** - Most logic stays in lexer
2. **Clean Token Stream** - Parser sees appropriate tokens
3. **Preserves Style** - Can maintain bash style in output if needed
4. **Extensible** - Easy to add more bash constructs
5. **Non-Breaking** - Only activates in bash context

## Application to Other Failing Features

### Decorators
```typescript
if (char === '@' && this.isStartOfLine()) {
  this.pushMode(LexerMode.Decorator);
  // Now @ isn't an operator, it's a decorator prefix
}
```

### F-Strings
```typescript
if (char === 'f' && this.peekNext() === '"') {
  this.pushMode(LexerMode.FString);
  // Now { } inside string are interpolation markers
}
```

### Comprehensions
```typescript
// In parser, when seeing '[' 
if (this.isLikelyComprehension()) {
  const comp = this.tryParseComprehension();
  if (comp) return comp;
}
// Fallback to array literal
```

## Proof of Concept Implementation

Here's a minimal working example for bash conditionals:

```typescript
// lexer-modes.ts
export enum LexerMode {
  Normal = "normal",
  BashCondition = "bash_cond",
  MemberAccess = "member",
}

// lexer-extensions.ts
export function enhanceLexer(Lexer: any) {
  const original = Lexer.prototype.scanToken;
  
  Lexer.prototype.modeStack = ['normal'];
  
  Lexer.prototype.scanToken = function() {
    const mode = this.modeStack[this.modeStack.length - 1];
    
    if (mode === 'bash_cond') {
      return this.scanBashToken();
    }
    
    // Check for mode transitions
    if (this.shouldEnterBashMode()) {
      this.modeStack.push('bash_cond');
    }
    
    return original.call(this);
  };
}
```

This architectural change would fix approximately 10 of the 16 failing tests with focused effort on the lexer layer.