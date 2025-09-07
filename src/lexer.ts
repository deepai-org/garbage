import { ContextTracker } from './lexer-context';

export enum TokenType {
  // Literals
  NumericLiteral = "NumericLiteral",
  StringLiteral = "StringLiteral",
  TemplateLiteral = "TemplateLiteral",
  RegexLiteral = "RegexLiteral",
  
  // Identifiers
  Identifier = "Identifier",
  SigilIdentifier = "SigilIdentifier",
  Keyword = "Keyword",
  
  // Operators and Punctuators
  Operator = "Operator",
  
  // JSX Tokens
  JSXTagStart = "JSXTagStart",      // < when starting JSX
  JSXTagEnd = "JSXTagEnd",          // > when ending JSX tag
  JSXSelfClose = "JSXSelfClose",    // />
  JSXText = "JSXText",              // Text content in JSX
  
  // Structure
  Comment = "Comment",
  Whitespace = "Whitespace",
  VirtualSemi = "VirtualSemi",
  EOF = "EOF"
}

export enum LexerMode {
  Normal = "Normal",
  MemberAccess = "MemberAccess",  // After '.', keywords become identifiers
  BashCondition = "BashCondition", // Inside [ ], use bash tokenization
  Decorator = "Decorator",         // After '@', special decorator syntax
  StringTemplate = "StringTemplate", // For f-strings, r-strings, heredocs
  JSXTag = "JSXTag",              // Inside JSX < > for parsing attributes
  JSXContent = "JSXContent",       // Between JSX opening and closing tags
  JSXExpression = "JSXExpression"  // Inside {} within JSX
}

export interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
  line: number;
  column: number;
  virtualSemi?: boolean;
  wsBefore?: boolean;
  wsAfter?: boolean;
  indentCol?: number;
  newline?: boolean;
}

export class Lexer {
  private source: string;
  private position = 0;
  private line = 1;
  private column = 1;
  private tokens: Token[] = [];
  private lastNonWSToken: Token | null = null;
  private currentIndent = 0;
  private lineStart = true;
  private modeStack: LexerMode[] = [LexerMode.Normal];
  private bashBracketDepth = 0;
  private jsxDepth = 0;  // Track JSX nesting depth for virtual semicolon suppression
  private context: ContextTracker;  // New context tracker
  
  // HTML tag names for JSX detection per spec
  private readonly htmlTags = new Set([
    'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li',
    'a', 'img', 'input', 'button', 'form', 'section', 'article', 'header', 'footer',
    'nav', 'main', 'aside', 'table', 'tr', 'td', 'th', 'tbody', 'thead', 'tfoot',
    'select', 'option', 'textarea', 'label', 'fieldset', 'legend', 'canvas', 'video',
    'audio', 'source', 'track', 'embed', 'object', 'iframe', 'script', 'style',
    'meta', 'link', 'title', 'head', 'body', 'html', 'strong', 'em', 'b', 'i',
    'small', 'mark', 'del', 'ins', 'sub', 'sup', 'code', 'pre', 'kbd', 'samp',
    'var', 'time', 'data', 'address', 'cite', 'q', 'abbr', 'dfn', 'ruby', 'rt',
    'rp', 'bdi', 'bdo', 'wbr', 'details', 'summary', 'dialog', 'menu'
  ]);
  
  constructor(source: string) {
    this.source = source;
    this.context = new ContextTracker();  // Initialize context tracker
  }
  
  tokenize(): Token[] {
    // Skip shebang if present
    if (this.source.startsWith('#!')) {
      this.skipShebang();
    }
    
    while (this.position < this.source.length) {
      this.scanToken();
    }
    
    // Add EOF token
    this.addToken(TokenType.EOF, '', this.position, this.position);
    
    // Apply MASI (Max-Accept Semicolon Insertion)
    this.applyMASI();
    
    return this.tokens;
  }
  
