import { Token, TokenType } from './lexer';
import * as AST from './ast';

export class ParseError extends Error {
  constructor(
    message: string,
    public token: Token,
    public quickFix?: string
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export class Parser {
  private tokens: Token[] = [];
  private current = 0;
  private errors: ParseError[] = [];
  
  // Block delimiter stacks
  private braceDepth = 0;
  private indentStack: number[] = [];
  private keywordStack: ("do" | "case" | "begin" | "if" | "for" | "while" | "function")[] = [];
  
  // Error recovery state
  private syntheticTokenCounter = 0;
  
  // Context tracking
  private insideSwitch = false;
  
  // Directives
  private nextStmtGenericMode: "on" | "off" | "auto" = "auto";
  
  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => 
      t.type !== TokenType.Comment && 
      t.type !== TokenType.Whitespace
    );
  }
  
  getErrors(): ParseError[] {
    return this.errors;
  }
  
  parse(): AST.Program {
    const body: (AST.Decl | AST.Stmt)[] = [];
    let iterations = 0;
    const maxIterations = Math.max(1000, this.tokens.length * 2); // Safety limit with minimum
    
    // Debug logging
    if (typeof process !== 'undefined' && process.env.DEBUG_HANG) {
      console.log(`[PARSE] Starting with ${this.tokens.length} tokens`);
    }
    
    while (!this.isAtEnd()) {
      iterations++;
      if (iterations > maxIterations) {
        console.error(`Parser exceeded maximum iterations (${maxIterations}) - possible infinite loop`);
        console.error(`Current position: ${this.current}/${this.tokens.length}`);
        console.error(`Current token: ${this.peek().value} (${this.peek().type})`);
        console.error(`Parsed ${body.length} statements so far`);
        // Return what we've parsed so far instead of continuing
        return {
          kind: "Program",
          body,
          span: this.createSpan(0, Math.min(this.current, this.tokens.length - 1))
        };
      }
      
      const beforePos = this.current;
      
      try {
        const item = this.parseTopLevel();
        if (item) {
          body.push(item);
        } else if (!this.isAtEnd()) {
          // parseTopLevel returned null but we're not at end
          // This shouldn't happen at the top level
          if (this.current === beforePos) {
            console.error(`Warning: parseTopLevel returned null at position ${this.current}, token: ${this.peek().value}`);
            this.advance();
          }
        }
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          // Debug: log the error
          if (typeof process !== 'undefined' && process.env.DEBUG_PARSER) {
            console.log('Parse error:', error.message, 'at token:', error.token);
          }
          this.synchronize();
        } else {
          throw error;
        }
      }
      
      // Ensure we're making progress
      if (this.current === beforePos && !this.isAtEnd()) {
        console.error(`Parser stuck at position ${this.current}, token: ${this.peek().value}`);
        console.error(`Forcing advance from ${this.peek().value}`);
        this.advance();
      }
    }
    
