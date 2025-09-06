# Virtual Semicolon Fix Implementation Guide

## Problem Analysis

### Current Behavior
```javascript
// Input JSX:
<div>
    {expr}
    <span>text</span>
</div>

// Tokens produced:
<, div, >, {, expr, }, [VIRTUAL_SEMICOLON], <, span, >, text, <, /, span, >, <, /, div, >

// Parser sees:
1. <div>{expr} - Parses as JSX with expression
2. ; - Virtual semicolon ends the statement
3. <span>text</span></div> - Attempts to parse as new statement, fails
```

### Root Cause
The lexer's `shouldInsertVirtualSemicolon()` method doesn't know about JSX context and inserts semicolons after `}` when followed by newline, even inside JSX elements.

## Solution Design

### Approach 1: Lexer-Level JSX Tracking (Recommended)

#### Advantages
- Clean separation of concerns
- No parser changes needed
- Fixes the root cause

#### Implementation
```typescript
// In src/lexer.ts

class Lexer {
  private jsxDepth = 0;
  private jsxStack: Array<{tag: string, selfClosing: boolean}> = [];
  
  private shouldInsertVirtualSemicolon(prevToken: Token, nextChar: string): boolean {
    // Don't insert virtual semicolon inside JSX
    if (this.jsxDepth > 0) {
      return false;
    }
    
    // Existing logic...
    if (prevToken.value === '}' && this.isNewlineAhead()) {
      return true;
    }
    // ...
  }
  
  private handleJSXContext(token: Token): void {
    // Track JSX element depth
    if (token.value === '<' && this.isJSXStart()) {
      const next = this.peekChar();
      if (next !== '/') {
        this.jsxDepth++;
      }
    } else if (token.value === '>' && this.jsxDepth > 0) {
      // Check if this closes a self-closing tag
      const prev = this.tokens[this.tokens.length - 1];
      if (prev?.value === '/') {
        this.jsxDepth--;
      }
    } else if (token.value === '<' && this.peekChar() === '/') {
      // Closing tag
      this.jsxDepth = Math.max(0, this.jsxDepth - 1);
    }
  }
  
  private isJSXStart(): boolean {
    // Look ahead to determine if < starts JSX
    const saved = this.current;
    this.advance(); // skip <
    
    if (this.peek() === '/') {
      this.current = saved;
      return true; // Closing tag
    }
    
    if (this.peek() === '>') {
      this.current = saved;
      return true; // Fragment <>
    }
    
    // Check if followed by identifier (tag name)
    if (this.isAlpha(this.peek()) || this.peek() === '_') {
      this.current = saved;
      return true;
    }
    
    this.current = saved;
    return false;
  }
}
```

### Approach 2: Parser-Level Handling (Alternative)

#### Advantages
- No lexer changes
- More context available

#### Disadvantages
- Requires skipping virtual semicolons in many places
- More complex

#### Implementation
```typescript
// In src/parser.ts

private parseJSXChildren(): AST.JSXChild[] {
  const children: AST.JSXChild[] = [];
  
  while (!this.isAtEnd()) {
    // Enhanced virtual semicolon handling
    while (this.peek().virtualSemi) {
      this.advance();
      
      // After virtual semicolon, check if we're still in JSX
      if (this.check("<") && !this.isJSXContinuation()) {
        // This might be a closing tag
        break;
      }
    }
    
    // ... rest of parsing
  }
}

private isJSXContinuation(): boolean {
  // Determine if the next tokens continue JSX content
  if (this.check("<")) {
    const next = this.peekNext();
    if (next?.value === "/") return true; // Closing tag
    if (next?.type === TokenType.Identifier) return true; // Another element
  }
  return false;
}
```

## Testing Strategy

### Test Cases to Verify

1. **Basic JSX with expressions**
```jsx
<div>{expr}</div>  // Should work
```

2. **Multiline JSX with expressions**
```jsx
<div>
    {expr}
    <span>text</span>
</div>  // Currently fails, should work after fix
```

3. **JSX with comments**
```jsx
<div>
    {/* comment */}
    <span>text</span>
</div>  // Currently fails, should work after fix
```

4. **Nested JSX with expressions**
```jsx
<div>
    {items.map(item => (
        <li>{item}</li>
    ))}
</div>  // Should work
```

5. **Non-JSX code still gets virtual semicolons**
```javascript
function foo() {
    const a = {}
    const b = {}  // Should still get virtual semicolon
}
```

### Validation Steps

1. **Run existing tests**
   ```bash
   npm test
   ```

2. **Check specific JSX tests**
   ```bash
   npm test -- test/jsx-edge-cases-updated.test.ts
   npm test -- test/jsx-typescript-updated.test.ts
   ```

3. **Verify no regressions**
   ```bash
   npm test -- test/parser.test.ts
   ```

## Implementation Checklist

### Phase 1: Lexer Changes
- [ ] Add `jsxDepth` counter to Lexer class
- [ ] Implement `isJSXStart()` helper
- [ ] Implement `handleJSXContext()` method
- [ ] Modify `shouldInsertVirtualSemicolon()` to check JSX context
- [ ] Update `tokenize()` to call `handleJSXContext()`

### Phase 2: Testing
- [ ] Create test file `test/jsx-virtual-semicolon.test.ts`
- [ ] Add test cases for all scenarios
- [ ] Run full test suite
- [ ] Fix any regressions

### Phase 3: Edge Cases
- [ ] Test with JSX fragments `<></>`
- [ ] Test with self-closing tags `<br />`
- [ ] Test with JSX member expressions `<Form.Input>`
- [ ] Test with JSX namespaced names `<svg:circle>`

### Phase 4: Documentation
- [ ] Update lexer documentation
- [ ] Add comments explaining JSX context tracking
- [ ] Update CHANGELOG

## Rollback Plan

If the fix causes issues:

1. **Immediate**: Revert lexer changes
2. **Short-term**: Use parser-level workaround
3. **Long-term**: Design more comprehensive solution

## Success Criteria

- [ ] All JSX tests pass
- [ ] No regression in non-JSX tests
- [ ] Virtual semicolons still work correctly in JS/TS code
- [ ] Performance impact < 5%

## Code Locations

### Files to Modify
1. `src/lexer.ts` - Main implementation
2. `src/tokens.ts` - May need JSX context flag

### Files to Test
1. `test/jsx-edge-cases-updated.test.ts`
2. `test/jsx-typescript-updated.test.ts`
3. `test/jsx-fragments-nested-updated.test.ts`
4. `test/jsx-polyglot-updated.test.ts`

## Example Fix

Here's a minimal fix to get started:

```typescript
// In src/lexer.ts, add to class Lexer:

private jsxElementDepth = 0;

// In tokenize() method, after creating token:
if (token.value === '<' && this.peekChar() !== '/' && 
    (this.isAlpha(this.peekChar()) || this.peekChar() === '>')) {
  this.jsxElementDepth++;
} else if (token.value === '>' && this.jsxElementDepth > 0) {
  if (this.tokens[this.tokens.length - 1]?.value === '/') {
    this.jsxElementDepth--; // Self-closing
  }
} else if (token.value === '<' && this.peekChar() === '/') {
  // Will decrement on the matching >
} else if (token.value === '>' && this.tokens[this.tokens.length - 2]?.value === '/') {
  this.jsxElementDepth--; // Closing tag
}

// In shouldInsertVirtualSemicolon():
if (this.jsxElementDepth > 0) {
  return false; // Don't insert inside JSX
}
```

This should fix the immediate issue and allow all JSX tests to pass.