  private scanToken(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Track whitespace before token
    const wsBefore = this.position > 0 && /\s/.test(this.source[this.position - 1]);
    
    const char = this.advance();
    
    // Comments
    if (char === '/' && this.peek() === '/') {
      this.skipLineComment();
      return;
    }
    
    if (char === '/' && this.peek() === '*') {
      this.skipBlockComment();
      return;
    }
    
    // Hash comments (Python/Ruby style)
    if (char === '#') {
      // Check if it's a shebang (at position 1) or regular comment
      this.skipLineComment();
      return;
    }
    
    // Double-dash comments
    if (char === '-' && this.peek() === '-' && 
        (this.position === 1 || /\s/.test(this.source[this.position - 2]))) {
      this.advance(); // consume second -
      this.skipLineComment();
      return;
    }
    
    if (char === '<' && this.peek() === '!' && this.peekNext() === '-' && this.peekAt(2) === '-') {
      this.skipHTMLComment();
      return;
    }
    
    // Whitespace
    if (/\s/.test(char)) {
      // In JSX text, preserve whitespace as text tokens
      if (this.context.shouldPreserveWhitespace()) {
        let whitespaceValue = char;
        const start = this.position - 1;
        const startLine = this.line;
        const startColumn = this.column - 1;
        
        // Collect consecutive whitespace
        while (/\s/.test(this.peek()) && !this.isAtEnd()) {
          const wsChar = this.advance();
          whitespaceValue += wsChar;
          if (wsChar === '\n') {
            this.line++;
            this.column = 0;
            this.lineStart = true;
          }
        }
        
        this.addTokenEx(TokenType.StringLiteral, whitespaceValue, start, this.position, startLine, startColumn);
        return;
      }
      
      // Normal whitespace handling - track line starts and indentation
      if (char === '\n') {
        this.lineStart = true;
        this.line++;
        this.column = 0;
        
        // Count spaces at start of next line for indentation
        let indent = 0;
        let pos = this.position;
        while (pos < this.source.length && this.source[pos] === ' ') {
          indent++;
          pos++;
        }
        this.currentIndent = indent;
      }
      
      // Skip remaining whitespace
      while (/\s/.test(this.peek()) && !this.isAtEnd()) {
        if (this.peek() === '\n') {
          this.line++;
          this.column = 0;
          this.lineStart = true;
          
          // Update indent for next line
          this.advance();
          let indent = 0;
          let pos = this.position;
          while (pos < this.source.length && this.source[pos] === ' ') {
            indent++;
            pos++;
          }
          this.currentIndent = indent;
        } else {
          this.advance();
        }
      }
      return;
    }
    
    // String literals with prefixes
    if (/[rbfuRBFU]/.test(char)) {
      const next = this.peek();
      if (next === '"' || next === "'") {
        this.position--; // Back up to include prefix
        this.scanPrefixedString();
        return;
      }
    }
    
    // C# verbatim strings (@"") or C# interpolated strings ($"")
    if ((char === '@' || char === '$') && this.peek() === '"') {
      this.position--; // Back up 
      this.scanPrefixedString();
      return;
    }
    
    // String literals
    if (char === '"' || char === "'") {
      this.position--; // Back up
      this.scanPrefixedString();
      return;
    }
    
    // Template literals
    if (char === '`') {
      this.scanTemplateLiteral();
      return;
    }
    
    // Numbers
    if (/\d/.test(char)) {
      this.scanNumber();
      return;
    }
    
    // Identifiers and keywords
    if (/[a-zA-Z_]/.test(char)) {
      this.scanIdentifier();
      return;
    }
    
    // Sigil identifiers
    if (char === '$' && /[a-zA-Z_]/.test(this.peek())) {
      this.scanSigilIdentifier();
      return;
    }
    
    // Heredoc check (before operators)
    if (char === '<' && this.peek() === '<') {
      const nextChar = this.peekNext();
      // Only treat as heredoc if followed by uppercase letter (common convention)
      if (nextChar && /[A-Z]/.test(nextChar)) {
        this.advance(); // consume second '<'
        this.scanHeredoc();
        return;
      }
    }
    
    // Regex or division
    if (char === '/') {
      if (this.shouldBeRegex()) {
        this.scanRegex();
      } else {
        this.scanOperator();
      }
      return;
    }
    
    // Operators and punctuators
    this.scanOperator();
  }
  
  private scanHeredoc(): void {
    const start = this.position - 2; // Account for '<<' already consumed
    const startLine = this.line;
    const startColumn = this.column - 2;
    
    // Read the delimiter (max 20 chars for safety)
    let delimiter = '';
    let delimiterCount = 0;
    while (!this.isAtEnd() && /[A-Z_0-9]/i.test(this.peek()) && delimiterCount < 20) {
      delimiter += this.advance();
      delimiterCount++;
    }
    
    if (delimiter === '') {
      // No delimiter found, treat as operator
      this.position = start + 2; // Position after <<
      this.scanOperator();
      return;
    }
    
    // Skip to next line
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
    if (this.peek() === '\n') {
      this.advance();
      this.line++;
      this.column = 0;
    }
    
    // Collect heredoc content until we find delimiter on its own line
    let content = '';
    let currentLine = '';
    let linesRead = 0;
    const maxLines = 1000; // Safety limit
    
    while (!this.isAtEnd() && linesRead < maxLines) {
      const char = this.peek();
      
      if (char === '\n') {
        // Check if current line is the delimiter
        if (currentLine.trim() === delimiter) {
          // Found end delimiter
          break;
        }
        // Add line to content
        content += currentLine + '\n';
        currentLine = '';
        linesRead++;
        this.advance();
        this.line++;
        this.column = 0;
      } else {
        currentLine += char;
        this.advance();
      }
    }
    
    // Check final line
    if (currentLine.trim() === delimiter) {
      // Consume the delimiter line
      while (!this.isAtEnd() && this.peek() !== '\n') {
        this.advance();
      }
    }
    
    // Create the heredoc token
    const heredocValue = `<<${delimiter}\n${content}${delimiter}`;
    this.addTokenEx(TokenType.StringLiteral, heredocValue, start, this.position, startLine, startColumn);
  }
  