    return {
      kind: "Program",
      body,
      span: this.createSpan(0, this.tokens.length - 1)
    };
  }
  
  // Error recovery helpers
  private createSyntheticToken(type: TokenType, value: string): Token {
    const pos = this.current > 0 ? this.tokens[this.current - 1].end : 0;
    return {
      type,
      value,
      start: pos,
      end: pos,
      line: this.current > 0 ? this.tokens[this.current - 1].line : 1,
      column: this.current > 0 ? this.tokens[this.current - 1].column + 1 : 1,
      synthetic: true
    } as Token;
  }
  
  private createMissingExpr(): AST.Expr {
    const span = this.current > 0 ? 
      this.createSpan(this.current - 1, this.current - 1) :
      this.createSpan(0, 0);
    
    return {
      kind: "Identifier",
      name: "__missing__",
      span
    };
  }
  
  private createMissingIdentifier(): AST.Identifier {
    const span = this.current > 0 ? 
      this.createSpan(this.current - 1, this.current - 1) :
      this.createSpan(0, 0);
    
    return {
      kind: "Identifier",
      name: "__missing__",
      span
    };
  }
  
  private must(expected: string, options?: { recoverWithSynthetic?: boolean }): boolean {
    // Skip virtual semicolons before checking for expected token
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    if (this.check(expected)) {
      this.advance();
      return true;
    }
    
    if (options?.recoverWithSynthetic) {
      // Record the error
      this.errors.push(new ParseError(
        `Expected '${expected}' but got '${this.peek().value}'`,
        this.peek(),
        `Insert '${expected}'`
      ));
      
      // Return true to indicate we're recovering
      // The caller should handle the missing token appropriately
      return true;
    }
    
    throw this.error(this.peek(), `Expected '${expected}'`);
  }
  
  private parseTopLevel(): AST.Decl | AST.Stmt | null {
    this.consumeDirectives();
    
    // Skip virtual semicolons at top level
    let vsCount = 0;
    while (this.peek().virtualSemi) {
      this.advance();
      vsCount++;
      if (vsCount > 100) {
        // Too many virtual semicolons, something is wrong
        console.error(`Error: Skipped ${vsCount} virtual semicolons without progress`);
        return null;
      }
    }
    
    if (this.isAtEnd()) return null;
    
    // Handle closing braces
    // Note: braceDepth only tracks {} blocks (if/for/while/function bodies)
    // It does NOT track braces for classes, interfaces, object literals, etc.
    if (this.check("}")) {
      if (this.braceDepth > 0) {
        // We're inside a statement block, let parseBlock() handle it
        return null;
      } else {
        // This } belongs to a class/interface/object literal/etc
        // or is genuinely unmatched. Either way, consume it and continue.
        // The calling context will handle validation.
        this.advance();
        return null;
      }
    }
    
    // Check for decorators (@decorator syntax)
    if (this.check("@")) {
      const decorators: AST.Expr[] = [];
      while (this.check("@")) {
        this.advance(); // consume @
        
        // Parse decorator expression (function call or identifier)
        const name = this.parseIdentifier();
        
        // Allow function calls on the decorator: @deprecated("message")
        const decorator = this.parsePostfix(name);
        
        decorators.push(decorator);
        
        // Skip virtual semicolons between decorators
        while (this.peek().virtualSemi) {
          this.advance();
        }
      }
      
      // After decorators, we expect a declaration (function or class)
      if (this.match("async", "unsafe")) {
        // Handle async/unsafe before function
        const isAsync = this.previous()?.value === "async";
        const isUnsafe = this.previous()?.value === "unsafe";
        
        if (this.match("def", "fun", "fn", "func", "function")) {
          const isGenerator = this.previous()?.value === "function" && this.match("*");
          const func = this.parseFuncDecl(isAsync, isUnsafe, isGenerator);
          // Note: We're ignoring decorators for now since AST doesn't have a field for them
          return func;
        }
      } else if (this.match("def", "fun", "fn", "func", "function")) {
        const isGenerator = this.previous()?.value === "function" && this.match("*");
        const func = this.parseFuncDecl(false, false, isGenerator);
        // Note: We're ignoring decorators for now since AST doesn't have a field for them
        return func;
      } else if (this.match("class")) {
        const cls = this.parseClassDecl();
        // Note: We're ignoring decorators for now since AST doesn't have a field for them
        return cls;
      }
      
      // If we have decorators but no valid declaration follows, it's an error
      throw this.error(this.peek(), "Expected function or class declaration after decorators");
    }
    
    // Check for short declaration first (including destructuring)
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      this.advance();
      if (this.check(":=")) {
        this.current = checkpoint;
        return this.parseShortDecl();
      }
      this.current = checkpoint;
    } else if ((this.peek().value === "{" || this.peek().value === "[") && 
               this.peekAhead(":=")) {
      // Destructuring pattern with :=
      return this.parseDestructuringShortDecl();
    }
    
    if (this.isDeclStart()) {
      return this.parseDeclaration();
    }
    
    return this.parseStatement();
  }
  
  private isStatementKeyword(keyword: string): boolean {
    // These keywords can start a statement and should not be treated as identifiers
    return keyword === "if" || keyword === "while" || keyword === "for" ||
           keyword === "do" || keyword === "switch" || keyword === "try" ||
           keyword === "throw" || keyword === "return" || keyword === "break" ||
           keyword === "continue" || keyword === "case" || keyword === "default" ||
           keyword === "new" || keyword === "yield" || keyword === "await" ||
           keyword === "match" || keyword === "using" || keyword === "defer" ||
           keyword === "go" || keyword === "echo";
  }
  
  private isDeclStart(): boolean {
    const type = this.peek().type;
    const value = this.peek().value;
    
    // Check for decorators (@decorator)
    if (value === "@") {
      return true;
    }
    
    // Special check for using - it's only a declaration if it's an import
    if (value === "using") {
      const next = this.peekNext();
      // It's a declaration if followed by string literal or identifier (but not assignment)
      return next?.type === TokenType.StringLiteral || 
             (next?.type === TokenType.Identifier && this.peekAt(2)?.value !== "=");
    }
    
    // Check for async/unsafe followed by function declarations
    if (value === "async" || value === "unsafe") {
      const next = this.peekNext();
      return next?.value === "fn" || next?.value === "fun" || 
             next?.value === "function" || next?.value === "def" || next?.value === "func" ||
             next?.value === "async" || next?.value === "unsafe";
    }
    
    // Special check for 'type' - only a declaration if followed by identifier (type alias)
    if (value === "type") {
      const next = this.peekNext();
      // It's a type declaration if the next token is an identifier
      // This allows 'type' to be used as a regular identifier in expressions
      return next?.type === TokenType.Identifier;
    }
    
    return (
      type === TokenType.Keyword && (
        value === "import" || value === "require" ||
        value === "let" || value === "var" || value === "auto" ||
        value === "fn" || value === "fun" || value === "function" || value === "def" || value === "func" ||
        value === "const" || value === "final" || value === "immutable" ||
        value === "class" || value === "struct" || value === "interface" ||
        value === "trait" || value === "enum" ||
        value === "package" || value === "export"
      ) ||
      type === TokenType.Operator && value === "#" && 
      this.peekNext()?.type === TokenType.Identifier && 
      this.peekNext()?.value === "include"
    );
  }
  
  private parseDeclaration(): AST.Decl {
    const token = this.peek();
    
    // Import statements
    if (this.match("import", "require")) {
      return this.parseImport();
    }
    
    // Check if using is for import or resource management
    if (this.peek().value === "using") {
      const next = this.peekNext();
      
      // Look ahead to distinguish import from resource management
      // Import: using "module" or using module (but not assignment)
      if (next?.type === TokenType.StringLiteral || 
          (next?.type === TokenType.Identifier && this.peekAt(2)?.value !== "=")) {
        this.advance(); // consume 'using'
        return this.parseImport();
      }
      
      // It's a using statement for resource management
      // Don't consume it, let parseStatement handle it
      throw this.error(this.peek(), "Expected declaration");
    }
    
    // #include
    if (this.check("#") && this.peekNext()?.value === "include") {
      this.advance(); // #
      this.advance(); // include
      return this.parseImport();
    }
    
    // Variable declarations
    if (this.match("let", "var", "auto")) {
      return this.parseVarDecl();
    }
    
    if (this.match("const", "final", "immutable")) {
      return this.parseConstDecl();
    }
    
    // Check for async/unsafe modifiers
    if (this.peek().value === "async" || this.peek().value === "unsafe") {
      let isAsync = false;
      let isUnsafe = false;
      
      if (this.match("async")) {
        isAsync = true;
        if (this.match("unsafe")) {
          isUnsafe = true;
        }
      } else if (this.match("unsafe")) {
        isUnsafe = true;
        if (this.match("async")) {
          isAsync = true;
        }
      }
      
      if (this.match("def", "fun", "fn", "func", "function")) {
        // Check for generator function (function*)
        const funcKeyword = this.previous()?.value;
        const isGenerator = funcKeyword === "function" && this.match("*");
        return this.parseFuncDecl(isAsync, isUnsafe, isGenerator);
      }
      
      // Not a function declaration - this would be an error
      throw this.error(this.peek(), "Expected function declaration after async/unsafe");
    }
    
    // Function declarations
    if (this.match("def", "fun", "fn", "func", "function")) {
      // Check for generator function (function*)
      const isGenerator = this.previous()?.value === "function" && this.match("*");
      return this.parseFuncDecl(false, false, isGenerator);
    }
    
    // Check for return-type-before-name function declaration
    if (this.isType()) {
      const checkpoint = this.current;
      try {
        const type = this.parseType();
        if (this.peek().type === TokenType.Identifier) {
          const name = this.advance();
          if (this.check("(")) {
            // This is a function with return type before name
            this.current = checkpoint;
            return this.parseFuncDeclWithReturnTypeBefore();
          }
        }
        this.current = checkpoint;
      } catch {
        this.current = checkpoint;
      }
    }
    
    // Type declarations
    if (this.match("type")) {
      return this.parseTypeDecl();
    }
    
    if (this.match("class")) {
      return this.parseClassDecl();
    }
    
    if (this.match("interface", "trait")) {
      return this.parseInterfaceDecl();
    }
    
    if (this.match("enum")) {
      return this.parseEnumDecl();
    }
    
    if (this.match("package")) {
      return this.parsePackageDecl();
    }
    
    if (this.match("export")) {
      return this.parseExportDecl();
    }
    
    // Check for short declaration
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      const id = this.advance();
      if (this.match(":=")) {
        this.current = checkpoint;
        return this.parseShortDecl();
      }
      this.current = checkpoint;
    }
    
    throw this.error(this.peek(), "Expected declaration");
  }
  
  private parseStatement(): AST.Stmt {
    // Handle async for
    if (this.peek().value === "async" && this.peekNext()?.value === "for") {
      this.advance(); // consume async
      this.advance(); // consume for
      // Now parse as a for-await loop
      return this.parseLoop();
    }
    
    // Control flow
    if (this.match("if")) {
      return this.parseIf();
    }
    
    if (this.match("switch", "match")) {
      return this.parseSwitch();
    }
    
    // Don't parse 'case' as a statement when inside a switch
    if (this.peek().value === "case" && !this.insideSwitch) {
      this.advance();
      // Bash-style case statement
      return this.parseCaseStatement();
    }
    
    if (this.match("select")) {
      // Go-style select statement for channels
      return this.parseSelectStatement();
    }
    
    if (this.match("do")) {
      // Check if this is a do-while loop or bash-style do-done
      return this.parseDoStatement();
    }
    
    if (this.match("for", "while", "until", "loop")) {
      return this.parseLoop();
    }
    
    if (this.match("foreach")) {
      return this.parseForeach();
    }
    
    if (this.match("try")) {
      return this.parseTry();
    }
    
    if (this.match("with")) {
      return this.parseUsing();
    }
    
    // Check if using is for resource management
    if (this.peek().value === "using") {
      const next = this.peekNext();
      const nextNext = this.peekAt(2);
      
      // Resource management: using var = expr { ... }
      if (next?.type === TokenType.Identifier && nextNext?.value === "=") {
        this.advance(); // consume 'using'
        return this.parseUsing();
      }
    }
    
    if (this.match("defer")) {
      return this.parseDefer();
    }
    
    if (this.match("break")) {
      return this.parseBreak();
    }
    
    if (this.match("continue")) {
      return this.parseContinue();
    }
    
    if (this.match("return")) {
      return this.parseReturn();
    }
    
    if (this.match("assert")) {
      return this.parseAssert();
    }
    
    if (this.match("echo", "print")) {
      return this.parseEcho();
    }
    
    // New statements
    if (this.match("throw", "raise")) {
      return this.parseThrow();
    }
    
    
    if (this.match("go")) {
      return this.parseGo();
    }
    
    if (this.match("defer")) {
      return this.parseDefer();
    }
    
    if (this.match("pass")) {
      return this.parsePass();
    }
    
    // Begin/end blocks (Ruby-style with rescue/ensure)
    if (this.match("begin")) {
      return this.parseBeginBlock();
    }
    
    // Block statements - but could also be object destructuring
    if (this.check("{")) {
      // Look ahead to see if this is object destructuring
      const checkpoint = this.current;
      try {
        this.advance(); // consume {
        
        // Check if it looks like object destructuring
        let isDestructuring = false;
        if (this.peek().type === TokenType.Identifier) {
          this.advance();
          if (this.check(",") || this.check("}")) {
            // Looks like {x, y} or {x}
            isDestructuring = true;
          }
        }
        
        this.current = checkpoint;
        
        if (isDestructuring) {
          // Parse as expression statement (which will parse object literal)
          return this.parseExprStmt();
        } else {
          // Parse as block
          return this.parseBlock();
        }
      } catch {
        this.current = checkpoint;
        return this.parseBlock();
      }
    }
    
    // Expression statement
    return this.parseExprStmt();
  }
  
  private parseBlockOrStatement(): AST.Block {
    // Helper to parse either a block or single statement
    if (this.check("{")) {
      return this.parseBlock();
    } else {
      // Single statement without braces
      const stmt = this.parseStatement();
      return {
        kind: "Block",
        statements: stmt ? [stmt] : [],
        span: this.createSpanFrom(stmt || this.previous())
      };
    }
  }

  private parseBlock(): AST.Block {
    const start = this.current;
    const openToken = this.peek();
    
    if (this.match("{")) {
      this.braceDepth++;
      const statements: (AST.Decl | AST.Stmt)[] = [];
      
      let loopCount = 0;
      while (!this.check("}") && !this.isAtEnd()) {
        loopCount++;
        if (loopCount > 1000) {
          console.error(`parseBlock exceeded 1000 iterations at position ${this.current}`);
          console.error(`Current token: ${this.peek().value} (${this.peek().type})`);
          break;
        }
        
        const beforePos = this.current;
        try {
          const stmt = this.parseTopLevel();
          if (stmt) statements.push(stmt);
        } catch (error) {
          if (error instanceof ParseError) {
            this.errors.push(error);
            this.synchronize();
          } else {
            throw error;
          }
        }
        // Prevent infinite loop
        if (this.current === beforePos && !this.check("}")) {
          console.error(`parseBlock not advancing at position ${this.current}, forcing advance`);
          this.advance();
        }
      }
      
      if (!this.match("}")) {
        throw this.error(this.peek(), "Expected '}'");
      }
      this.braceDepth--;
      
      return {
        kind: "Block",
        statements,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Check for indent block
    if (this.checkIndentBlock()) {
      return this.parseIndentBlock();
    }
    
    // Check for keyword block
    if (this.checkKeywordBlock()) {
      return this.parseKeywordBlock();
    }
    
    throw this.error(this.peek(), "Expected block");
  }
  
  private checkIndentBlock(): boolean {
    // Check if previous token was a header ending with ':'
    if (this.current > 0) {
      const prev = this.tokens[this.current - 1];
      if (prev.type === TokenType.Operator && prev.value === ":") {
        // Check if next line is more indented
        const nextToken = this.peek();
        if (nextToken.indentCol !== undefined && 
            (this.indentStack.length === 0 || 
             nextToken.indentCol > this.indentStack[this.indentStack.length - 1])) {
          return true;
        }
      }
    }
    return false;
  }
  
  private parseSelectStatement(): AST.Switch {
    const start = this.current - 1;
    const cases: AST.SwitchCase[] = [];
    let defaultCase: AST.Block | undefined;
    
    this.consume("{", "Expected '{' after select");
    
    while (!this.check("}") && !this.isAtEnd()) {
      // Skip virtual semicolons
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      if (this.check("}") || this.isAtEnd()) {
        break;
      }
      
      if (this.match("default")) {
        this.consume(":", "Expected ':' after default");
        defaultCase = this.parseCaseBody();
        continue;
      }
      
      if (this.match("case")) {
        // Parse channel operation (e.g., x := <-ch or ch <- value)
        // Parse as expression to get the channel operation directly
        const pattern = this.parseExpression();
        this.consume(":", "Expected ':' after case");
        const body = this.parseCaseBody();
        
        cases.push({
          patterns: [pattern], // Channel operation as pattern
          body,
          fallthrough: false,
          span: this.createSpan(start, this.current - 1)
        });
        continue;
      }
      
      // If we get here, there's an unexpected token
      throw this.error(this.peek(), "Expected 'case' or 'default' in select statement");
    }
    
    this.consume("}", "Expected '}' after select body");
    
    // Create a pseudo-discriminant for select (since it doesn't have one)
    const discriminant: AST.Identifier = {
      kind: "Identifier",
      name: "__select__",
      originalSpelling: "__select__",
      span: this.createSpan(start, start)
    };
    
    return {
      kind: "Switch",
      discriminant,
      cases,
      defaultCase,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseCaseStatement(): AST.Switch {
    const start = this.current - 1;
    // Parse the discriminant - just a primary expression to avoid consuming 'in'
    const discriminant = this.parsePrimary();
    this.consume("in", "Expected 'in' after case expression");
    return this.parseCaseEsac(start, discriminant);
  }
  
  private parseCaseEsac(start: number, discriminant: AST.Expr): AST.Switch {
    const cases: AST.SwitchCase[] = [];
    let defaultCase: AST.Block | undefined;
    
    while (!this.check("esac") && !this.isAtEnd()) {
      // Skip any virtual semicolons
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      if (this.check("esac")) break;
      
      // Parse case pattern
      const patterns: AST.Expr[] = [];
      
      // Check for default case (*)
      if (this.match("*")) {
        this.consume(")", "Expected ')' after case pattern");
        
        // Parse case body
        const statements: (AST.Decl | AST.Stmt)[] = [];
        while (!this.check(";;") && !this.check("esac") && !this.isAtEnd() && 
               !(this.peek().type === TokenType.NumericLiteral || 
                 this.peek().type === TokenType.StringLiteral ||
                 this.peek().value === "*") ) {
          const stmt = this.parseTopLevel();
          if (stmt) statements.push(stmt);
        }
        
        defaultCase = {
          kind: "Block",
          statements,
          span: this.createSpan(this.current, this.current)
        };
        
        // Consume ;; if present
        this.match(";;");
      } else {
        // Parse pattern (number, string, etc.)
        patterns.push(this.parseExpression());
        
        this.consume(")", "Expected ')' after case pattern");
        
        // Parse case body
        const statements: (AST.Decl | AST.Stmt)[] = [];
        while (!this.check(";;") && !this.check("esac") && !this.isAtEnd() && 
               !(this.peek().type === TokenType.NumericLiteral || 
                 this.peek().type === TokenType.StringLiteral ||
                 this.peek().value === "*")) {
          const stmt = this.parseTopLevel();
          if (stmt) statements.push(stmt);
        }
        
        const body: AST.Block = {
          kind: "Block",
          statements,
          span: this.createSpan(this.current, this.current)
        };
        
        // Check for fallthrough (no ;;)
        const fallthrough = !this.match(";;");
        
        cases.push({
          patterns,
          body,
          fallthrough,
          span: this.createSpan(this.current, this.current)
        });
      }
    }
    
    this.consume("esac", "Expected 'esac' to close case statement");
    
    return {
      kind: "Switch",
      discriminant,
      cases,
      defaultCase,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseBashTestExpression(): AST.Expr {
    // Parse [ ... ] as a special test expression
    const start = this.current;
    this.consume("[", "Expected '[' for bash test");
    
    // Collect everything until ] as a test expression
    // For now, we'll represent it as a special call expression
    const args: AST.Expr[] = [];
    
    while (!this.check("]") && !this.isAtEnd()) {
      // Skip virtual semicolons
      if (this.peek().virtualSemi) {
        this.advance();
        continue;
      }
      
      // Handle operators as identifiers in bash test context
      if (this.peek().type === TokenType.Operator) {
        const op = this.advance();
        
        // Handle test operators like -gt, -lt, etc.
        if (op.value === "-" && this.peek().type === TokenType.Identifier) {
          const flag = this.advance();
          // Create a special test operator expression
          args.push({
            kind: "Identifier",
            name: op.value + flag.value,
            span: this.createSpan(this.current - 2, this.current - 1)
          });
        } else {
          // Other operators like =, !=, etc. are test operators
          args.push({
            kind: "Identifier", 
            name: op.value,
            span: this.createSpanFrom(op)
          });
        }
      } else if (this.peek().type === TokenType.StringLiteral ||
                 this.peek().type === TokenType.NumericLiteral ||
                 this.peek().type === TokenType.Identifier ||
                 this.peek().type === TokenType.SigilIdentifier) {
        // Parse literals and identifiers
        args.push(this.parsePrimary());
      } else {
        // Skip unexpected tokens
        this.advance();
      }
    }
    
    this.consume("]", "Expected ']' after bash test");
    
    // Return as a special call expression representing the test
    return {
      kind: "Call",
      callee: {
        kind: "Identifier",
        name: "test",
        span: this.createSpan(start, start)
      },
      args,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseIfThenBlock(): AST.Block {
    // Parse statements until we hit fi, elif, or else
    const start = this.current;
    const statements: (AST.Decl | AST.Stmt)[] = [];
    
    while (!this.check("fi") && !this.check("elif") && !this.check("elseif") && 
           !this.check("else") && !this.isAtEnd()) {
      const beforePos = this.current;
      try {
        const stmt = this.parseTopLevel();
        if (stmt) statements.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
      // Prevent infinite loop
      if (this.current === beforePos) {
        this.advance();
      }
    }
    
    return {
      kind: "Block",
      statements,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseIndentBlock(): AST.Block {
    const start = this.current;
    
    // Skip any virtual semicolons after the colon
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    // Get the base indent level
    const baseIndent = this.indentStack.length > 0 ? 
      this.indentStack[this.indentStack.length - 1] : 0;
    
    // The first statement should be more indented
    // Use the indentCol of the next non-whitespace token
    const blockIndent = this.peek().indentCol ?? 0;
    if (blockIndent <= baseIndent && !this.isAtEnd()) {
      // Empty block or same-line statement
      return {
        kind: "Block",
        statements: [],
        span: this.createSpan(start, this.current)
      };
    }
    
    this.indentStack.push(blockIndent);
    const statements: (AST.Decl | AST.Stmt)[] = [];
    
    while (!this.isAtEnd()) {
      const nextIndent = this.peek().indentCol ?? 0;
      
      // Check if we've dedented back to or past the base level
      if (nextIndent < blockIndent) {
        break;
      }
      
      try {
        const stmt = this.parseTopLevel();
        if (stmt) statements.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
    }
    
    this.indentStack.pop();
    
    return {
      kind: "Block",
      statements,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private checkKeywordBlock(): boolean {
    const value = this.previous()?.value;
    return value === "do" || value === "case" || value === "begin" ||
           (value === "if" && this.isBashOrRubyStyle()) ||
           (value === "for" && this.isRubyStyle()) ||
           (value === "while" && this.isRubyStyle()) ||
           (value === "function" && this.isBashStyle());
  }
  
  private parseBeginBlock(): AST.Try | AST.Block {
    const start = this.current - 1;
    const statements: (AST.Decl | AST.Stmt)[] = [];
    
    // Parse the main body until rescue/ensure/end
    while (!this.check("rescue") && !this.check("ensure") && !this.check("end") && !this.isAtEnd()) {
      // Skip virtual semicolons
      if (this.peek().virtualSemi) {
        this.advance();
        continue;
      }
      
      const beforePos = this.current;
      try {
        const stmt = this.parseTopLevel();
        if (stmt) statements.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
      // Prevent infinite loop
      if (this.current === beforePos) {
        this.advance();
      }
    }
    
    // If we hit 'end' directly without rescue/ensure, it's just a block
    if (this.check("end")) {
      this.advance(); // consume 'end'
      return {
        kind: "Block",
        statements,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    const body: AST.Block = {
      kind: "Block",
      statements,
      span: this.createSpan(start, this.current - 1)
    };
    
    const catches: AST.CatchClause[] = [];
    
    // Handle rescue clauses
    while (this.match("rescue")) {
      let param: AST.Identifier | undefined;
      let type: AST.TypeNode | undefined;
      
      // Check for rescue Type => var pattern
      if (this.peek().type === TokenType.Identifier && !this.check("=>")) {
        type = this.parseType();
      }
      
      if (this.match("=>")) {
        param = this.parseIdentifier();
      }
      
      const rescueStatements: (AST.Decl | AST.Stmt)[] = [];
      while (!this.check("rescue") && !this.check("ensure") && !this.check("end") && !this.isAtEnd()) {
        if (this.peek().virtualSemi) {
          this.advance();
          continue;
        }
        
        const beforePos = this.current;
        try {
          const stmt = this.parseTopLevel();
          if (stmt) rescueStatements.push(stmt);
        } catch (error) {
          if (error instanceof ParseError) {
            this.errors.push(error);
            this.synchronize();
          } else {
            throw error;
          }
        }
        // Prevent infinite loop
        if (this.current === beforePos && !this.check("rescue") && !this.check("ensure") && !this.check("end")) {
          console.error(`parseBeginBlock rescue body stuck at position ${this.current}, forcing advance`);
          this.advance();
        }
      }
      
      catches.push({
        param,
        type,
        body: {
          kind: "Block",
          statements: rescueStatements,
          span: this.createSpan(this.current - 1, this.current)
        },
        span: this.createSpan(this.current - 1, this.current)
      });
    }
    
    // Handle ensure clause
    let finallyBlock: AST.Block | undefined;
    if (this.match("ensure")) {
      const ensureStatements: (AST.Decl | AST.Stmt)[] = [];
      while (!this.check("end") && !this.isAtEnd()) {
        if (this.peek().virtualSemi) {
          this.advance();
          continue;
        }
        
        try {
          const stmt = this.parseTopLevel();
          if (stmt) ensureStatements.push(stmt);
        } catch (error) {
          if (error instanceof ParseError) {
            this.errors.push(error);
            this.synchronize();
          } else {
            throw error;
          }
        }
      }
      
      finallyBlock = {
        kind: "Block",
        statements: ensureStatements,
        span: this.createSpan(this.current - 1, this.current)
      };
    }
    
    this.consume("end", "Expected 'end' to close begin block");
    
    return {
      kind: "Try",
      body,
      catches,
      finallyBody: finallyBlock,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseKeywordBlock(keyword?: string): AST.Block {
    const start = this.current;
    const actualKeyword = keyword || this.previous()?.value || "do";
    this.keywordStack.push(actualKeyword as any);
    
    const statements: (AST.Decl | AST.Stmt)[] = [];
    
    const endKeyword = this.getEndKeyword(actualKeyword);
    
    while (!this.check(endKeyword) && !this.isAtEnd()) {
      // Skip virtual semicolons
      if (this.peek().virtualSemi) {
        this.advance();
        continue;
      }
      
      try {
        const stmt = this.parseTopLevel();
        if (stmt) statements.push(stmt);
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
    }
    
    if (!this.match(endKeyword)) {
      throw this.error(this.peek(), `Expected '${endKeyword}'`);
    }
    
    this.keywordStack.pop();
    
    return {
      kind: "Block",
      statements,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private getEndKeyword(keyword: string): string {
    switch (keyword) {
      case "do": return "done";
      case "case": return "esac";
      case "begin": return "end";
      case "if": return "fi";
      case "for":
      case "while":
      case "function": return this.isBashStyle() ? "done" : "end";
      default: return "end";
    }
  }
  
  private isBashStyle(): boolean {
    // Heuristic: check for bash-style constructs
    return false; // Implement based on context
  }
  
  private isRubyStyle(): boolean {
    // Heuristic: check for ruby-style constructs
    return false; // Implement based on context
  }
  
  private isBashOrRubyStyle(): boolean {
    return this.isBashStyle() || this.isRubyStyle();
  }
  
  // Expression parsing with Pratt parser
  private parseExpression(minPrecedence = 0): AST.Expr {
    let left = this.parsePrimary();
    
    // Check for single-parameter lambda without parentheses
    if (left.kind === "Identifier" && this.check("=>")) {
      this.advance(); // consume =>
      
      // Skip virtual semicolons after => in arrow functions
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      const body = this.check("{") ? this.parseBlock() : this.parseExpression();
      return {
        kind: "Lambda",
        params: [{
          name: left as AST.Identifier,
          type: undefined,
          defaultValue: undefined,
          span: left.span
        }],
        returnType: undefined,
        body,
        span: this.createSpanFrom(left)
      };
    }
    
    while (true) {
      const op = this.peek();
      
      // Check for 'as' type assertion (TypeScript)
      if (op.value === "as") {
        this.advance(); // consume 'as'
        const type = this.parseType();
        left = {
          kind: "TypeAssertion",
          expr: left,
          type,
          span: this.createSpanFrom(left)
        };
        continue;
      }
      
      if (!this.isBinaryOp(op) && !this.isAssignmentOp(op)) {
        break;
      }
      
      const precedence = this.getPrecedence(op);
      if (precedence < minPrecedence) {
        break;
      }
      
      this.advance();
      
      // Skip virtual semicolons after binary operators
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      // Handle ternary operator
      if (op.value === "?") {
        const consequent = this.parseExpression();
        this.consume(":", "Expected ':' in ternary expression");
        const alternate = this.parseExpression(precedence);
        left = {
          kind: "Ternary",
          test: left,
          consequent,
          alternate,
          span: this.createSpanFrom(left)
        };
        continue;
      }
      
      const isRightAssoc = this.isRightAssociative(op);
      const nextMinPrec = isRightAssoc ? precedence : precedence + 1;
      
      // Special case: pipe operator followed by match expression
      let right: AST.Expr;
      if (op.value === "|>" && this.check("match")) {
        // Parse match with implicit discriminant (left side of pipe)
        this.advance(); // consume 'match'
        const switchStmt = this.parseSwitch();
        // For now, treat it as an expression (would need AST changes for proper support)
        right = switchStmt as any;
      } else {
        right = this.parseExpression(nextMinPrec);
      }
      
      if (this.isAssignmentOp(op)) {
        left = {
          kind: "Assign",
          op: op.value,
          left,
          right,
          span: this.createSpanFrom(left)
        };
      } else {
        left = {
          kind: "Binary",
          op: op.value,
          left,
          right,
          span: this.createSpanFrom(left)
        };
      }
    }
    
    return left;
  }
  
  private parsePrimary(): AST.Expr {
    // Handle async lambda/function expressions
    if (this.peek().value === "async") {
      // Look ahead to see if this is really an async function/lambda
      const next = this.peekNext();
      const isAsyncFunction = next && (
        next.value === "(" ||  // async () => 
        next.value === "{" ||  // async { ... }
        (next.type === TokenType.Identifier && this.peekAt(2)?.value === "=>") || // async x =>
        next.value === "function" // async function
      );
      
      if (isAsyncFunction) {
        this.advance(); // consume 'async'
        const start = this.current - 1;
        // Check for lambda or async block
        if (this.check("(") || this.peek().type === TokenType.Identifier || this.check("{")) {
          // Parse as async lambda or async block
          const lambda = this.parseAsyncLambda(start);
          // Allow postfix operations on the lambda (like calls)
          return this.parsePostfix(lambda);
        }
        // Otherwise it's an error
        throw this.error(this.peek(), "Expected lambda or block after async");
      }
      // Otherwise, treat 'async' as a regular identifier
    }
    
    // Handle yield expression
    if (this.match("yield")) {
      return this.parseYieldExpression();
    }
    
    // Handle channel receive operator
    if (this.check("<-")) {
      const op = this.advance();
      const argument = this.parsePrimary();
      return {
        kind: "Unary",
        op: "<-",
        argument,
        prefix: true,
        span: this.createSpan(this.current - 1, this.current)
      };
    }
    
    // Handle angle-bracket type assertion <Type>expr
    if (this.peek().value === "<") {
      const next = this.peekNext();
      // Check if this looks like a type assertion
      if (next && next.type === TokenType.Identifier) {
        const checkpoint = this.current;
        this.advance(); // consume '<'
        
        // Try to parse the type
        const typeStart = this.current;
        if (this.match("Identifier")) {
          const typeName = this.tokens[this.current - 1].value;
          
          // Look for closing '>'
          if (this.match(">")) {
            // Parse the expression after the type assertion
            const expr = this.parsePrimary();
            const type: AST.SimpleType = {
              kind: "SimpleType",
              id: { kind: "Identifier", name: typeName, span: this.createSpan(typeStart, typeStart) },
              span: this.createSpan(typeStart, this.current - 1)
            };
            return {
              kind: "TypeAssertion",
              expr,
              type,
              span: this.createSpan(checkpoint, this.current - 1)
            };
          }
        }
        
        // Not a type assertion, restore position
        this.current = checkpoint;
      }
    }
    
    // Handle prefix operators
    if (this.isUnaryOp(this.peek())) {
      const op = this.advance();
      const argument = this.parsePrimary();
      return {
        kind: "Unary",
        op: op.value,
        argument,
        prefix: true,
        span: this.createSpan(this.current - 1, this.current)
      };
    }
    
    // Literals
    if (this.peek().type === TokenType.NumericLiteral) {
      return this.parseNumericLiteral();
    }
    
    if (this.peek().type === TokenType.StringLiteral) {
      return this.parseStringLiteral();
    }
    
    if (this.peek().type === TokenType.TemplateLiteral) {
      // Check if this should be reinterpreted as an identifier
      if (this.shouldReinterpretAsIdentifier()) {
        return this.parseBacktickIdentifier();
      }
      return this.parseTemplateLiteral();
    }
    
    if (this.peek().type === TokenType.RegexLiteral) {
      return this.parseRegexLiteral();
    }
    
    if (this.match("true", "false")) {
      const token = this.previous();
      return {
        kind: "BooleanLiteral",
        value: token?.value === "true",
        span: this.createSpanFrom(token!)
      };
    }
    
    if (this.match("null", "undefined", "nil")) {
      return {
        kind: "NullLiteral",
        span: this.createSpanFrom(this.previous()!)
      };
    }
    
    // this and super keywords
    if (this.match("this", "super")) {
      const token = this.previous()!;
      const id: AST.Identifier = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
      return this.parsePostfix(id);
    }
    
    // Identifiers and sigil identifiers
    // Also allow keywords as identifiers in expression context when they can't start a statement
    if (this.peek().type === TokenType.Identifier || 
        this.peek().type === TokenType.SigilIdentifier ||
        (this.peek().type === TokenType.Keyword && !this.isStatementKeyword(this.peek().value))) {
      const token = this.peek();
      let id: AST.Identifier;
      
      if (token.type === TokenType.Keyword) {
        // Keywords used as identifiers
        this.advance();
        id = {
          kind: "Identifier",
          name: token.value,
          span: this.createSpanFrom(token)
        };
      } else {
        id = this.parseIdentifier();
      }
      
      // Check for generic type arguments only in specific contexts
      // Don't try to parse generics if the < is followed by a number (likely comparison)
      if (this.peek().value === "<" && !this.peek().wsBefore) {
        const next = this.peekNext();
        // Only try to parse generics if not followed by a number or obvious non-type token
        if (next && next.type !== TokenType.NumericLiteral && 
            next.type === TokenType.Identifier) {
          const genericArgs = this.tryParseGenericArgs();
          if (genericArgs) {
            // This would be handled in type context
          }
        }
      }
      
      return this.parsePostfix(id);
    }
    
    // Parenthesized expression, lambda, or generator comprehension
    if (this.match("(")) {
      // Check if this is a lambda parameter list
      const checkpoint = this.current;
      const isLambda = this.checkParenthesizedLambda();
      this.current = checkpoint;
      
      if (isLambda) {
        return this.parseLambda();
      }
      
      const start = this.current - 1;
      
      // Skip virtual semicolons after opening parenthesis
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      const expr = this.parseExpression();
      
      // Skip virtual semicolons before closing parenthesis
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      // Check for generator comprehension: (expr for var in iterable)
      if (this.check("for")) {
        return this.parseGeneratorComprehension(expr, start);
      }
      
      this.must(")", { recoverWithSynthetic: true });
      return this.parsePostfix(expr);
    }
    
    // Array literal
    if (this.match("[")) {
      return this.parseArrayLiteral();
    }
    
    // Object literal
    if (this.match("{")) {
      return this.parseObjectLiteral();
    }
    
    // Lambda/arrow function
    if (this.checkLambda()) {
      return this.parseLambda();
    }
    
    // new expression
    if (this.match("new")) {
      return this.parseNewExpression();
    }
    
    // throw expression (JavaScript/TypeScript)
    if (this.match("throw")) {
      const start = this.current - 1;
      const argument = this.parseExpression();
      return {
        kind: "Unary",
        op: "throw",
        argument,
        prefix: true,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // match expression
    if (this.match("match")) {
      const switchExpr = this.parseSwitch();
      // Convert Switch statement to an expression context
      // For now, return it as-is (would need AST changes for proper match expression)
      return switchExpr as any;
    }
    
    throw this.error(this.peek(), "Unexpected token in expression");
  }
  
  private parsePostfix(expr: AST.Expr): AST.Expr {
    while (true) {
      // Function call
      if (this.match("(")) {
        // Special case for make() with channel types
        if (expr.kind === "Identifier" && expr.name === "make") {
          // Check if the next token suggests a channel type
          if (this.check("<-") || this.peek().value === "chan") {
            // Parse as a type and convert to an identifier expression
            const typeNode = this.parseType();
            const typeExpr: AST.Identifier = {
              kind: "Identifier",
              name: this.typeNodeToString(typeNode),
              originalSpelling: this.typeNodeToString(typeNode),
              span: typeNode.span
            };
            
            // Handle optional size/capacity arguments
            const args: AST.Expr[] = [typeExpr];
            while (this.match(",")) {
              args.push(this.parseAssignmentExpression());
            }
            
            this.must(")", { recoverWithSynthetic: true });
            expr = {
              kind: "Call",
              callee: expr,
              args,
              span: this.createSpanFrom(expr)
            };
            continue;
          }
        }
        
        const args = this.parseArguments();
        this.must(")", { recoverWithSynthetic: true });
        expr = {
          kind: "Call",
          callee: expr,
          args,
          span: this.createSpanFrom(expr)
        };
        continue;
      }
      
      // Member access and optional chaining
      // Check for ?. first to handle both ?.property and ?.[index]
      if (this.peek().value === "?.") {
        const next = this.peekNext();
        // DEBUG
        if (typeof process !== 'undefined' && process.env.DEBUG_PARSER) {
          console.log('Found ?. at position', this.current, 'next token:', next?.value);
        }
        if (next?.value === "[") {
          // Optional chaining with bracket notation (?.[)
          this.advance(); // consume ?.
          this.advance(); // consume [
          const index = this.parseExpression();
          this.consume("]", "Expected ']' after index");
          expr = {
            kind: "Index",
            object: expr,
            index,
            optional: true,
            span: this.createSpanFrom(expr)
          };
          continue;
        } else if (next && next.type === TokenType.Identifier) {
          // Optional chaining with property access (?.property)
          this.advance(); // consume ?.
          const property = this.parseIdentifier();
          expr = {
            kind: "Member",
            object: expr,
            property,
            optional: true,
            span: this.createSpanFrom(expr)
          };
          continue;
        }
        // If ?. is not followed by [ or identifier, don't consume it
        // This might be an error or part of something else
      }
      
      // Regular index access
      if (this.match("[")) {
        const index = this.parseExpression();
        this.consume("]", "Expected ']' after index");
        expr = {
          kind: "Index",
          object: expr,
          index,
          optional: false,
          span: this.createSpanFrom(expr)
        };
        continue;
      }
      
      // Regular member access (including pointer dereference and force unwrap)
      if (this.match(".", ".*", "!.")) {
        const op = this.previous()?.value;
        const deref = op === ".*";
        const forceUnwrap = op === "!.";
        
        // Special case for .*. pattern (pointer member access)
        if (deref && this.match(".")) {
          const property = this.parseIdentifier();
          // Create a compound member access: (*obj).field
          expr = {
            kind: "Member",
            object: {
              kind: "Unary",
              op: "*",
              argument: expr,
              prefix: true,
              span: expr.span
            },
            property,
            optional: false,
            span: this.createSpanFrom(expr)
          };
        } else if (!deref) {
          // Regular member access or force unwrap
          const property = this.parseIdentifier();
          
          // If it was force unwrap, wrap the object in a non-null assertion
          if (forceUnwrap) {
            expr = {
              kind: "Member",
              object: {
                kind: "Unary",
                op: "!",
                argument: expr,
                prefix: false,
                span: expr.span
              },
              property,
              optional: false,
              span: this.createSpanFrom(expr)
            };
          } else {
            expr = {
              kind: "Member",
              object: expr,
              property,
              optional: false,
              span: this.createSpanFrom(expr)
            };
          }
        }
        continue;
      } else if (this.check(".") && this.peekNext()?.value === "*") {
        // Handle case where .* was lexed as two separate tokens
        this.advance(); // consume .
        this.advance(); // consume *
        if (this.match(".")) {
          const property = this.parseIdentifier();
          // Create a compound member access: (*obj).field
          expr = {
            kind: "Member",
            object: {
              kind: "Unary",
              op: "*",
              argument: expr,
              prefix: true,
              span: expr.span
            },
            property,
            optional: false,
            span: this.createSpanFrom(expr)
          };
        } else {
          // Just pointer dereference
          expr = {
            kind: "Unary",
            op: "*",
            argument: expr,
            prefix: true,
            span: this.createSpanFrom(expr)
          };
        }
        continue;
      }
      
      // Postfix increment/decrement
      if (this.match("++", "--")) {
        const op = this.previous();
        expr = {
          kind: "Unary",
          op: op?.value || "",
          argument: expr,
          prefix: false,
          span: this.createSpanFrom(expr)
        };
        continue;
      }
      
      // Non-null assertion operator (TypeScript)
      if (this.check("!")) {
        const next = this.peekNext();
        if (!next || !this.isUnaryOp(next)) {
          // Only treat ! as postfix if not followed by another unary operator
          this.advance(); // consume !
          expr = {
            kind: "Unary",
            op: "!",
            argument: expr,
            prefix: false,
            span: this.createSpanFrom(expr)
          };
          continue;
        }
      }
      
      break;
    }
    
    return expr;
  }
  
  // Helper methods for specific constructs
  private parseImport(): AST.Import {
    const start = this.current - 1;
    
    // Handle TypeScript-style imports: import { ... } from '...' or import * as ... from '...'
    let alias: AST.Identifier | undefined;
    let path: string;
    
    // Check for destructured imports: import { Token, TokenType } from './lexer'
    if (this.check("{")) {
      this.advance();
      // Skip the destructured imports for now - just consume until }
      while (!this.check("}") && !this.isAtEnd()) {
        this.advance();
      }
      if (this.check("}")) {
        this.advance();
      }
      
      // Expect 'from'
      if (this.match("from")) {
        // Get the path
        if (this.peek().type === TokenType.StringLiteral) {
          const token = this.advance();
          path = token.value.slice(1, -1);
        } else {
          throw this.error(this.peek(), "Expected import path after 'from'");
        }
      } else {
        throw this.error(this.peek(), "Expected 'from' after import specifiers");
      }
    }
    // Check for namespace import: import * as AST from './ast'
    else if (this.check("*")) {
      this.advance();
      if (this.match("as")) {
        alias = this.parseIdentifier();
      }
      
      // Expect 'from'
      if (this.match("from")) {
        // Get the path
        if (this.peek().type === TokenType.StringLiteral) {
          const token = this.advance();
          path = token.value.slice(1, -1);
        } else {
          throw this.error(this.peek(), "Expected import path after 'from'");
        }
      } else {
        throw this.error(this.peek(), "Expected 'from' after namespace import");
      }
    }
    // Check for default import with destructured: import React, { Component } from 'react'
    else if (this.peek().type === TokenType.Identifier) {
      const maybeDefault = this.peek();
      const nextToken = this.peekNext();
      
      if (nextToken && nextToken.value === ",") {
        // Default import with destructured
        alias = this.parseIdentifier();
        this.consume(",", "Expected ','");
        
        // Skip destructured part
        if (this.check("{")) {
          this.advance();
          while (!this.check("}") && !this.isAtEnd()) {
            this.advance();
          }
          if (this.check("}")) {
            this.advance();
          }
        }
        
        // Expect 'from'
        if (this.match("from")) {
          // Get the path
          if (this.peek().type === TokenType.StringLiteral) {
            const token = this.advance();
            path = token.value.slice(1, -1);
          } else {
            throw this.error(this.peek(), "Expected import path after 'from'");
          }
        } else {
          throw this.error(this.peek(), "Expected 'from' after import specifiers");
        }
      }
      // Simple import: import 'module' or import module
      else if (nextToken && nextToken.value === "from") {
        // Default import: import Parser from './parser'
        alias = this.parseIdentifier();
        this.consume("from", "Expected 'from'");
        
        if (this.peek().type === TokenType.StringLiteral) {
          const token = this.advance();
          path = token.value.slice(1, -1);
        } else {
          throw this.error(this.peek(), "Expected import path after 'from'");
        }
      }
      // Old-style simple import
      else {
        path = this.advance().value;
        if (this.match("as")) {
          alias = this.parseIdentifier();
        }
      }
    }
    // String literal import: import './styles.css' or import "module" as alias
    else if (this.peek().type === TokenType.StringLiteral) {
      const token = this.advance();
      path = token.value.slice(1, -1);
      
      // Check for Python-style import alias: import "module" as mod
      if (this.match("as")) {
        alias = this.parseIdentifier();
      }
    } else {
      throw this.error(this.peek(), "Expected import path");
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "Import",
      path: path!,
      alias,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseVarDecl(): AST.VarDecl {
    const start = this.current - 1;
    const names = this.parseIdentifierList();
    
    let type: AST.TypeNode | undefined;
    if (this.match(":")) {
      type = this.parseType();
    }
    
    let values: AST.Expr[] | undefined;
    if (this.match("=")) {
      values = this.parseExpressionList();
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "VarDecl",
      names,
      type,
      values,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseConstDecl(): AST.ConstDecl {
    const start = this.current - 1;
    const names = this.parseIdentifierList();
    
    let type: AST.TypeNode | undefined;
    if (this.match(":")) {
      type = this.parseType();
    }
    
    this.consume("=", "Const declaration requires initialization");
    const values = this.parseExpressionList();
    
    this.consumeSemicolon();
    
    return {
      kind: "ConstDecl",
      names,
      type,
      values,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private peekAhead(value: string): boolean {
    // Look ahead to see if a specific token appears after destructuring pattern
    const checkpoint = this.current;
    let depth = 0;
    
    // Skip the destructuring pattern
    if (this.peek().value === "{" || this.peek().value === "[") {
      const openBracket = this.peek().value;
      const closeBracket = openBracket === "{" ? "}" : "]";
      this.advance();
      depth = 1;
      
      while (depth > 0 && !this.isAtEnd()) {
        if (this.peek().value === openBracket) depth++;
        else if (this.peek().value === closeBracket) depth--;
        this.advance();
      }
      
      // Check if the next token is what we're looking for
      const found = this.peek().value === value;
      this.current = checkpoint;
      return found;
    }
    
    this.current = checkpoint;
    return false;
  }
  
  private parseDestructuringShortDecl(): AST.ShortDecl {
    const start = this.current;
    
    // Parse the destructuring pattern
    const pattern = this.parseExpression(); // This will parse {x, y, ...rest} or [a, b, c]
    
    this.consume(":=", "Expected ':=' in destructuring declaration");
    
    const value = this.parseExpression();
    
    this.consumeSemicolon();
    
    // For now, treat it as a single short declaration with a complex pattern
    // In a real implementation, we'd extract the individual bindings
    return {
      kind: "ShortDecl",
      pairs: [{
        name: {
          kind: "Identifier",
          name: "__destructured",
          span: pattern.span
        },
        expr: {
          kind: "Assign",
          left: pattern,
          right: value,
          op: "=",
          span: this.createSpan(start, this.current - 1)
        }
      }],
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseShortDecl(): AST.ShortDecl {
    const start = this.current;
    const pairs: AST.ShortDeclPair[] = [];
    
    // Check if this might be a destructuring pattern
    const checkpoint = this.current;
    const firstToken = this.peek();
    
    if (firstToken.type === TokenType.Identifier) {
      const name = this.parseIdentifier();
      this.consume(":=", "Expected ':=' in short declaration");
      const expr = this.parseExpression();
      
      // For single identifier short declarations
      pairs.push({ name, expr });
      
      while (this.match(",")) {
        const nextName = this.parseIdentifier();
        this.consume(":=", "Expected ':=' in short declaration");
        const nextExpr = this.parseExpression();
        pairs.push({ name: nextName, expr: nextExpr });
      }
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "ShortDecl",
      pairs,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseFuncDecl(async = false, unsafe = false, generator = false): AST.FuncDecl {
    const start = this.current - 1;
    
    const name = this.parseIdentifier();
    
    // Parse generic parameters if present
    let genericParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      genericParams = [];
      do {
        genericParams.push(this.parseIdentifier());
      } while (this.match(","));
      this.consume(">", "Expected '>' after generic parameters");
    }
    
    const params = this.parseParameterList();
    
    let returnType: AST.TypeNode | undefined;
    
    // Check for return type annotations
    if (this.match("->")) {
      // Arrow notation always indicates return type
      returnType = this.parseType();
      // After parsing return type, check for Python-style colon
      if (!this.check(":") && !this.check("{") && !this.check("=>")) {
        // If no block starter follows, this might be an error
      }
    } else if (this.check(":")) {
      // Colon could be either type annotation or Python-style block
      // Check if next token after colon indicates an indent block
      const checkpoint = this.current;
      this.advance(); // consume ':'
      
      // Check what comes after the colon
      const nextToken = this.peek();
      const prevIndent = this.tokens[checkpoint]?.indentCol ?? 0;
      const nextIndent = nextToken.indentCol;
      
      if (nextToken.virtualSemi || 
          (nextIndent !== undefined && nextIndent > prevIndent)) {
        // This is a Python-style indented block
        // parseIndentBlock will handle the rest
      } else if (this.check("return") || this.check("pass") || 
                 this.check("raise") || this.check("yield") ||
                 this.check("this") || this.check("super")) {
        // Single-line Python function body or statement starting with this/super
        // Don't parse as type, this is a statement
      } else {
        // This is a type annotation
        returnType = this.parseType();
      }
    }
    
    let body: AST.Block;
    if (this.match("=>")) {
      body = this.parseExpressionBody();
    } else if (this.match(":") || this.previous()?.value === ":") {
      // Python-style block with colon (handles both direct : and -> Type: cases)
      // Note: previous check handles case where : was already consumed in type checking
      const currentIndent = this.current > 0 ? (this.tokens[this.current - 1]?.indentCol ?? 0) : 0;
      const peekIndent = this.peek().indentCol;
      if (this.peek().virtualSemi || 
          (peekIndent !== undefined && peekIndent > currentIndent)) {
        // Indented block
        body = this.parseIndentBlock();
      } else {
        // Single-line Python body
        const stmt = this.parseStatement();
        body = {
          kind: "Block",
          statements: stmt ? [stmt] : [],
          span: this.createSpanFrom(stmt || this.previous())
        };
      }
    } else if (this.check("{")) {
      body = this.parseBlock();
    } else {
      // Ruby-style def without braces - parse until 'end'
      const statements: (AST.Decl | AST.Stmt)[] = [];
      while (!this.check("end") && !this.isAtEnd()) {
        if (this.peek().virtualSemi) {
          this.advance();
          continue;
        }
        
        try {
          const stmt = this.parseTopLevel();
          if (stmt) statements.push(stmt);
        } catch (error) {
          if (error instanceof ParseError) {
            this.errors.push(error);
            this.synchronize();
          } else {
            throw error;
          }
        }
      }
      
      this.consume("end", "Expected 'end' to close function");
      
      body = {
        kind: "Block",
        statements,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    return {
      kind: "FuncDecl",
      name,
      genericParams,
      params,
      returnType,
      async,
      unsafe,
      generator,
      body: body as AST.Block,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseFuncDeclWithReturnTypeBefore(): AST.FuncDecl {
    const start = this.current;
    const returnType = this.parseType();
    const name = this.parseIdentifier();
    const params = this.parseParameterList();
    
    const body = this.match("=>") ? 
      this.parseExpressionBody() : 
      this.parseBlock();
    
    return {
      kind: "FuncDecl",
      name,
      genericParams: undefined,
      params,
      returnType,
      async: false,
      unsafe: false,
      body: body as AST.Block,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseParameterList(): AST.Param[] {
    this.consume("(", "Expected '(' before parameters");
    const params: AST.Param[] = [];
    
    // Skip virtual semicolons before first parameter
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    if (!this.check(")")) {
      do {
        params.push(this.parseParameter());
        
        // Skip virtual semicolons after parameter
        while (this.peek().virtualSemi) {
          this.advance();
        }
      } while (this.match(","));
    }
    
    // Skip virtual semicolons before closing paren
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    this.consume(")", "Expected ')' after parameters");
    return params;
  }
  
  private parseParameter(): AST.Param {
    const start = this.current;
    
    // Skip parameter decorators (e.g., @NotNull, @Range(...))
    // These aren't part of the spec but we need to handle them gracefully
    while (this.check("@")) {
      this.advance(); // consume @
      
      // Skip the decorator name
      if (this.peek().type === TokenType.Identifier) {
        this.advance();
        
        // Skip decorator arguments if present
        if (this.check("(")) {
          this.advance(); // consume (
          let depth = 1;
          while (depth > 0 && !this.isAtEnd()) {
            if (this.check("(")) {
              depth++;
            } else if (this.check(")")) {
              depth--;
            }
            this.advance();
          }
        }
      }
    }
    
    // Handle TypeScript visibility modifiers in constructor params
    let visibility: "public" | "private" | "protected" | undefined;
    if (this.match("public", "private", "protected")) {
      visibility = this.previous()!.value as any;
    }
    
    // Handle readonly modifier  
    let readonly = false;
    if (this.match("readonly")) {
      readonly = true;
    }
    
    // Handle Ruby-style block parameter (&param)
    let isBlockParam = false;
    if (this.match("&")) {
      isBlockParam = true;
    }
    
    // Handle spread parameter (...param)
    let isSpread = false;
    if (this.match("...")) {
      isSpread = true;
    }
    
    // Parse parameter name - allow keywords as parameter names
    let name: AST.Identifier;
    const token = this.peek();
    
    // In parameter context, allow any keyword or identifier as parameter name
    if (token.type === TokenType.Identifier || 
        token.type === TokenType.Keyword ||
        token.type === TokenType.SigilIdentifier) {
      this.advance();
      name = {
        kind: "Identifier",
        name: token.value,
        originalSpelling: token.value,
        span: this.createSpanFrom(token)
      };
    } else {
      // Fall back to regular identifier parsing for error reporting
      name = this.parseIdentifier();
    }
    
    // Handle optional parameter marker (?)
    let optional = false;
    if (this.match("?")) {
      optional = true;
    }
    
    let type: AST.TypeNode | undefined;
    if (this.match(":")) {
      type = this.parseType();
    }
    
    let defaultValue: AST.Expr | undefined;
    if (this.match("=")) {
      defaultValue = this.parseExpression();
    }
    
    return {
      name,
      type,
      defaultValue,
      visibility,
      readonly,
      spread: isSpread,
      blockParam: isBlockParam,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseExpressionBody(): AST.Block {
    const expr = this.parseExpression();
    return {
      kind: "Block",
      statements: [{
        kind: "Return",
        values: [expr],
        span: expr.span
      }],
      span: expr.span
    };
  }
  
  // Control flow parsing
  private parseIf(): AST.If {
    const start = this.current - 1;
    const arms: AST.IfArm[] = [];
    let isBashStyle = false;
    
    // First if condition
    // Check if this is a bash-style test expression with [ ... ]
    let test: AST.Expr;
    if (this.check("[")) {
      // Bash test expression
      test = this.parseBashTestExpression();
    } else {
      test = this.parseExpression();
    }
    
    // Check for Python-style colon
    if (this.match(":")) {
      // Indent-based block
      const body = this.parseIndentBlock();
      arms.push({ test, body, span: this.createSpan(start, this.current - 1) });
    } else if (this.check(";") && this.peekNext()?.value === "then") {
      // Bash-style: if condition; then ... fi
      this.advance(); // consume ;
      this.consume("then", "Expected 'then' after if condition in bash-style");
      const body = this.parseIfThenBlock();
      arms.push({ test, body, span: this.createSpan(start, this.current - 1) });
      isBashStyle = true;
    } else if (this.match("then")) {
      // Bash-style without semicolon: if condition then ... fi
      const body = this.parseIfThenBlock();
      arms.push({ test, body, span: this.createSpan(start, this.current - 1) });
      isBashStyle = true;
    } else {
      // Regular block or single statement
      const body = this.parseBlockOrStatement();
      arms.push({ test, body, span: this.createSpan(start, this.current - 1) });
    }
    
    // elif/elseif clauses
    while (this.match("elif", "elseif")) {
      const elifTest = this.parseExpression();
      
      let elifBody: AST.Block;
      if (this.match(":")) {
        elifBody = this.parseIndentBlock();
      } else if (isBashStyle && (this.match(";") || this.match("then"))) {
        if (this.previous()?.value === ";") {
          this.consume("then", "Expected 'then' after elif condition");
        }
        elifBody = this.parseIfThenBlock();
      } else {
        // Block or single statement
        elifBody = this.parseBlockOrStatement();
      }
      
      arms.push({ 
        test: elifTest, 
        body: elifBody, 
        span: this.createSpan(this.current - 1, this.current) 
      });
    }
    
    // else clause
    let elseBody: AST.Block | undefined;
    if (this.match("else")) {
      // Check for 'else if' (two separate keywords)
      if (this.match("if")) {
        // Handle 'else if' as another if statement
        // parseIf expects 'if' to have been already matched
        const elseIf = this.parseIf();
        // Wrap the else-if in a block
        elseBody = {
          kind: "Block",
          statements: [elseIf],
          span: elseIf.span
        };
      } else if (this.match(":")) {
        elseBody = this.parseIndentBlock();
      } else if (isBashStyle) {
        elseBody = this.parseIfThenBlock();
      } else {
        // Block or single statement
        elseBody = this.parseBlockOrStatement();
      }
    }
    
    // Consume 'fi' for bash-style if statements
    if (isBashStyle) {
      this.consume("fi", "Expected 'fi' to close if statement");
    }
    
    return {
      kind: "If",
      arms,
      elseBody,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseSwitch(): AST.Switch {
    const start = this.current - 1;
    const isMatch = this.previous()?.value === "match";
    const discriminant = this.parseExpression();
    const cases: AST.SwitchCase[] = [];
    let defaultCase: AST.Block | undefined;
    
    // Set flag to indicate we're inside a switch
    const wasInsideSwitch = this.insideSwitch;
    this.insideSwitch = true;
    
    // Support both { } and : styles
    const isPythonStyle = this.check(":");
    let baseIndent = 0;
    if (isPythonStyle) {
      this.consume(":", "Expected ':' after match expression");
      // Get the indentation level for Python-style match
      baseIndent = this.tokens[this.current - 1]?.indentCol ?? 0;
      
      // Skip to next line if there's a virtual semicolon
      while (this.peek().virtualSemi) {
        this.advance();
      }
    } else {
      this.consume("{", "Expected '{' after switch expression");
    }
    
    // Loop condition depends on style
    while (!this.isAtEnd()) {
      // For Python style, check if we've dedented back
      if (isPythonStyle) {
        const currentIndent = this.peek().indentCol;
        if (currentIndent !== undefined && currentIndent <= baseIndent) {
          // We've dedented, exit the match block
          break;
        }
      } else {
        // For brace style, check for closing brace
        if (this.check("}")) {
          break;
        }
      }
      
      // Skip virtual semicolons
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      // Check again after skipping virtual semicolons
      if (!isPythonStyle && this.check("}")) {
        break;
      }
      if (this.isAtEnd()) {
        break;
      }
      
      const caseStart = this.current;
      
      // Handle default case
      if (this.match("default")) {
        this.consume(":", "Expected ':' after default");
        defaultCase = this.parseCaseBody();
        
        // Check for comma in match expressions
        if (isMatch && this.check(",")) {
          this.advance();
        }
        continue;
      }
      
      // Handle regular case
      const patterns: AST.Expr[] = [];
      
      // Check for wildcard default in match expressions
      if (isMatch && this.check("_")) {
        const wildcardStart = this.current;
        this.advance(); // consume _
        
        // Skip virtual semicolons
        while (this.peek().virtualSemi) {
          this.advance();
        }
        
        if (this.check("=>")) {
          // This is a wildcard default case
          this.consume("=>", "Expected '=>' after wildcard pattern");
          defaultCase = this.parseMatchCaseBody();
          
          // Check for comma in match expressions
          if (this.check(",")) {
            this.advance();
          }
          continue;
        } else {
          // Not a wildcard, backtrack
          this.current = wildcardStart;
        }
      }
      
      if (this.match("case")) {
        // Traditional switch case
        patterns.push(this.parseExpression());
        while (this.match(",")) {
          patterns.push(this.parseExpression());
        }
      } else if (isMatch && !this.check("}")) {
        // Match expression case - parse pattern directly
        patterns.push(this.parseMatchPattern());
        
        // Handle alternative patterns with |
        while (this.match("|")) {
          patterns.push(this.parseMatchPattern());
        }
      } else {
        // No more cases
        break;
      }
      
      // Check for guard clause (if condition)
      let guard: AST.Expr | undefined;
      if (this.match("if")) {
        guard = this.parseExpression();
      }
      
      // Match can use either => or : depending on style
      if (isMatch && !isPythonStyle) {
        this.consume("=>", "Expected '=>' after match pattern");
      } else {
        this.consume(":", "Expected ':' after case pattern");
      }
      
      const body = isMatch ? this.parseMatchCaseBody() : this.parseCaseBody();
      
      // Check for fallthrough
      const fallthrough = this.checkFallthrough();
      
      cases.push({
        patterns,
        guard,
        body,
        fallthrough,
        span: this.createSpan(caseStart, this.current - 1)
      });
      
      // In match expressions, cases can be separated by commas
      if (isMatch && this.check(",")) {
        this.advance(); // consume comma
        // Continue to next case
      }
    }
    
    // Only expect closing brace for non-Python style
    if (!isPythonStyle) {
      this.consume("}", "Expected '}' after switch body");
    }
    
    // Restore switch context flag
    this.insideSwitch = wasInsideSwitch;
    
    return {
      kind: "Switch",
      discriminant,
      cases,
      defaultCase,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseMatchPattern(): AST.Expr {
    const start = this.current;
    
    // Skip virtual semicolons
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    // Check for wildcard pattern _
    if (this.match("_")) {
      return {
        kind: "Identifier",
        name: "_",
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Check for literal patterns (numbers, strings, booleans)
    if (this.peek().type === TokenType.NumericLiteral) {
      return this.parseNumericLiteral();
    }
    
    if (this.peek().type === TokenType.StringLiteral) {
      return this.parseStringLiteral();
    }
    
    if (this.match("true", "false")) {
      const token = this.previous();
      return {
        kind: "BooleanLiteral",
        value: token?.value === "true",
        span: this.createSpanFrom(token!)
      };
    }
    
    if (this.match("null", "undefined", "nil", "None")) {
      return {
        kind: "NullLiteral",
        span: this.createSpanFrom(this.previous()!)
      };
    }
    
    // Check for array/list patterns [head, ...tail]
    if (this.match("[")) {
      return this.parseArrayLiteral();
    }
    
    // Check for object patterns {type: "user", name}
    if (this.match("{")) {
      return this.parseObjectLiteral();
    }
    
    // Parse constructor pattern like Some(v) or simple identifier
    const id = this.parseIdentifier();
    
    // Check for constructor pattern with arguments
    if (this.match("(")) {
      const args: AST.Expr[] = [];
      
      if (!this.check(")")) {
        do {
          // Parse binding variable or nested pattern
          args.push(this.parseExpression());
        } while (this.match(","));
      }
      
      this.consume(")", "Expected ')' after constructor arguments");
      
      return {
        kind: "Call",
        callee: id,
        args,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    return id;
  }
  
  private parseCaseBody(): AST.Block {
    const statements: (AST.Decl | AST.Stmt)[] = [];
    
    while (!this.check("case") && !this.check("default") && 
           !this.check("}") && !this.isAtEnd()) {
      const stmt = this.parseTopLevel();
      if (stmt) statements.push(stmt);
      
      // Check for break statement
      if (stmt && stmt.kind === "Break") {
        break;
      }
    }
    
    return {
      kind: "Block",
      statements,
      span: this.createSpanFrom(statements[0] || this.previous())
    };
  }
  
  private parseMatchCaseBody(): AST.Block {
    // For match expressions, the body is typically a single expression
    // It can be a block {...} or just an expression
    if (this.check("{")) {
      return this.parseBlock();
    }
    
    // Parse single expression but not comma operator at this level
    // In match cases, comma separates cases, not expressions
    const expr = this.parseAssignmentExpression();
    
    // Check for comma (next case) but don't consume it
    // The main loop will handle advancing past the comma
    if (this.check(",")) {
      // Don't consume - let the main loop handle it
    }
    
    return {
      kind: "Block",
      statements: [{
        kind: "ExprStmt",
        expr,
        span: expr.span
      }],
      span: expr.span
    };
  }
  
  private checkFallthrough(): boolean {
    // Check for fallthrough token or comment
    const next = this.peek();
    if (next.type === TokenType.Keyword && next.value === "fallthrough") {
      this.advance();
      this.consumeSemicolon();
      return true;
    }
    
    // Check for // fallthrough comment
    // This would need to be tracked during lexing
    return false;
  }
  
  private parseDoStatement(): AST.Stmt {
    const start = this.current - 1;
    const startToken = this.tokens[start - 1]; // The 'do' token
    
    // Parse the block
    const body = this.parseBlock();
    
    // Check what comes after the block
    if (this.match("while")) {
      // This is a JavaScript-style do-while loop
      this.consume("(", "Expected '(' after 'while' in do-while loop");
      const test = this.parseExpression();
      this.consume(")", "Expected ')' after condition in do-while loop");
      
      // Optional semicolon after do-while
      this.consumeSemicolon();
      
      return {
        kind: "Loop",
        mode: "do-while",
        body,
        test,
        span: this.createSpan(start, this.current - 1)
      };
    } else if (this.check("done")) {
      // This would be a bash-style do-done block
      // For now, treat it as a simple block statement
      this.consume("done", "Expected 'done' to close do block");
      return {
        kind: "Block",
        statements: body.statements,
        span: this.createSpan(start, this.current - 1)
      };
    } else {
      // Error: 'do' must be followed by either 'while' or 'done'
      throw this.error(this.peek(), "Expected 'while' or 'done' after do block");
    }
  }
  
  private parseLoop(): AST.Loop {
    const start = this.current - 1;
    const keyword = this.previous()?.value || "";
    
    if (keyword === "loop") {
      // Infinite loop
      const body = this.parseBlock();
      return {
        kind: "Loop",
        mode: "infinite",
        body,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    if (keyword === "for") {
      // Check for await
      const isAwait = this.match("await");
      
      // Check for foreach-style
      if (this.peek().type === TokenType.Identifier || (isAwait && this.check("("))) {
        if (isAwait) {
          // for await (const item of stream)
          this.consume("(", "Expected '(' after 'for await'");
          
          // Parse variable declaration (const/let/var item)
          let variable: AST.Identifier;
          if (this.match("const", "let", "var")) {
            variable = this.parseIdentifier();
          } else {
            variable = this.parseIdentifier();
          }
          
          this.consume("of", "Expected 'of' in for-await loop");
          const iterable = this.parseExpression();
          this.consume(")", "Expected ')' after for-await");
          const body = this.parseBlock();
          
          return {
            kind: "Loop",
            mode: "foreach",
            variable,
            iterable,
            body,
            await: true,
            span: this.createSpan(start, this.current - 1)
          };
        } else {
          const checkpoint = this.current;
          const id = this.advance();
          if (this.match("in")) {
            // foreach style: for x in collection
            const variable = {
              kind: "Identifier" as const,
              name: id.value,
              span: this.createSpanFrom(id)
            };
            const iterable = this.parseExpression();
            const body = this.parseBlockOrStatement();
            return {
              kind: "Loop",
              mode: "foreach",
              variable,
              iterable,
              body,
              span: this.createSpan(start, this.current - 1)
            };
          }
          this.current = checkpoint;
        }
      }
      
      // Check for Go-style for loop (without parentheses)
      // Look for pattern: identifier := 
      if (this.peek().type === TokenType.Identifier && this.peekAt(1)?.value === ":=") {
        // Go-style for loop without parentheses
        // Parse init statement manually to avoid consuming semicolon
        const initStart = this.current;
        const name = this.parseIdentifier();
        this.consume(":=", "Expected ':=' in for init");
        const expr = this.parseExpression();
        const init: AST.ShortDecl = {
          kind: "ShortDecl",
          pairs: [{ name, expr }],
          span: this.createSpan(initStart, this.current - 1)
        };
        
        this.consume(";", "Expected ';' after init");
        
        let test: AST.Expr | undefined;
        if (!this.check(";")) {
          test = this.parseExpression();
        }
        this.consume(";", "Expected ';' after loop condition");
        
        let step: AST.Expr | undefined;
        if (!this.check("{")) {
          step = this.parseExpression();
        }
        
        const body = this.parseBlockOrStatement();
        
        return {
          kind: "Loop",
          mode: "for",
          init,
          test,
          step,
          body,
          span: this.createSpan(start, this.current - 1)
        };
      }
      
      // Traditional for loop with parentheses
      this.consume("(", "Expected '(' after 'for'");
      
      // Check for for-of/for-in loops with const/let/var
      if (this.check("const") || this.check("let") || this.check("var")) {
        const checkpoint = this.current;
        const declKeyword = this.advance(); // consume const/let/var
        
        if (this.peek().type === TokenType.Identifier) {
          const variable = this.parseIdentifier();
          
          // Check for 'of' or 'in'
          if (this.match("of", "in")) {
            const iterType = this.previous()?.value; // "of" or "in"
            const iterable = this.parseExpression();
            this.consume(")", "Expected ')' after for-of/for-in");
            const body = this.parseBlockOrStatement();
            
            return {
              kind: "Loop",
              mode: "foreach",
              variable,
              iterable,
              body,
              span: this.createSpan(start, this.current - 1)
            };
          }
        }
        
        // Not a for-of/for-in, restore position and parse normally
        this.current = checkpoint;
      }
      
      // Check for for-of/for-in without const/let/var (just identifier)
      if (this.peek().type === TokenType.Identifier) {
        const checkpoint = this.current;
        const variable = this.parseIdentifier();
        
        if (this.match("of", "in")) {
          const iterType = this.previous()?.value; // "of" or "in"
          const iterable = this.parseExpression();
          this.consume(")", "Expected ')' after for-of/for-in");
          const body = this.parseBlockOrStatement();
          
          return {
            kind: "Loop",
            mode: "foreach",
            variable,
            iterable,
            body,
            span: this.createSpan(start, this.current - 1)
          };
        }
        
        // Not a for-of/for-in, restore position
        this.current = checkpoint;
      }
      
      let init: AST.Stmt | AST.Decl | undefined;
      if (!this.check(";")) {
        if (this.isDeclStart()) {
          init = this.parseDeclaration();
        } else {
          init = this.parseExprStmt();
        }
      } else {
        this.advance(); // consume ';'
      }
      
      // Skip virtual semicolons that might appear
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      let test: AST.Expr | undefined;
      if (!this.check(";")) {
        test = this.parseExpression();
      }
      this.consume(";", "Expected ';' after loop condition");
      
      let step: AST.Expr | undefined;
      if (!this.check(")")) {
        step = this.parseExpression();
      }
      
      this.consume(")", "Expected ')' after for clauses");
      const body = this.parseBlockOrStatement();
      
      return {
        kind: "Loop",
        mode: "for",
        init,
        test,
        step,
        body,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    if (keyword === "while") {
      // Check if this is a bash-style test expression with [ ... ]
      let test: AST.Expr;
      if (this.check("[")) {
        // Bash test expression
        test = this.parseBashTestExpression();
      } else {
        test = this.parseExpression();
      }
      
      // Skip optional semicolon before do (bash style: while [ test ]; do)
      if (this.check(";") && this.peekNext()?.value === "do") {
        this.advance(); // consume semicolon
      }
      
      // Check for keyword block (do...done)
      let body: AST.Block;
      if (this.match("do")) {
        body = this.parseKeywordBlock("do");
      } else {
        body = this.parseBlockOrStatement();
      }
      
      return {
        kind: "Loop",
        mode: "while",
        test,
        body,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    if (keyword === "until") {
      // Check if this is a bash-style test expression with [ ... ]
      let test: AST.Expr;
      if (this.check("[")) {
        // Bash test expression
        test = this.parseBashTestExpression();
      } else {
        test = this.parseExpression();
      }
      
      // Skip optional semicolon before do (bash style: until [ test ]; do)
      if (this.check(";") && this.peekNext()?.value === "do") {
        this.advance(); // consume semicolon
      }
      
      // Check for keyword block (do...done)
      let body: AST.Block;
      if (this.match("do")) {
        body = this.parseKeywordBlock("do");
      } else {
        body = this.parseBlockOrStatement();
      }
      return {
        kind: "Loop",
        mode: "until",
        test,
        body,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    throw this.error(this.peek(), "Invalid loop type");
  }
  
  private parseForeach(): AST.Loop {
    const start = this.current - 1;
    const variable = this.parseIdentifier();
    this.consume("in", "Expected 'in' in foreach loop");
    const iterable = this.parseExpression();
    
    // Check for do/done keyword block
    let body: AST.Block;
    if (this.match("do")) {
      body = this.parseKeywordBlock("do");
    } else {
      body = this.parseBlockOrStatement();
    }
    
    return {
      kind: "Loop",
      mode: "foreach",
      variable,
      iterable,
      body,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseTry(): AST.Try {
    const start = this.current - 1;
    
    // Check for Python-style try with colon
    let body: AST.Block;
    if (this.match(":")) {
      // Python-style - parse single statement or indented block
      if (this.checkIndentBlock()) {
        body = this.parseIndentBlock();
      } else {
        // Single statement on same line
        const stmt = this.parseStatement();
        body = {
          kind: "Block",
          statements: [stmt],
          span: stmt.span
        };
      }
    } else {
      body = this.parseBlock();
    }
    
    const catches: AST.CatchClause[] = [];
    
    while (this.match("catch", "except", "rescue")) {
      const clauseType = this.previous()?.value; // Remember which keyword we matched
      let param: AST.Identifier | undefined;
      let type: AST.TypeNode | undefined;
      
      // Check for Python-style except/rescue with colon
      if (clauseType === "except" && this.check(":")) {
        // Python-style except: or except Exception:
        // First check if there's an exception type before the colon
        if (this.peek().type === TokenType.Identifier && !this.check(":")) {
          type = this.parseType();
          if (this.match("as")) {
            param = this.parseIdentifier();
          }
        }
        this.consume(":", "Expected ':' after except clause");
        
        // Parse except body
        let catchBody: AST.Block;
        if (this.checkIndentBlock()) {
          catchBody = this.parseIndentBlock();
        } else {
          // Single statement (often 'pass')
          const stmt = this.parseStatement();
          catchBody = {
            kind: "Block",
            statements: [stmt],
            span: stmt.span
          };
        }
        catches.push({
          param,
          type,
          body: catchBody,
          span: this.createSpan(this.current - 1, this.current)
        });
      } else if (clauseType === "rescue") {
        // Ruby-style rescue Type => var or just rescue
        if (this.peek().type === TokenType.Identifier && !this.check("=>")) {
          type = this.parseType();
        }
        
        if (this.match("=>")) {
          param = this.parseIdentifier();
        }
        
        // Parse rescue body (statements until next rescue/ensure/end)
        const rescueStatements: (AST.Decl | AST.Stmt)[] = [];
        while (!this.check("rescue") && !this.check("ensure") && !this.check("end") && 
               !this.check("finally") && !this.check("except") && !this.isAtEnd()) {
          if (this.peek().virtualSemi) {
            this.advance();
            continue;
          }
          const beforePos = this.current;
          try {
            const stmt = this.parseTopLevel();
            if (stmt) rescueStatements.push(stmt);
          } catch (error) {
            if (error instanceof ParseError) {
              this.errors.push(error);
              this.synchronize();
            } else {
              throw error;
            }
          }
          // Prevent infinite loop - if we didn't advance, force advance
          if (this.current === beforePos) {
            this.advance();
          }
        }
        
        catches.push({
          param,
          type,
          body: {
            kind: "Block",
            statements: rescueStatements,
            span: this.createSpan(this.current - 1, this.current)
          },
          span: this.createSpan(this.current - 1, this.current)
        });
      } else if (this.match("(")) {
        // Traditional catch with parentheses
        if (!this.check(")")) {
          param = this.parseIdentifier();
          if (this.match(":")) {
            type = this.parseType();
          }
        }
        this.consume(")", "Expected ')' after catch clause");
        
        const catchBody = this.parseBlock();
        catches.push({
          param,
          type,
          body: catchBody,
          span: this.createSpan(this.current - 1, this.current)
        });
      } else {
        // No parentheses or colon, parse block directly
        const catchBody = this.parseBlock();
        catches.push({
          param,
          type,
          body: catchBody,
          span: this.createSpan(this.current - 1, this.current)
        });
      }
    }
    
    let finallyBody: AST.Block | undefined;
    if (this.match("finally")) {
      // Check for Python-style finally with colon
      if (this.match(":")) {
        if (this.checkIndentBlock()) {
          finallyBody = this.parseIndentBlock();
        } else {
          const stmt = this.parseStatement();
          finallyBody = {
            kind: "Block",
            statements: [stmt],
            span: stmt.span
          };
        }
      } else {
        finallyBody = this.parseBlock();
      }
    }
    
    return {
      kind: "Try",
      body,
      catches,
      finallyBody,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseUsing(): AST.Using {
    const start = this.current - 1;
    
    let resource: AST.Expr | AST.Decl;
    
    // Parse the resource expression
    const expr = this.parseExpression();
    
    // Check for Python-style 'as' alias
    if (this.match("as")) {
      const alias = this.parseIdentifier();
      // Create a variable declaration for the alias
      resource = {
        kind: "VarDecl",
        names: [alias],
        values: [expr],
        span: this.createSpan(start, this.current - 1)
      } as AST.VarDecl;
    } else if (this.isDeclStart()) {
      // Rewind and parse as declaration
      this.current = start + 1;
      resource = this.parseDeclaration();
    } else {
      resource = expr;
    }
    
    // Parse body - check for Python-style colon
    let body: AST.Block;
    if (this.match(":")) {
      if (this.checkIndentBlock()) {
        body = this.parseIndentBlock();
      } else {
        // Single statement on same line
        const stmt = this.parseStatement();
        body = {
          kind: "Block",
          statements: [stmt],
          span: stmt.span
        };
      }
    } else {
      body = this.parseBlock();
    }
    
    return {
      kind: "Using",
      resource,
      body,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseDefer(): AST.Defer {
    const start = this.current - 1;
    let body: AST.Block | AST.Expr;
    
    if (this.check("{")) {
      body = this.parseBlock();
    } else {
      body = this.parseExpression();
      this.consumeSemicolon();
    }
    
    return {
      kind: "Defer",
      body,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseBreak(): AST.Break {
    const start = this.current - 1;
    let label: AST.Identifier | undefined;
    
    // Check if next token is an identifier or keyword that could be a label
    if ((this.peek().type === TokenType.Identifier || 
         this.peek().type === TokenType.Keyword) && 
        !this.check(";")) {
      // Parse as label identifier
      const token = this.advance();
      label = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "Break",
      label,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseContinue(): AST.Continue {
    const start = this.current - 1;
    let label: AST.Identifier | undefined;
    
    // Check if next token is an identifier or keyword that could be a label
    if ((this.peek().type === TokenType.Identifier || 
         this.peek().type === TokenType.Keyword) && 
        !this.check(";")) {
      // Parse as label identifier
      const token = this.advance();
      label = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "Continue",
      label,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseReturn(): AST.Return {
    const start = this.current - 1;
    const values: AST.Expr[] = [];
    
    if (!this.checkSemicolon() && !this.isAtEnd()) {
      values.push(...this.parseExpressionList());
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "Return",
      values,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseAssert(): AST.ExprStmt {
    const start = this.current - 1;
    
    // Parse the condition expression
    const condition = this.parseExpression();
    
    // Optional: parse comma and message (Python style: assert x == 1, "message")
    let message: AST.Expr | undefined;
    if (this.match(",")) {
      message = this.parseExpression();
    }
    
    this.consumeSemicolon();
    
    // Create an assert as a call expression wrapped in an expression statement
    const assertCall: AST.Call = {
      kind: "Call",
      callee: {
        kind: "Identifier",
        name: "assert",
        span: this.createSpan(start, start)
      },
      args: message ? [condition, message] : [condition],
      span: this.createSpan(start, this.current - 1)
    };
    
    return {
      kind: "ExprStmt",
      expr: assertCall,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseEcho(): AST.Echo {
    const start = this.current - 1;
    const values = this.parseExpressionList();
    this.consumeSemicolon();
    
    return {
      kind: "Echo",
      values,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseThrow(): AST.Throw {
    const start = this.current - 1;
    const value = this.parseExpression();
    this.consumeSemicolon();
    
    return {
      kind: "Throw",
      value,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseYield(): AST.Yield {
    const start = this.current - 1;
    let value: AST.Expr | undefined;
    let delegate = false;
    
    if (this.match("*")) {
      delegate = true;
    }
    
    if (!this.checkSemicolon() && !this.isAtEnd()) {
      value = this.parseExpression();
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "Yield",
      value,
      delegate,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseYieldExpression(): AST.Yield {
    const start = this.current - 1;
    let value: AST.Expr | undefined;
    let delegate = false;
    
    // Check for yield* or yield from
    if (this.match("*")) {
      delegate = true;
    } else if (this.match("from")) {
      delegate = true;
    }
    
    // In expression context, parse the value if there is one
    if (!this.check(";") && !this.check(",") && !this.check(")") && 
        !this.check("]") && !this.check("}") && !this.isAtEnd()) {
      value = this.parseAssignmentExpression();
    }
    
    return {
      kind: "Yield",
      value,
      delegate,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseGo(): AST.Go {
    const start = this.current - 1;
    const expr = this.parseExpression();
    this.consumeSemicolon();
    
    return {
      kind: "Go",
      expr,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parsePass(): AST.Pass {
    const start = this.current - 1;
    this.consumeSemicolon();
    
    return {
      kind: "Pass",
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseExprStmt(): AST.ExprStmt | AST.If {
    const expr = this.parseExpression();
    
    // Check for reassignment operator :=:
    if (this.match(":=:")) {
      if (expr.kind !== "Identifier") {
        throw this.error(this.previous()!, "Reassignment requires an identifier");
      }
      const value = this.parseExpression();
      this.consumeSemicolon();
      return {
        kind: "ExprStmt",
        expr: {
          kind: "Assign",
          op: ":=:",
          left: expr,
          right: value,
          span: this.createSpanFrom(expr)
        },
        span: this.createSpanFrom(expr)
      };
    }
    
    // Check for postfix if/unless (Ruby-style)
    if (this.check("if") || this.check("unless")) {
      const modifier = this.peek().value;
      this.advance();
      const condition = this.parseExpression();
      
      // Create an If statement that executes expr if condition is true (or false for unless)
      const ifStmt: AST.If = {
        kind: "If",
        arms: [{
          test: modifier === "unless" ? {
            kind: "Unary",
            op: "!",
            argument: condition,
            prefix: true,
            span: condition.span
          } : condition,
          body: {
            kind: "Block",
            statements: [{
              kind: "ExprStmt",
              expr,
              span: expr.span
            }],
            span: expr.span
          },
          span: this.createSpanFrom(expr)
        }],
        span: this.createSpanFrom(expr)
      };
      
      this.consumeSemicolon();
      
      return ifStmt;
    }
    
    this.consumeSemicolon();
    
    return {
      kind: "ExprStmt",
      expr,
      span: expr.span
    };
  }
  
  // Type parsing
  private parseType(): AST.TypeNode {
    // Check for type predicates: paramName is Type
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      const paramName = this.advance();
      
      if (this.peek().value === "is") {
        this.advance(); // consume 'is'
        const predicateType = this.parseSimpleType();
        
        // Create a type predicate node
        // For now, we'll represent it as a special kind of type
        return {
          kind: "PredicateType",
          param: { 
            kind: "Identifier", 
            name: paramName.value, 
            span: this.createSpan(checkpoint, checkpoint) 
          },
          type: predicateType,
          span: this.createSpan(checkpoint, this.current - 1)
        } as any; // Cast to any since PredicateType may not be in AST yet
      } else {
        // Not a type predicate, backtrack
        this.current = checkpoint;
      }
    }
    
    let type = this.parseSimpleType();
    
    // Handle array type suffix: Type[] or indexed access Type["property"]
    while (this.check("[")) {
      const checkpoint = this.current;
      this.advance(); // consume [
      
      // Check if it's an empty [] for array type
      if (this.check("]")) {
        this.advance(); // consume ]
        // Create a generic type Array<Type>
        type = {
          kind: "GenericType",
          base: { 
            kind: "Identifier", 
            name: "Array", 
            span: this.createSpan(checkpoint, this.current - 1) 
          } as AST.Identifier,
          args: [type],
          span: this.createSpanFrom(type)
        };
      } else if (this.peek().type === TokenType.StringLiteral) {
        // Indexed access type: Type["property"]
        const indexToken = this.advance();
        this.consume("]", "Expected ']' after indexed access property");
        
        type = {
          kind: "IndexedAccessType",
          object: type,
          index: indexToken.value,
          span: this.createSpanFrom(type)
        } as any; // Cast to any since IndexedAccessType may not be in AST yet
      } else {
        // Not an array type or indexed access, restore position
        this.current = checkpoint;
        break;
      }
    }
    
    // Handle nullable types
    if (this.match("?")) {
      type = {
        kind: "NullableType",
        inner: type,
        span: this.createSpanFrom(type)
      };
    }
    
    // Handle function types with -> (right-associative)
    // A -> B -> C is parsed as A -> (B -> C)
    if (this.check("->")) {
      this.advance(); // consume ->
      const ret = this.parseType(); // recursive call for right-associativity
      type = {
        kind: "FuncType",
        params: [type],
        ret,
        span: this.createSpanFrom(type)
      };
    }
    
    // Handle union types
    else if (this.match("|")) {
      const types: AST.TypeNode[] = [type];
      do {
        types.push(this.parseSimpleType());
      } while (this.match("|"));
      
      type = {
        kind: "UnionType",
        types,
        span: this.createSpanFrom(types[0])
      };
    }
    
    return type;
  }
  
  private parseSimpleType(): AST.TypeNode {
    const start = this.current;
    
    // String literal type
    if (this.peek().type === TokenType.StringLiteral) {
      const literal = this.advance();
      // Treat string literals in type position as a simple type with the literal value as the name
      return {
        kind: "SimpleType",
        id: { kind: "Identifier", name: literal.value, span: this.createSpan(start, start) },
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Channel type: <-chan T or chan<- T
    if (this.match("<-")) {
      this.consume("chan", "Expected 'chan' after '<-'");
      let elementType: AST.TypeNode | undefined;
      if (this.peek().type === TokenType.Identifier || this.check("(")) {
        elementType = this.parseSimpleType();
      }
      return {
        kind: "ChanType",
        direction: "receive",
        elementType,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    if (this.peek().value === "chan") {
      this.advance(); // consume 'chan'
      if (this.match("<-")) {
        // Send-only channel: chan<- T
        let elementType: AST.TypeNode | undefined;
        if (this.peek().type === TokenType.Identifier || this.check("(")) {
          elementType = this.parseSimpleType();
        }
        return {
          kind: "ChanType",
          direction: "send",
          elementType,
          span: this.createSpan(start, this.current - 1)
        };
      } else {
        // Bidirectional channel: chan T
        let elementType: AST.TypeNode | undefined;
        if (this.peek().type === TokenType.Identifier || this.check("(")) {
          elementType = this.parseSimpleType();
        }
        return {
          kind: "ChanType",
          direction: "both",
          elementType,
          span: this.createSpan(start, this.current - 1)
        };
      }
    }
    
    // Object type literal: { prop: type, ... }
    if (this.check("{")) {
      this.advance(); // consume {
      
      // For now, parse object type literals as opaque types
      // Skip to the matching closing brace
      let depth = 1;
      while (depth > 0 && !this.isAtEnd()) {
        if (this.check("{")) depth++;
        else if (this.check("}")) {
          depth--;
          if (depth === 0) break;
        }
        this.advance();
      }
      
      this.consume("}", "Expected '}' in object type literal");
      
      // Return a simple type representing the object literal
      return {
        kind: "SimpleType",
        id: { kind: "Identifier", name: "object", span: this.createSpan(start, start) },
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Function type with parenthesized parameters or parenthesized type
    if (this.check("(")) {
      // Look ahead to see if this is a function type
      const checkpoint = this.current;
      this.advance(); // (
      
      // Skip to matching )
      let depth = 1;
      while (depth > 0 && !this.isAtEnd()) {
        if (this.check("(")) depth++;
        if (this.check(")")) depth--;
        this.advance();
      }
      
      // Check if followed by => or ->
      const isFuncType = this.check("=>") || this.check("->");
      const arrow = this.check("=>") ? "=>" : "->";
      this.current = checkpoint;
      
      if (isFuncType) {
        this.advance(); // (
        const params: AST.TypeNode[] = [];
        
        if (!this.check(")")) {
          // Parse parameter types - for now just skip the names
          do {
            // Skip parameter name if present
            if (this.peek().type === TokenType.Identifier && this.peekNext()?.value === ":") {
              this.advance(); // name
              this.advance(); // :
            }
            params.push(this.parseType());
          } while (this.match(","));
        }
        
        this.consume(")", "Expected ')' in function type");
        this.consume(arrow, `Expected '${arrow}' in function type`);
        const ret = this.parseType();
        
        return {
          kind: "FuncType",
          params,
          ret,
          span: this.createSpan(start, this.current - 1)
        };
      } else {
        // Not a function type - it's a parenthesized type expression
        this.advance(); // consume '('
        const type = this.parseType();
        this.consume(")", "Expected ')' after parenthesized type");
        return type;
      }
    }
    
    // Simple or generic type
    // Allow keywords as type names (void, undefined, number, boolean, string, etc.)
    let id: AST.Identifier;
    const token = this.peek();
    if (token.type === TokenType.Keyword && 
        (token.value === "void" || token.value === "undefined" || 
         token.value === "number" || token.value === "boolean" || 
         token.value === "string" || token.value === "object" ||
         token.value === "any" || token.value === "never" ||
         token.value === "unknown" || token.value === "null")) {
      this.advance();
      id = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
    } else {
      id = this.parseIdentifier();
    }
    
    // Handle qualified type names (e.g., AST.Program, React.Component)
    let qualifiedId = id;
    while (this.match(".")) {
      const member = this.parseIdentifier();
      // Create a new identifier with the full qualified name
      qualifiedId = {
        kind: "Identifier",
        name: `${qualifiedId.name}.${member.name}`,
        span: this.createSpanFrom(qualifiedId)
      };
    }
    
    // Handle "impl Trait" pattern (Rust-style)
    if (qualifiedId.name === "impl" && this.peek().type === TokenType.Identifier) {
      const traitType = this.parseSimpleType();
      return {
        kind: "ImplType",
        trait: traitType,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Special handling for chan<T> syntax
    if (qualifiedId.name === "chan") {
      if (this.check("<")) {
        this.advance(); // consume '<'
        const elementType = this.parseType();
        this.consume(">", "Expected '>' after channel element type");
        
        // Debug: ensure elementType is defined
        if (!elementType) {
          throw this.error(this.peek(), "Failed to parse channel element type");
        }
        
        const result = {
          kind: "ChanType" as const,
          direction: "both" as const,
          elementType: elementType,
          span: this.createSpan(start, this.current - 1)
        };
        return result;
      } else {
        // chan without type parameter - treat as chan<any>
        return {
          kind: "ChanType",
          direction: "both",
          elementType: undefined,
          span: this.createSpan(start, this.current - 1)
        };
      }
    }
    
    // Check for generic arguments
    if (this.match("<") || this.match("[")) {
      const closeBracket = this.previous()?.value === "<" ? ">" : "]";
      const args: AST.TypeNode[] = [];
      
      if (!this.check(closeBracket)) {
        do {
          args.push(this.parseType());
        } while (this.match(","));
      }
      
      this.consume(closeBracket, `Expected '${closeBracket}'`);
      
      return {
        kind: "GenericType",
        base: qualifiedId,
        args,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    return {
      kind: "SimpleType",
      id: qualifiedId,
      span: qualifiedId.span
    };
  }
  
  private isType(): boolean {
    const token = this.peek();
    return token.type === TokenType.Identifier && (
      token.value === "any" || token.value === "never" ||
      token.value === "bool" || token.value === "bytes" ||
      token.value === "string" || token.value === "char" ||
      token.value === "bigint" || token.value === "i8" ||
      token.value === "i16" || token.value === "i32" ||
      token.value === "i64" || token.value === "u8" ||
      token.value === "u16" || token.value === "u32" ||
      token.value === "u64" || token.value === "f32" ||
      token.value === "f64" || token.value === "chan" ||
      // Could be a user-defined type
      token.type === TokenType.Identifier
    );
  }
  
  // Other declaration parsing
  private parseTypeDecl(): AST.TypeDecl {
    const start = this.current - 1;
    const name = this.parseIdentifier();
    
    // Parse generic parameters if present
    let genericParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      genericParams = [];
      do {
        genericParams.push(this.parseIdentifier());
      } while (this.match(","));
      this.consume(">", "Expected '>' after generic parameters");
    }
    
    this.consume("=", "Expected '=' in type declaration");
    const definition = this.parseType();
    this.consumeSemicolon();
    
    return {
      kind: "TypeDecl",
      name,
      genericParams,
      definition,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseClassDecl(): AST.ClassDecl {
    const start = this.current - 1;
    const name = this.parseIdentifier();
    
    // Parse type parameters
    let typeParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      typeParams = [];
      do {
        typeParams.push(this.parseIdentifier());
      } while (this.match(","));
      this.consume(">", "Expected '>' after type parameters");
    }
    
    // Parse extends clause
    let extendsType: AST.TypeNode | undefined;
    if (this.match("extends")) {
      extendsType = this.parseType();
    }
    
    // Parse implements clause
    let implementsTypes: AST.TypeNode[] | undefined;
    if (this.match("implements")) {
      implementsTypes = [];
      do {
        implementsTypes.push(this.parseType());
      } while (this.match(","));
    }
    
    // Parse class body
    this.consume("{", "Expected '{' before class body");
    const members: AST.ClassMember[] = [];
    
    while (!this.check("}") && !this.isAtEnd()) {
      // Skip virtual semicolons and regular semicolons
      while (this.check(";") || this.peek().virtualSemi) {
        this.advance();
      }
      
      if (this.check("}")) break;
      
      try {
        // Parse class member
        const memberStart = this.current;
        
        // Skip member decorators (e.g., @Input, @Output, @HostListener)
        // These aren't part of the spec but we need to handle them gracefully
        while (this.check("@")) {
          this.advance(); // consume @
          
          // Skip the decorator name
          if (this.peek().type === TokenType.Identifier) {
            this.advance();
            
            // Skip decorator arguments if present
            if (this.check("(")) {
              this.advance(); // consume (
              let depth = 1;
              while (depth > 0 && !this.isAtEnd()) {
                if (this.check("(")) {
                  depth++;
                } else if (this.check(")")) {
                  depth--;
                }
                this.advance();
              }
            }
          }
          
          // Skip virtual semicolons after decorators
          while (this.peek().virtualSemi) {
            this.advance();
          }
        }
        
        // Handle Ruby-style def...end methods
        if (this.match("def")) {
          const method = this.parseFuncDecl();
          members.push(method as any);
          continue;
        }
        
        // Handle regular function declarations
        if (this.match("fn", "fun", "function", "func")) {
          const method = this.parseFuncDecl();
          members.push(method as any);
          continue;
        }
        
        // Handle async functions
        if (this.match("async")) {
          if (this.match("fn", "fun", "function", "func", "def")) {
            const method = this.parseFuncDecl(true);
            members.push(method as any);
            continue;
          }
          // If not followed by function keyword, restore position
          this.current = memberStart;
        }
        
        // Handle constructor
        if (this.peek().value === "constructor") {
          const name = this.parseIdentifier();
          
          // Constructor with parentheses
          if (this.check("(")) {
            const params = this.parseParameterList();
            
            // Constructor body
            const body = this.parseBlock();
            
            members.push({
              kind: "Constructor",
              params,
              body,
              span: this.createSpan(memberStart, this.current - 1)
            } as any);
            continue;
          }
        }
        
        // Handle visibility modifiers for fields/methods
        let visibility: "public" | "private" | "protected" | undefined;
        if (this.match("public", "private", "protected")) {
          visibility = this.previous()!.value as any;
        }
        
        // Handle static modifier
        let isStatic = false;
        if (this.match("static")) {
          isStatic = true;
        }
        
        // Handle readonly modifier
        let isReadonly = false;
        if (this.match("readonly")) {
          isReadonly = true;
        }
        
        // Handle property declarations and methods
        if (this.peek().type === TokenType.Identifier) {
          const name = this.parseIdentifier();
          
          // Method with parentheses: methodName(params): returnType { body }
          if (this.check("(")) {
            const params = this.parseParameterList();
            
            // Optional return type
            let returnType: AST.TypeNode | undefined;
            if (this.match(":")) {
              try {
                returnType = this.parseType();
              } catch (error) {
                // If parsing the return type fails, skip to the opening brace
                if (error instanceof ParseError) {
                  this.errors.push(error);
                  // Skip to the opening brace of the method body
                  while (!this.isAtEnd() && !this.check("{") && !this.check("}")) {
                    this.advance();
                  }
                } else {
                  throw error;
                }
              }
            }
            
            // Method body
            let body: AST.Block;
            try {
              body = this.parseBlock();
            } catch (error) {
              // If parsing the method body fails, create an empty block
              // and try to skip to the closing brace
              if (error instanceof ParseError) {
                this.errors.push(error);
                
                // Skip to the matching closing brace
                let depth = 1; // We're inside the method body
                while (depth > 0 && !this.isAtEnd()) {
                  if (this.peek().value === "{") depth++;
                  else if (this.peek().value === "}") {
                    depth--;
                    if (depth === 0) {
                      this.advance(); // consume the closing }
                      break;
                    }
                  }
                  this.advance();
                }
                
                // Skip any trailing semicolons or virtual semicolons after the method
                while (this.check(";") || this.peek().virtualSemi) {
                  this.advance();
                }
                
                body = {
                  kind: "Block",
                  statements: [],
                  span: this.createSpan(memberStart, this.current - 1)
                };
              } else {
                throw error;
              }
            }
            
            members.push({
              kind: "Method",
              name,
              params,
              type: returnType,
              body,
              span: this.createSpan(memberStart, this.current - 1)
            } as any);
            continue;
          }
          
          // Short declaration: name := value
          if (this.match(":=")) {
            const value = this.parseExpression();
            members.push({
              kind: "Field",
              name,
              value,
              span: this.createSpan(memberStart, this.current - 1)
            } as any);
            continue;
          }
          
          // Type annotation: name: Type = value or name: Type;
          if (this.match(":")) {
            const type = this.parseType();
            let value: AST.Expr | undefined;
            if (this.match("=")) {
              value = this.parseExpression();
            }
            
            // Check if this might be a method signature without implementation
            if (this.check("(")) {
              // It's actually a method: name: ReturnType(params) - skip for now
              while (!this.isAtEnd() && !this.checkSemicolon() && !this.check("}")) {
                this.advance();
              }
            } else {
              members.push({
                kind: "Field",
                name,
                type,
                value,
                span: this.createSpan(memberStart, this.current - 1)
              } as any);
            }
            continue;
          }
          
          // Simple assignment: name = value
          if (this.match("=")) {
            const value = this.parseExpression();
            members.push({
              kind: "Field",
              name,
              value,
              span: this.createSpan(memberStart, this.current - 1)
            } as any);
            continue;
          }
          
          // Field without value
          members.push({
            kind: "Field",
            name,
            span: this.createSpan(memberStart, this.current - 1)
          } as any);
          
          // Consume semicolon if present
          this.consumeSemicolon();
        } else {
          // Unknown member type - skip this token
          this.advance();
        }
        
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          // More aggressive error recovery - skip to next potential member
          // Look for visibility modifiers, method/field declarations, or closing brace
          let braceDepth = 0;
          while (!this.isAtEnd() && !this.check("}")) {
            const token = this.peek();
            
            // Track brace depth to skip nested blocks
            if (token.value === "{") {
              braceDepth++;
              this.advance();
              continue;
            } else if (token.value === "}" && braceDepth > 0) {
              braceDepth--;
              this.advance();
              continue;
            }
            
            // Only look for next member at brace depth 0
            if (braceDepth === 0) {
              // Check if we've reached what looks like the next member
              if (token.value === "public" || token.value === "private" || 
                  token.value === "protected" || token.value === "static" ||
                  token.value === "readonly" || token.value === "async" ||
                  token.value === "constructor" || token.value === "override" ||
                  token.value === "abstract" || token.value === "get" ||
                  token.value === "set" || token.value === "declare") {
                // Found a potential next member
                break;
              }
              
              // Also check if we see "private methodName()" pattern
              if (token.value === "private" || token.value === "public" || 
                  token.value === "protected") {
                // Look ahead one token
                const savedPos = this.current;
                this.advance();
                const next = this.peek();
                this.current = savedPos; // Restore position
                
                if (next?.type === TokenType.Identifier) {
                  break; // This is likely a member declaration
                }
              }
            }
            
            // Also break if we see an identifier after a newline/semicolon
            // (could be a method/field without visibility modifier)
            if (this.checkSemicolon() || token.virtualSemi) {
              this.advance(); // consume the semicolon
              if (this.peek().type === TokenType.Identifier && !this.isAtEnd()) {
                break; // Next token could be a member
              }
            } else {
              this.advance();
            }
          }
        } else {
          throw error;
        }
      }
    }
    
    this.consume("}", "Expected '}' after class body");
    
    return {
      kind: "ClassDecl",
      name,
      typeParams,
      extends: extendsType,
      implements: implementsTypes,
      members,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseInterfaceDecl(): AST.InterfaceDecl {
    const start = this.current - 1;
    const name = this.parseIdentifier();
    
    // Parse type parameters
    let typeParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      typeParams = [];
      do {
        typeParams.push(this.parseIdentifier());
      } while (this.match(","));
      this.consume(">", "Expected '>' after type parameters");
    }
    
    // Parse extends clause
    let extendsTypes: AST.TypeNode[] | undefined;
    if (this.match("extends")) {
      extendsTypes = [];
      do {
        extendsTypes.push(this.parseType());
      } while (this.match(","));
    }
    
    // Parse interface body
    this.consume("{", "Expected '{' before interface body");
    const members: AST.InterfaceMember[] = [];
    
    while (!this.check("}") && !this.isAtEnd()) {
      // Parse interface members
      // This is simplified - full implementation would handle all member types
      this.advance(); // Skip for now
    }
    
    this.consume("}", "Expected '}' after interface body");
    
    return {
      kind: "InterfaceDecl",
      name,
      typeParams,
      extends: extendsTypes,
      members,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parsePackageDecl(): AST.PackageDecl {
    const start = this.current - 1;
    const name = this.peek().type === TokenType.Identifier ? 
      this.advance().value : 
      this.consume(TokenType.StringLiteral, "Expected package name").value;
    
    this.consumeSemicolon();
    
    return {
      kind: "PackageDecl",
      name,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseExportDecl(): AST.ExportDecl {
    const start = this.current - 1;
    
    // Handle 'export default'
    if (this.match("default")) {
      // For now, just consume the default export
      // Skip until semicolon or newline
      while (!this.check(";") && !this.check("\n") && !this.isAtEnd()) {
        this.advance();
      }
      this.consumeSemicolon();
      
      return {
        kind: "ExportDecl",
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Handle 'export type'
    if (this.match("type")) {
      // Check if it's export type { ... } or export type Name = ...
      if (this.check("{")) {
        // export type { ... }
        const specifiers = this.parseExportSpecifiers();
        
        let source: string | undefined;
        if (this.match("from")) {
          if (this.peek().type === TokenType.StringLiteral) {
            source = this.advance().value.slice(1, -1);
          }
        }
        
        this.consumeSemicolon();
        
        return {
          kind: "ExportDecl",
          specifiers,
          source,
          span: this.createSpan(start, this.current - 1)
        };
      } else {
        // export type Name = ... 
        // Parse as type declaration
        const declaration = this.parseTypeDecl();
        return {
          kind: "ExportDecl",
          declaration,
          span: this.createSpan(start, this.current - 1)
        };
      }
    }
    
    // Check for export declaration (export function foo() {})
    if (this.isDeclStart()) {
      const declaration = this.parseDeclaration();
      return {
        kind: "ExportDecl",
        declaration,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Check for export specifiers (export { foo, bar })
    if (this.check("{")) {
      const specifiers = this.parseExportSpecifiers();
      
      let source: string | undefined;
      if (this.match("from")) {
        if (this.peek().type === TokenType.StringLiteral) {
          source = this.advance().value.slice(1, -1);
        }
      }
      
      this.consumeSemicolon();
      
      return {
        kind: "ExportDecl",
        specifiers,
        source,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Handle simple export: export Parser or export * from
    if (this.check("*")) {
      this.advance();
      if (this.match("from")) {
        let source: string | undefined;
        if (this.peek().type === TokenType.StringLiteral) {
          source = this.advance().value.slice(1, -1);
        }
        this.consumeSemicolon();
        
        return {
          kind: "ExportDecl",
          source,
          span: this.createSpan(start, this.current - 1)
        };
      }
    }
    
    // Try to consume as identifier
    if (this.peek().type === TokenType.Identifier) {
      this.advance();
      this.consumeSemicolon();
      
      return {
        kind: "ExportDecl",
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    throw this.error(this.peek(), "Invalid export declaration");
  }
  
  private parseExportSpecifiers(): AST.ExportSpecifier[] {
    this.consume("{", "Expected '{'");
    const specifiers: AST.ExportSpecifier[] = [];
    
    if (!this.check("}")) {
      do {
        const local = this.parseIdentifier();
        let exported: AST.Identifier | undefined;
        
        if (this.match("as")) {
          exported = this.parseIdentifier();
        }
        
        specifiers.push({
          local,
          exported,
          span: this.createSpanFrom(local)
        });
      } while (this.match(","));
    }
    
    this.consume("}", "Expected '}'");
    return specifiers;
  }
  
  private parseEnumDecl(): AST.EnumDecl {
    const start = this.current - 1;
    const name = this.parseIdentifier();
    
    this.consume("{", "Expected '{' before enum body");
    const members: AST.EnumMember[] = [];
    
    while (!this.check("}") && !this.isAtEnd()) {
      const memberName = this.parseIdentifier();
      let value: AST.Expr | undefined;
      
      if (this.match("=")) {
        value = this.parseExpression();
      }
      
      members.push({
        name: memberName,
        value,
        span: this.createSpanFrom(memberName)
      });
      
      if (!this.match(",")) {
        break;
      }
    }
    
    this.consume("}", "Expected '}' after enum body");
    
    return {
      kind: "EnumDecl",
      name,
      members,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  // Literal parsing
  private parseNumericLiteral(): AST.NumericLiteral {
    const token = this.advance();
    let base: "decimal" | "hex" | "octal" | "binary" = "decimal";
    
    if (token.value.startsWith("0x") || token.value.startsWith("0X")) {
      base = "hex";
    } else if (token.value.startsWith("0o") || token.value.startsWith("0O")) {
      base = "octal";
    } else if (token.value.startsWith("0b") || token.value.startsWith("0B")) {
      base = "binary";
    }
    
    // Extract suffix if present
    let suffix: string | undefined;
    const suffixMatch = token.value.match(/[nulfiULFI][\w]*$/);
    if (suffixMatch) {
      suffix = suffixMatch[0];
    }
    
    return {
      kind: "NumericLiteral",
      raw: token.value,
      base,
      suffix,
      span: this.createSpanFrom(token)
    };
  }
  
  private parseStringLiteral(): AST.StringLiteral {
    const token = this.advance();
    
    // Parse string flags and delimiter
    let flags: AST.StringLiteral["flags"] = {};
    let delimiter = token.value[0];
    
    // Check for prefixes
    let prefixEnd = 0;
    for (let i = 0; i < token.value.length; i++) {
      const char = token.value[i];
      if (char === 'r') flags.raw = true;
      else if (char === 'b') flags.bytes = true;
      else if (char === 'f') flags.format = true;
      else if (char === 'c') flags.const = true;
      else if (char === '"' || char === "'" || char === '`') {
        prefixEnd = i;
        delimiter = char;
        break;
      }
    }
    
    // Parse content and handle interpolations
    const content = token.value.slice(prefixEnd + 1, -1); // Remove quotes
    const parts: AST.StringPart[] = [];
    
    // If it's an f-string or template literal, parse interpolations
    if (flags.format || delimiter === '`') {
      let current = "";
      let i = 0;
      
      while (i < content.length) {
        if ((flags.format && content[i] === '{' && content[i + 1] !== '{') ||
            (delimiter === '`' && content[i] === '$' && content[i + 1] === '{')) {
          // Save text before interpolation
          if (current) {
            parts.push({ kind: "Text", value: current });
            current = "";
          }
          
          // Find the end of interpolation
          const start = flags.format ? i + 1 : i + 2;
          let depth = 1;
          let end = start;
          
          while (end < content.length && depth > 0) {
            if (content[end] === '{') depth++;
            else if (content[end] === '}') depth--;
            end++;
          }
          
          if (depth === 0) {
            // Extract interpolation expression
            const exprStr = content.slice(start, end - 1);
            parts.push({
              kind: "Interpolation",
              value: exprStr // This would ideally be parsed as an expression
            });
            i = end;
          } else {
            // Unclosed interpolation
            current += content[i];
            i++;
          }
        } else if ((flags.format && content[i] === '{' && content[i + 1] === '{') ||
                   (flags.format && content[i] === '}' && content[i + 1] === '}')) {
          // Escaped braces in f-strings
          current += content[i];
          i += 2;
        } else {
          current += content[i];
          i++;
        }
      }
      
      // Add remaining text
      if (current) {
        parts.push({ kind: "Text", value: current });
      }
    } else {
      // Regular string
      parts.push({ kind: "Text", value: content });
    }
    
    return {
      kind: "StringLiteral",
      parts,
      flags,
      delimiter,
      span: this.createSpanFrom(token)
    };
  }
  
  private parseTemplateLiteral(): AST.StringLiteral {
    const token = this.advance();
    
    // Parse template literal with interpolations
    const content = token.value.slice(1, -1); // Remove backticks
    const parts: AST.StringPart[] = [];
    
    let current = "";
    let i = 0;
    
    while (i < content.length) {
      if (content[i] === '$' && content[i + 1] === '{') {
        // Save text before interpolation
        if (current) {
          parts.push({ kind: "Text", value: current });
          current = "";
        }
        
        // Find the end of interpolation
        let depth = 1;
        let end = i + 2;
        
        while (end < content.length && depth > 0) {
          if (content[end] === '{') depth++;
          else if (content[end] === '}') depth--;
          end++;
        }
        
        if (depth === 0) {
          // Extract interpolation expression
          const exprStr = content.slice(i + 2, end - 1);
          parts.push({
            kind: "Interpolation",
            value: exprStr
          });
          i = end;
        } else {
          // Unclosed interpolation
          current += content[i];
          i++;
        }
      } else if (content[i] === '\\' && i + 1 < content.length) {
        // Handle escape sequences
        i++;
        switch (content[i]) {
          case 'n': current += '\n'; break;
          case 't': current += '\t'; break;
          case 'r': current += '\r'; break;
          case '\\': current += '\\'; break;
          case '`': current += '`'; break;
          default: current += content[i];
        }
        i++;
      } else {
        current += content[i];
        i++;
      }
    }
    
    // Add remaining text
    if (current || parts.length === 0) {
      parts.push({ kind: "Text", value: current });
    }
    
    return {
      kind: "StringLiteral",
      parts,
      flags: { format: true },
      delimiter: "`",
      span: this.createSpanFrom(token)
    };
  }
  
  private parseRegexLiteral(): AST.RegexLiteral {
    const token = this.advance();
    
    // Extract pattern and flags
    const lastSlash = token.value.lastIndexOf('/');
    const pattern = token.value.slice(1, lastSlash);
    const flags = token.value.slice(lastSlash + 1);
    
    return {
      kind: "RegexLiteral",
      pattern,
      flags,
      span: this.createSpanFrom(token)
    };
  }
  
  private parseListComprehension(expr: AST.Expr, start: number): AST.ArrayLiteral {
    // Parse: [expr for var in iterable if condition]
    const comprehensions: any[] = [];
    
    while (this.match("for")) {
      const variable = this.parseIdentifier();
      this.consume("in", "Expected 'in' in list comprehension");
      const iterable = this.parseExpression();
      
      let condition: AST.Expr | undefined;
      if (this.match("if")) {
        condition = this.parseExpression();
      }
      
      comprehensions.push({
        variable,
        iterable,
        condition
      });
      
      // Check for nested comprehensions
      if (!this.check("for")) {
        break;
      }
    }
    
    this.consume("]", "Expected ']' after list comprehension");
    
    // For now, return as a regular array with special metadata
    // A full implementation would have a ListComprehension AST node
    return {
      kind: "ArrayLiteral",
      elements: [expr], // Store the expression
      // Add comprehension data as metadata (would need AST type updates)
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseArrayLiteral(): AST.ArrayLiteral {
    const start = this.current - 1;
    const elements: AST.Expr[] = [];
    
    if (!this.check("]")) {
      // Parse first element or expression
      let firstExpr: AST.Expr;
      
      // Check for spread operator
      if (this.match("...")) {
        const spreadStart = this.current - 1;
        // Check for optional spread (...?)
        const optional = this.match("?");
        const argument = this.parseAssignmentExpression();
        firstExpr = {
          kind: "Spread",
          argument,
          optional,
          span: this.createSpan(spreadStart, this.current - 1)
        };
        elements.push(firstExpr);
      } else {
        // Check for match expression in comprehension context
        if (this.check("match")) {
          const checkpoint = this.current;
          try {
            const matchExpr = this.parseSwitch();
            firstExpr = matchExpr as any;
          } catch (e) {
            // If match parsing fails, restore position and parse as assignment
            this.current = checkpoint;
            firstExpr = this.parseAssignmentExpression();
          }
        } else {
          firstExpr = this.parseAssignmentExpression();
        }
        
        // Skip virtual semicolons before checking for comprehension
        while (this.peek().virtualSemi) {
          this.advance();
        }
        
        // Check for list comprehension (expression followed by 'for')
        if (this.check("for")) {
          // This is a list comprehension
          return this.parseListComprehension(firstExpr, start);
        } else {
          elements.push(firstExpr);
        }
      }
      
      // If not a comprehension, continue parsing regular array elements
      if (!this.check("for")) {
        while (this.match(",")) {
          if (this.check("]")) break; // Allow trailing comma
          
          // Check for spread operator
          if (this.match("...")) {
            const spreadStart = this.current - 1;
            // Check for optional spread (...?)
            const optional = this.match("?");
            const argument = this.parseAssignmentExpression();
            elements.push({
              kind: "Spread",
              argument,
              optional,
              span: this.createSpan(spreadStart, this.current - 1)
            });
          } else {
            elements.push(this.parseAssignmentExpression());
          }
        }
      }
    }
    
    this.consume("]", "Expected ']' after array elements");
    
    return {
      kind: "ArrayLiteral",
      elements,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseObjectLiteral(): AST.ObjectLiteral | AST.SetLiteral {
    const start = this.current - 1;
    
    if (!this.check("}")) {
      // Parse first element to determine if it's a set/dict comprehension
      const checkpoint = this.current;
      
      // Try to parse as expression first, but catch errors for object literals
      try {
        // Skip this check if we see a keyword followed by colon (object literal)
        if (this.peek().type === TokenType.Keyword && this.peekNext()?.value === ":") {
          // This is likely an object literal with keyword property
          // Skip the comprehension check
        } else {
          const firstExpr = this.parseAssignmentExpression();
          
          // Check for set comprehension: {expr for var in iterable}
          if (this.check("for")) {
            return this.parseSetComprehension(firstExpr, start);
          }
        }
      } catch {
        // Failed to parse as expression, continue as object literal
      }
      
      // Reset for regular object/dict parsing
      this.current = checkpoint;
      
      const properties: AST.ObjectProperty[] = [];
      
      do {
        const propStart = this.current;
        
        // Check for spread property
        if (this.match("...")) {
          // Check for optional spread (...?)
          const optional = this.match("?");
          const argument = this.parseAssignmentExpression();
          
          properties.push({
            key: {
              kind: "Identifier",
              name: "...",
              span: this.createSpan(propStart, propStart)
            },
            value: {
              kind: "Spread",
              argument,
              optional,
              span: this.createSpan(propStart, this.current - 1)
            } as AST.Expr,
            shorthand: false,
            computed: false,
            span: this.createSpan(propStart, this.current - 1)
          });
          
          // Continue to next property if there's a comma
          if (this.match(",")) {
            continue;
          }
          break;
        }
        
        // Parse property key
        let key: AST.Identifier | AST.StringLiteral | AST.NumericLiteral;
        let computed = false;
        
        if (this.match("[")) {
          // Computed property
          computed = true;
          const expr = this.parseExpression();
          this.consume("]", "Expected ']' after computed property");
          
          // For now, treat computed properties as identifiers
          key = {
            kind: "Identifier",
            name: "[computed]",
            span: expr.span
          };
        } else if (this.peek().type === TokenType.StringLiteral) {
          key = this.parseStringLiteral();
        } else if (this.peek().type === TokenType.NumericLiteral) {
          key = this.parseNumericLiteral();
        } else if (this.peek().type === TokenType.Keyword) {
          // Allow keywords as property keys in object literals
          const keyToken = this.advance();
          key = {
            kind: "Identifier",
            name: keyToken.value,
            span: this.createSpanFrom(keyToken)
          };
        } else {
          key = this.parseIdentifier();
        }
        
        // Check for shorthand
        let value: AST.Expr;
        let shorthand = false;
        
        if (this.match(":")) {
          value = this.parseAssignmentExpression();
          
          // Check for dict comprehension after first key:value pair
          if (this.check("for")) {
            // This is a dict comprehension
            const dictExpr = {
              kind: "ObjectLiteral" as const,
              properties: [{
                key,
                value,
                shorthand: false,
                computed,
                span: this.createSpan(propStart, this.current - 1)
              }],
              span: this.createSpan(propStart, this.current - 1)
            };
            return this.parseDictComprehension(dictExpr, start);
          }
        } else if (key.kind === "Identifier") {
          // Shorthand property
          shorthand = true;
          value = key;
        } else {
          throw this.error(this.peek(), "Expected ':' after property key");
        }
        
        properties.push({
          key,
          value,
          shorthand,
          computed,
          span: this.createSpan(propStart, this.current - 1)
        });
      } while (this.match(","));
      
      // Skip virtual semicolons before closing brace
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      this.consume("}", "Expected '}' after object properties");
      
      return {
        kind: "ObjectLiteral",
        properties,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Skip virtual semicolons before closing brace (for empty object)
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    this.consume("}", "Expected '}' after object properties");
    
    return {
      kind: "ObjectLiteral",
      properties: [],
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseSetComprehension(expr: AST.Expr, start: number): AST.SetLiteral {
    // Parse: {expr for var in iterable if condition}
    const comprehensions: any[] = [];
    
    while (this.match("for")) {
      const variable = this.parseIdentifier();
      this.consume("in", "Expected 'in' in set comprehension");
      const iterable = this.parseExpression();
      
      let condition: AST.Expr | undefined;
      if (this.match("if")) {
        condition = this.parseExpression();
      }
      
      comprehensions.push({
        variable,
        iterable,
        condition
      });
      
      // Check for nested comprehensions
      if (!this.check("for")) {
        break;
      }
    }
    
    this.consume("}", "Expected '}' after set comprehension");
    
    // Return as a SetLiteral
    return {
      kind: "SetLiteral",
      elements: [expr], // Store the expression
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseDictComprehension(firstPair: AST.ObjectLiteral, start: number): AST.ObjectLiteral {
    // Parse: {k: v for k, v in iterable if condition}
    const comprehensions: any[] = [];
    
    while (this.match("for")) {
      // Parse variable(s) - can be single or multiple
      const variables: AST.Identifier[] = [];
      variables.push(this.parseIdentifier());
      
      while (this.match(",")) {
        variables.push(this.parseIdentifier());
      }
      
      this.consume("in", "Expected 'in' in dict comprehension");
      const iterable = this.parseExpression();
      
      let condition: AST.Expr | undefined;
      if (this.match("if")) {
        condition = this.parseExpression();
      }
      
      comprehensions.push({
        variables,
        iterable,
        condition
      });
      
      // Check for nested comprehensions
      if (!this.check("for")) {
        break;
      }
    }
    
    this.consume("}", "Expected '}' after dict comprehension");
    
    // Return as ObjectLiteral with comprehension metadata
    return {
      kind: "ObjectLiteral",
      properties: firstPair.properties,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseGeneratorComprehension(expr: AST.Expr, start: number): AST.Call {
    // Parse: (expr for var in iterable if condition)
    const comprehensions: any[] = [];
    
    while (this.match("for")) {
      const variable = this.parseIdentifier();
      this.consume("in", "Expected 'in' in generator comprehension");
      const iterable = this.parseExpression();
      
      let condition: AST.Expr | undefined;
      if (this.match("if")) {
        condition = this.parseExpression();
      }
      
      comprehensions.push({
        variable,
        iterable,
        condition
      });
      
      // Check for nested comprehensions
      if (!this.check("for")) {
        break;
      }
    }
    
    this.consume(")", "Expected ')' after generator comprehension");
    
    // Return as a special Call node representing a generator
    return {
      kind: "Call",
      callee: {
        kind: "Identifier",
        name: "__generator",
        span: this.createSpan(start, start)
      },
      args: [expr], // Store the expression
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseLambda(): AST.Lambda {
    const start = this.current - 1; // Account for already consumed (
    
    // Parse parameters
    let params: AST.Param[] = [];
    
    // We already consumed the opening paren
    if (!this.check(")")) {
      do {
        params.push(this.parseParameter());
      } while (this.match(","));
    }
    this.consume(")", "Expected ')' after lambda parameters");
    
    // Parse return type
    let returnType: AST.TypeNode | undefined;
    if (this.match(":")) {
      returnType = this.parseType();
    }
    
    // Parse arrow
    this.consume("=>", "Expected '=>' in lambda");
    
    // Skip virtual semicolons after => in arrow functions
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    // Parse body
    const body = this.check("{") ? this.parseBlock() : this.parseExpression();
    
    return {
      kind: "Lambda",
      params,
      returnType,
      body,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseAsyncLambda(start: number): AST.Lambda {
    // Check for async block (no parameters, just a block)
    if (this.check("{")) {
      const block = this.parseBlock();
      // Return an async block expression (wrapped in a lambda with no params)
      return {
        kind: "Lambda",
        params: [],
        returnType: undefined,
        body: block,
        async: true,
        span: this.createSpan(start, this.current - 1)
      } as AST.Lambda;
    }
    
    // Parse parameters - can be single identifier or parenthesized list
    let params: AST.Param[] = [];
    
    if (this.match("(")) {
      if (!this.check(")")) {
        do {
          params.push(this.parseParameter());
        } while (this.match(","));
      }
      this.consume(")", "Expected ')' after lambda parameters");
    } else if (this.peek().type === TokenType.Identifier) {
      // Single parameter without parentheses
      const name = this.parseIdentifier();
      params.push({
        name,
        type: undefined,
        defaultValue: undefined,
        span: name.span
      });
    }
    
    // Parse return type
    let returnType: AST.TypeNode | undefined;
    if (this.match(":")) {
      returnType = this.parseType();
    }
    
    // Parse arrow
    this.consume("=>", "Expected '=>' in async lambda");
    
    // Parse body
    const body = this.check("{") ? this.parseBlock() : this.parseExpression();
    
    return {
      kind: "Lambda",
      params,
      returnType,
      body,
      async: true,
      span: this.createSpan(start, this.current - 1)
    } as AST.Lambda;
  }
  
  private checkLambda(): boolean {
    // Check for arrow function patterns
    if (this.check("(")) {
      const checkpoint = this.current;
      this.advance(); // (
      
      // Skip parameters
      let depth = 1;
      while (depth > 0 && !this.isAtEnd()) {
        if (this.check("(")) depth++;
        if (this.check(")")) depth--;
        this.advance();
      }
      
      const hasArrow = this.check("=>") || (this.check(":") && this.peekNext()?.value === "=>");
      this.current = checkpoint;
      return hasArrow;
    }
    
    // Single parameter arrow function
    if (this.peek().type === TokenType.Identifier) {
      const next = this.peekNext();
      return next?.value === "=>" || 
             (next?.value === ":" && this.peekAt(2)?.value === "=>");
    }
    
    return false;
  }
  
  private checkParenthesizedLambda(): boolean {
    // We already consumed the opening paren
    // Check for lambda parameter pattern
    
    // First check: if we see identifier : type, it's likely a lambda parameter
    if (this.peek().type === TokenType.Identifier) {
      const next = this.peekNext();
      if (next && next.value === ":") {
        // This looks like a typed parameter
        // Scan ahead to find the closing paren and check for =>
        let depth = 1;
        let pos = this.current + 2; // Skip identifier and :
        
        while (depth > 0 && pos < this.tokens.length) {
          const tok = this.tokens[pos];
          if (tok.value === "(") depth++;
          else if (tok.value === ")") {
            depth--;
            if (depth === 0) {
              // Check if followed by =>
              const nextTok = this.tokens[pos + 1];
              return nextTok && nextTok.value === "=>";
            }
          }
          pos++;
        }
      }
    }
    
    // Fallback: scan to closing paren and check for =>
    let depth = 1;
    
    while (depth > 0 && !this.isAtEnd()) {
      if (this.check("(")) {
        depth++;
        this.advance();
      } else if (this.check(")")) {
        depth--;
        this.advance();
      } else {
        this.advance();
      }
    }
    
    // After closing paren, check for => or : (return type) then =>
    return this.check("=>") || (this.check(":") && this.peekNext()?.value === "=>");
  }
  
  private parseNewExpression(): AST.Call {
    const start = this.current - 1;
    const callee = this.parsePrimary();
    
    let args: AST.Expr[] = [];
    if (this.match("(")) {
      args = this.parseArguments();
      this.must(")", { recoverWithSynthetic: true });
    }
    
    return {
      kind: "Call",
      callee: {
        kind: "Member",
        object: {
          kind: "Identifier",
          name: "new",
          span: this.createSpan(start, start)
        },
        property: callee as AST.Identifier,
        span: this.createSpanFrom(callee)
      },
      args,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  // Helper methods
  private typeNodeToString(type: AST.TypeNode): string {
    switch (type.kind) {
      case "SimpleType":
        return type.id.name;
      case "ChanType":
        const prefix = type.direction === "receive" ? "<-chan" : 
                      type.direction === "send" ? "chan<-" : "chan";
        return type.elementType ? `${prefix} ${this.typeNodeToString(type.elementType)}` : prefix;
      case "NullableType":
        return `${this.typeNodeToString(type.inner)}?`;
      case "UnionType":
        return type.types.map(t => this.typeNodeToString(t)).join(" | ");
      case "GenericType":
        return `${type.base.name}<${type.args.map(a => this.typeNodeToString(a)).join(", ")}>`;
      case "FuncType":
        return `(${type.params.map(p => this.typeNodeToString(p)).join(", ")}) => ${this.typeNodeToString(type.ret)}`;
      default:
        return "unknown";
    }
  }
  
  private parseIdentifier(): AST.Identifier {
    const token = this.peek();
    
    // Allow keywords as identifiers in member access context
    if (token.type === TokenType.Keyword && this.shouldReinterpretAsIdentifier()) {
      this.advance();
      return {
        kind: "Identifier",
        name: token.value,
        originalSpelling: token.value,
        span: this.createSpanFrom(token)
      };
    }
    
    if (token.type === TokenType.Identifier || 
        token.type === TokenType.SigilIdentifier) {
      this.advance();
      
      // Handle sigil identifiers
      const name = token.type === TokenType.SigilIdentifier ?
        token.value.slice(1) : // Remove $ prefix
        token.value;
      
      return {
        kind: "Identifier",
        name,
        originalSpelling: token.value,
        span: this.createSpanFrom(token)
      };
    }
    
    // Check for backtick identifier
    if (token.type === TokenType.TemplateLiteral && 
        this.shouldReinterpretAsIdentifier()) {
      return this.parseBacktickIdentifier();
    }
    
    // Return missing identifier instead of throwing
    this.errors.push(new ParseError("Expected identifier", token));
    return this.createMissingIdentifier();
  }
  
  private shouldReinterpretAsIdentifier(): boolean {
    // Check if we're in an identifier position
    const prev = this.previous();
    
    if (!prev) return false;
    
    // Declaration contexts
    if (prev.value === "def" || prev.value === "fun" || prev.value === "fn" ||
        prev.value === "function" || prev.value === "class" || prev.value === "struct" ||
        prev.value === "interface" || prev.value === "trait" || prev.value === "type" ||
        prev.value === "enum" || prev.value === "let" || prev.value === "var" ||
        prev.value === "const" || prev.value === "auto" || prev.value === "final" ||
        prev.value === "immutable") {
      return true;
    }
    
    // Import/export contexts
    if (prev.value === "import" || prev.value === "as" || prev.value === "export") {
      return true;
    }
    
    // Member access
    if (prev.value === "." || prev.value === "?.") {
      return true;
    }
    
    // Object property keys
    if (prev.value === "{" || prev.value === ",") {
      // Could be in an object literal context
      return true;
    }
    
    return false;
  }
  
  private parseBacktickIdentifier(): AST.Identifier {
    const token = this.advance();
    
    // For template literals that contain interpolations (${...}),
    // treat the entire literal as a string literal instead of an identifier
    if (token.value.includes('${')) {
      // This is actually a template literal with interpolations, not a backtick identifier
      // Return it as-is to be handled as a string literal
      this.current--; // Put the token back
      return this.parseTemplateLiteral() as any; // Treat as expression
    }
    
    // Extract content from backticks
    const content = token.value.slice(1, -1);
    
    // Validate it matches identifier pattern
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(content)) {
      // If not a valid identifier, treat it as a string literal
      this.current--; // Put the token back
      return this.parseTemplateLiteral() as any;
    }
    
    return {
      kind: "Identifier",
      name: content,
      originalSpelling: token.value,
      span: this.createSpanFrom(token)
    };
  }
  
  private parseIdentifierList(): AST.Identifier[] {
    const ids: AST.Identifier[] = [this.parseIdentifier()];
    
    while (this.match(",")) {
      ids.push(this.parseIdentifier());
    }
    
    return ids;
  }
  
  private parseExpressionList(): AST.Expr[] {
    const exprs: AST.Expr[] = [this.parseAssignmentExpression()];
    
    while (this.match(",")) {
      exprs.push(this.parseAssignmentExpression());
    }
    
    return exprs;
  }
  
  private parseArguments(): AST.Expr[] {
    const args: AST.Expr[] = [];
    
    // Skip virtual semicolons before first argument
    while (this.peek().virtualSemi) {
      this.advance();
    }
    
    if (!this.check(")")) {
      do {
        // Check for spread operator
        if (this.match("...")) {
          const spreadStart = this.current - 1;
          const argument = this.parseAssignmentExpression();
          args.push({
            kind: "Spread",
            argument,
            optional: false,
            span: this.createSpan(spreadStart, this.current - 1)
          });
        } else {
          // Parse expression but stop at comma at this level
          args.push(this.parseAssignmentExpression());
        }
        
        // Skip virtual semicolons after argument
        while (this.peek().virtualSemi) {
          this.advance();
        }
        
        if (!this.match(",")) {
          break;
        }
        
        // Skip virtual semicolons after comma
        while (this.peek().virtualSemi) {
          this.advance();
        }
        
        // Tolerate trailing comma
        if (this.check(")")) {
          break;
        }
      } while (true);
    }
    
    return args;
  }
  
  private parseAssignmentExpression(): AST.Expr {
    // Parse everything except comma operator
    return this.parseExpression(this.getPrecedence({value: ","} as Token) + 1);
  }
  
  private tryParseGenericArgs(): AST.TypeNode[] | null {
    if (!this.check("<")) return null;
    
    const checkpoint = this.current;
    
    try {
      this.advance(); // <
      const args: AST.TypeNode[] = [];
      
      do {
        args.push(this.parseType());
      } while (this.match(","));
      
      // Handle >> and >>> as closing brackets
      if (this.check(">>")) {
        // Split >> into > >
        const token = this.peek();
        token.value = ">";
        // Would need to insert another > token here
      } else if (this.check(">>>")) {
        // Split >>> into > >>
        const token = this.peek();
        token.value = ">";
        // Would need to insert >> token here
      } else {
        this.consume(">", "Expected '>' after generic arguments");
      }
      
      // Check if followed by valid continuation
      const next = this.peek();
      if (next.value === "(" || next.value === "[" || next.value === "{" ||
          next.value === ">" || next.value === ">>" || next.value === ">>>" ||
          next.value === ":" || next.value === "extends" || 
          next.value === "implements" || next.value === "where") {
        return args;
      }
      
      // Not a valid generic argument list
      this.current = checkpoint;
      return null;
    } catch {
      this.current = checkpoint;
      return null;
    }
  }
  
  // Operator precedence
  private getPrecedence(token: Token): number {
    switch (token.value) {
      // Highest precedence (handled in parsePostfix)
      // case "(": case "[": case ".": case "?.": return 18;
      
      // Unary operators (handled in parsePrimary)
      // case "new": case "++": case "--": return 17;
      // case "!": case "~": case "+": case "-": case "typeof": case "void": case "delete": case "await": return 16;
      
      case "**": return 15;
      case "*": case "/": case "%": return 14;
      case "+": case "-": return 13;
      case "<<": case ">>": case ">>>": return 12;
      case "..": return 11.5; // Range operator
      case "<-": return 11.3; // Channel send operator
      case "<": case "<=": case ">": case ">=": case "in": case "instanceof": return 11;
      case "<=>": return 11; // Spaceship operator (comparison)
      case "==": case "!=": case "===": case "!==": return 10;
      case "=~": return 10;
      case "|>": return 9; // Pipeline operator
      case "&": return 9;
      case "^": return 8;
      case "|": return 7;
      case "&&": return 6;
      case "||": return 5;
      case "??": return 4;
      case "?": return 3; // Ternary
      case "=": case "+=": case "-=": case "*=": case "/=": case "%=":
      case "**=": case "<<=": case ">>=": case ">>>=":
      case "&=": case "^=": case "|=": case "??=":
      case ":=": case ":=:": return 2;
      case ",": return 1;
      
      default: return 0;
    }
  }
  
  private isRightAssociative(token: Token): boolean {
    return token.value === "**" || this.isAssignmentOp(token);
  }
  
  private isBinaryOp(token: Token): boolean {
    return this.getPrecedence(token) > 0 && !this.isAssignmentOp(token);
  }
  
  private isAssignmentOp(token: Token): boolean {
    const op = token.value;
    return op === "=" || op === "+=" || op === "-=" || op === "*=" ||
           op === "/=" || op === "%=" || op === "**=" || op === "<<=" ||
           op === ">>=" || op === ">>>=" || op === "&=" || op === "^=" ||
           op === "|=" || op === "??=" || op === ":=" || op === ":=:";
  }
  
  private isUnaryOp(token: Token): boolean {
    const op = token.value;
    return op === "!" || op === "~" || op === "+" || op === "-" ||
           op === "typeof" || op === "void" || op === "delete" ||
           op === "await" || op === "++" || op === "--" || op === "&" || op === "*";
  }
  
  // Utility methods
  private consumeDirectives(): void {
    // Check for directive comments
    while (this.peek().type === TokenType.Comment) {
      const comment = this.advance();
      if (comment.value.startsWith("// @generics")) {
        this.nextStmtGenericMode = "on";
      } else if (comment.value.startsWith("// @nogenerics")) {
        this.nextStmtGenericMode = "off";
      }
    }
  }
  
  private consumeSemicolon(): void {
    if (this.match(";") || this.peek().virtualSemi) {
      if (this.peek().virtualSemi) {
        // Don't actually consume virtual semicolon
        return;
      }
    }
    // Semicolon insertion is handled by MASI
  }
  
  private checkSemicolon(): boolean {
    return this.check(";") || this.peek().virtualSemi || false;
  }
  
  private skipSemicolons(): void {
    while (this.check(";") || this.peek().virtualSemi) {
      this.advance();
    }
  }
  
  private synchronize(): void {
    this.advance();
    
    while (!this.isAtEnd()) {
      if (this.previous()?.type === TokenType.Operator && 
          this.previous()?.value === ";") {
        return;
      }
      
      // Stop at block/statement endings
      const token = this.peek();
      if (token.value === "fi" || token.value === "esac" || token.value === "done" || 
          token.value === "end" || token.value === "}" || token.value === "elif" || 
          token.value === "else" || token.value === "elseif" || token.value === "rescue" || 
          token.value === "ensure" || token.value === "except" || token.value === "finally") {
        return;
      }
      
      if (this.isDeclStart()) {
        return;
      }
      
      this.advance();
    }
  }
  
  private error(token: Token, message: string): ParseError {
    return new ParseError(message, token);
  }
  
  private createSpan(start: number, end: number): AST.Span {
    const startToken = this.tokens[start] || this.tokens[0];
    const endToken = this.tokens[end] || this.tokens[this.tokens.length - 1];
    
    return {
      start: startToken.start,
      end: endToken.end,
      line: startToken.line,
      column: startToken.column
    };
  }
  
  private createSpanFrom(node: { span: AST.Span } | Token): AST.Span {
    if ('span' in node) {
      return {
        ...node.span,
        end: this.previous()?.end || node.span.end
      };
    }
    
    return {
      start: node.start,
      end: node.end,
      line: node.line,
      column: node.column
    };
  }
  
  // Token navigation
  private peek(): Token {
    if (this.isAtEnd()) {
      return this.tokens[this.tokens.length - 1];
    }
    return this.tokens[this.current];
  }
  
  private peekNext(): Token | undefined {
    return this.tokens[this.current + 1];
  }
  
  private peekAt(offset: number): Token | undefined {
    return this.tokens[this.current + offset];
  }
  
  private previous(): Token | undefined {
    return this.tokens[this.current - 1];
  }
  
  private advance(): Token {
    if (!this.isAtEnd()) this.current++;
    return this.previous()!;
  }
  
  private isAtEnd(): boolean {
    if (this.current >= this.tokens.length) return true;
    const token = this.tokens[this.current];
    return token && token.type === TokenType.EOF;
  }
  
  private check(value: string): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().value === value;
  }
  
  private match(...values: string[]): boolean {
    for (const value of values) {
      if (this.check(value)) {
        this.advance();
        return true;
      }
    }
    return false;
  }
  
  private consume(expected: TokenType | string, message: string): Token {
    const token = this.peek();
    
    if (typeof expected === "string") {
      if (token.value === expected) {
        return this.advance();
      }
    } else {
      if (token.type === expected) {
        return this.advance();
      }
    }
    
    throw this.error(token, message);
  }
}