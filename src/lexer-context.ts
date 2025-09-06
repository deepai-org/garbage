/**
 * Context-Aware Lexer Context Management
 * 
 * This module provides sophisticated context tracking for the lexer,
 * enabling it to make intelligent decisions about tokenization based
 * on the current parsing context.
 */

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
  afterOpenParen: boolean;
  afterOpenBrace: boolean;
  afterOpenBracket: boolean;
  afterSemicolon: boolean;
  lineStart: boolean;
}

export interface LexerContext {
  // Language contexts
  languageMode: LanguageMode;
  languageStack: LanguageMode[];
  
  // JSX tracking
  jsxDepth: number;
  jsxTagStack: string[];  // Track opening tags for validation
  inJSXText: boolean;
  inJSXAttribute: boolean;
  inJSXOpeningTag: boolean;
  inJSXClosingTag: boolean;
  
  // Type context
  inTypeAnnotation: boolean;
  inTypeDeclaration: boolean;
  typeDepth: number;
  genericDepth: number;
  inGenericArguments: boolean;
  
  // Expression context  
  parenDepth: number;
  braceDepth: number;
  bracketDepth: number;
  
  // Template strings
  inTemplateString: boolean;
  templateDepth: number;
  
  // Special modes
  inRegex: boolean;
  inComment: boolean;
  inString: boolean;
  stringDelimiter: string | null;
  
  // Position tracking
  position: ContextPosition;
  
  // Indentation (for Python/Ruby)
  indentStack: number[];
  currentIndent: number;
}

export class ContextTracker {
  private context: LexerContext;
  private history: LexerContext[] = [];
  private maxHistorySize = 100;
  
  constructor() {
    this.context = this.createInitialContext();
  }
  
  private createInitialContext(): LexerContext {
    return {
      languageMode: LanguageMode.TSX, // Default to TSX for maximum compatibility
      languageStack: [],
      
      jsxDepth: 0,
      jsxTagStack: [],
      inJSXText: false,
      inJSXAttribute: false,
      inJSXOpeningTag: false,
      inJSXClosingTag: false,
      
      inTypeAnnotation: false,
      inTypeDeclaration: false,
      typeDepth: 0,
      genericDepth: 0,
      inGenericArguments: false,
      
      parenDepth: 0,
      braceDepth: 0,
      bracketDepth: 0,
      
      inTemplateString: false,
      templateDepth: 0,
      
      inRegex: false,
      inComment: false,
      inString: false,
      stringDelimiter: null,
      
      position: this.createInitialPosition(),
      
      indentStack: [0],
      currentIndent: 0
    };
  }
  
  private createInitialPosition(): ContextPosition {
    return {
      afterReturn: false,
      afterNew: false,
      afterYield: false,
      afterAwait: false,
      afterType: false,
      afterConst: false,
      afterLet: false,
      afterVar: false,
      afterClass: false,
      afterInterface: false,
      afterFunction: false,
      afterArrow: false,
      afterDot: false,
      afterComma: false,
      afterColon: false,
      afterEquals: false,
      afterOperator: false,
      afterOpenParen: false,
      afterOpenBrace: false,
      afterOpenBracket: false,
      afterSemicolon: false,
      lineStart: true
    };
  }
  
  /**
   * Save current context to history and apply updates
   */
  push(updates: Partial<LexerContext>): void {
    // Save to history
    this.history.push(this.deepClone(this.context));
    
    // Trim history if too large
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
    
    // Apply updates
    Object.assign(this.context, updates);
  }
  
  /**
   * Restore previous context from history
   */
  pop(): void {
    if (this.history.length > 0) {
      this.context = this.history.pop()!;
    }
  }
  
  /**
   * Create a snapshot of current context
   */
  snapshot(): LexerContext {
    return this.deepClone(this.context);
  }
  
  /**
   * Restore from a snapshot
   */
  restore(snapshot: LexerContext): void {
    this.context = this.deepClone(snapshot);
  }
  
  /**
   * Update position context based on token
   */
  updatePosition(tokenValue: string, tokenType: string): void {
    // Reset all position flags
    const newPosition = this.createInitialPosition();
    newPosition.lineStart = false;
    
    // Set specific flags based on token
    switch (tokenValue) {
      case 'return': newPosition.afterReturn = true; break;
      case 'new': newPosition.afterNew = true; break;
      case 'yield': newPosition.afterYield = true; break;
      case 'await': newPosition.afterAwait = true; break;
      case 'type': newPosition.afterType = true; break;
      case 'const': newPosition.afterConst = true; break;
      case 'let': newPosition.afterLet = true; break;
      case 'var': newPosition.afterVar = true; break;
      case 'class': newPosition.afterClass = true; break;
      case 'interface': newPosition.afterInterface = true; break;
      case 'function': newPosition.afterFunction = true; break;
      case '=>': newPosition.afterArrow = true; break;
      case '.': newPosition.afterDot = true; break;
      case ',': newPosition.afterComma = true; break;
      case ':': newPosition.afterColon = true; break;
      case '=': newPosition.afterEquals = true; break;
      case '(': newPosition.afterOpenParen = true; break;
      case '{': newPosition.afterOpenBrace = true; break;
      case '[': newPosition.afterOpenBracket = true; break;
      case ';': newPosition.afterSemicolon = true; break;
    }
    
    // Check if operator
    const operators = ['+', '-', '*', '/', '%', '**', '&', '|', '^', '~', 
                      '<<', '>>', '>>>', '&&', '||', '??', '!', 
                      '<', '>', '<=', '>=', '==', '!=', '===', '!=='];
    if (operators.includes(tokenValue)) {
      newPosition.afterOperator = true;
    }
    
    this.context.position = newPosition;
  }
  