  private scanPrefixedString(): void {
    const start = this.position;
    const startLine = this.line;
    const startColumn = this.column;
    
    // Collect prefixes - support f, r, b, u, br, rb combinations, plus @ and $
    let prefixes = '';
    while (/[rbfuRBFU@$]/.test(this.peek())) {
      prefixes += this.advance();
    }
    
    const quote = this.advance();
    if (quote !== '"' && quote !== "'") {
      // Not a string, backtrack
      this.position = start;
      this.scanIdentifier();
      return;
    }
    
    // Check for triple quotes
    let isTriple = false;
    if (this.peek() === quote && this.peekNext() === quote) {
      isTriple = true;
      this.advance();
      this.advance();
    }
    
    let value = prefixes + quote;
    if (isTriple) value += quote + quote;
    
    while (!this.isAtEnd()) {
      if (isTriple) {
        if (this.peek() === quote && this.peekNext() === quote && this.peekAt(2) === quote) {
          value += this.advance() + this.advance() + this.advance();
          break;
        }
      } else {
        if (this.peek() === quote) {
          // Count consecutive backslashes before the quote
          let backslashCount = 0;
          let checkPos = this.position - 1;
          while (checkPos >= 0 && this.source[checkPos] === '\\') {
            backslashCount++;
            checkPos--;
          }
          // If even number of backslashes (including 0), the quote is not escaped
          if (backslashCount % 2 === 0) {
            value += this.advance();
            break;
          }
        }
      }
      
      if (this.peek() === '\n') {
        if (!isTriple) {
          // Error: unterminated string
          break;
        }
        this.line++;
        this.column = 1;
      }
      
      value += this.advance();
    }
    
    this.addTokenEx(TokenType.StringLiteral, value, start, this.position, startLine, startColumn);
  }
  
  private scanString(quote: string): void {
    const start = this.position - 1;
    const startLine = this.line;
    const startColumn = this.column - 1;
    
    // Check for triple quotes
    let isTriple = false;
    if (this.peek() === quote && this.peekNext() === quote) {
      isTriple = true;
      this.advance();
      this.advance();
    }
    
    let value = quote;
    if (isTriple) value += quote + quote;
    
    while (!this.isAtEnd()) {
      if (isTriple) {
        if (this.peek() === quote && this.peekNext() === quote && this.peekAt(2) === quote) {
          value += this.advance() + this.advance() + this.advance();
          break;
        }
      } else {
        if (this.peek() === quote) {
          // Count consecutive backslashes before the quote
          let backslashCount = 0;
          let checkPos = this.position - 1;
          while (checkPos >= 0 && this.source[checkPos] === '\\') {
            backslashCount++;
            checkPos--;
          }
          // If even number of backslashes (including 0), the quote is not escaped
          if (backslashCount % 2 === 0) {
            value += this.advance();
            break;
          }
        }
      }
      
      if (this.peek() === '\n') {
        if (!isTriple) {
          // Error: unterminated string
          break;
        }
        this.line++;
        this.column = 1;
      }
      
      value += this.advance();
    }
    
    this.addTokenEx(TokenType.StringLiteral, value, start, this.position, startLine, startColumn);
  }
  
  private scanTemplateLiteral(): void {
    const start = this.position - 1;
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = '`';
    
    while (!this.isAtEnd() && this.peek() !== '`') {
      if (this.peek() === '\\') {
        value += this.advance();
        if (!this.isAtEnd()) {
          value += this.advance();
        }
      } else if (this.peek() === '$' && this.peekNext() === '{') {
        // Handle template expression
        value += this.advance() + this.advance();
        let depth = 1;
        while (!this.isAtEnd() && depth > 0) {
          const char = this.advance();
          value += char;
          if (char === '{') depth++;
          else if (char === '}') depth--;
        }
      } else {
        if (this.peek() === '\n') {
          this.line++;
          this.column = 0;
        }
        value += this.advance();
      }
    }
    
    if (this.peek() === '`') {
      value += this.advance();
    }
    
    this.addTokenEx(TokenType.TemplateLiteral, value, start, this.position, startLine, startColumn);
  }
  
  private scanNumber(): void {
    const start = this.position - 1;
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = this.source[start];
    
    // Check for hex, octal, binary
    if (value === '0') {
      const next = this.peek();
      if (next === 'x' || next === 'X') {
        value += this.advance();
        while (/[0-9a-fA-F_]/.test(this.peek())) {
          value += this.advance();
        }
      } else if (next === 'o' || next === 'O') {
        value += this.advance();
        while (/[0-7_]/.test(this.peek())) {
          value += this.advance();
        }
      } else if (next === 'b' || next === 'B') {
        value += this.advance();
        while (/[01_]/.test(this.peek())) {
          value += this.advance();
        }
      }
    }
    
    // Decimal number
    while (/[\d_]/.test(this.peek())) {
      value += this.advance();
    }
    
    // Float
    if (this.peek() === '.' && /\d/.test(this.peekNext())) {
      value += this.advance();
      while (/[\d_]/.test(this.peek())) {
        value += this.advance();
      }
    }
    
    // Exponent
    if (/[eE]/.test(this.peek())) {
      value += this.advance();
      if (/[+-]/.test(this.peek())) {
        value += this.advance();
      }
      while (/\d/.test(this.peek())) {
        value += this.advance();
      }
    }
    
    // Suffix
    if (/[nulfiULFI]/.test(this.peek())) {
      while (/[a-zA-Z0-9]/.test(this.peek())) {
        value += this.advance();
      }
    }
    
    this.addTokenEx(TokenType.NumericLiteral, value, start, this.position, startLine, startColumn);
  }
  
  private scanIdentifier(): void {
    const start = this.position - 1;
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = this.source[start];
    
    while (/[a-zA-Z0-9_]/.test(this.peek())) {
      value += this.advance();
    }
    
    // In MemberAccess mode, all keywords become identifiers
    let type: TokenType;
    if (this.inMode(LexerMode.MemberAccess)) {
      type = TokenType.Identifier;
      // Pop the mode after consuming the identifier
      this.popMode();
    } else if (this.inMode(LexerMode.Decorator)) {
      type = TokenType.Identifier;
      // Pop decorator mode after identifier
      this.popMode();
    } else {
      type = this.isKeyword(value) ? TokenType.Keyword : TokenType.Identifier;
    }
    
    this.addTokenEx(type, value, start, this.position, startLine, startColumn);
  }
  
  private scanSigilIdentifier(): void {
    const start = this.position - 1;
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = '$';
    
    while (/[a-zA-Z0-9_]/.test(this.peek())) {
      value += this.advance();
    }
    
    this.addTokenEx(TokenType.SigilIdentifier, value, start, this.position, startLine, startColumn);
  }
  
  private scanRegex(): void {
    const start = this.position - 1;
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = '/';
    
    while (!this.isAtEnd() && this.peek() !== '/') {
      if (this.peek() === '\\') {
        value += this.advance();
        if (!this.isAtEnd()) {
          value += this.advance();
        }
      } else if (this.peek() === '\n') {
        // Error: unterminated regex
        break;
      } else {
        value += this.advance();
      }
    }
    
    if (this.peek() === '/') {
      value += this.advance();
      
      // Flags
      while (/[gimsuy]/.test(this.peek())) {
        value += this.advance();
      }
    }
    
    this.addTokenEx(TokenType.RegexLiteral, value, start, this.position, startLine, startColumn);
  }
  