  /**
   * Enter JSX context
   */
  enterJSX(tagName?: string): void {
    this.push({
      jsxDepth: this.context.jsxDepth + 1,
      inJSXOpeningTag: true,
      jsxTagStack: tagName ? [...this.context.jsxTagStack, tagName] : this.context.jsxTagStack
    });
  }
  
  /**
   * Exit JSX context
   */
  exitJSX(): void {
    if (this.context.jsxDepth > 0) {
      const tagStack = [...this.context.jsxTagStack];
      tagStack.pop();
      
      this.push({
        jsxDepth: this.context.jsxDepth - 1,
        jsxTagStack: tagStack,
        inJSXText: false,
        inJSXAttribute: false,
        inJSXOpeningTag: false,
        inJSXClosingTag: false
      });
    }
  }
  
  /**
   * Enter JSX text content
   */
  enterJSXText(): void {
    this.push({ inJSXText: true });
  }
  
  /**
   * Exit JSX text content
   */
  exitJSXText(): void {
    this.push({ inJSXText: false });
  }
  
  /**
   * Enter type annotation context
   */
  enterTypeAnnotation(): void {
    this.push({
      inTypeAnnotation: true,
      typeDepth: this.context.typeDepth + 1
    });
  }
  
  /**
   * Exit type annotation context
   */
  exitTypeAnnotation(): void {
    if (this.context.typeDepth > 0) {
      this.push({
        inTypeAnnotation: this.context.typeDepth > 1,
        typeDepth: this.context.typeDepth - 1
      });
    }
  }
  
  /**
   * Enter generic arguments context
   */
  enterGeneric(): void {
    this.push({
      genericDepth: this.context.genericDepth + 1,
      inGenericArguments: true
    });
  }
  
  /**
   * Exit generic arguments context
   */
  exitGeneric(): void {
    if (this.context.genericDepth > 0) {
      this.push({
        genericDepth: this.context.genericDepth - 1,
        inGenericArguments: this.context.genericDepth > 1
      });
    }
  }
  
  /**
   * Check if we're in JSX context
   */
  isInJSX(): boolean {
    return this.context.jsxDepth > 0;
  }
  
  /**
   * Check if we're in JSX text
   */
  isInJSXText(): boolean {
    return this.context.inJSXText;
  }
  
  /**
   * Check if we're in type context
   */
  isInType(): boolean {
    return this.context.inTypeAnnotation || 
           this.context.inTypeDeclaration || 
           this.context.genericDepth > 0;
  }
  
  /**
   * Check if whitespace should be preserved
   */
  shouldPreserveWhitespace(): boolean {
    return this.context.inJSXText || 
           this.context.inTemplateString ||
           this.context.inString;
  }
  
  /**
   * Check if a forward slash can be a regex
   */
  canBeRegex(): boolean {
    const pos = this.context.position;
    
    // Can't be regex in JSX or type contexts
    if (this.isInJSX() || this.isInType()) {
      return false;
    }
    
    // Can be regex after these tokens
    return pos.afterReturn || 
           pos.afterOperator || 
           pos.afterEquals || 
           pos.afterComma || 
           pos.afterOpenParen ||
           pos.afterOpenBrace ||
           pos.afterOpenBracket ||
           pos.afterSemicolon ||
           pos.lineStart;
  }
  
  /**
   * Check if < can start JSX
   */
  canBeJSX(): boolean {
    // Can't be JSX in type contexts
    if (this.isInType()) {
      return false;
    }
    
    const pos = this.context.position;
    
    // Can be JSX after these tokens
    return pos.afterReturn || 
           pos.afterEquals || 
           pos.afterArrow ||
           pos.afterOpenParen ||
           pos.afterOpenBrace ||
           pos.afterComma;
  }
  
  /**
   * Check if < can start a generic
   */
  canBeGeneric(): boolean {
    const pos = this.context.position;
    
    // Can be generic after identifiers or in type context
    return this.isInType() || 
           pos.afterDot ||
           (!pos.afterOperator && !pos.afterEquals);
  }
  
  /**
   * Get current context (read-only)
   */
  getContext(): Readonly<LexerContext> {
    return this.context;
  }
  
  /**
   * Deep clone helper
   */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}

// Export singleton instance
export const lexerContext = new ContextTracker();