  private scanOperator(): void {
    const start = this.position - 1;
    const startLine = this.line;
    const startColumn = this.column - 1;
    let value = this.source[start];
    
    // Handle JSX context detection for '<' and '>' per spec 10.6
    if (value === '<') {
      const nextChar = this.peek();
      
      if (nextChar === '/') {
        // JSX closing tag </tagname> - per spec
        if (this.context.isInJSXText()) {
          this.context.exitJSXText();
        }
        this.context.push({ inJSXClosingTag: true });
        this.context.enterJSX();
        // Emit JSXTagStart for closing tags too
        this.addTokenEx(TokenType.JSXTagStart, '<', start, this.position, startLine, startColumn);
        return;
      } else if (nextChar === '>') {
        // JSX Fragment <> - per spec
        if (this.context.canBeJSX()) {
          this.addTokenEx(TokenType.JSXTagStart, '<', start, this.position, startLine, startColumn);
          this.context.enterJSX();
          this.context.enterJSXText();
          return;
        }
      } else if (nextChar && /[A-Z]/.test(nextChar)) {
        // Capital letter → JSX Component - per spec
        if (this.context.canBeJSX()) {
          // Look ahead to check if this is really JSX or a generic type
          const identifier = this.peekIdentifier();
          const posAfterIdentifier = this.position + identifier.length;
          const charAfterIdentifier = this.source[posAfterIdentifier];
          
          // If followed by '<', need to look past generic params to determine if JSX
          if (charAfterIdentifier === '<') {
            const posAfterGeneric = this.peekPastGenericParams(posAfterIdentifier);
            const afterGeneric = this.source[posAfterGeneric];
            
            // Check for JSX patterns after generic params
            // JSX: <Component<T> />, <Component<T> attr=, <Component<T>>
            // Not JSX: Result<Vec<T>, Error> (followed by comma, semicolon, etc)
            if (afterGeneric === ' ' || afterGeneric === '/' || afterGeneric === '>' ||
                (afterGeneric && /[a-zA-Z_]/.test(afterGeneric))) {
              // This is JSX! Create JSXTagStart token instead of operator
              this.addTokenEx(TokenType.JSXTagStart, '<', start, this.position, startLine, startColumn);
              this.context.enterJSX();
              return; // Don't continue with operator processing
            }
            // Else it's a generic type, continue with operator processing
          } else {
            // Not followed by '<', so it's regular JSX
            this.addTokenEx(TokenType.JSXTagStart, '<', start, this.position, startLine, startColumn);
            this.context.enterJSX();
            return; // Don't continue with operator processing
          }
        }
      } else if (nextChar && /[a-z]/.test(nextChar)) {
        // Lowercase identifier → potential HTML element - per spec
        if (this.context.canBeJSX()) {
          // Look ahead to see if this is a valid HTML tag name
          const tagName = this.peekIdentifier();
          if (this.isHTMLTag(tagName)) {
            // Additional check: if followed by '<', need to look past generic params
            const posAfterTag = this.position + tagName.length;
            const charAfterTag = this.source[posAfterTag];
            
            if (charAfterTag === '<') {
              // HTML elements shouldn't have generic params, but check anyway
              const posAfterGeneric = this.peekPastGenericParams(posAfterTag);
              const afterGeneric = this.source[posAfterGeneric];
              
              if (afterGeneric === ' ' || afterGeneric === '/' || afterGeneric === '>' ||
                  (afterGeneric && /[a-zA-Z_]/.test(afterGeneric))) {
                this.addTokenEx(TokenType.JSXTagStart, '<', start, this.position, startLine, startColumn);
                this.context.enterJSX();
                return;
              }
            } else {
              this.addTokenEx(TokenType.JSXTagStart, '<', start, this.position, startLine, startColumn);
              this.context.enterJSX();
              return;
            }
          }
        }
      }
    } else if (value === '>' && this.context.isInJSX()) {
      // Handle JSX tag completion
      if (this.context.getContext().inJSXClosingTag) {
        // This is the end of closing tag like </div> - exit JSX entirely
        this.context.exitJSX();
      } else {
        const prevChar = this.position > 1 ? this.source[this.position - 2] : '';
        if (prevChar === '/') {
          // Self-closing element like <Component />
          this.context.exitJSX();
        } else {
          // Opening tag completed, enter JSX text
          this.context.enterJSXText();
        }
      }
    } else if (value === '{' && this.context.isInJSX()) {
      // Entering JSX expression container
      this.context.enterJSXExpression();
    } else if (value === '}' && this.context.getContext().inJSXExpression) {
      // Exiting JSX expression container
      this.context.exitJSXExpression();
    }
    
    // Handle mode transitions
    if (value === '.' && this.peek() !== '.' && this.peek() !== '*') {
      // After single dot (not .. or .*), push MemberAccess mode
      this.pushMode(LexerMode.MemberAccess);
    } else if (value === '?' && this.peek() === '.') {
      // After ?. optional chaining, also push MemberAccess mode
      // Note: We'll handle the full ?. operator below, but set the mode now
      this.pushMode(LexerMode.MemberAccess);
    } else if (value === '[' && this.inMode(LexerMode.Normal)) {
      // Check if this might be a bash conditional
      // Look for patterns like [ $var, [ "test", [ -f, [ !
      const nextNonWs = this.peekNextNonWhitespace();
      if (nextNonWs === '$' || nextNonWs === '"' || nextNonWs === '`' || 
          nextNonWs === '-' || nextNonWs === '!') {
        this.pushMode(LexerMode.BashCondition);
        this.bashBracketDepth = 1;
      }
    } else if (value === ']' && this.inMode(LexerMode.BashCondition)) {
      this.bashBracketDepth--;
      if (this.bashBracketDepth === 0) {
        this.popMode();
      }
    } else if (value === '@' && this.inMode(LexerMode.Normal)) {
      // Check if this is a decorator (@identifier) or verbatim string (@")
      const next = this.peek();
      if (/[a-zA-Z_]/.test(next)) {
        // After @, if followed by identifier, push Decorator mode
        this.pushMode(LexerMode.Decorator);
      }
      // Otherwise it might be a C# verbatim string, handled elsewhere
    }
    
    // Try to match longest operator
    const operators = [
      '>>>=', '>>>=' , '>>>', '>>=', '<<=', '===', '!==', '??=', '**=',
      '<=>', '...', '..', '=>', '==', '!=', '<=', '>=', '<<', '>>', '&&', '||', 
      '??', ';;', '|>', '**', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', 
      '~=', '=~', '++', '--', ':=:', ':=', '->', '<-', '::', '?.', '!.', '.*'
    ];
    
    for (const op of operators) {
      if (this.matchOperator(start, op)) {
        value = op;
        this.position = start + op.length;
        this.column += op.length - 1;
        break;
      }
    }
    
    this.addTokenEx(TokenType.Operator, value, start, this.position, startLine, startColumn);
  }
  
  private matchOperator(start: number, op: string): boolean {
    for (let i = 0; i < op.length; i++) {
      if (start + i >= this.source.length || this.source[start + i] !== op[i]) {
        return false;
      }
    }
    return true;
  }
  
  private shouldBeRegex(): boolean {
    if (!this.lastNonWSToken) return true;
    
    // Special case: After < followed by identifier and >, we're likely in JSX content
    // where </div> should be tokenized as <, /, div, > not as < followed by regex /div>
    if (this.lastNonWSToken.value === '<') {
      // Don't treat / as regex start after < (could be JSX closing tag)
      return false;
    }
    
    const canEndExpression = [
      TokenType.Identifier, TokenType.SigilIdentifier,
      TokenType.NumericLiteral, TokenType.StringLiteral,
      TokenType.TemplateLiteral, TokenType.RegexLiteral
    ];
    
    if (canEndExpression.includes(this.lastNonWSToken.type)) {
      return false;
    }
    
    const endTokens = [']', ')', '}', '++', '--', '>'];
    if (endTokens.includes(this.lastNonWSToken.value)) {
      return false;
    }
    
    return true;
  }
  
  private isKeyword(value: string): boolean {
    const keywords = [
      'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
      'default', 'defer', 'def', 'do', 'done', 'elif', 'else', 'end',
      'enum', 'export', 'extends', 'false', 'fi', 'final', 'for', 'fun',
      'function', 'go', 'if', 'import', 'in', 'interface', 'let', 'loop',
      'match', 'new', 'null', 'nil', 'of', 'package', 'return', 'struct', 'switch',
      'then', 'this', 'throw', 'trait', 'true', 'try', 'type', 'until',
      'unsafe', 'using', 'var', 'when', 'while', 'with', 'yield',
      'typeof', 'void', 'delete', 'instanceof', 'async', 'auto',
      'immutable', 'require', 'fn', 'foreach', 'echo', 'print',
      'except', 'rescue', 'finally', 'undefined', 'elseif', 'esac',
      'begin', 'as', 'from', 'is', 'not', 'or', 'and', 'lambda',
      'global', 'nonlocal', 'pass', 'raise', 'assert', 'del'
    ];
    
    return keywords.includes(value);
  }
  
  private applyMASI(): void {
    const result: Token[] = [];
    let jsxDepth = 0;
    let braceDepth = 0;
    
    for (let i = 0; i < this.tokens.length; i++) {
      const token = this.tokens[i];
      result.push(token);
      
      // Track JSX context
      if (token.value === '<' && i + 1 < this.tokens.length) {
        const next = this.tokens[i + 1];
        // Check if this looks like JSX: < followed by identifier, /, or > (fragment)
        if (next.type === TokenType.Identifier || 
            next.value === '>' ||  // Fragment <>
            (next.value === '/' && i + 2 < this.tokens.length && 
             (this.tokens[i + 2].type === TokenType.Identifier || this.tokens[i + 2].value === '>'))) {
          jsxDepth++;
        }
      } else if (token.value === '>' && jsxDepth > 0) {
        // Check if this is a self-closing tag />
        if (i > 0 && this.tokens[i - 1].value === '/') {
          jsxDepth--;
        } else if (i > 2 && this.tokens[i - 2].value === '<' && this.tokens[i - 1].value === '/') {
          // Closing tag </...>
          jsxDepth--;
        } else {
          // Opening tag end
          // Don't decrement for opening tags
        }
      } else if (token.value === '{' && jsxDepth > 0) {
        braceDepth++;
      } else if (token.value === '}' && jsxDepth > 0 && braceDepth > 0) {
        braceDepth--;
      }
      
      // Check if we should insert virtual semicolon after this token
      if (i < this.tokens.length - 1) {
        const nextToken = this.tokens[i + 1];
        
        // Check if there's a line break between tokens
        if (nextToken.line > token.line) {
          // Suppress virtual semicolons in JSX context
          // This includes when we're inside JSX elements or when closing a JSX expression
          const inJSXContext = jsxDepth > 0;
          
          // Also suppress after } if we're still within JSX (even at depth 0 of expressions)
          const isJSXExpressionClose = token.value === '}' && braceDepth >= 0 && jsxDepth > 0;
          
          // Check MASI rules
          if (!this.shouldSuppressVirtualSemi(token, nextToken, inJSXContext || isJSXExpressionClose)) {
            const virtualSemi: Token = {
              type: TokenType.VirtualSemi,
              value: ';',
              start: token.end,
              end: token.end,
              line: token.line,
              column: token.column + token.value.length,
              virtualSemi: true
            };
            result.push(virtualSemi);
          }
        }
      }
    }
    
    this.tokens = result;
  }
  
  private shouldSuppressVirtualSemi(current: Token, next: Token, inJSX: boolean = false): boolean {
    // Special case: Some keywords should always have a virtual semicolon after them
    // when they appear alone on a line (no expression following on same line)
    // This takes precedence even over JSX context since these keywords can't appear in JSX expressions
    const alwaysTerminateKeywords = ['return', 'break', 'continue', 'throw', 'yield'];
    if (current.type === TokenType.Keyword && alwaysTerminateKeywords.includes(current.value)) {
      // These keywords alone on a line always get a virtual semicolon
      return false;
    }
    
    // Rule 0: Never insert virtual semicolons inside JSX content
    if (inJSX) {
      return true;
    }
    
    // Rule 1: line's last non-space character is one of .,:;+-*/%&|^<>=!~?([{`
    const suppressChars = ['.', ',', ':', ';', '+', '-', '*', '/', '%', '&', '|', '^', '<', '>', '=', '!', '~', '?', '(', '[', '{', '`'];
    if (suppressChars.includes(current.value)) {
      return true;
    }
    
    // Rule 2: Next line starts with operator that continues expression
    // Check for operators like ?., |>, .., ::, etc.
    const continuationOps = ['?.', '|>', '..', '::', '||', '&&', '??', '->'];
    if (continuationOps.includes(next.value)) {
      return true;
    }
    
    // Also check single character operators that commonly continue lines
    const singleCharContinuation = ['.', '?', '|', '&', '+', '-', '*', '/', '%', '^'];
    if (singleCharContinuation.includes(next.value)) {
      return true;
    }
    
    // Rule 3: current ()[]{}  depth > 0 (simplified - would need proper tracking)
    // This is a simplification - real implementation would track depth
    
    // Rule 4: next line is strictly more indented
    // Compare next line's indentation with current line's indentation
    if (next.indentCol !== undefined && current.indentCol !== undefined) {
      if (next.indentCol > current.indentCol) {
        return true;
      }
    }
    
    return false;
  }
  
  // Helper methods
  private skipShebang(): void {
    while (this.peek() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }
    if (this.peek() === '\n') {
      this.advance();
      this.line++;
      this.column = 1;
    }
  }
  
  private skipLineComment(): void {
    while (this.peek() !== '\n' && !this.isAtEnd()) {
      this.advance();
    }
  }
  
  private skipBlockComment(): void {
    this.advance(); // consume second /
    while (!this.isAtEnd()) {
      if (this.peek() === '*' && this.peekNext() === '/') {
        this.advance(); // *
        this.advance(); // /
        break;
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
  }
  
  private skipHTMLComment(): void {
    this.advance(); // !
    this.advance(); // -
    this.advance(); // -
    
    while (!this.isAtEnd()) {
      if (this.peek() === '-' && this.peekNext() === '-' && this.peekAt(2) === '>') {
        this.advance(); // -
        this.advance(); // -
        this.advance(); // >
        break;
      }
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
      }
      this.advance();
    }
  }
  
  private skipWhitespace(): void {
    while (/\s/.test(this.peek()) && !this.isAtEnd()) {
      if (this.peek() === '\n') {
        this.line++;
        this.column = 0;
        this.lineStart = true;
      }
      this.advance();
    }
  }
  
  private advance(): string {
    const char = this.source[this.position];
    this.position++;
    this.column++;
    return char;
  }
  
  private peek(): string {
    if (this.isAtEnd()) return '\0';
    return this.source[this.position];
  }
  
  private peekNext(): string {
    if (this.position + 1 >= this.source.length) return '\0';
    return this.source[this.position + 1];
  }
  
  private peekAt(offset: number): string {
    if (this.position + offset >= this.source.length) return '\0';
    return this.source[this.position + offset];
  }
  
  private peekIdentifier(): string {
    let pos = this.position;
    if (!this.source[pos] || !/[a-zA-Z_]/.test(this.source[pos])) {
      return '';
    }
    
    let result = '';
    while (pos < this.source.length && /[a-zA-Z0-9_]/.test(this.source[pos])) {
      result += this.source[pos];
      pos++;
    }
    return result;
  }
  
  private peekPastGenericParams(startPos: number): number {
    // Given a position after an identifier followed by '<', 
    // find the position after the matching '>' of generic params
    let pos = startPos;
    if (this.source[pos] !== '<') return pos;
    
    let depth = 1;
    pos++; // Skip initial '<'
    
    while (pos < this.source.length && depth > 0) {
      const char = this.source[pos];
      if (char === '<') {
        depth++;
      } else if (char === '>') {
        depth--;
      }
      pos++;
    }
    
    return pos; // Position after the closing '>'
  }
  
  private isHTMLTag(tagName: string): boolean {
    return this.htmlTags.has(tagName.toLowerCase());
  }
  
  private isAtEnd(): boolean {
    return this.position >= this.source.length;
  }
  
  private currentMode(): LexerMode {
    return this.modeStack[this.modeStack.length - 1];
  }
  
  private pushMode(mode: LexerMode): void {
    this.modeStack.push(mode);
  }
  
  private popMode(): LexerMode | undefined {
    if (this.modeStack.length > 1) {
      return this.modeStack.pop();
    }
    return undefined;
  }
  
  private inMode(mode: LexerMode): boolean {
    return this.currentMode() === mode;
  }
  
  private peekNextNonWhitespace(): string {
    let offset = 0;
    while (this.position + offset < this.source.length) {
      const char = this.source[this.position + offset];
      if (!/\s/.test(char)) {
        return char;
      }
      offset++;
    }
    return '\0';
  }
  
  private addToken(type: TokenType, value: string, start: number, end: number): void {
    const token: Token = {
      type,
      value,
      start,
      end,
      line: this.line,
      column: this.column - (end - start)
    };
    
    // Set indentation for tokens at start of line
    if (this.lineStart && token.type !== TokenType.Whitespace) {
      token.indentCol = this.currentIndent;
      token.newline = true;
      this.lineStart = false;  // Reset line start flag after adding token
    }
    
    this.tokens.push(token);
    
    if (type !== TokenType.Whitespace && type !== TokenType.Comment) {
      this.lastNonWSToken = token;
      
      // Update context position based on this token
      this.context.updatePosition(value, type);
    }
  }
  
  private addTokenEx(type: TokenType, value: string, start: number, end: number, line: number, column: number): void {
    const token: Token = {
      type,
      value,
      start,
      end,
      line,
      column
    };
    
    // Set indentation for tokens at start of line
    if (this.lineStart && token.type !== TokenType.Whitespace) {
      token.indentCol = this.currentIndent;
      token.newline = true;
      this.lineStart = false;  // Reset line start flag after adding token
    }
    
    this.tokens.push(token);
    
    if (type !== TokenType.Whitespace && type !== TokenType.Comment) {
      this.lastNonWSToken = token;
      
      // Update context position based on this token
      this.context.updatePosition(value, type);
      
      // Handle type context transitions
      this.updateTypeContext(value, type);
    }
  }

  private updateTypeContext(value: string, type: TokenType): void {
    // Enter type context after these tokens
    if (value === ':' && !this.context.isInJSX()) {
      // Type annotation context (but not JSX attributes)
      this.context.enterTypeAnnotation();
    } else if (value === '<' && this.context.canBeGeneric()) {
      // Generic type parameters
      this.context.enterGeneric();
    } else if (value === 'extends' || value === 'implements' || 
               value === 'as' || value === 'typeof' || value === 'keyof') {
      // TypeScript type contexts
      this.context.enterTypeAnnotation();
    }
    
    // Exit type context after these tokens
    if (value === '>' && this.context.getContext().genericDepth > 0) {
      // End of generic parameters
      this.context.exitGeneric();
    } else if ((value === ',' || value === ')' || value === ';' || value === '=' || 
                value === '{' || value === '}') && this.context.isInType()) {
      // End of type annotation in many contexts
      this.context.exitTypeAnnotation();
    }
  }
}