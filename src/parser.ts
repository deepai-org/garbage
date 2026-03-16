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
  private noRubyBlock = false;
  
  // Directives
  private nextStmtGenericMode: "on" | "off" | "auto" = "auto";
  private fileRuntimeDirective?: string;

  constructor(tokens: Token[], source?: string) {
    // Scan raw source text for runtime directive (comments are skipped by lexer)
    if (source) {
      const match = source.match(/\/\/\s*@runtime\s+(\S+)/);
      if (match) {
        this.fileRuntimeDirective = match[1];
      }
    }
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
    
    while (!this.isAtEnd()) {
      iterations++;
      if (iterations > maxIterations) {
        return {
          kind: "Program",
          body,
          runtimeDirective: this.fileRuntimeDirective,
          span: this.createSpan(0, Math.min(this.current, this.tokens.length - 1))
        };
      }
      
      const beforePos = this.current;
      
      try {
        const item = this.parseTopLevel();
        if (item) {
          body.push(item);
        } else if (!this.isAtEnd()) {
          if (this.current === beforePos) {
            this.advance();
          }
        }
      } catch (error) {
        if (error instanceof ParseError) {
          this.errors.push(error);
          this.synchronize();
        } else {
          throw error;
        }
      }
      
      if (this.current === beforePos && !this.isAtEnd()) {
        this.advance();
      }
    }
    
    return {
      kind: "Program",
      body,
      runtimeDirective: this.fileRuntimeDirective,
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
        // It should have been consumed already by the appropriate parser.
        // If we see it here, it's an extra/unmatched brace - skip it and continue
        this.advance();
        return this.parseTopLevel(); // Try to parse the next item
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
      // Check for class first since Python can have 'def' inside class
      if (this.match("class")) {
        const cls = this.parseClassDecl(decorators);
        return cls;
      } else if (this.match("async", "unsafe")) {
        // Handle async/unsafe before function
        const isAsync = this.previous()?.value === "async";
        const isUnsafe = this.previous()?.value === "unsafe";
        
        if (this.match("def", "fun", "fn", "func", "function")) {
          const isGenerator = this.previous()?.value === "function" && this.match("*");
          const func = this.parseFuncDecl(isAsync, isUnsafe, isGenerator, decorators);
          return func;
        }
      } else if (this.match("def", "fun", "fn", "func", "function")) {
        const isGenerator = this.previous()?.value === "function" && this.match("*");
        const func = this.parseFuncDecl(false, false, isGenerator, decorators);
        return func;
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
    
    // Check for impl blocks (Rust-style)
    if (value === "impl" && type === TokenType.Identifier) {
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
    
    // Python-style from X import Y — only if 'import' appears soon after
    if (value === "from" && type === TokenType.Keyword) {
      // Look ahead: from <path> import ... — path can be deeply dotted
      for (let i = 1; i <= 30; i++) {
        const ahead = this.peekAt(i);
        if (!ahead || ahead.type === TokenType.EOF) break;
        if (ahead.value === "import" && ahead.type === TokenType.Keyword) return true;
        // Stop if we see operators that aren't dots, or virtual semis
        if (ahead.virtualSemi) break;
        if (ahead.type === TokenType.Operator && ahead.value !== ".") break;
      }
      return false;
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
      // Also check for 'impl' as an identifier (Rust-style impl blocks)
      (type === TokenType.Identifier && value === "impl") ||
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

    // Python-style: from module import names
    if (this.peek().value === "from" && this.peek().type === TokenType.Keyword && this.isDeclStart()) {
      return this.parseFromImport();
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
    
    // Handle Rust-style impl blocks as a special class-like structure
    if (this.peek().value === "impl" && this.peek().type === TokenType.Identifier) {
      return this.parseImplBlock();
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
    
    if (this.check("switch")) {
      this.advance();
      return this.parseSwitch() as AST.Stmt;
    }
    // match keyword — but not when followed by = or { (assignment or variable reference)
    if (this.check("match") && !this.isAssignmentOp(this.peekAt(1)!) && this.peekAt(1)?.value !== "{") {
      this.advance();
      return this.parseSwitch() as AST.Stmt;
    }
    // Kotlin-style `when` as match expression
    if (this.peek().value === "when" &&
        (this.peekAt(1)?.value === "(" || this.peekAt(1)?.value === "{")) {
      this.advance(); // consume 'when'
      return this.parseSwitch() as AST.Stmt;
    }
    
    // Bash-style case...in...esac — allowed even inside switch (distinguishes from switch case)
    if (this.peek().value === "case") {
      // Bash case: `case expr in ... esac` — detect by looking for `in` after expr
      if (!this.insideSwitch) {
        this.advance();
        return this.parseCaseStatement();
      } else {
        // Inside a switch, only allow if it looks like bash case (has `in` or `when` nearby)
        const cp = this.current;
        this.advance(); // case
        const expr = this.parsePrimary(); // consume discriminant
        if (this.check("in") || this.check("when")) {
          this.advance(); // consume 'in' or 'when'
          return this.parseCaseEsac(cp, expr);
        }
        // Not bash case — restore and let switch handle it
        this.current = cp;
      }
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

      // Resource management: using var = expr { ... } or using (Type var = expr) { ... }
      if ((next?.type === TokenType.Identifier && nextNext?.value === "=") ||
          next?.value === "(") {
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
    
    // Rust `use path::to::module`, Ruby `include Module`
    if (this.peek().type === TokenType.Identifier &&
        (this.peek().value === "use" || this.peek().value === "include") &&
        this.peekAt(1) && (this.peekAt(1)!.type === TokenType.Identifier ||
                           this.peekAt(1)!.type === TokenType.StringLiteral)) {
      this.advance(); // consume 'use' or 'include'
      return this.parseImport() as any;
    }

    // Rust `mod name;` module declaration
    if (this.peek().type === TokenType.Identifier && this.peek().value === "mod" &&
        this.peekAt(1)?.type === TokenType.Identifier) {
      this.advance(); // consume 'mod'
      const modName = this.parseIdentifier();
      this.consumeSemicolon();
      return { kind: "Import", path: modName.name, span: modName.span } as any;
    }

    // Check for short declarations (Go-style :=)
    if (this.peek().type === TokenType.Identifier) {
      const checkpoint = this.current;
      this.advance();
      if (this.check(":=")) {
        this.current = checkpoint;
        return this.parseShortDecl() as any; // ShortDecl can be used as a statement
      }
      this.current = checkpoint;
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
          break;
        }

        const beforePos = this.current;
        try {
          // Skip virtual semicolons
          while (this.peek().virtualSemi) {
            this.advance();
          }

          let stmt: AST.Decl | AST.Stmt | null = null;

          if (this.isDeclStart()) {
            stmt = this.parseDeclaration();
          } else if (!this.check("}")) {
            stmt = this.parseStatement();
          }

          if (stmt) {
            statements.push(stmt);
          }
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
  
  private parseSelectStatement(): AST.Select {
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
    return {
      kind: "Select",
      cases,
      defaultCase,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseCaseStatement(): AST.Switch {
    const start = this.current - 1;
    // Parse the discriminant - just a primary expression to avoid consuming 'in'
    const discriminant = this.parsePrimary();
    // Accept both 'in' (bash) and 'when' (Ruby) as the keyword after case discriminant
    if (!this.match("in") && !this.match("when")) {
      this.consume("in", "Expected 'in' or 'when' after case expression");
    }
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
        
        // Parse case body — stop at ;;, esac, or new pattern followed by )
        const statements: (AST.Decl | AST.Stmt)[] = [];
        while (!this.check(";;") && !this.check("esac") && !this.isAtEnd()) {
          if (this.isNewCaseArm()) break;
          const stmt = this.parseTopLevel();
          if (stmt) statements.push(stmt);
        }

        const body: AST.Block = {
          kind: "Block",
          statements,
          span: this.createSpan(this.current, this.current)
        };

        // Skip vsemis before checking for ;;
        while (this.peek().virtualSemi) this.advance();
        // Check for fallthrough (no ;;)
        const fallthrough = !this.match(";;");

        // Add default case to cases array with empty patterns to indicate default
        cases.push({
          patterns: [], // Empty patterns indicate default case
          body,
          fallthrough,
          span: this.createSpan(this.current, this.current)
        });

        // Also set defaultCase for backward compatibility
        defaultCase = body;
      } else {
        // Parse pattern (number, string, etc.)
        patterns.push(this.parseExpression());

        this.consume(")", "Expected ')' after case pattern");

        // Parse case body — stop at ;;, esac, or new pattern followed by )
        const statements: (AST.Decl | AST.Stmt)[] = [];
        while (!this.check(";;") && !this.check("esac") && !this.isAtEnd()) {
          // Detect start of a new case arm (implicit arm boundary without ;;)
          if (this.isNewCaseArm()) break;
          const stmt = this.parseTopLevel();
          if (stmt) statements.push(stmt);
        }

        const body: AST.Block = {
          kind: "Block",
          statements,
          span: this.createSpan(this.current, this.current)
        };

        // Skip vsemis before checking for ;;
        while (this.peek().virtualSemi) this.advance();
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
  
  /**
   * Detect if current position starts a new bash case arm pattern.
   * Uses conservative lookahead to avoid false positives.
   * Checks for: literal/identifier/_ followed by ), or range pattern like N..M)
   */
  private isNewCaseArm(): boolean {
    const t = this.peek();
    // Simple pattern: value )
    if ((t.type === TokenType.NumericLiteral || t.type === TokenType.StringLiteral ||
         t.type === TokenType.Identifier || (t.type === TokenType.Keyword && t.value === "_")) &&
        this.peekAt(1)?.value === ")") {
      return true;
    }
    // Range pattern: N..M ) or N..M)
    if ((t.type === TokenType.NumericLiteral || t.type === TokenType.Identifier) &&
        this.peekAt(1)?.value === ".." &&
        this.peekAt(2) &&
        this.peekAt(3)?.value === ")") {
      return true;
    }
    // Wildcard pattern: * )
    if (t.value === "*" && this.peekAt(1)?.value === ")") {
      return true;
    }
    return false;
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
      // Skip virtual semicolons before checking indentation
      while (this.peek().virtualSemi) {
        this.advance();
      }
      if (this.isAtEnd()) break;

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
      
      const body = this.check("{") ? this.parseBlock() : this.parseAssignmentExpression();
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
      // Skip JSX whitespace tokens if we're in a JSX context
      this.skipJSXWhitespace();
      
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
      
      // Skip JSX whitespace after operators
      this.skipJSXWhitespace();
      
      // Skip virtual semicolons after binary operators
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      // Handle ternary operator
      if (op.value === "?") {
        this.skipJSXWhitespace();
        const consequent = this.parseExpression();
        this.skipJSXWhitespace();
        this.consume(":", "Expected ':' in ternary expression");
        this.skipJSXWhitespace();
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
    // Handle function expressions (including async)
    // But not when func() looks like a function call (no body follows the parens)
    if ((this.peek().value === "function" || this.peek().value === "func") &&
        !this.looksLikeFuncCall()) {
      const start = this.current;
      this.advance(); // consume 'function' or 'func'

      // Check for generator function*
      const isGenerator = this.match("*");

      // Function expressions can be anonymous
      let name: AST.Identifier | undefined = undefined;
      if (this.peek().type === TokenType.Identifier) {
        name = this.parseIdentifier();
      }

      // Parse parameters
      const params = this.parseParameterList();

      // Parse return type if present
      let returnType: AST.TypeNode | undefined = undefined;
      if (this.match(":")) {
        returnType = this.parseType();
      }

      // Parse body
      const body = this.parseBlock();

      // Return as a Lambda expression (anonymous function)
      // Allow postfix operations (like IIFE calls: func(){}())
      const lambda: AST.Expr = {
        kind: "Lambda",
        params,
        returnType,
        body,
        span: this.createSpan(start, this.current - 1)
      };
      if (isGenerator) (lambda as any).generator = true;
      return this.parsePostfix(lambda);
    }
    
    // Handle async lambda/function expressions
    if (this.peek().value === "async") {
      // Look ahead to see if this is really an async function/lambda
      const next = this.peekNext();
      const isAsyncFunction = next && (
        next.value === "(" ||  // async () => 
        next.value === "{" ||  // async { ... }
        next.value === "move" || // async move { ... } (Rust-style)
        (next.type === TokenType.Identifier && this.peekAt(2)?.value === "=>") || // async x =>
        next.value === "function" // async function
      );
      
      if (isAsyncFunction) {
        this.advance(); // consume 'async'
        const start = this.current - 1;
        
        // Check for async function expression
        if (this.match("function")) {
          // Parse async function expression
          const isGenerator = this.match("*");
          
          // Function expressions can be anonymous
          let name: AST.Identifier | undefined = undefined;
          if (this.peek().type === TokenType.Identifier) {
            name = this.parseIdentifier();
          }
          
          // Parse parameters
          const params = this.parseParameterList();
          
          // Parse return type if present
          let returnType: AST.TypeNode | undefined = undefined;
          if (this.match(":")) {
            returnType = this.parseType();
          }
          
          // Parse body
          const body = this.parseBlock();
          
          // Return as an async Lambda expression
          const lambda: any = {
            kind: "Lambda",
            params,
            returnType,
            body,
            span: this.createSpan(start, this.current - 1)
          };
          lambda.async = true;
          if (isGenerator) lambda.generator = true;
          return lambda;
        }
        
        // Check for 'move' keyword (Rust-style async move block)
        const hasMove = this.match("move");
        
        // Check for lambda or async block
        if (this.check("(") || this.peek().type === TokenType.Identifier || this.check("{")) {
          // Parse as async lambda or async block
          const lambda = this.parseAsyncLambda(start);
          // Mark if it has move semantics
          if (hasMove) {
            (lambda as any).move = true;
          }
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
    
    // Handle JSX elements and fragments (spec 10.6)
    const token = this.peek();
    if (token.type === TokenType.JSXTagStart || token.value === "<") {
      // Check if we're in a valid JSX expression context
      if (this.isInJSXExpressionContext()) {
        const next = this.peekNext();
        
        // Check for JSX fragment <>
        if (next && next.value === ">") {
          return this.parseJSXFragment();
        }
        
        // Check for JSX closing tag </
        if (next && next.value === "/") {
          // This shouldn't happen in primary expression position
          throw this.error(this.peek(), "Unexpected JSX closing tag");
        }
        
        // Check if this looks like JSX element using new disambiguation
        if (next && (next.type === TokenType.Identifier || next.value === ">")) {
          if (this.isJSXElement()) {
            return this.parseJSXElement();
          }
        }
      }
      
      // Not JSX - try other interpretations
      const next = this.peekNext();
      if (next && next.type === TokenType.Identifier) {
        // Try type assertion or generic parsing
        
        // Try type assertion <Type>expr
        const checkpoint = this.current;
        this.advance(); // consume '<'
        
        // Try to parse a type (which could be a complex generic type)
        try {
          const type = this.parseType();
          
          // Look for closing '>' - for generic types, this is already consumed
          // For simple types, we need to consume it
          // Also handle >> token that might remain after generic parsing
          if (this.peek().value === ">") {
            this.advance();
          } else if (this.peek().value === ">>") {
            // Split >> into two > tokens for proper handling
            this.advance(); // consume >>
            // Inject a synthetic > token back
            const syntheticToken = { ...this.tokens[this.current - 1] };
            syntheticToken.value = ">";
            this.tokens.splice(this.current, 0, syntheticToken);
          }
          
          // Now we should have a complete type, parse the expression
          // But first check we're at a valid position for an expression
          if (this.isAtEnd() || this.peek().type === TokenType.EOF) {
            throw new Error("Expected expression after type assertion");
          }
          const expr = this.parsePrimary();
          
          return {
            kind: "TypeAssertion",
            expr,
            type,
            span: this.createSpan(checkpoint, this.current - 1)
          };
        } catch (e) {
          // Not a valid type assertion, restore position
          this.current = checkpoint;
          // Re-throw if it's not a parsing error we can recover from
          if (e instanceof Error && e.message && !e.message.includes("Unexpected")) {
            throw e;
          }
        }
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
      return this.parsePostfix(this.parseRegexLiteral());
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
    
    // Runtime tag expressions: @py(expr), @js(expr), @go(expr), @rb(expr), @java(expr)
    if (this.check("@")) {
      const runtimeNames = ["py", "js", "go", "rb", "java"];
      const nextToken = this.peekNext();
      if (nextToken && runtimeNames.includes(nextToken.value)) {
        const checkpoint = this.current;
        const atToken = this.advance(); // consume @
        const runtimeName = this.advance(); // consume runtime name
        if (this.check("(")) {
          this.advance(); // consume (
          const expr = this.parseExpression();
          this.consume(")", "Expected ')' after runtime-tagged expression");
          return this.parsePostfix({
            kind: "RuntimeTag",
            runtime: runtimeName.value as AST.RuntimeTag["runtime"],
            expr,
            span: this.createSpan(checkpoint, this.current - 1)
          });
        }
        // Not a runtime tag call, restore
        this.current = checkpoint;
      }
    }

    // Kotlin-style `when` as match expression
    if (this.peek().value === "when" &&
        (this.peekAt(1)?.value === "(" || this.peekAt(1)?.value === "{")) {
      this.advance(); // consume 'when'
      const switchExpr = this.parseSwitch();
      return switchExpr as any;
    }

    // Go composite literals: map[K]V{...}, []Type{...}
    if (this.check("map") && this.peekAt(1)?.value === "[") {
      return this.parsePostfix(this.parseGoCompositeLiteral());
    }
    if (this.check("[") && this.peekAt(1)?.value === "]" &&
        (this.peekAt(2)?.type === TokenType.Identifier ||
         (this.peekAt(2)?.type === TokenType.Keyword &&
          ["map", "interface", "struct", "chan"].includes(this.peekAt(2)?.value || "")))) {
      // Only parse as Go slice literal if { follows the type (lookahead to confirm)
      const checkpoint = this.current;
      try {
        this.advance(); // [
        this.advance(); // ]
        // For simple identifiers (byte, int, string, etc.), just skip one token
        // to avoid parseType() over-consuming the following '(' as function type params
        if (this.peek().type === TokenType.Identifier) {
          this.advance();
        } else {
          this.parseGoTypeAnnotation(); // handle map[K]V, interface{}, etc.
        }
        if (this.check("{") || this.check("(")) {
          this.current = checkpoint;
          return this.parsePostfix(this.parseGoCompositeLiteral());
        }
      } catch {}
      this.current = checkpoint;
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
      // Per spec: generics only when < follows identifier with NO whitespace
      if (this.peek().value === "<" && !this.hasWhitespaceBefore()) {
        const next = this.peekNext();
        // Only try to parse generics if not followed by a number or obvious non-type token
        if (next && next.type !== TokenType.NumericLiteral && 
            next.type === TokenType.Identifier) {
          const genericArgs = this.tryParseGenericArgs();
          if (genericArgs) {
            // Store generic arguments for potential call expression
            // This will be picked up by parsePostfix if followed by ()
            (id as any)._genericArgs = genericArgs;
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
      
      // Skip virtual semicolons and JSX whitespace after opening parenthesis
      while (this.peek().virtualSemi) {
        this.advance();
      }
      this.skipJSXWhitespace();
      
      const expr = this.parseExpression();
      
      // Skip virtual semicolons and JSX whitespace before closing parenthesis
      while (this.peek().virtualSemi) {
        this.advance();
      }
      this.skipJSXWhitespace();
      
      // Check for generator comprehension: (expr for var in iterable)
      if (this.check("for")) {
        return this.parseGeneratorComprehension(expr, start);
      }
      
      this.must(")", { recoverWithSynthetic: true });
      return this.parsePostfix(expr);
    }
    
    // Array literal
    if (this.match("[")) {
      return this.parsePostfix(this.parseArrayLiteral());
    }

    // Object literal
    if (this.match("{")) {
      return this.parsePostfix(this.parseObjectLiteral());
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
    
    // match expression — but not when followed by assignment (e.g. match = str =~ rx)
    // or { (e.g. if match { ... } where match is a variable name used as condition)
    if (this.check("match") && !this.isAssignmentOp(this.peekAt(1)!) && this.peekAt(1)?.value !== "{") {
      this.advance();
      const switchExpr = this.parseSwitch();
      return switchExpr as any;
    }
    // match as identifier (assignment target or variable reference)
    if (this.check("match")) {
      const token = this.advance();
      const id: AST.Identifier = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
      return this.parsePostfix(id);
    }

    // Ruby symbol literals: :identifier or :keyword
    if (this.check(":") && !this.check("::")) {
      const next = this.peekAt(1);
      if (next && (next.type === TokenType.Identifier || next.type === TokenType.Keyword)) {
        const start = this.current;
        this.advance(); // consume ':'
        const name = this.advance(); // consume identifier/keyword
        return this.parsePostfix({
          kind: "StringLiteral",
          parts: [{ kind: "Text", value: ":" + name.value }],
          flags: {},
          delimiter: ":",
          span: this.createSpan(start, this.current - 1)
        });
      }
    }

    // Ruby percent literals: %r{pattern}flags, %w{word list}, %i{symbol list}
    if (this.check("%")) {
      const next = this.peekAt(1);
      if (next && next.type === TokenType.Identifier && /^[rwiqQxs]$/.test(next.value)) {
        const nextNext = this.peekAt(2);
        if (nextNext && (nextNext.value === "{" || nextNext.value === "[" || nextNext.value === "(")) {
          const start = this.current;
          this.advance(); // consume '%'
          const kind = this.advance(); // consume letter (r, w, etc.)
          const open = this.advance(); // consume opening delimiter
          const close = open.value === "{" ? "}" : open.value === "[" ? "]" : ")";
          // Consume content until matching close delimiter
          let depth = 1;
          while (!this.isAtEnd() && depth > 0) {
            if (this.peek().value === open.value) depth++;
            else if (this.peek().value === close) depth--;
            if (depth > 0) this.advance();
          }
          if (!this.isAtEnd()) this.advance(); // consume closing delimiter
          // Consume optional trailing flags (e.g., 'i', 'g', 'mix')
          if (!this.isAtEnd() && this.peek().type === TokenType.Identifier &&
              /^[igmxsue]+$/.test(this.peek().value)) {
            this.advance();
          }
          return {
            kind: "RegexLiteral",
            pattern: "%" + kind.value + open.value + "..." + close,
            flags: "",
            span: this.createSpan(start, this.current - 1)
          } as any;
        }
      }
    }

    throw this.error(this.peek(), "Unexpected token in expression");
  }
  
  private parsePostfix(expr: AST.Expr): AST.Expr {
    // Note: Generic arguments are now parsed in parsePrimary and attached to the identifier
    // They will be in expr._genericArgs if present
    
    while (true) {
      // Check for generic arguments after member access (e.g., React.forwardRef<T1, T2>)
      // This handles cases where generics appear after a member access operation
      if (this.check("<") && !this.check("<-") && !this.check("<<") && !this.check("<=") && expr.kind === "Member") {
        // Skip if next token after < is a numeric literal — definitely a comparison
        const afterLt = this.peekAt(1);
        if (afterLt && afterLt.type === TokenType.NumericLiteral) {
          // Fall through to binary operator handling below
        } else {
        const checkpoint = this.current;
        const genericArgs = this.tryParseGenericArgs();
        
        if (genericArgs) {
          // Store generic arguments for the next call expression
          (expr as any)._genericArgs = genericArgs;
        } else {
          // Not generic arguments, restore position
          this.current = checkpoint;
        }
        }
      }
      
      // Function call
      if (this.match("(")) {
        // Special case for make() with Go types (channels, slices, maps)
        if (expr.kind === "Identifier" && expr.name === "make") {
          // Check if the next token suggests a Go type
          if (this.check("<-") || this.peek().value === "chan" ||
              (this.check("[") && this.peekAt(1)?.value === "]") ||
              this.peek().value === "map") {
            // Use parseGoTypeAnnotation for Go-specific types (slices, maps)
            // Use parseType for chan (supports angle bracket generics like chan<T>)
            const useGoType = (this.check("[") && this.peekAt(1)?.value === "]") || this.peek().value === "map";
            const typeNode = useGoType ? this.parseGoTypeAnnotation() : this.parseType();
            
            // If it's a GenericType with chan base, keep it as a structured expression
            let typeExpr: AST.Expr;
            if (typeNode.kind === "GenericType" && typeNode.base.name === "chan") {
              // Keep the GenericType structure accessible by wrapping in a special node
              // For now, we'll still convert to string but mark it specially
              typeExpr = {
                kind: "Identifier",
                name: this.typeNodeToString(typeNode),
                originalSpelling: this.typeNodeToString(typeNode),
                span: typeNode.span,
                // Store the original type info in a non-standard field for test access
                _typeNode: typeNode
              } as any;
            } else {
              typeExpr = {
                kind: "Identifier",
                name: this.typeNodeToString(typeNode),
                originalSpelling: this.typeNodeToString(typeNode),
                span: typeNode.span
              };
            }
            
            // Handle optional size/capacity arguments
            const args: AST.Expr[] = [typeExpr];
            while (this.match(",")) {
              args.push(this.parseAssignmentExpression());
            }
            
            this.must(")", { recoverWithSynthetic: true });
            
            // Create the Call node, and if we have a GenericType, store it
            const callExpr: AST.Call = {
              kind: "Call",
              callee: expr,
              args,
              span: this.createSpanFrom(expr)
            };
            
            // Store the type node in a non-standard field for test access
            if ((typeExpr as any)._typeNode) {
              (callExpr as any)._typeNode = (typeExpr as any)._typeNode;
            }
            
            expr = callExpr;
            continue;
          }
        }
        
        const args = this.parseArguments();
        this.must(")", { recoverWithSynthetic: true });
        
        // Check if we have stored generic arguments
        const genericArgs = (expr as any)._genericArgs;
        
        const callExpr: AST.Call = {
          kind: "Call",
          callee: expr,
          args,
          span: this.createSpanFrom(expr)
        };
        
        // Add generic arguments if they exist
        if (genericArgs) {
          (callExpr as any).genericArgs = genericArgs;
          // Clean up the temporary storage
          delete (expr as any)._genericArgs;
        }
        
        expr = callExpr;
        
        // Check for Ruby block after function call
        if (this.check("do") && !this.noRubyBlock) {
          const blockStart = this.current;
          this.advance(); // consume 'do'
          
          // Parse block parameters if present |x, y|
          let blockParams: AST.Identifier[] = [];
          if (this.match("|")) {
            do {
              blockParams.push(this.parseIdentifier());
            } while (this.match(","));
            this.consume("|", "Expected '|' after block parameters");
          }
          
          // Parse block body until 'end' or 'done'
          const blockStatements: (AST.Stmt | AST.Decl)[] = [];
          while (!this.isAtEnd() && this.peek().value !== "end" && this.peek().value !== "done") {
            if (this.peek().virtualSemi) {
              this.advance();
              continue;
            }

            const stmt = this.parseStatement();
            if (stmt) blockStatements.push(stmt);
          }

          if (!this.match("end") && !this.match("done")) {
            this.consume("end", "Expected 'end' to close Ruby block");
          }

          // Add block as a special property on the call (not in standard AST)
          (callExpr as any).rubyBlock = {
            params: blockParams,
            body: blockStatements,
            span: this.createSpan(blockStart, this.current - 1)
          };
        }

        continue;
      }

      // Check for Ruby block after member access (Ruby method calls without parens)
      // e.g., items.each do |item| ... end
      if (this.check("do") && expr.kind === "Member" && !this.noRubyBlock) {
        // Convert the member access to a call with no arguments
        const callExpr: AST.Call = {
          kind: "Call",
          callee: expr,
          args: [],
          span: expr.span
        };

        const blockStart = this.current;
        this.advance(); // consume 'do'

        // Parse block parameters if present |x, y|
        let blockParams: AST.Identifier[] = [];
        if (this.match("|")) {
          do {
            blockParams.push(this.parseIdentifier());
          } while (this.match(","));
          this.consume("|", "Expected '|' after block parameters");
        }

        // Parse block body until 'end' or 'done'
        const blockStatements: (AST.Stmt | AST.Decl)[] = [];
        while (!this.isAtEnd() && this.peek().value !== "end" && this.peek().value !== "done") {
          if (this.peek().virtualSemi) {
            this.advance();
            continue;
          }

          const stmt = this.parseStatement();
          if (stmt) blockStatements.push(stmt);
        }

        if (!this.match("end") && !this.match("done")) {
          this.consume("end", "Expected 'end' to close Ruby block");
        }
        
        // Add block as a special property on the call
        (callExpr as any).rubyBlock = {
          params: blockParams,
          body: blockStatements,
          span: this.createSpan(blockStart, this.current - 1)
        };
        
        expr = callExpr;
        continue;
      }
      
      // Ruby block with curly braces: expr { |x, y| body }
      // Only when { is followed by | (to disambiguate from object literals/blocks)
      if (this.check("{") && this.peekNext()?.value === "|" && !this.noRubyBlock &&
          (expr.kind === "Call" || expr.kind === "Member" || expr.kind === "Identifier")) {
        // Convert to call if needed
        let callExpr: AST.Call;
        if (expr.kind === "Call") {
          callExpr = expr as AST.Call;
        } else {
          callExpr = {
            kind: "Call",
            callee: expr,
            args: [],
            span: expr.span
          };
        }

        const blockStart = this.current;
        this.advance(); // consume '{'

        // Parse block parameters |x, y|
        let blockParams: AST.Identifier[] = [];
        if (this.match("|")) {
          do {
            blockParams.push(this.parseIdentifier());
          } while (this.match(","));
          this.consume("|", "Expected '|' after block parameters");
        }

        // Parse block body until '}'
        const blockStatements: (AST.Stmt | AST.Decl)[] = [];
        while (!this.isAtEnd() && !this.check("}")) {
          if (this.peek().virtualSemi) {
            this.advance();
            continue;
          }

          const stmt = this.parseStatement();
          if (stmt) blockStatements.push(stmt);
        }

        this.consume("}", "Expected '}' to close Ruby block");

        (callExpr as any).rubyBlock = {
          params: blockParams,
          body: blockStatements,
          span: this.createSpan(blockStart, this.current - 1)
        };

        expr = callExpr;
        continue;
      }

      // Member access and optional chaining
      // Check for ?. first to handle both ?.property and ?.[index]
      if (this.peek().value === "?.") {
        const next = this.peekNext();
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
      
      // Scope resolution operator (C++/Rust style)
      if (this.match("::")) {
        // After ::, keywords can be used as identifiers
        const next = this.peek();
        let property: AST.Identifier;
        
        if (next.type === TokenType.Identifier || next.type === TokenType.Keyword) {
          property = {
            kind: "Identifier",
            name: next.value,
            originalSpelling: next.value,
            span: this.createSpan(this.current, this.current)
          };
          this.advance();
        } else {
          property = this.parseIdentifier();
        }
        
        expr = {
          kind: "Member",
          object: expr,
          property,
          computed: false,
          optional: false,
          span: this.createSpanFrom(expr)
        };
        continue;
      }
      
      // Regular member access (including pointer dereference, force unwrap, and PHP arrow)
      if (this.match(".", ".*", "!.", "->")) {
        const op = this.previous()?.value;
        const deref = op === ".*";
        const forceUnwrap = op === "!.";
        const phpArrow = op === "->";
        
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
          // Check for .await syntax (Rust-style)
          if (this.peek().value === "await") {
            this.advance(); // consume await
            expr = {
              kind: "Unary",
              op: "await",
              argument: expr,
              prefix: false,
              span: this.createSpanFrom(expr)
            };
            continue;
          }

          // Go type assertion: expr.(Type) or expr.(type)
          if (this.check("(")) {
            this.advance(); // consume (
            if (this.check("type")) {
              // Go type switch: expr.(type)
              this.advance(); // consume 'type'
              this.consume(")", "Expected ')' after type assertion");
              expr = {
                kind: "TypeAssertion",
                expr,
                type: {
                  kind: "SimpleType",
                  id: { kind: "Identifier", name: "type", span: this.createSpanFrom(expr) },
                  span: this.createSpanFrom(expr)
                } as AST.TypeNode,
                span: this.createSpanFrom(expr)
              };
            } else {
              // Go type assertion: expr.(ConcreteType)
              const type = this.parseGoTypeAnnotation();
              this.consume(")", "Expected ')' after type assertion");
              expr = {
                kind: "TypeAssertion",
                expr,
                type,
                span: this.createSpanFrom(expr)
              };
            }
            continue;
          }

          // Regular member access, force unwrap, or PHP arrow
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
            // Regular member access (. or ->)
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
      
      // Try operator (Rust) - only at end of expression or before certain tokens
      if (this.check("?")) {
        const next = this.peekNext();
        // Treat as postfix ? if followed by:
        // - End of statement (; or newline)
        // - Closing bracket/paren
        // - Comma
        // - Binary operators (but not :)
        const isPostfix = !next ||
                         next.type === TokenType.EOF ||
                         next.value === ";" ||
                         next.value === ")" ||
                         next.value === "]" ||
                         next.value === "}" ||
                         next.value === "," ||
                         next.virtualSemi ||
                         (this.isBinaryOp(next) && next.value !== ":" && next.value !== "<") ||
                         (next.type === TokenType.Keyword && this.isStatementKeyword(next.value));
        
        if (isPostfix) {
          this.advance(); // consume ?
          expr = {
            kind: "Unary",
            op: "?",
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
  private parseImport(): AST.Import | AST.ImportDecl {
    const start = this.current - 1;
    
    // Handle TypeScript-style imports: import { ... } from '...' or import * as ... from '...'
    let alias: AST.Identifier | undefined;
    let path: string;
    
    // Check for destructured imports: import { Token, TokenType } from './lexer'
    if (this.check("{")) {
      this.advance();
      
      // Parse import specifiers
      const specifiers: AST.ImportSpecifier[] = [];
      
      if (!this.check("}")) {
        do {
          const imported = this.parseIdentifier().name;
          let local = imported;
          
          // Check for "as" alias
          if (this.match("as")) {
            local = this.parseIdentifier().name;
          }
          
          specifiers.push({ imported, local });
        } while (this.match(",") && !this.check("}"));
      }
      
      this.consume("}", "Expected '}' after import specifiers");
      
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
      
      this.consumeSemicolon();
      
      return {
        kind: "ImportDecl",
        specifiers,
        path,
        span: this.createSpan(start, this.current - 1)
      };
    }
    // Check for namespace import: import * as AST from './ast'
    else if (this.check("*")) {
      this.advance();
      let namespaceImport: AST.Identifier | undefined;
      if (this.match("as")) {
        namespaceImport = this.parseIdentifier();
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
      
      this.consumeSemicolon();
      
      return {
        kind: "ImportDecl",
        namespaceImport,
        path,
        span: this.createSpan(start, this.current - 1)
      };
    }
    // Check for default import with destructured: import React, { Component } from 'react'
    else if (this.peek().type === TokenType.Identifier) {
      const maybeDefault = this.peek();
      const nextToken = this.peekNext();
      
      if (nextToken && nextToken.value === ",") {
        // Default import with destructured
        const defaultImport = this.parseIdentifier();
        this.consume(",", "Expected ','");
        
        // Parse destructured imports
        const specifiers: AST.ImportSpecifier[] = [];
        if (this.check("{")) {
          this.advance();
          
          if (!this.check("}")) {
            do {
              const imported = this.parseIdentifier().name;
              let local = imported;
              
              // Check for "as" alias
              if (this.match("as")) {
                local = this.parseIdentifier().name;
              }
              
              specifiers.push({ imported, local });
            } while (this.match(",") && !this.check("}"));
          }
          
          this.consume("}", "Expected '}' after import specifiers");
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
        
        this.consumeSemicolon();
        
        return {
          kind: "ImportDecl",
          defaultImport,
          specifiers: specifiers.length > 0 ? specifiers : undefined,
          path,
          span: this.createSpan(start, this.current - 1)
        };
      }
      // Simple import: import 'module' or import module
      else if (nextToken && nextToken.value === "from") {
        // Default import: import Parser from './parser'
        const defaultImport = this.parseIdentifier();
        this.consume("from", "Expected 'from'");
        
        if (this.peek().type === TokenType.StringLiteral) {
          const token = this.advance();
          path = token.value.slice(1, -1);
        } else {
          throw this.error(this.peek(), "Expected import path after 'from'");
        }
        
        this.consumeSemicolon();
        
        return {
          kind: "ImportDecl",
          defaultImport,
          path,
          span: this.createSpan(start, this.current - 1)
        };
      }
      // Old-style simple import (possibly dotted or :: separated)
      else {
        let pathParts = [this.advance().value];
        while (this.match(".") || this.match("::")) {
          const sep = this.previous()!.value;
          if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword) {
            pathParts.push(sep === "::" ? "::" : ".");
            pathParts.push(this.advance().value);
          } else if (this.match("*")) {
            pathParts.push(sep === "::" ? "::" : ".");
            pathParts.push("*");
          } else break;
        }
        path = pathParts.join("");
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
    }
    // Go grouped imports: import ( "fmt" "os" )
    else if (this.check("(")) {
      this.advance(); // consume '('
      const imports: (AST.Import | AST.ImportDecl)[] = [];
      while (!this.check(")") && !this.isAtEnd()) {
        while (this.peek().virtualSemi) this.advance();
        if (this.check(")")) break;
        if (this.peek().type === TokenType.StringLiteral) {
          const token = this.advance();
          const importPath = token.value.slice(1, -1);
          let importAlias: AST.Identifier | undefined;
          // Go import alias comes BEFORE the path, but we already consumed it
          // For simplicity, also check for `as` after
          if (this.match("as")) {
            importAlias = this.parseIdentifier();
          }
          imports.push({
            kind: "Import",
            path: importPath,
            alias: importAlias,
            span: this.createSpanFrom(token)
          });
        } else if (this.peek().type === TokenType.Identifier) {
          // Go alias import: alias "path"
          const importAlias = this.parseIdentifier();
          if (this.peek().type === TokenType.StringLiteral) {
            const token = this.advance();
            const importPath = token.value.slice(1, -1);
            imports.push({
              kind: "Import",
              path: importPath,
              alias: importAlias,
              span: this.createSpanFrom(token)
            });
          }
        } else {
          this.advance(); // skip unknown token
        }
        while (this.peek().virtualSemi) this.advance();
      }
      this.consume(")", "Expected ')' after grouped imports");
      this.consumeSemicolon();

      // Return first import if only one, otherwise return first and let the rest
      // be handled by re-parsing. For grouped imports, wrap as first import.
      if (imports.length === 0) {
        return { kind: "Import", path: "", span: this.createSpan(start, this.current - 1) };
      }
      // Return the first import — the rest will be lost, but the parse won't error.
      // A proper solution would need a multi-import AST node.
      return imports[0];
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
  
  private parseFromImport(): AST.ImportDecl {
    const start = this.current;
    this.advance(); // consume 'from'

    // Parse the module path — could be dotted identifier or string
    let path: string;
    if (this.peek().type === TokenType.StringLiteral) {
      const token = this.advance();
      path = token.value.slice(1, -1);
    } else {
      // Dotted path like typing, os.path, etc.
      let pathParts = [this.advance().value];
      while (this.match(".")) {
        pathParts.push(this.advance().value);
      }
      path = pathParts.join(".");
    }

    this.consume("import", "Expected 'import' after module path");

    // Parse imported names
    const specifiers: AST.ImportSpecifier[] = [];
    do {
      const imported = this.parseIdentifier().name;
      let local = imported;
      if (this.match("as")) {
        local = this.parseIdentifier().name;
      }
      specifiers.push({ imported, local });
    } while (this.match(","));

    this.consumeSemicolon();

    return {
      kind: "ImportDecl",
      specifiers,
      path,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseVarDecl(): AST.VarDecl {
    const start = this.current - 1;

    // Rust-style: let mut x = ...
    if (this.peek().value === "mut") {
      this.advance(); // skip 'mut'
    }

    // Go grouped var: var ( name = value \n name2 = value2 )
    if (this.check("(")) {
      this.advance(); // consume '('
      const allNames: AST.Identifier[] = [];
      const allValues: AST.Expr[] = [];
      while (!this.check(")") && !this.isAtEnd()) {
        while (this.peek().virtualSemi) this.advance();
        if (this.check(")")) break;
        const name = this.parseIdentifier();
        allNames.push(name);
        if (this.match("=")) {
          allValues.push(this.parseAssignmentExpression());
        }
        while (this.peek().virtualSemi) this.advance();
      }
      this.consume(")", "Expected ')' after grouped var declarations");
      this.consumeSemicolon();
      return {
        kind: "VarDecl",
        names: allNames,
        values: allValues.length > 0 ? allValues : undefined,
        span: this.createSpan(start, this.current - 1)
      };
    }

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
    const pattern = this.parseDestructuringPattern();
    
    this.consume(":=", "Expected ':=' in destructuring declaration");
    
    const value = this.parseExpression();
    
    this.consumeSemicolon();
    
    return {
      kind: "ShortDecl",
      targets: [pattern],
      value,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseShortDecl(): AST.ShortDecl {
    const start = this.current;
    const targets: (AST.Identifier | AST.ArrayPattern | AST.ObjectPattern)[] = [];
    
    // Parse targets (can be identifiers or destructuring patterns)
    do {
      if (this.check("[") || this.check("{")) {
        // Destructuring pattern
        targets.push(this.parseDestructuringPattern());
      } else if (this.peek().type === TokenType.Identifier) {
        // Simple identifier
        targets.push(this.parseIdentifier());
      } else {
        throw this.error(this.peek(), "Expected identifier or destructuring pattern");
      }
    } while (this.match(","));
    
    this.consume(":=", "Expected ':=' in short declaration");
    
    // Parse the value expression
    const value = this.parseExpression();
    
    this.consumeSemicolon();
    
    // If it's a simple single-identifier case, use the old format for compatibility
    if (targets.length === 1 && targets[0].kind === "Identifier") {
      return {
        kind: "ShortDecl",
        pairs: [{ name: targets[0], expr: value }],
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // For destructuring or multiple targets
    return {
      kind: "ShortDecl",
      targets,
      value,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseFuncDecl(async = false, unsafe = false, generator = false, decorators?: AST.Expr[]): AST.FuncDecl {
    const start = this.current - 1;

    // Capture the declaration keyword for runtime resolution
    const declKeywordValue = this.tokens[start]?.value;
    const declKeyword = (declKeywordValue === "def" || declKeywordValue === "fn" ||
                         declKeywordValue === "fun" || declKeywordValue === "func" ||
                         declKeywordValue === "function") ? declKeywordValue as AST.FuncDecl["declKeyword"] : undefined;

    // Check if this is a Ruby-style def
    const isRubyDef = declKeywordValue === "def";

    // Ruby/C++ operator overload: def +(other), operator+(...)
    let name: AST.Identifier;
    const isOperatorName = isRubyDef && this.peek().type === TokenType.Operator &&
      ["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "<<", ">>",
       "[]", "[]=", "<=>", "**", "&", "|", "^", "~", "!"].includes(this.peek().value);
    if (isOperatorName) {
      const opToken = this.advance();
      name = {
        kind: "Identifier",
        name: opToken.value,
        span: this.createSpanFrom(opToken)
      };
    } else {
      name = this.parseIdentifier();
    }
    
    // Parse generic parameters if present
    let genericParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      genericParams = [];
      do {
        genericParams.push(this.parseIdentifier());
        // Skip type constraints: extends Type, super Type, : Type
        if (this.match("extends", "super")) {
          this.parseType();
        } else if (this.check(":") && !this.check("::")) {
          this.advance();
          this.parseType();
          while (this.match("+")) {
            this.parseType();
          }
        }
      } while (this.match(","));
      this.consume(">", "Expected '>' after generic parameters");
    }

    // For Ruby def, parameters are optional (can be without parentheses)
    let params: AST.Param[] = [];
    if (this.check("(")) {
      params = this.parseParameterList();
    } else if (isRubyDef && !this.check(":") && !this.check("{") &&
               !this.check("=>") && !this.peek().virtualSemi &&
               this.peek().line === name.span.line) {
      // Ruby allows parameters without parentheses: def foo bar, baz
      // Only if params are on the same line as the function name
      do {
        params.push(this.parseParameter());
      } while (this.match(","));
    }
    
    let returnType: AST.TypeNode | undefined;

    // Check for return type annotations
    if (this.match("->")) {
      // Arrow notation always indicates return type
      returnType = this.parseType();
    } else if (declKeywordValue === "func" && this.check("(") && !this.check("(=")) {
      // Go multi-return: func name(params) (Type1, Type2) { ... }
      const checkpoint = this.current;
      try {
        this.advance(); // consume '('
        const types: AST.TypeNode[] = [];
        if (!this.check(")")) {
          do {
            types.push(this.parseGoTypeAnnotation());
          } while (this.match(","));
        }
        this.consume(")", "Expected ')' after return types");
        if (types.length === 1) {
          returnType = types[0];
        } else if (types.length > 1) {
          // Represent as a tuple/union for multi-return
          returnType = { kind: "UnionType", types, span: this.createSpan(checkpoint, this.current - 1) } as any;
        }
      } catch {
        this.current = checkpoint;
      }
    } else if (declKeywordValue === "func" && this.peek().type === TokenType.Identifier &&
               !this.check("{") && !this.peek().virtualSemi) {
      // Go single return type without parens: func name(params) Type { ... }
      returnType = this.parseGoTypeAnnotation();
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
    } else if (isRubyDef) {
      // Ruby-style def without braces - parse until matching 'end'
      const statements: (AST.Decl | AST.Stmt)[] = [];
      
      // Track nested blocks that also use 'end'
      let endCount = 1; // We need to find one matching 'end' for this def
      
      while (!this.isAtEnd() && endCount > 0) {
        if (this.peek().virtualSemi) {
          this.advance();
          continue;
        }
        
        // Check for keywords that start blocks ending with 'end'
        const token = this.peek();
        if (token.value === "def" || token.value === "class" || token.value === "module") {
          // These start a new block that will need its own 'end'
          endCount++;
        } else if (token.value === "begin") {
          // 'begin' blocks are handled by parseBeginBlock which consumes its own 'end'
          // So we don't need to track it here - parseTopLevel will handle it
        } else if (token.value === "do") {
          // 'do' blocks might end with 'end' (Ruby) or 'done' (bash)
          // Check context to determine if this is a Ruby do...end block
          if (this.current > 0) {
            const prevToken = this.tokens[this.current - 1];
            // Ruby do...end typically follows method calls or control structures
            if (prevToken.type === TokenType.Identifier || 
                prevToken.value === ")" || prevToken.value === "|") {
              endCount++;
            }
          }
        } else if (token.value === "if" || token.value === "unless" ||
                   token.value === "while" || token.value === "until") {
          // These might use 'end' in Ruby style or other endings in bash style
          // Look ahead to see if there's a 'then' or ':' suggesting Ruby style
          const nextIdx = this.current + 1;
          let isRubyStyle = false;
          for (let i = nextIdx; i < this.tokens.length && i < nextIdx + 10; i++) {
            if (this.tokens[i].value === "then" || 
                (this.tokens[i].value === ":" && this.tokens[i].type === TokenType.Operator)) {
              isRubyStyle = true;
              break;
            }
            if (this.tokens[i].virtualSemi || this.tokens[i].value === "{") break;
          }
          if (isRubyStyle) endCount++;
        } else if (token.value === "case") {
          // case might end with 'end' (Ruby) or 'esac' (bash)
          // Look for 'when' to determine Ruby style
          const nextIdx = this.current + 1;
          let isRubyStyle = false;
          for (let i = nextIdx; i < this.tokens.length && i < nextIdx + 20; i++) {
            if (this.tokens[i].value === "when") {
              isRubyStyle = true;
              break;
            }
            if (this.tokens[i].value === "in" || this.tokens[i].value === ")") {
              // Bash style case
              break;
            }
          }
          if (isRubyStyle) endCount++;
        } else if (token.value === "try") {
          // try blocks might use rescue...end in Ruby style
          // Look for 'rescue' to determine Ruby style
          const nextIdx = this.current + 1;
          let isRubyStyle = false;
          for (let i = nextIdx; i < this.tokens.length && i < nextIdx + 50; i++) {
            if (this.tokens[i].value === "rescue") {
              isRubyStyle = true;
              break;
            }
            if (this.tokens[i].value === "catch" || this.tokens[i].value === "except") {
              // JavaScript/Python style
              break;
            }
          }
          if (isRubyStyle) endCount++;
        } else if (token.value === "end") {
          // Found an 'end' - decrement counter
          endCount--;
          if (endCount === 0) {
            // This is our matching 'end'
            break;
          }
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
    } else {
      // Default: try to parse a block or single statement
      if (this.peek().virtualSemi || this.isAtEnd()) {
        // No body provided
        body = {
          kind: "Block",
          statements: [],
          span: this.createSpanFrom(this.previous() || { span: { start: 0, end: 0, line: 0, column: 0 } })
        };
      } else {
        // Try to parse as a single expression or statement
        const stmt = this.parseStatement();
        body = {
          kind: "Block",
          statements: stmt ? [stmt] : [],
          span: this.createSpanFrom(stmt || this.previous())
        };
      }
    }
    
    const funcDecl: AST.FuncDecl = {
      kind: "FuncDecl",
      name,
      genericParams,
      params,
      returnType,
      async,
      unsafe,
      generator,
      declKeyword,
      body: body as AST.Block,
      span: this.createSpan(start, this.current - 1)
    };
    
    // Add decorators if provided
    if (decorators && decorators.length > 0) {
      funcDecl.decorators = decorators.map(expr => ({
        kind: "Decorator" as const,
        name: expr.kind === "Identifier" ? expr : 
              expr.kind === "Call" && expr.callee.kind === "Identifier" ? expr.callee :
              { kind: "Identifier" as const, name: "unknown", span: expr.span },
        args: expr.kind === "Call" ? expr.args : undefined,
        span: expr.span
      }));
    }
    
    return funcDecl;
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
    
    // Parse parameter decorators (e.g., @NotNull, @Range(...))
    const decorators: AST.Decorator[] = [];
    while (this.check("@")) {
      this.advance(); // consume @
      
      // Parse the decorator name
      if (this.peek().type === TokenType.Identifier) {
        const name = this.parseIdentifier();
        let args: AST.Expr[] | undefined;
        
        // Parse decorator arguments if present
        if (this.check("(")) {
          this.advance(); // consume (
          args = [];
          
          if (!this.check(")")) {
            do {
              args.push(this.parseExpression());
            } while (this.match(","));
          }
          
          this.consume(")", "Expected ')' after decorator arguments");
        }
        
        decorators.push({
          kind: "Decorator",
          name,
          args,
          span: this.createSpan(start, this.current - 1)
        });
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
    
    // Handle spread parameter (...param), Python *args, or Python **kwargs
    let isSpread = false;
    if (this.match("...")) {
      isSpread = true;
    } else if (this.check("**")) {
      // Python-style **kwargs (double-splat)
      this.advance(); // consume **
      isSpread = true;
    } else if (this.check("*") &&
               (this.peekNext()?.type === TokenType.Identifier || this.peekNext()?.type === TokenType.Keyword)) {
      // Python-style *args (single-splat)
      this.advance(); // consume *
      isSpread = true;
    }
    
    // Parse parameter name - allow keywords as parameter names
    let name: AST.Identifier | AST.ArrayPattern | AST.ObjectPattern;
    const token = this.peek();
    
    // Handle destructuring patterns { a, b } or [ a, b ]
    if (token.value === "{" || token.value === "[") {
      name = this.parseDestructuringPattern();
    }
    // In parameter context, allow any keyword or identifier as parameter name
    else if (token.type === TokenType.Identifier || 
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
    } else if (name.kind === "Identifier" &&
               !this.check(",") && !this.check(")") && !this.check("=") && !this.check("?") && !this.check("|") &&
               (this.peek().type === TokenType.Identifier ||
                // Go interface{}, struct{}, chan, *Type, []Type, map[K]V
                this.check("interface") || this.check("struct") || this.check("chan") ||
                this.check("map") || this.check("*") ||
                (this.check("[") && this.peekAt(1)?.value === "]"))) {
      // Go-style type annotation: name Type (no colon separator)
      type = this.parseGoTypeAnnotation();
    }

    let defaultValue: AST.Expr | undefined;
    if (this.match("=")) {
      defaultValue = this.parseExpression();
    }

    const param: AST.Param = {
      name,
      type,
      defaultValue,
      visibility,
      readonly,
      spread: isSpread,
      blockParam: isBlockParam,
      span: this.createSpan(start, this.current - 1)
    };
    
    // Add decorators if present
    if (decorators.length > 0) {
      param.decorators = decorators;
    }
    
    return param;
  }

  /**
   * Parse a Go-style type in parameter position: handles interface{}, *Type,
   * chan/chan<-/chan-> Type, []Type, map[K]V, and dotted paths (http.Request).
   */
  private parseGoTypeAnnotation(): AST.TypeNode {
    const start = this.current;
    const mkId = (n: string, span: AST.Span): AST.Identifier => ({ kind: "Identifier", name: n, span });
    const mkSpan = () => this.createSpan(start, this.current - 1);

    // Pointer type: *Type
    if (this.match("*")) {
      const inner = this.parseGoTypeAnnotation();
      return { kind: "SimpleType", id: mkId("*" + (inner.kind === "SimpleType" ? (inner as any).id.name : ""), inner.span), span: inner.span } as any;
    }

    // Slice type: []Type
    if (this.check("[") && this.peekAt(1)?.value === "]") {
      this.advance(); // [
      this.advance(); // ]
      const elem = this.parseGoTypeAnnotation();
      return { kind: "GenericType", base: mkId("[]", mkSpan()), args: [elem], span: mkSpan() } as AST.TypeNode;
    }

    // map[K]V
    if (this.check("map") && this.peekAt(1)?.value === "[") {
      this.advance(); // map
      this.advance(); // [
      const keyType = this.parseGoTypeAnnotation();
      this.consume("]", "Expected ']' after map key type");
      const valType = this.parseGoTypeAnnotation();
      return { kind: "GenericType", base: mkId("map", mkSpan()), args: [keyType, valType], span: mkSpan() } as AST.TypeNode;
    }

    // chan<- Type, <-chan Type, chan Type
    if (this.check("chan")) {
      this.advance(); // chan
      if (this.match("<-")) { /* chan<- Type (send-only) */ }
      const chanType = this.parseGoTypeAnnotation();
      return { kind: "ChanType", direction: "both", elementType: chanType, span: mkSpan() } as any;
    }
    if (this.check("<-") && this.peekAt(1)?.value === "chan") {
      this.advance(); // <-
      this.advance(); // chan
      const chanType = this.parseGoTypeAnnotation();
      return { kind: "ChanType", direction: "recv", elementType: chanType, span: mkSpan() } as any;
    }

    // interface{}
    if (this.check("interface") && this.peekAt(1)?.value === "{") {
      this.advance(); this.advance();
      this.consume("}", "Expected '}' after interface{}");
      return { kind: "SimpleType", id: mkId("interface{}", mkSpan()), span: mkSpan() } as AST.TypeNode;
    }

    // struct{}
    if (this.check("struct") && this.peekAt(1)?.value === "{") {
      this.advance(); this.advance();
      this.consume("}", "Expected '}' after struct{}");
      return { kind: "SimpleType", id: mkId("struct{}", mkSpan()), span: mkSpan() } as AST.TypeNode;
    }

    // Fall back to regular type parsing (handles dotted types, generics, etc.)
    return this.parseType();
  }

  /**
   * Parse a Go composite literal: map[K]V{...}, []Type{...}, Type{...}
   * Returns an ObjectLiteral (for map) or ArrayLiteral (for slice) node.
   */
  private parseGoCompositeLiteral(): AST.Expr {
    const start = this.current;
    // Parse the Go type
    const goType = this.parseGoTypeAnnotation();

    // If followed by { ... }, parse the composite literal body
    if (this.check("{")) {
      this.advance(); // consume {
      // Skip virtual semicolons
      while (this.peek().virtualSemi) this.advance();

      // Check if this is a map-like type (has key-value pairs) or slice-like (has values)
      const entries: AST.ObjectProperty[] = [];
      const elements: AST.Expr[] = [];
      let isMap = false;

      while (!this.check("}") && !this.isAtEnd()) {
        while (this.peek().virtualSemi) this.advance();
        if (this.check("}")) break;

        const expr = this.parseAssignmentExpression();

        if (this.match(":")) {
          // key: value pair (map literal)
          isMap = true;
          const value = this.parseAssignmentExpression();
          entries.push({
            key: expr,
            value,
            span: this.createSpanFrom(expr)
          });
        } else {
          // Just a value (slice literal)
          elements.push(expr);
        }

        this.match(","); // optional trailing comma
        while (this.peek().virtualSemi) this.advance();
      }
      this.consume("}", "Expected '}' in Go composite literal");

      if (isMap || entries.length > 0) {
        return {
          kind: "ObjectLiteral",
          properties: entries,
          span: this.createSpan(start, this.current - 1)
        } as AST.ObjectLiteral;
      } else {
        return {
          kind: "ArrayLiteral",
          elements,
          span: this.createSpan(start, this.current - 1)
        } as AST.ArrayLiteral;
      }
    }

    // No { after type — treat as a type conversion: []byte(data) etc.
    // Parse it as a call-like expression
    if (this.check("(")) {
      this.advance(); // consume (
      const args: AST.Expr[] = [];
      if (!this.check(")")) {
        do {
          args.push(this.parseExpression());
        } while (this.match(","));
      }
      this.consume(")", "Expected ')' in Go type conversion");
      const typeName: AST.Identifier = {
        kind: "Identifier",
        name: goType.kind === "SimpleType" ? ((goType as any).id?.name || "unknown") :
              goType.kind === "GenericType" ? ("[]" + ((goType as any).args?.[0]?.id?.name || "")) : "GoType",
        span: this.createSpan(start, this.current - 1)
      };
      return {
        kind: "Call",
        callee: typeName,
        args,
        span: this.createSpan(start, this.current - 1)
      } as AST.Call;
    }

    // Fallback: just return the type name as an identifier
    const typeName: AST.Identifier = {
      kind: "Identifier",
      name: goType.kind === "SimpleType" ? ((goType as any).id?.name || "GoType") : "GoType",
      span: this.createSpan(start, this.current - 1)
    };
    return typeName;
  }

  private parseDestructuringPattern(): AST.ArrayPattern | AST.ObjectPattern {
    const start = this.current;
    const token = this.peek();
    
    if (token.value === "[") {
      // Array destructuring pattern
      this.advance(); // consume [
      const elements: (AST.Identifier | AST.ArrayPattern | AST.ObjectPattern | null)[] = [];
      
      while (!this.check("]") && !this.isAtEnd()) {
        // Skip virtual semicolons
        while (this.peek().virtualSemi) this.advance();
        
        // Check for hole in array pattern (e.g., [a, , c])
        if (this.check(",")) {
          elements.push(null);
          this.advance();
          continue;
        }
        
        // Parse nested pattern or identifier
        if (this.check("[") || this.check("{")) {
          elements.push(this.parseDestructuringPattern());
        } else if (this.peek().type === TokenType.Identifier) {
          const name = this.parseIdentifier();
          elements.push(name);
        } else {
          break;
        }
        
        // Skip virtual semicolons before comma
        while (this.peek().virtualSemi) this.advance();
        
        if (!this.match(",")) {
          break;
        }
      }
      
      this.consume("]", "Expected ']' after array pattern");
      
      return {
        kind: "ArrayPattern",
        elements,
        span: this.createSpan(start, this.current - 1)
      };
    } else {
      // Object destructuring pattern
      this.advance(); // consume {
      const properties: AST.ObjectPatternProperty[] = [];
      
      while (!this.check("}") && !this.isAtEnd()) {
        // Skip virtual semicolons
        while (this.peek().virtualSemi) this.advance();
        
        const propStart = this.current;
        const key = this.parseIdentifier();
        
        let value: AST.Identifier | AST.ArrayPattern | AST.ObjectPattern = key;
        let shorthand = true;
        
        if (this.match(":")) {
          shorthand = false;
          // Parse nested pattern or identifier
          if (this.check("[") || this.check("{")) {
            value = this.parseDestructuringPattern();
          } else {
            value = this.parseIdentifier();
          }
        }
        
        properties.push({
          key,
          value,
          shorthand,
          span: this.createSpan(propStart, this.current - 1)
        });
        
        // Skip virtual semicolons before comma
        while (this.peek().virtualSemi) this.advance();
        
        if (!this.match(",")) {
          break;
        }
      }
      
      this.consume("}", "Expected '}' after object pattern");
      
      return {
        kind: "ObjectPattern",
        properties,
        span: this.createSpan(start, this.current - 1)
      };
    }
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
    
    // Go-style if with init statement: if init; condition { ... }
    if (this.check(";") && this.peekNext()?.value !== "then") {
      // The test we just parsed is actually the init statement; parse the real condition
      this.advance(); // consume ;
      if (this.check("[")) {
        test = this.parseBashTestExpression();
      } else {
        test = this.parseExpression();
      }
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
  
  private parseSwitch(): AST.Switch | AST.Match {
    const start = this.current - 1;
    const prevVal = this.previous()?.value;
    const isMatch = prevVal === "match" || prevVal === "when";
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
      // We've consumed a brace but didn't increment braceDepth
      // Track this so we know when we're back at the match level
    }
    
    // Track the initial brace depth (before parsing any arms)
    const matchBraceDepth = this.braceDepth;
    
    // Loop condition depends on style
    while (!this.isAtEnd()) {
      // Skip virtual semicolons first
      while (this.peek().virtualSemi) {
        this.advance();
      }

      // For Python style, check if we've dedented back
      if (isPythonStyle) {
        const currentIndent = this.peek().indentCol;
        if (currentIndent !== undefined && currentIndent <= baseIndent) {
          // We've dedented, exit the match block
          break;
        }
      } else {
        // For brace style, check for closing brace
        // We should only exit if we're back at the same brace depth as when we started
        if (this.check("}") && this.braceDepth === matchBraceDepth) {
          break;
        }
      }
      
      if (this.isAtEnd()) {
        break;
      }
      
      const caseStart = this.current;
      
      // Handle default case (also `else` for Kotlin when-style)
      if (this.match("default") || (isMatch && this.match("else"))) {
        // Match uses => while switch uses :
        if (isMatch && !isPythonStyle) {
          this.consume("=>", "Expected '=>' after default");
          defaultCase = this.parseMatchCaseBody();
        } else {
          this.consume(":", "Expected ':' after default");
          defaultCase = this.parseCaseBody();
        }
        
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
        // Go type switch case: case []map[string]string: or case map[K]V:
        if ((this.check("[") && this.peekAt(1)?.value === "]") ||
            (this.check("map") && this.peekAt(1)?.value === "[")) {
          const goType = this.parseGoTypeAnnotation();
          // Convert type to an identifier expression for case matching
          const typeName = goType.kind === "SimpleType" ? ((goType as any).id?.name || "GoType") :
                           goType.kind === "GenericType" ? this.typeNodeToString(goType) : "GoType";
          patterns.push({
            kind: "Identifier",
            name: typeName,
            span: goType.span
          } as AST.Identifier);
        } else {
          // Traditional switch case
          patterns.push(this.parseExpression());
        }
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
    
    // Return Match for match expressions, Switch for switch statements
    if (isMatch) {
      // Convert SwitchCase to MatchArm
      const arms: AST.MatchArm[] = cases.map(c => ({
        patterns: c.patterns,
        guard: c.guard,
        body: c.body
      }));
      
      // Add default case as a catch-all arm if present
      if (defaultCase) {
        arms.push({
          patterns: [{ kind: "Identifier", name: "_", span: defaultCase.span }],
          body: defaultCase
        });
      }
      
      return {
        kind: "Match",
        expr: discriminant,
        arms,
        style: isPythonStyle ? "python" : "rust",
        span: this.createSpan(start, this.current - 1)
      } as AST.Match;
    }
    
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
    let id: AST.Expr = this.parseIdentifier();
    
    // Check for qualified pattern like Pattern::Regex
    if (this.check("::")) {
      this.advance(); // consume ::
      const property = this.parseIdentifier();
      id = {
        kind: "Member",
        object: id,
        property,
        computed: false,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
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

    while (!this.isAtEnd() && !this.check("}") && !this.check("default")) {
      // Skip virtual semicolons
      while (this.peek().virtualSemi) {
        this.advance();
      }

      // Check terminators after skipping vsemis
      if (this.check("}") || this.check("default") || this.isAtEnd()) {
        break;
      }

      // Stop at 'case' unless it's a bash case...in statement
      if (this.check("case")) {
        // Look ahead: case <pattern> in => bash case statement (parse as body statement)
        // case <pattern> : => next switch case (stop)
        let isBashCase = false;
        const checkpoint = this.current;
        // Peek past 'case' and the pattern to see 'in' vs ':'
        let scan = this.current + 1; // skip 'case'
        // skip the pattern expression tokens until we hit 'in', ':', or '=>'
        while (scan < this.tokens.length) {
          const t = this.tokens[scan];
          if (t.value === "in") { isBashCase = true; break; }
          if (t.value === ":" || t.value === "=>" || t.value === "}" ||
              t.type === TokenType.EOF || t.virtualSemi) break;
          scan++;
        }
        if (!isBashCase) break;
      }
      
      // Parse statements directly, not using parseTopLevel
      let stmt: AST.Decl | AST.Stmt | null = null;
      if (this.isDeclStart()) {
        stmt = this.parseDeclaration();
      } else {
        stmt = this.parseStatement();
      }
      
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

    // Handle return/break/continue statements in match arms (Rust allows this)
    if (this.check("return") || this.check("break") || this.check("continue")) {
      const stmt = this.parseStatement();
      return {
        kind: "Block",
        statements: stmt ? [stmt] : [],
        span: stmt?.span || this.createSpan(this.current, this.current)
      };
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

    // Ruby-style block: do |params| body end
    if (this.check("|")) {
      this.advance(); // consume '|'
      const params: AST.Param[] = [];
      if (!this.check("|")) {
        do {
          params.push(this.parseParameter());
        } while (this.match(","));
      }
      this.consume("|", "Expected '|' after block parameters");
      // Parse body until 'end' or 'done'
      const stmts: AST.Stmt[] = [];
      while (!this.check("end") && !this.check("done") && !this.isAtEnd()) {
        while (this.peek().virtualSemi) this.advance();
        if (this.check("end") || this.check("done")) break;
        stmts.push(this.parseTopLevel() as AST.Stmt);
      }
      if (!this.match("end") && !this.match("done")) {
        throw this.error(this.peek(), "Expected 'end' to close do block");
      }
      const body: AST.Block = { kind: "Block", statements: stmts, span: this.createSpan(start, this.current - 1) };
      // Emit as a Lambda expression statement (the block is a Ruby block/lambda)
      const lambda: AST.Lambda = {
        kind: "Lambda",
        params,
        body,
        span: this.createSpan(start, this.current - 1)
      };
      return { kind: "ExprStmt", expression: lambda, span: lambda.span } as any;
    }

    // Parse the block — use custom loop that accepts both 'done' (bash) and 'end' (Ruby)
    let body: AST.Block;
    if (this.check("{")) {
      body = this.parseBlock();
    } else {
      const stmts: (AST.Decl | AST.Stmt)[] = [];
      while (!this.check("done") && !this.check("end") && !this.check("while") && !this.isAtEnd()) {
        if (this.peek().virtualSemi) { this.advance(); continue; }
        const beforePos = this.current;
        try {
          const stmt = this.parseTopLevel();
          if (stmt) stmts.push(stmt);
        } catch (error) {
          if (error instanceof (ParseError as any)) {
            this.errors.push(error as any);
            this.synchronize();
          } else { throw error; }
        }
        if (this.current === beforePos) this.advance();
      }
      body = { kind: "Block", statements: stmts, span: this.createSpan(start, this.current - 1) };
    }

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
    } else if (this.check("end")) {
      // Ruby-style do-end block (e.g., fork do ... end)
      this.consume("end", "Expected 'end' to close do block");
      return {
        kind: "Block",
        statements: body.statements,
        span: this.createSpan(start, this.current - 1)
      };
    } else {
      // Error: 'do' must be followed by either 'while', 'done', or 'end'
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
          if (this.match(",")) {
            // Multi-variable: for key, value of/in ...
            const firstVar: AST.Identifier = {
              kind: "Identifier",
              name: id.value,
              span: this.createSpanFrom(id)
            };
            const secondId = this.peek();
            if (secondId.type === TokenType.Identifier || secondId.type === TokenType.Keyword) {
              this.advance();
              const secondVar: AST.Identifier = {
                kind: "Identifier",
                name: secondId.value,
                span: this.createSpanFrom(secondId)
              };
              if (this.match("of", "in")) {
                const variable: AST.ArrayPattern = {
                  kind: "ArrayPattern",
                  elements: [firstVar, secondVar],
                  span: this.createSpan(checkpoint, this.current - 1)
                };
                const iterable = this.parseExpression();
                this.match(":");
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
            // Didn't match multi-variable pattern, backtrack
            this.current = checkpoint;
          } else if (this.match("in")) {
            // foreach style: for x in collection
            const variable: AST.Identifier = {
              kind: "Identifier",
              name: id.value,
              span: this.createSpanFrom(id)
            };
            this.noRubyBlock = true;
            const iterable = this.parseExpression();
            this.noRubyBlock = false;
            // Consume optional Python-style colon (for x in items:)
            let body: AST.Block;
            if (this.match(":")) {
              body = this.parseIndentBlock();
            } else if (this.match("do")) {
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

        // Check for Go for-range: `for task := range iterable { ... }`
        if (this.peek().type === TokenType.Identifier && this.peek().value === "range") {
          this.advance(); // consume 'range'
          const iterable = this.parseExpression();
          const body = this.parseBlockOrStatement();
          return {
            kind: "Loop",
            mode: "foreach",
            variable: name,
            iterable,
            body,
            span: this.createSpan(start, this.current - 1)
          };
        }

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
      
      // Go-style condition-only for: for condition { body }
      if (!this.check("(")) {
        const test = this.parseExpression();
        let body: AST.Block;
        if (this.match(":")) {
          body = this.parseIndentBlock();
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
      
      // Check for for-of/for-in without const/let/var (just identifier or destructuring)
      if (this.peek().type === TokenType.Identifier) {
        const checkpoint = this.current;
        
        // Check if this might be a destructuring pattern
        const firstId = this.parseIdentifier();
        
        // Check for destructuring pattern like a, b (note: we're already inside parentheses)
        if (this.check(",")) {
          // This is a destructuring pattern
          const elements: AST.Identifier[] = [firstId];
          while (this.match(",")) {
            elements.push(this.parseIdentifier());
          }
          
          // Check if followed by 'in' or 'of'
          if (this.check(")") && (this.peekNext()?.value === "in" || this.peekNext()?.value === "of")) {
            this.advance(); // consume )
            this.advance(); // consume in/of
            const iterType = this.previous()?.value; // "in" or "of"
            const iterable = this.parseExpression();
            const body = this.parseBlockOrStatement();
            
            // Create a pseudo-identifier for the destructured pattern
            const variable: AST.Identifier = {
              kind: "Identifier",
              name: `(${elements.map(e => e.name).join(", ")})`,
              originalSpelling: `(${elements.map(e => e.name).join(", ")})`,
              span: this.createSpan(checkpoint, checkpoint + elements.length - 1)
            };
            
            return {
              kind: "Loop",
              mode: "foreach",
              variable,
              iterable,
              body,
              span: this.createSpan(start, this.current - 1)
            };
          }
        } else if (this.match("of", "in")) {
          // Simple identifier with in/of
          const iterType = this.previous()?.value; // "of" or "in"
          const iterable = this.parseExpression();
          this.consume(")", "Expected ')' after for-of/for-in");
          const body = this.parseBlockOrStatement();
          
          return {
            kind: "Loop",
            mode: "foreach",
            variable: firstId,
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
      } else if (this.match(":")) {
        // Python-style colon block
        body = this.parseIndentBlock();
      } else if (this.peek().virtualSemi && !this.check("{")) {
        // Ruby-style: while cond \n body \n end
        body = this.parseKeywordBlock("while");
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
    // Suppress Ruby block consumption so factory.deps do ... done doesn't
    // get parsed as Ruby method call (items.each do |x| ... end)
    this.noRubyBlock = true;
    const iterable = this.parseExpression();
    this.noRubyBlock = false;

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
    } else if (this.check("(")) {
      // Java-style try-with-resources: try (resource = expr) { body }
      // Skip the resource declaration and parse as regular try body
      this.advance(); // consume '('
      // Parse resource declarations (skip until closing paren)
      let parenDepth = 1;
      while (parenDepth > 0 && !this.isAtEnd()) {
        if (this.check("(")) parenDepth++;
        if (this.check(")")) parenDepth--;
        if (parenDepth > 0) this.advance();
      }
      this.consume(")", "Expected ')' after try-with-resources");
      body = this.parseBlock();
    } else {
      body = this.parseBlock();
    }

    const catches: AST.CatchClause[] = [];
    
    while (this.match("catch", "except", "rescue")) {
      const clauseType = this.previous()?.value; // Remember which keyword we matched
      let param: AST.Identifier | undefined;
      let type: AST.TypeNode | undefined;
      
      // Python-style except: except Type: except Type as var:
      // But NOT except (e) { ... } which uses parenthesized catch below
      if (clauseType === "except" && !this.check("(") && !this.check("{")) {
        // Parse optional exception type(s) and binding
        if (this.peek().type === TokenType.Identifier && !this.check(":")) {
          type = this.parseType();
          if (this.match("as")) {
            param = this.parseIdentifier();
          }
        }
        // Expect colon for Python-style, or handle brace-style
        if (this.match(":")) {
          let catchBody: AST.Block;
          if (this.checkIndentBlock()) {
            catchBody = this.parseIndentBlock();
          } else {
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
        } else {
          // Fall through to brace-style catch body
          const catchBody = this.parseBlock();
          catches.push({ param, type, body: catchBody, span: this.createSpan(this.current - 1, this.current) });
        }
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

    // C#/Java-style: using (Type var = expr) { ... }
    const hasParen = this.match("(");

    // Inside using (...), check for typed declaration: Type Name = Expr or var Name = Expr
    const isUsingDecl = hasParen && (
      // Type Name = Expr pattern (e.g., StreamReader sr = new StreamReader("file"))
      (this.peek().type === TokenType.Identifier && this.peekAt(1)?.type === TokenType.Identifier) ||
      // var/let/const Name = Expr pattern (e.g., var response = await ...)
      ((this.peek().value === "var" || this.peek().value === "let" || this.peek().value === "const") &&
       this.peekAt(1)?.type === TokenType.Identifier)
    );
    if (isUsingDecl) {
      // Skip var/let/const or type name
      const firstToken = this.advance();
      const varName = this.parseIdentifier();
      this.consume("=", "Expected '=' in using declaration");
      const value = this.parseExpression();
      resource = {
        kind: "VarDecl",
        names: [varName],
        values: [value],
        span: this.createSpan(start, this.current - 1)
      } as AST.VarDecl;
    } else {
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
    }
    
    // Consume closing paren for using (...) form
    if (hasParen) {
      this.consume(")", "Expected ')' after using declaration");
    }

    // Parse body - check for Python-style colon or explicit block
    let body: AST.Block | undefined;
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
    } else if (this.check("{")) {
      // Explicit block
      body = this.parseBlock();
    } else {
      // C#-style using without explicit body - applies to rest of scope
      // Create an empty block placeholder
      body = {
        kind: "Block",
        statements: [],
        span: this.createSpan(this.current, this.current)
      };
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
    
    // Check if next token is an identifier that could be a label
    // Don't treat keywords like "default", "case", "}", etc. as labels
    const next = this.peek();
    if (next.type === TokenType.Identifier && !this.check(";")) {
      // Parse as label identifier
      const token = this.advance();
      label = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
    } else if (next.type === TokenType.Keyword && 
               !this.check(";") &&
               !this.check("default") && 
               !this.check("case") &&
               !this.check("}") &&
               !this.check("else") &&
               !this.check("catch") &&
               !this.check("finally")) {
      // Only treat certain keywords as potential labels, not control flow keywords
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
    
    // Check if next token is an identifier that could be a label
    // Don't treat keywords like "default", "case", "}", etc. as labels
    const next = this.peek();
    if (next.type === TokenType.Identifier && !this.check(";")) {
      // Parse as label identifier
      const token = this.advance();
      label = {
        kind: "Identifier",
        name: token.value,
        span: this.createSpanFrom(token)
      };
    } else if (next.type === TokenType.Keyword && 
               !this.check(";") &&
               !this.check("default") && 
               !this.check("case") &&
               !this.check("}") &&
               !this.check("else") &&
               !this.check("catch") &&
               !this.check("finally")) {
      // Only treat certain keywords as potential labels, not control flow keywords
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
    
    if (!this.checkSemicolon() && !this.isAtEnd() && !this.check("}")) {
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
  
  /**
   * Check if 'func' keyword is followed by Go-style typed params: func(name type, ...)
   * or func Name(name type, ...). Peeks ahead without consuming tokens.
   */
  private hasGoTypedParams(): boolean {
    // Current token is 'func'. Skip optional name identifier to find '('
    let idx = this.current + 1;
    // Skip function name if present: func Name(...)
    if (idx < this.tokens.length && this.tokens[idx].type === TokenType.Identifier) {
      idx++;
    }
    // Must have '(' next
    if (idx >= this.tokens.length || this.tokens[idx].value !== "(") return false;
    const firstParam = idx + 1;
    if (firstParam >= this.tokens.length) return false;
    // Empty params func() → not Go-typed
    if (this.tokens[firstParam].value === ")") return false;
    // Check if first param is identifier followed by a type token (Go-style: name type)
    if (this.tokens[firstParam].type !== TokenType.Identifier) return false;
    const afterFirst = firstParam + 1;
    if (afterFirst >= this.tokens.length) return false;
    const afterTok = this.tokens[afterFirst];
    // Go type can be: identifier, keyword type (interface, struct, map, chan, func), pointer (*), slice ([])
    if (afterTok.type === TokenType.Identifier) return true;
    if (afterTok.type === TokenType.Keyword &&
        ["interface", "struct", "map", "chan", "func"].includes(afterTok.value)) return true;
    if (afterTok.value === "*" || afterTok.value === "[") return true;
    return false;
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
    
    // Check for postfix if/unless (Ruby-style) — only on same line
    if ((this.check("if") || this.check("unless")) && !this.peek().newline) {
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
        params: [{
          type: type,
          span: type.span
        }],
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
    
    // Array type prefix: []Type
    if (this.check("[") && this.peekNext()?.value === "]") {
      this.advance(); // consume [
      this.advance(); // consume ]
      const elementType = this.parseSimpleType();
      
      // Return as a GenericType Array<Type> for compatibility
      return {
        kind: "GenericType",
        base: { 
          kind: "Identifier", 
          name: "Array",
          span: this.createSpan(start, start + 1)
        },
        args: [elementType],
        span: this.createSpan(start, this.current - 1)
      };
    }
    
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
      } else if (this.check("<")) {
        // Generic channel syntax: chan<T> - return as GenericType for compatibility
        this.advance(); // consume <
        const args: AST.TypeNode[] = [];
        args.push(this.parseType());
        
        while (this.match(",")) {
          args.push(this.parseType());
        }
        
        // Handle >> and >>> as closing brackets
        if (this.check(">>")) {
          // Treat >> as a single > and leave the second > for the next parse
          const originalToken = this.tokens[this.current];
          // Replace >> with > at current position
          this.tokens[this.current] = { ...originalToken, value: ">" };
          // Insert another > after it
          const syntheticToken = { ...originalToken, value: ">" };
          this.tokens.splice(this.current + 1, 0, syntheticToken);
          // Now consume the first >
          this.advance();
        } else if (this.check(">>>")) {
          // Treat >>> as a single > and leave >> for the next parse
          const originalToken = this.tokens[this.current];
          // Replace >>> with > at current position
          this.tokens[this.current] = { ...originalToken, value: ">" };
          // Insert >> after it
          const syntheticToken = { ...originalToken, value: ">>" };
          this.tokens.splice(this.current + 1, 0, syntheticToken);
          // Now consume the first >
          this.advance();
        } else {
          this.consume(">", "Expected '>' after channel element type");
        }
        
        // Return as GenericType instead of ChanType for test compatibility
        return {
          kind: "GenericType",
          base: { 
            kind: "Identifier", 
            name: "chan",
            originalSpelling: "chan",
            span: this.createSpan(start, start)
          },
          args,
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
      
      const properties: AST.ObjectTypeProperty[] = [];
      
      while (!this.check("}") && !this.isAtEnd()) {
        // Skip virtual semicolons
        while (this.peek().virtualSemi) {
          this.advance();
        }
        
        if (this.check("}")) break;
        
        // Parse readonly modifier
        let readonly = false;
        if (this.match("readonly")) {
          readonly = true;
        }
        
        // Parse property name (identifier or string literal)
        let name: string;
        if (this.peek().type === TokenType.StringLiteral) {
          const token = this.advance();
          name = token.value.slice(1, -1); // strip quotes
        } else if (this.peek().type === TokenType.Keyword) {
          name = this.advance().value; // allow keywords as property names
        } else {
          name = this.parseIdentifier().name;
        }
        
        // Parse optional marker
        let optional = false;
        if (this.match("?")) {
          optional = true;
        }
        
        // Expect colon
        this.consume(":", "Expected ':' after property name in object type");
        
        // Parse property type
        const type = this.parseType();
        
        properties.push({
          name,
          type,
          optional,
          readonly
        });
        
        // Skip comma or semicolon separators
        if (this.match(",", ";")) {
          // consumed
        }
        
        // Skip virtual semicolons
        while (this.peek().virtualSemi) {
          this.advance();
        }
      }
      
      this.consume("}", "Expected '}' in object type literal");
      
      return {
        kind: "ObjectType",
        properties,
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
        const params: AST.FuncTypeParam[] = [];
        
        if (!this.check(")")) {
          // Parse parameter types with optional names
          do {
            const paramStart = this.current;
            let name: AST.Identifier | undefined;
            let optional = false;
            
            // Check if parameter has a name
            if (this.peek().type === TokenType.Identifier) {
              const next = this.peekNext();
              if (next?.value === ":" || next?.value === "?") {
                name = this.parseIdentifier();
                
                // Check for optional marker (?) before the colon
                if (this.match("?")) {
                  optional = true;
                }
                
                // Now consume the colon
                if (this.match(":")) {
                  // Type annotation follows
                } else if (!optional) {
                  // Error: expected : after parameter name (unless it was optional)
                  throw this.error(this.peek(), "Expected ':' after parameter name");
                }
              }
            }
            
            // Parse the type
            const type = this.parseType();
            
            params.push({
              name,
              type,
              optional,
              span: this.createSpan(paramStart, this.current - 1)
            });
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
        // Not a function type - it's a parenthesized type or tuple type
        this.advance(); // consume '('
        
        // Check for empty tuple
        if (this.check(")")) {
          this.advance();
          // Return empty tuple as a simple type
          return {
            kind: "SimpleType",
            id: { kind: "Identifier", name: "()", span: this.createSpan(start, this.current - 1) },
            span: this.createSpan(start, this.current - 1)
          };
        }
        
        const firstType = this.parseType();
        
        // Check if this is a tuple type (has comma)
        if (this.match(",")) {
          const elements: AST.TypeNode[] = [firstType];
          do {
            elements.push(this.parseType());
          } while (this.match(","));
          
          this.consume(")", "Expected ')' after tuple type");
          
          // Create a string representation of the tuple for compatibility
          // Since we don't have a TupleType in AST, represent as SimpleType
          const tupleStr = `(${elements.map(e => this.typeNodeToString(e)).join(", ")})`;
          
          return {
            kind: "SimpleType",
            id: { kind: "Identifier", name: tupleStr, span: this.createSpan(start, this.current - 1) },
            span: this.createSpan(start, this.current - 1)
          };
        } else {
          // Single parenthesized type
          this.consume(")", "Expected ')' after parenthesized type");
          return firstType;
        }
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
    
    // Handle "keyof Type" pattern (TypeScript-style type operator)
    if (qualifiedId.name === "keyof" && (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword)) {
      const innerType = this.parseSimpleType();
      return {
        kind: "SimpleType",
        id: { kind: "Identifier", name: "keyof", span: this.createSpan(start, this.current - 1) },
        inner: innerType,
        span: this.createSpan(start, this.current - 1)
      } as any;
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
    
    // Handle "dyn Trait" pattern (Rust-style trait objects)
    if (qualifiedId.name === "dyn" && this.peek().type === TokenType.Identifier) {
      const traitType = this.parseSimpleType();
      return {
        kind: "DynType",
        trait: traitType,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Special handling for chan<T> syntax
    if (qualifiedId.name === "chan") {
      if (this.check("<")) {
        // Parse as GenericType for chan<T> syntax
        this.advance(); // consume '<'
        const args: AST.TypeNode[] = [];
        args.push(this.parseType());
        
        while (this.match(",")) {
          args.push(this.parseType());
        }
        
        // Handle >> and >>> as closing brackets
        if (this.check(">>")) {
          // Treat >> as a single > and leave the second > for the next parse
          const originalToken = this.tokens[this.current];
          // Replace >> with > at current position
          this.tokens[this.current] = { ...originalToken, value: ">" };
          // Insert another > after it
          const syntheticToken = { ...originalToken, value: ">" };
          this.tokens.splice(this.current + 1, 0, syntheticToken);
          // Now consume the first >
          this.advance();
        } else if (this.check(">>>")) {
          // Treat >>> as a single > and leave >> for the next parse
          const originalToken = this.tokens[this.current];
          // Replace >>> with > at current position
          this.tokens[this.current] = { ...originalToken, value: ">" };
          // Insert >> after it
          const syntheticToken = { ...originalToken, value: ">>" };
          this.tokens.splice(this.current + 1, 0, syntheticToken);
          // Now consume the first >
          this.advance();
        } else {
          this.consume(">", "Expected '>' after channel element type");
        }
        
        // Return GenericType instead of ChanType for compatibility
        return {
          kind: "GenericType",
          base: qualifiedId,
          args,
          span: this.createSpan(start, this.current - 1)
        };
      } else {
        // chan without type parameter - treat as simple chan type
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
          // Check for associated type constraint (e.g., Item = V in Rust)
          const checkpoint = this.current;
          const firstType = this.parseType();
          
          // Check if this is an associated type constraint
          if (this.check("=") && firstType.kind === "SimpleType") {
            // This is an associated type constraint like "Item = V"
            this.advance(); // consume '='
            const constraintType = this.parseType();
            // For now, treat the whole constraint as a special type
            // We'll just use the constraint type since we don't have full support
            args.push(constraintType);
          } else {
            args.push(firstType);
          }
        } while (this.match(","));
      }
      
      // Handle >> and >>> as closing brackets in generic types
      if (closeBracket === ">") {
        if (this.check(">>")) {
          // Treat >> as a single > and leave the second > for the next parse
          const originalToken = this.tokens[this.current];
          // Replace >> with > at current position
          this.tokens[this.current] = { ...originalToken, value: ">" };
          // Insert another > after it
          const syntheticToken = { ...originalToken, value: ">" };
          this.tokens.splice(this.current + 1, 0, syntheticToken);
          // Now consume the first >
          this.advance();
        } else if (this.check(">>>")) {
          // Treat >>> as a single > and leave >> for the next parse
          const originalToken = this.tokens[this.current];
          // Replace >>> with > at current position
          this.tokens[this.current] = { ...originalToken, value: ">" };
          // Insert >> after it
          const syntheticToken = { ...originalToken, value: ">>" };
          this.tokens.splice(this.current + 1, 0, syntheticToken);
          // Now consume the first >
          this.advance();
        } else {
          // Debug: log what token we actually have
          const actualToken = this.peek();
          if (actualToken.value !== ">") {
            throw this.error(actualToken, `Expected '>' but got '${actualToken.value}'`);
          }
          this.consume(">", "Expected '>'");
        }
      } else {
        this.consume(closeBracket, `Expected '${closeBracket}'`);
      }
      
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
  
  private parseClassDecl(decorators?: AST.Expr[]): AST.ClassDecl {
    const start = this.current - 1;
    const name = this.parseIdentifier();
    
    // Parse type parameters
    let typeParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      typeParams = [];
      do {
        typeParams.push(this.parseIdentifier());
        // Skip type constraints: extends Type, super Type, : Type
        if (this.match("extends", "super")) {
          this.parseType();
        } else if (this.check(":") && !this.check("::")) {
          this.advance();
          this.parseType();
          // Handle multiple constraints with + (e.g., <T: Clone + Debug>)
          while (this.match("+")) {
            this.parseType();
          }
        }
      } while (this.match(","));
      this.consume(">", "Expected '>' after type parameters");
    }

    // Python-style class inheritance: class Name(Parent, Mixin):
    let extendsType: AST.TypeNode | undefined;
    if (this.check("(") && !typeParams) {
      this.advance(); // consume '('
      if (!this.check(")")) {
        extendsType = this.parseType();
        // Additional parent classes (mixins) - skip for now
        while (this.match(",")) {
          this.parseType();
        }
      }
      this.consume(")", "Expected ')' after parent classes");
    }

    // Parse extends clause
    if (!extendsType && this.match("extends")) {
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
    
    // Parse with clause (mixins/traits)
    let withTypes: AST.TypeNode[] | undefined;
    if (this.match("with")) {
      withTypes = [];
      do {
        withTypes.push(this.parseType());
      } while (this.match(","));
    }
    
    // Parse class body - handle both { } and Python-style :
    const members: AST.ClassMember[] = [];
    let isPythonStyle = false;
    let classIndent = -1;
    
    if (this.match(":")) {
      // Python-style class with colon
      isPythonStyle = true;
      // Skip virtual semicolons after colon
      while (this.peek().virtualSemi) {
        this.advance();
      }
      // Record the indentation level of the class body
      classIndent = this.peek().indentCol ?? 0;
    } else {
      // Traditional braces style
      this.consume("{", "Expected '{' before class body");
    }
    
    while (!this.isAtEnd()) {
      // For Python style, check if we've dedented out of the class
      if (isPythonStyle) {
        const currentIndent = this.peek().indentCol ?? 0;
        if (currentIndent < classIndent) {
          // We've dedented out of the class
          break;
        }
      } else if (this.check("}")) {
        // For brace style, check for closing brace
        break;
      }
      // Skip virtual semicolons and regular semicolons
      while (this.check(";") || this.peek().virtualSemi) {
        this.advance();
      }
      
      if (this.check("}")) break;
      
      try {
        // Parse class member
        const memberStart = this.current;
        
        // Parse member decorators (e.g., @Input, @Output, @HostListener)
        const memberDecorators: AST.Decorator[] = [];
        while (this.check("@")) {
          const decoratorStart = this.current;
          this.advance(); // consume @
          
          // Parse the decorator name
          if (this.peek().type === TokenType.Identifier) {
            const name = this.parseIdentifier();
            let args: AST.Expr[] | undefined;
            
            // Parse decorator arguments if present
            if (this.check("(")) {
              this.advance(); // consume (
              args = [];
              
              if (!this.check(")")) {
                do {
                  args.push(this.parseExpression());
                } while (this.match(","));
              }
              
              this.consume(")", "Expected ')' after decorator arguments");
            }
            
            memberDecorators.push({
              kind: "Decorator",
              name,
              args,
              span: this.createSpan(decoratorStart, this.current - 1)
            });
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

        // Handle C++/C# operator overloads: operator+(args) { ... }
        if (this.peek().value === "operator" && this.peekNext()?.type === TokenType.Operator) {
          this.advance(); // consume 'operator'
          const opToken = this.advance(); // consume the operator symbol
          const opName: AST.Identifier = {
            kind: "Identifier",
            name: "operator" + opToken.value,
            span: this.createSpanFrom(opToken)
          };
          // Skip optional `const` qualifier after params (C++ const methods)
          const params = this.parseParameterList();
          if (this.peek().value === "const") this.advance();
          const body = this.parseBlock();
          members.push({
            kind: "Method",
            name: opName,
            params,
            body,
            span: this.createSpan(memberStart, this.current - 1)
          } as any);
          continue;
        }

        // Handle async functions
        if (this.match("async")) {
          // Check if followed by function keyword
          if (this.match("fn", "fun", "function", "func", "def")) {
            const method = this.parseFuncDecl(true);
            members.push(method as any);
            continue;
          }
          
          // Check if followed by identifier (async method without function keyword)
          // e.g., async handle<T>() { }
          if (this.peek().type === TokenType.Identifier) {
            const methodName = this.parseIdentifier();
            
            // Parse generic parameters if present
            let genericParams: AST.Identifier[] | undefined;
            if (this.match("<")) {
              genericParams = [];
              do {
                genericParams.push(this.parseIdentifier());
                if (this.match("extends", "super")) {
                  this.parseType();
                } else if (this.check(":") && !this.check("::")) {
                  this.advance();
                  this.parseType();
                  while (this.match("+")) this.parseType();
                }
              } while (this.match(","));
              this.consume(">", "Expected '>' after generic parameters");
            }

            // Parse parameters
            const params = this.parseParameterList();
            
            // Parse return type if present
            let returnType: AST.TypeNode | undefined;
            if (this.match(":")) {
              returnType = this.parseType();
            }
            
            // Parse method body
            const body = this.parseBlock();
            
            const member: any = {
              kind: "Method",
              name: methodName,
              params,
              type: returnType,
              body,
              async: true,
              genericParams,
              span: this.createSpan(memberStart, this.current - 1)
            };
            if (memberDecorators.length > 0) {
              member.decorators = memberDecorators;
            }
            members.push(member);
            continue;
          }
          
          // If not followed by function keyword or identifier, restore position
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
        
        // Handle TypeScript-style getters and setters
        // But only if get/set is not followed immediately by ( (then it's a method name)
        if ((this.peek().value === "get" || this.peek().value === "set") && 
            this.peekNext()?.value !== "(") {
          const isGetter = this.peek().value === "get";
          this.advance(); // consume get/set
          
          // Parse the accessor name
          const accessorName = this.parseIdentifier();
          
          // Parse parameters (setters have one parameter)
          const params = this.parseParameterList();
          
          // Parse return type if present
          let returnType: AST.TypeNode | undefined;
          if (this.match(":")) {
            returnType = this.parseType();
          }
          
          // Parse the body
          const body = this.parseBlock();
          
          const accessorMember: any = {
            kind: isGetter ? "Getter" : "Setter",
            name: accessorName,
            params,
            type: returnType,
            body,
            span: this.createSpan(memberStart, this.current - 1)
          };
          
          if (memberDecorators.length > 0) {
            accessorMember.decorators = memberDecorators;
          }
          
          members.push(accessorMember);
          continue;
        }
        
        // Collect all modifiers (known and unknown)
        let visibility: "public" | "private" | "protected" | undefined;
        let isStatic = false;
        let isReadonly = false;
        let unknownModifiers: string[] = [];
        
        // Keep collecting modifiers until we hit something that's definitely not a modifier
        while (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword) {
          const token = this.peek();
          const value = token.value;
          
          // Check for known modifiers
          if (value === "public" || value === "private" || value === "protected") {
            visibility = value as any;
            this.advance();
          } else if (value === "static") {
            isStatic = true;
            this.advance();
          } else if (value === "readonly") {
            isReadonly = true;
            this.advance();
          } else if (value === "async" || value === "const" || value === "final") {
            // These are handled elsewhere, stop collecting modifiers
            break;
          } else {
            // Check if this looks like it could be a modifier or a member name
            // If the next token is another identifier or a known type starter, it might be a modifier
            const next = this.peekNext();
            if (next && (next.type === TokenType.Identifier || 
                        next.value === ":" || next.value === "(" || next.value === "{" ||
                        next.value === "<" || next.value === "[")) {
              // Could be a modifier if followed by another identifier/type
              // or could be the member name if followed by : ( { < [
              if (next.type === TokenType.Identifier) {
                // Before treating as modifier, check for C# property pattern: type name { get/set }
                const twoAhead = this.peekAt(2);
                const threeAhead = this.peekAt(3);
                if (twoAhead?.value === "{" &&
                    (threeAhead?.value === "get" || threeAhead?.value === "set")) {
                  // This is a type name, not a modifier - leave for C# property detection
                  break;
                }
                // Likely a modifier (e.g., "volatile x")
                unknownModifiers.push(value);
                this.advance();
              } else {
                // Likely the member name, stop collecting modifiers
                break;
              }
            } else {
              // Probably the member name, stop collecting
              break;
            }
          }
        }
        
        // ES2022 static initializer block: static { ... }
        if (isStatic && this.check("{")) {
          const body = this.parseBlock();
          members.push({
            kind: "Method",
            name: { kind: "Identifier", name: "__static_init__", span: body.span } as AST.Identifier,
            params: [],
            body,
            static: true,
            span: this.createSpan(memberStart, this.current - 1)
          } as any);
          continue;
        }

        // Handle C#-style operator overloads after modifiers: public static Vec operator +(...)
        // At this point modifiers have been consumed; check for optional return type + operator keyword
        if (this.peek().value === "operator" && this.peekNext()?.type === TokenType.Operator) {
          this.advance(); // consume 'operator'
          const opToken = this.advance(); // consume the operator symbol
          const opName: AST.Identifier = {
            kind: "Identifier",
            name: "operator" + opToken.value,
            span: this.createSpanFrom(opToken)
          };
          const params = this.parseParameterList();
          if (this.peek().value === "const") this.advance();
          const body = this.parseBlock();
          const member: any = {
            kind: "Method",
            name: opName,
            params,
            body,
            static: isStatic,
            visibility,
            span: this.createSpan(memberStart, this.current - 1)
          };
          members.push(member);
          continue;
        }

        // Handle property declarations and methods
        // Allow keywords as method names (e.g., 'match' can be a method name)
        // Process any identifier or keyword as a potential field/method name
        if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword) {
          // Check if this might be a C# property with type first: public Type Name { get; set; }
          // We need to look ahead to distinguish between:
          // - public string Title { get; set; }  (C# property)
          // - public Title { ... }  (field/method named Title)
          
          let fieldType: AST.TypeNode | undefined;
          let name: AST.Identifier;
          
          // Save position for potential backtracking
          const checkpoint = this.current;
          
          // Try to parse as type + name pattern
          if (visibility) {
            // After visibility modifier, check if next two tokens could be type + name
            const firstToken = this.peek();
            const secondToken = this.peekNext();
            
            if (firstToken && secondToken && 
                (firstToken.type === TokenType.Identifier || firstToken.type === TokenType.Keyword) &&
                secondToken.type === TokenType.Identifier &&
                this.peekAt(2)?.value === "{") {
              // Check if the third token is { and fourth is "get" or "set"
              const thirdToken = this.peekAt(2);
              const fourthToken = this.peekAt(3);
              
              if (thirdToken?.value === "{" && 
                  (fourthToken?.value === "get" || fourthToken?.value === "set")) {
                // This looks like a C# property: type name { get/set; }
                // Parse the type
                fieldType = this.parseType();
                // Parse the name
                name = this.parseIdentifier();
                
                // Now handle the { get; set; } part
                if (this.match("{")) {
                  // Parse property accessors
                  let getter: AST.PropertyAccessor | undefined;
                  let setter: AST.PropertyAccessor | undefined;
                  
                  while (!this.check("}") && !this.isAtEnd()) {
                    const accessorStart = this.current;
                    let accessorVisibility: "public" | "private" | "protected" | undefined;
                    
                    // Check for visibility modifier on accessor
                    if (this.match("public", "private", "protected")) {
                      accessorVisibility = this.previous()!.value as any;
                    }
                    
                    if (this.match("get")) {
                      // Parse getter
                      if (this.match(";")) {
                        // Auto-property getter
                        getter = {
                          visibility: accessorVisibility,
                          span: this.createSpan(accessorStart, this.current - 1)
                        };
                      } else if (this.check("{")) {
                        // Getter with body
                        const body = this.parseBlock();
                        getter = {
                          visibility: accessorVisibility,
                          body,
                          span: this.createSpan(accessorStart, this.current - 1)
                        };
                      }
                    } else if (this.match("set")) {
                      // Parse setter
                      if (this.match(";")) {
                        // Auto-property setter
                        setter = {
                          visibility: accessorVisibility,
                          span: this.createSpan(accessorStart, this.current - 1)
                        };
                      } else if (this.check("{")) {
                        // Setter with body
                        const body = this.parseBlock();
                        setter = {
                          visibility: accessorVisibility,
                          body,
                          span: this.createSpan(accessorStart, this.current - 1)
                        };
                      }
                    } else if (!accessorVisibility) {
                      // Skip unexpected tokens (but we already consumed visibility)
                      this.advance();
                    }
                  }
                  this.consume("}", "Expected '}' after property accessors");
                  
                  // Create a property with accessors
                  members.push({
                    kind: "Property",
                    name,
                    type: fieldType,
                    getter,
                    setter,
                    span: this.createSpan(memberStart, this.current - 1)
                  } as any);
                  continue;
                }
              } else {
                // Not a C# property, parse normally
                this.current = checkpoint;
              }
            }
          }
          
          // Parse method/field name - allow keywords as identifiers in this context
          const nameToken = this.advance();
          name = {
            kind: "Identifier",
            name: nameToken.value,
            span: this.createSpanFrom(nameToken)
          };
          
          // Check for generic parameters on methods: methodName<T, U>() or methodName<K extends T>()
          let genericParams: AST.Identifier[] | undefined;
          if (this.check("<") && !this.check("<=") && !this.check("<<") && !this.check("<-")) {
            const checkpoint = this.current;
            try {
              this.advance(); // consume <
              genericParams = [];
              do {
                genericParams.push(this.parseIdentifier());
                // Skip type constraints: extends Type, : Type
                if (this.match("extends", "super")) {
                  this.parseType();
                } else if (this.check(":") && !this.check("::")) {
                  this.advance();
                  this.parseType();
                  while (this.match("+")) {
                    this.parseType();
                  }
                }
              } while (this.match(","));
              this.consume(">", "Expected '>' after generic parameters");
              
              // Verify this is followed by parentheses (method signature)
              if (!this.check("(")) {
                // Not a method with generics, restore position
                genericParams = undefined;
                this.current = checkpoint;
              }
            } catch {
              // Failed to parse generics, restore position
              genericParams = undefined;
              this.current = checkpoint;
            }
          }
          
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
            
            // Method body - handle both block and arrow function  
            // But first check if this is just a signature (ends with semicolon)
            let body: AST.Block | undefined;
            
            if (this.check(";") || (this.checkSemicolon() && !this.check("{"))) {
              // Method signature without implementation
              this.consumeSemicolon();
              body = undefined;
            } else {
              try {
                if (this.match("=>")) {
                  // Arrow function body
                  const expr = this.parseExpression();
                  body = {
                    kind: "Block",
                    statements: [{
                      kind: "Return",
                      values: [expr],
                      span: expr.span
                    }],
                    span: expr.span
                  };
                } else {
                  body = this.parseBlock();
                }
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
            }
            
            const methodMember: any = {
              kind: "Method",
              name,
              params,
              type: returnType,
              body,
              genericParams,
              span: this.createSpan(memberStart, this.current - 1)
            };
            if (visibility) methodMember.visibility = visibility;
            if (isStatic) methodMember.static = isStatic;
            if (isReadonly) methodMember.readonly = isReadonly;
            if (memberDecorators.length > 0) {
              methodMember.decorators = memberDecorators;
            }
            if (unknownModifiers.length > 0) {
              methodMember.unknownModifiers = unknownModifiers;
            }
            members.push(methodMember);
            continue;
          }
          
          // Short declaration: name := value
          if (this.match(":=")) {
            const value = this.parseExpression();
            const member: any = {
              kind: "Field",
              name,
              value,
              span: this.createSpan(memberStart, this.current - 1)
            };
            if (memberDecorators.length > 0) {
              member.decorators = memberDecorators;
            }
            if (unknownModifiers.length > 0) {
              member.unknownModifiers = unknownModifiers;
            }
            members.push(member);
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
              // It's actually a method signature like: methodName: ReturnType(params)
              // But this is an unusual syntax - normally it would be methodName(params): ReturnType
              // For now, treat it as a field with a function type
              // Note: This might need adjustment based on language spec
            }
            
            // Create the field member
            const member: any = {
              kind: "Field",
              name,
              type,
              value,
              span: this.createSpan(memberStart, this.current - 1)
            };
            if (visibility) member.visibility = visibility;
            if (isStatic) member.static = isStatic;
            if (isReadonly) member.readonly = isReadonly;
            if (memberDecorators.length > 0) {
              member.decorators = memberDecorators;
            }
            if (unknownModifiers.length > 0) {
              member.unknownModifiers = unknownModifiers;
            }
            members.push(member);
            continue;
          }
          
          // Simple assignment: name = value
          if (this.match("=")) {
            const value = this.parseExpression();
            const member: any = {
              kind: "Field",
              name,
              value,
              span: this.createSpan(memberStart, this.current - 1)
            };
            if (memberDecorators.length > 0) {
              member.decorators = memberDecorators;
            }
            if (unknownModifiers.length > 0) {
              member.unknownModifiers = unknownModifiers;
            }
            members.push(member);
            continue;
          }
          
          // Field without value
          const fieldMember: any = {
            kind: "Field",
            name,
            span: this.createSpan(memberStart, this.current - 1)
          };
          if (memberDecorators.length > 0) {
            fieldMember.decorators = memberDecorators;
          }
          members.push(fieldMember);
          
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
    
    // Only consume closing brace for non-Python style
    if (!isPythonStyle) {
      this.consume("}", "Expected '}' after class body");
    }
    
    // Merge withTypes into implementsTypes since AST doesn't have separate field
    if (withTypes && withTypes.length > 0) {
      if (!implementsTypes) {
        implementsTypes = [];
      }
      implementsTypes.push(...withTypes);
    }
    
    const classDecl: AST.ClassDecl = {
      kind: "ClassDecl",
      name,
      typeParams,
      genericParams: typeParams, // Provide both for compatibility
      extends: extendsType,
      implements: implementsTypes,
      members,
      span: this.createSpan(start, this.current - 1)
    };
    
    // Add decorators if provided
    if (decorators && decorators.length > 0) {
      classDecl.decorators = decorators.map(expr => ({
        kind: "Decorator" as const,
        name: expr.kind === "Identifier" ? expr : 
              expr.kind === "Call" && expr.callee.kind === "Identifier" ? expr.callee :
              { kind: "Identifier", name: "unknown", span: expr.span } as AST.Identifier,
        args: expr.kind === "Call" ? expr.args : undefined,
        span: expr.span
      }));
    }
    
    return classDecl;
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
      // Skip virtual semicolons and commas
      while (this.peek().virtualSemi || this.check(",")) {
        this.advance();
      }
      
      if (this.check("}")) break;
      
      // Parse interface member
      const memberStart = this.current;

      // Skip modifier keywords (async, static, readonly, etc.) before member name
      while (this.peek().type === TokenType.Keyword &&
             (this.peek().value === "async" || this.peek().value === "static" ||
              this.peek().value === "readonly" || this.peek().value === "abstract" ||
              this.peek().value === "fn" || this.peek().value === "def" ||
              this.peek().value === "fun" || this.peek().value === "func")) {
        this.advance();
      }

      // Parse member name (allow keywords as identifiers here)
      let memberName: AST.Identifier;
      if (this.peek().type === TokenType.Keyword) {
        const kw = this.advance();
        memberName = { kind: "Identifier", name: kw.value, span: this.createSpanFrom(kw) };
      } else {
        memberName = this.parseIdentifier();
      }
      
      // Check for generic parameters on methods
      let genericParams: AST.Identifier[] | undefined;
      if (this.check("<")) {
        this.advance(); // consume <
        genericParams = [];
        do {
          genericParams.push(this.parseIdentifier());
          if (this.match("extends", "super")) {
            this.parseType();
          } else if (this.check(":") && !this.check("::")) {
            this.advance();
            this.parseType();
            while (this.match("+")) this.parseType();
          }
        } while (this.match(","));
        this.consume(">", "Expected '>' after generic parameters");
      }
      
      // Check if it's a method (has parentheses) or property
      if (this.check("(")) {
        // It's a method signature
        const params = this.parseParameterList();

        // Parse return type — but not if ':' is followed by a statement keyword (Python block)
        let returnType: AST.TypeNode | undefined;
        if (this.check(":") && this.peekNext()?.type === TokenType.Keyword &&
            (this.peekNext()?.value === "pass" || this.peekNext()?.value === "return" ||
             this.peekNext()?.value === "break" || this.peekNext()?.value === "continue")) {
          // Python-style colon block — skip the colon and block
          this.advance(); // consume ':'
          // Just skip the body statement
          while (this.peek().virtualSemi) this.advance();
          if (!this.check("}")) this.advance(); // skip the keyword (pass, etc.)
        } else if (this.match(":")) {
          returnType = this.parseType();
        } else if (this.match("->")) {
          returnType = this.parseType();
        }

        // Store as a method member with full signature
        members.push({
          name: memberName,
          kind: "Method",
          params,
          returnType,
          genericParams,
          optional: false,
          span: this.createSpan(memberStart, this.current - 1)
        });
      } else {
        // It's a property
        const optional = this.match("?");
        
        // Expect colon for type annotation
        this.consume(":", "Expected ':' after member name");
        
        // Parse the type
        const memberType = this.parseType();
        
        members.push({
          name: memberName,
          kind: "Property",
          type: memberType,
          optional,
          span: this.createSpan(memberStart, this.current - 1)
        });
      }
      
      // Skip optional comma or semicolon
      this.match(",") || this.match(";");
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
  
  private parseImplBlock(): AST.ImplDecl {
    // Parse Rust-style impl blocks
    // impl<T> Container<T> where T: Display { ... }
    // impl<T> Display for Container<T> where T: Display { ... }
    const start = this.current;
    this.advance(); // consume 'impl'
    
    // Parse generic parameters if present
    let typeParams: AST.Identifier[] | undefined;
    if (this.match("<")) {
      typeParams = [];
      do {
        typeParams.push(this.parseIdentifier());
        if (this.match("extends", "super")) {
          this.parseType();
        } else if (this.check(":") && !this.check("::")) {
          this.advance();
          this.parseType();
          while (this.match("+")) this.parseType();
        }
      } while (this.match(","));
      this.consume(">", "Expected '>' after generic parameters");
    }

    // Parse either "Type" or "Trait for Type"
    let trait: AST.TypeNode | undefined;
    let type: AST.TypeNode;
    
    // Parse the first type/identifier
    const firstType = this.parseType();
    
    // Check if this is "Trait for Type" pattern
    if (this.match("for")) {
      trait = firstType;
      type = this.parseType();
    } else {
      // Just "Type" without trait
      type = firstType;
    }
    
    // Parse where clause if present
    let whereClause: AST.WhereClause | undefined;
    if (this.peek().value === "where") {
      whereClause = this.parseWhereClause();
    }
    
    // Parse impl body
    this.consume("{", "Expected '{' before impl body");
    const members: AST.ImplMember[] = [];
    
    while (!this.check("}") && !this.isAtEnd()) {
      // Skip semicolons and virtual semicolons
      while (this.check(";") || this.peek().virtualSemi) {
        this.advance();
      }
      
      if (this.check("}")) break;
      
      const memberStart = this.current;
      
      // Parse visibility modifiers
      let visibility: "public" | "private" | "protected" | undefined;
      if (this.match("pub", "public")) {
        visibility = "public";
      } else if (this.match("private", "priv")) {
        visibility = "private";
      } else if (this.match("protected")) {
        visibility = "protected";
      }
      
      // Parse impl members (methods, associated types, associated constants)
      if (this.match("const")) {
        // Check if this is "const fn" (const function)
        if (this.peek().value === "fn") {
          this.advance(); // consume 'fn'
          const func = this.parseFuncDecl(false, false, false);
          members.push({
            kind: "Method",
            name: func.name!,
            params: func.params,
            type: func.returnType,
            body: func.body,
            isConst: true,
            visibility,
            span: func.span
          });
        } else {
          // Associated constant: const SIZE: usize = 10;
          const name = this.parseIdentifier();
          let type: AST.TypeNode | undefined;
          if (this.match(":")) {
            type = this.parseType();
          }
          let value: AST.Expr | undefined;
          if (this.match("=")) {
            value = this.parseExpression();
          }
          this.consumeSemicolon();
          members.push({
            kind: "AssociatedConst",
            name,
            type,
            value,
            visibility,
            span: this.createSpan(memberStart, this.current - 1)
          });
        }
      } else if (this.match("fn", "fun", "func", "function")) {
        const isGenerator = this.previous()?.value === "function" && this.match("*");
        const func = this.parseFuncDecl(false, false, isGenerator);
        members.push({
          kind: "Method",
          name: func.name!,
          params: func.params,
          type: func.returnType,
          body: func.body,
          visibility,
          span: func.span
        });
      } else if (this.match("type")) {
        // Associated type: type Item = T;
        const name = this.parseIdentifier();
        let type: AST.TypeNode | undefined;
        if (this.match("=")) {
          type = this.parseType();
        }
        this.consumeSemicolon();
        members.push({
          kind: "AssociatedType",
          name,
          type,
          visibility,
          span: this.createSpan(memberStart, this.current - 1)
        });
      } else if (this.peek().type === TokenType.Identifier) {
        // Try to parse as a method without fn keyword or as a field
        const name = this.parseIdentifier();
        if (this.check("(")) {
          // Method without fn keyword
          const params = this.parseParameterList();
          let returnType: AST.TypeNode | undefined;
          if (this.match("->", ":")) {
            returnType = this.parseType();
          }
          const body = this.parseBlock();
          members.push({
            kind: "Method",
            name,
            params,
            type: returnType,
            body,
            visibility,
            span: this.createSpan(memberStart, this.current - 1)
          });
        } else if (this.match(":")) {
          // Field with type annotation: field: Type = value
          const type = this.parseType();
          let value: AST.Expr | undefined;
          if (this.match("=")) {
            value = this.parseExpression();
          }
          this.consumeSemicolon();
          members.push({
            kind: "Field",
            name,
            type,
            value,
            visibility,
            span: this.createSpan(memberStart, this.current - 1)
          });
        } else {
          // Unknown member - store as unknown to preserve data
          // This could be macro invocations or other language features
          const tokens: Token[] = [];
          while (!this.checkSemicolon() && !this.check("}") && !this.isAtEnd()) {
            tokens.push(this.advance());
          }
          this.consumeSemicolon();
          members.push({
            kind: "Unknown",
            name,
            tokens,
            visibility,
            span: this.createSpan(memberStart, this.current - 1)
          });
        }
      } else {
        // Store unknown tokens as unknown member
        const tokens: Token[] = [];
        const unknownStart = this.current;
        while (!this.checkSemicolon() && !this.check("}") && !this.isAtEnd()) {
          tokens.push(this.advance());
        }
        this.consumeSemicolon();
        if (tokens.length > 0) {
          members.push({
            kind: "Unknown",
            tokens,
            visibility,
            span: this.createSpan(unknownStart, this.current - 1)
          });
        }
      }
    }
    
    this.consume("}", "Expected '}' after impl body");
    
    // Return as an ImplDecl
    return {
      kind: "ImplDecl",
      type,
      trait,
      typeParams,
      whereClause,
      members,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseWhereClause(): AST.WhereClause {
    const start = this.current;
    this.advance(); // consume 'where'
    
    const constraints: AST.WhereConstraint[] = [];
    
    // Parse comma-separated constraints
    do {
      const constraintStart = this.current;
      
      // Parse the type being constrained (e.g., T or T::Item)
      const type = this.parseType();
      
      // Parse the bounds (e.g., : Display + Debug)
      const bounds: AST.TypeNode[] = [];
      if (this.match(":")) {
        // Parse first bound
        bounds.push(this.parseType());
        
        // Parse additional bounds separated by +
        while (this.match("+")) {
          bounds.push(this.parseType());
        }
      }
      
      constraints.push({
        type,
        bounds,
        span: this.createSpan(constraintStart, this.current - 1)
      });
    } while (this.match(","));
    
    return {
      constraints,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parsePackageDecl(): AST.PackageDecl {
    const start = this.current - 1;
    const nameToken = this.peek().type === TokenType.Identifier ? 
      this.advance() : 
      this.consume(TokenType.StringLiteral, "Expected package name");
    
    const name: AST.Identifier = {
      kind: "Identifier",
      name: nameToken.value,
      span: this.createSpanFrom(nameToken)
    };
    
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
      let declaration: AST.Decl | undefined;
      
      // Check if it's a declaration (class, function, etc.)
      if (this.isDeclStart()) {
        declaration = this.parseDeclaration();
      } else {
        // It's an expression - wrap it in an ExprStmt for now
        const expr = this.parseExpression();
        this.consumeSemicolon();
        // We'll store the expression as-is - could extend AST later
      }
      
      return {
        kind: "ExportDecl",
        declaration,
        isDefault: true,
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
      // Skip virtual semicolons in enum body
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      // Check for closing brace after skipping virtual semicolons
      if (this.check("}")) {
        break;
      }
      
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
      
      // Skip trailing virtual semicolons
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
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
  
  private parseListComprehension(expr: AST.Expr, start: number): AST.ListComprehension {
    // Parse: [expr for var in iterable if condition]
    // For simplicity, we'll support single-level comprehensions first
    
    this.consume("for", "Expected 'for' in list comprehension");
    
    // Parse the target variable(s) - can be multiple like "item, i"
    const targets: AST.Identifier[] = [];
    targets.push(this.parseIdentifier());
    
    // Handle multiple variables separated by commas (e.g., "item, i")
    while (this.match(",")) {
      targets.push(this.parseIdentifier());
    }
    
    this.consume("in", "Expected 'in' in list comprehension");
    
    // Parse the iterable expression
    const iterable = this.parseExpression();

    // Skip virtual semicolons before optional filter/chained for
    while (this.peek().virtualSemi) this.advance();

    // Parse optional filter
    let filter: AST.Expr | undefined;
    if (this.match("if")) {
      filter = this.parseExpression();
    }

    // Skip virtual semicolons before closing bracket
    while (this.peek().virtualSemi) this.advance();

    this.consume("]", "Expected ']' after list comprehension");
    
    return {
      kind: "ListComprehension",
      expression: expr,
      targets,
      iterable,
      filter,
      span: this.createSpan(start, this.current - 1)
    };
  }
  
  private parseArrayLiteral(): AST.ArrayLiteral | AST.ListComprehension {
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
          // Skip virtual semicolons after comma
          while (this.peek().virtualSemi) {
            this.advance();
          }
          
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
          
          // Skip trailing virtual semicolons
          while (this.peek().virtualSemi) {
            this.advance();
          }
        }
      }
    }
    
    // Skip virtual semicolons before closing bracket
    while (this.peek().virtualSemi) {
      this.advance();
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
          const errorCheckpoint = this.errors.length;
          const firstExpr = this.parseAssignmentExpression();

          // Check for set comprehension: {expr for var in iterable}
          if (this.check("for")) {
            return this.parseSetComprehension(firstExpr, start);
          }

          // Check for set literal: {expr, expr, ...} or {expr}
          // A set is detected when the first element is NOT followed by ':'
          // (which would indicate an object literal key:value pair)
          if (this.check(",") || this.check("}")) {
            // This looks like a set literal, not an object
            const elements: AST.Expr[] = [firstExpr];
            while (this.match(",")) {
              while (this.peek().virtualSemi) this.advance();
              if (this.check("}")) break;
              elements.push(this.parseAssignmentExpression());
            }
            this.consume("}", "Expected '}' after set literal");
            // Restore errors from speculative parsing
            this.errors.length = errorCheckpoint;
            return {
              kind: "SetLiteral",
              elements,
              span: this.createSpan(start, this.current - 1)
            };
          }
        }
      } catch {
        // Failed to parse as expression, continue as object literal
      }

      // Reset for regular object/dict parsing
      this.current = checkpoint;
      
      const properties: AST.ObjectProperty[] = [];
      
      do {
        // Skip virtual semicolons between properties
        while (this.peek().virtualSemi) {
          this.advance();
        }
        
        // Check for closing brace (end of object)
        if (this.check("}")) {
          break;
        }
        
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
        } else {
          // Parse regular property (not spread)
          // Parse property key
        let key: AST.Identifier | AST.StringLiteral | AST.NumericLiteral | AST.Expr;
        let computed = false;
        
        if (this.match("[")) {
          // Computed property
          computed = true;
          key = this.parseExpression();
          this.consume("]", "Expected ']' after computed property");
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
        } else if (key.kind === "Identifier" && this.check("(")) {
          // Shorthand method: method() { ... }
          this.advance(); // consume '('
          const params: AST.Param[] = [];
          if (!this.check(")")) {
            do {
              params.push(this.parseParameter());
            } while (this.match(","));
          }
          this.consume(")", "Expected ')' after method parameters");
          const methodBody = this.parseBlockOrStatement();
          value = {
            kind: "Lambda",
            params,
            body: methodBody,
            span: this.createSpan(propStart, this.current - 1)
          } as AST.Lambda;
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
        } // End of else block for non-spread properties
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
      // Parse one or more variables (e.g., "x" or "item, i")
      const variables: AST.Identifier[] = [];
      variables.push(this.parseIdentifier());
      
      // Handle multiple variables separated by commas
      while (this.match(",")) {
        variables.push(this.parseIdentifier());
      }
      
      this.consume("in", "Expected 'in' in set comprehension");
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
      // Parse one or more variables (e.g., "x" or "item, i")
      const variables: AST.Identifier[] = [];
      variables.push(this.parseIdentifier());
      
      // Handle multiple variables separated by commas
      while (this.match(",")) {
        variables.push(this.parseIdentifier());
      }
      
      this.consume("in", "Expected 'in' in generator comprehension");
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
    
    // Parse body — use parseAssignmentExpression to stop at comma (not parseExpression)
    const body = this.check("{") ? this.parseBlock() : this.parseAssignmentExpression();

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

    // Parse body — use parseAssignmentExpression to stop at comma
    const body = this.check("{") ? this.parseBlock() : this.parseAssignmentExpression();
    
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
      
      let hasArrow = this.check("=>");
      if (!hasArrow && this.check(":")) {
        // Skip return type annotation to find =>
        // e.g. (mode: string): void => { ... }
        // e.g. (x: number): Promise<string> => { ... }
        const savePos = this.current;
        this.advance(); // skip :
        let typeDepth = 0;
        while (!this.isAtEnd()) {
          if (this.check("<") || this.check("[")) {
            typeDepth++;
          } else if (this.check(">") || this.check("]")) {
            typeDepth--;
          } else if (typeDepth === 0 && this.check("=>")) {
            hasArrow = true;
            break;
          } else if (typeDepth === 0 && (this.check("{") || this.check(";") || this.check(",") || this.check(")") || this.isAtEnd())) {
            break;
          }
          this.advance();
        }
        this.current = savePos;
      }
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
              if (nextTok && nextTok.value === "=>") return true;
              // Check for return type annotation: ): Type =>
              if (nextTok && nextTok.value === ":") {
                let rpos = pos + 2; // skip ) and :
                let rtypeDepth = 0;
                while (rpos < this.tokens.length) {
                  const rt = this.tokens[rpos];
                  if (rt.value === "<" || rt.value === "[") rtypeDepth++;
                  else if (rt.value === ">" || rt.value === "]") rtypeDepth--;
                  else if (rtypeDepth === 0 && rt.value === "=>") return true;
                  else if (rtypeDepth === 0 && (rt.value === "{" || rt.value === ";" || rt.value === ",")) break;
                  rpos++;
                }
              }
              return false;
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
    if (this.check("=>")) {
      return true;
    }
    
    // Check for return type annotation
    if (this.check(":")) {
      // Save position and scan ahead through the type to find =>
      const savePos = this.current;
      this.advance(); // consume :
      
      // Skip through the type expression
      let typeDepth = 0;
      while (!this.isAtEnd()) {
        if (this.check("<")) {
          typeDepth++;
        } else if (this.check(">")) {
          typeDepth--;
        } else if (typeDepth === 0 && this.check("=>")) {
          this.current = savePos;
          return true;
        } else if (typeDepth === 0 && (this.check("{") || this.check(";") || this.check(",") || this.isAtEnd())) {
          // Not a lambda - stop scanning
          break;
        }
        this.advance();
      }
      this.current = savePos;
    }
    
    return false;
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
        return `(${type.params.map(p => {
          const name = p.name ? p.name.name + ": " : "";
          return name + this.typeNodeToString(p.type);
        }).join(", ")}) => ${this.typeNodeToString(type.ret)}`;
      case "ImplType":
        return `impl ${this.typeNodeToString(type.trait)}`;
      case "DynType":
        return `dyn ${this.typeNodeToString(type.trait)}`;
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

        // Python implicit string concatenation: adjacent string literals without comma
        while (this.peek().type === TokenType.StringLiteral && !this.check(")")) {
          const right = this.parseAssignmentExpression();
          const left = args[args.length - 1];
          args[args.length - 1] = {
            kind: "Binary",
            op: "+",
            left,
            right,
            span: this.createSpan((left.span as any).start ?? this.current - 2, this.current - 1)
          } as any;
          while (this.peek().virtualSemi) {
            this.advance();
          }
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
    const errorCheckpoint = this.errors.length;

    try {
      this.advance(); // <
      const args: AST.TypeNode[] = [];

      do {
        args.push(this.parseType());
      } while (this.match(","));

      // Handle >> and >>> as closing brackets
      if (this.check(">>")) {
        // Treat >> as a single > and leave the second > for the next parse
        const originalToken = this.tokens[this.current];
        // Replace >> with > at current position
        this.tokens[this.current] = { ...originalToken, value: ">" };
        // Insert another > after it
        const syntheticToken = { ...originalToken, value: ">" };
        this.tokens.splice(this.current + 1, 0, syntheticToken);
        // Now consume the first >
        this.advance();
      } else if (this.check(">>>")) {
        // Treat >>> as a single > and leave >> for the next parse
        const originalToken = this.tokens[this.current];
        // Replace >>> with > at current position
        this.tokens[this.current] = { ...originalToken, value: ">" };
        // Insert >> after it
        const syntheticToken = { ...originalToken, value: ">>" };
        this.tokens.splice(this.current + 1, 0, syntheticToken);
        // Now consume the first >
        this.advance();
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

      // Not a valid generic argument list — restore errors from failed attempt
      this.errors.length = errorCheckpoint;
      this.current = checkpoint;
      return null;
    } catch {
      // Failed to parse as generic args — restore errors from failed attempt
      this.errors.length = errorCheckpoint;
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
  
  /**
   * Check if `func` or `function` looks like a function call rather than a function expression.
   * func() with no body following the parens = function call.
   * func() { ... } or func name() { ... } = function expression.
   */
  private looksLikeFuncCall(): boolean {
    const kw = this.peek();
    if (kw.value !== "func" && kw.value !== "function") return false;
    const next = this.peekAt(1);
    if (!next || next.value !== "(") return false;
    // func( — scan past matched parens to see if a body follows
    let depth = 0;
    let pos = this.current + 1; // start at (
    while (pos < this.tokens.length) {
      const t = this.tokens[pos];
      if (t.value === "(") depth++;
      else if (t.value === ")") {
        depth--;
        if (depth === 0) {
          // Check what follows the closing paren
          const after = this.tokens[pos + 1];
          if (!after) return true; // EOF after func() = call
          // If body follows, it's a function expression
          if (after.value === "{" || after.value === ":" || after.value === "->") return false;
          // Otherwise it's a call
          return true;
        }
      }
      pos++;
    }
    return false;
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
           op === "|=" || op === "??=" || op === "||=" || op === "&&=" ||
           op === ":=" || op === ":=:";
  }
  
  private isUnaryOp(token: Token): boolean {
    const op = token.value;
    return op === "!" || op === "~" || op === "+" || op === "-" ||
           op === "typeof" || op === "void" || op === "delete" ||
           op === "await" || op === "++" || op === "--" || op === "&" || op === "*" || op === "**";
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

  /** Peek past consecutive virtualSemi tokens to find the next real token */
  private peekPastVsemis(): Token | undefined {
    let pos = this.current;
    while (pos < this.tokens.length && this.tokens[pos].virtualSemi) {
      pos++;
    }
    return pos < this.tokens.length ? this.tokens[pos] : undefined;
  }
  
  private previous(): Token | undefined {
    return this.tokens[this.current - 1];
  }
  
  private hasWhitespaceBefore(): boolean {
    // Check if there's whitespace between the previous token and current token
    const prev = this.previous();
    const curr = this.peek();
    
    if (!prev || !curr) return false;
    
    // Check if tokens are adjacent by comparing end position of prev with start position of curr
    // If prev.end exists, use it; otherwise fall back to checking positions
    if (prev.end !== undefined && curr.start !== undefined) {
      return curr.start > prev.end;
    }
    
    // Fallback: assume whitespace if we can't determine positions
    return false;
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

  // ============ JSX Parsing Methods ============

  // Helper for multi-token lookahead
  private lookahead(n: number): Token | null {
    const pos = this.current + n;
    return pos < this.tokens.length ? this.tokens[pos] : null;
  }

  private isJSXElement(): boolean {
    // JSX disambiguation based on spec 10.6
    const saved = this.current;

    try {
      // Check for JSXTagStart or < token
      const token = this.peek();
      if (token.type !== TokenType.JSXTagStart && token.value !== "<") {
        return false;
      }
      this.advance(); // consume JSXTagStart or <

      // Check what follows < to apply JSX recognition patterns (spec 10.6.2)
      const next = this.peek();

      // Pattern 1: Fragment <>
      if (next.value === ">") {
        this.current = saved;
        return true;
      }

      // Pattern 2: Closing tag </
      if (next.value === "/") {
        this.current = saved;
        return true;
      }

      // Pattern 3 & 4: Identifier (component or HTML element)
      if (next.type !== TokenType.Identifier) {
        this.current = saved;
        return false;
      }

      const elementName = next.value;

      // Pattern 3: Capital letter → JSX Component (but check for type assertion)
      if (/^[A-Z]/.test(elementName)) {
        this.current = saved;

        // Check if this could be a type assertion <Type>expr
        // Type assertions have the pattern <Identifier>expression
        // JSX has patterns like <Identifier attr=... or <Identifier>...content...</Identifier>
        if (this.couldBeTypeAssertion()) {
          return false;
        }

        return this.isValidJSXContinuation();
      }

      // Pattern 4: HTML tag name → JSX Element
      if (this.isHTMLTag(elementName)) {
        this.current = saved;
        return this.isValidJSXContinuation();
      }

      // Pattern 5: Qualified name (namespace.component)
      this.advance(); // consume identifier
      if (this.peek().value === ".") {
        this.current = saved;
        return this.isValidJSXContinuation();
      }

      // Not a JSX pattern - check if it's a primitive type (non-JSX pattern)
      if (this.isPrimitiveType(elementName)) {
        this.current = saved;
        return false;
      }
      
      // For other identifiers, use lookahead to disambiguate
      // This could be a generic, comparison, or unrecognized JSX pattern
      this.current = saved;
      return this.isValidJSXContinuation();
    } catch {
      this.current = saved;
      return false;
    }
  }

  private isPrimitiveType(name: string): boolean {
    const primitiveTypes = new Set([
      'string', 'number', 'boolean', 'object', 'undefined', 'null',
      'bigint', 'symbol', 'any', 'unknown', 'never', 'void'
    ]);
    return primitiveTypes.has(name);
  }

  private couldBeTypeAssertion(): boolean {
    // Check if <Identifier>expr pattern matches type assertion
    // Be conservative - only return true if we're confident it's a type assertion
    // We're at position before <, need to look ahead
    const saved = this.current;
    
    try {
      this.advance(); // consume <
      const identifier = this.advance(); // consume identifier
      
      // Check if we have a simple > (not >> or >>>)
      if (this.peek().value !== ">") {
        this.current = saved;
        return false;
      }
      
      this.advance(); // consume >
      
      // Now check what follows - for type assertion, it should be an expression
      const next = this.peek();
      
      // IMPORTANT: Check for JSX closing tag pattern first
      // If we see text/whitespace followed by </Identifier>, it's definitely JSX
      if (next.type === TokenType.Identifier || 
          next.type === TokenType.JSXText || 
          next.type === TokenType.StringLiteral) {
        // Look ahead for closing tag
        let checkPos = this.current;
        let foundNonWhitespace = false;
        
        while (checkPos < this.tokens.length && checkPos < this.current + 10) {
          const tok = this.tokens[checkPos];
          
          // Skip whitespace and newlines
          if (tok.type === TokenType.StringLiteral && /^\s+$/.test(tok.value)) {
            checkPos++;
            continue;
          }
          
          // If we find a closing tag, it's definitely JSX
          if (tok.value === "<" && 
              checkPos + 1 < this.tokens.length && 
              this.tokens[checkPos + 1].value === "/") {
            this.current = saved;
            return false; // Definitely JSX
          }
          
          // If we find non-whitespace that's not a closing tag, stop checking
          if (tok.value && tok.value.trim()) {
            foundNonWhitespace = true;
            break;
          }
          
          checkPos++;
        }
      }
      
      // Only consider it a type assertion if followed by clear expression starters
      // Be more restrictive here to avoid false positives
      if (next.type === TokenType.Identifier) {
        // Check if the identifier is followed by something that confirms it's an expression
        const afterIdent = this.tokens[this.current + 1];
        if (afterIdent && (
            afterIdent.value === "." ||   // member access
            afterIdent.value === "(" ||   // function call
            afterIdent.value === "[" ||   // array access
            afterIdent.value === ";" ||   // statement end
            afterIdent.value === "," ||   // in sequence
            afterIdent.value === ")" ||   // in parens
            afterIdent.type === TokenType.Operator)) {  // binary op
          this.current = saved;
          return true;
        }
        // Just an identifier alone - could be JSX text content
        this.current = saved;
        return false;
      }
      
      // Clear type assertion patterns
      if (next.value === "(" ||  // <Type>(expr)
          next.value === "[" ||  // <Type>[...]
          next.type === TokenType.NumericLiteral) {  // <Type>123
        this.current = saved;
        return true;
      }
      
      // Special case: { could be object literal OR JSX expression
      // Need more context to decide
      if (next.value === "{") {
        // Look for closing tag to determine if it's JSX
        let checkPos = this.current;
        let braceDepth = 0;
        
        while (checkPos < this.tokens.length && checkPos < this.current + 20) {
          const tok = this.tokens[checkPos];
          
          if (tok.value === "{") braceDepth++;
          else if (tok.value === "}") {
            braceDepth--;
            if (braceDepth === 0) {
              // Found matching close brace, check what's after
              if (checkPos + 1 < this.tokens.length) {
                const after = this.tokens[checkPos + 1];
                // If we see </ after }, it's JSX not type assertion
                if (after.value === "<" && 
                    checkPos + 2 < this.tokens.length &&
                    this.tokens[checkPos + 2].value === "/") {
                  this.current = saved;
                  return false; // It's JSX
                }
              }
              break;
            }
          }
          
          checkPos++;
        }
        
        // If we couldn't determine, default to JSX (more common)
        this.current = saved;
        return false;
      }
      
      // Default to JSX interpretation for ambiguous cases
      this.current = saved;
      return false;
    } catch {
      this.current = saved;
      return false;
    }
  }

  private isInJSXExpressionContext(): boolean {
    // Based on spec 10.6.1 - JSX is valid in these expression contexts
    if (this.current === 0) return true; // Start of program
    
    // Look at recent meaningful tokens to determine context
    const meaningfulTokens: Token[] = [];
    
    // Collect last few meaningful tokens
    for (let i = this.current - 1; i >= 0 && meaningfulTokens.length < 5; i--) {
      const token = this.tokens[i];
      
      // Skip whitespace and comments
      if (token.type === TokenType.Whitespace || 
          token.type === TokenType.Comment ||
          token.virtualSemi) {
        continue;
      }
      
      meaningfulTokens.unshift(token); // Add to beginning for correct order
      
      // Stop at statement boundaries to avoid looking too far back
      if (token.value === ';' || token.value === '}' || token.newline) {
        break;
      }
    }
    
    if (meaningfulTokens.length === 0) return true;
    
    // Check last token for immediate context
    const lastToken = meaningfulTokens[meaningfulTokens.length - 1];
    
    // JSX expression contexts (spec 10.6.1)
    switch (lastToken.value) {
      // Assignment operators
      case '=':
      case ':=':
      case '+=':
      case '-=':
      case '*=':
      case '/=':
        return true;
        
      // Control flow
      case 'return':
        return true;
        
      // Ternary operators  
      case '?':
      case ':':
        return true;
        
      // Logical operators
      case '&&':
      case '||':
      case '!':
        return true;
        
      // Array/object literals
      case '[':
      case '{':
      case ',':
        return true;
        
      // Function calls and parentheses
      case '(':
        return true;
        
      // Arrow functions
      case '=>':
        return true;
        
      // After keywords that expect expressions
      case 'yield':
      case 'throw':
      case 'await':
        return true;
        
      // Type contexts (NOT JSX contexts)
      case 'extends':
      case 'implements':
      case 'instanceof':
        return false;
    }
    
    // Check for patterns in recent token sequence
    if (meaningfulTokens.length >= 2) {
      const recent = meaningfulTokens.slice(-2);
      
      // Pattern: identifier ? (ternary condition)
      if (recent[0].type === TokenType.Identifier && recent[1].value === '?') {
        return true;
      }
      
      // Pattern: ) ? (complex condition in ternary)
      if (recent[0].value === ')' && recent[1].value === '?') {
        return true;
      }
    }
    
    return true; // Default to allowing JSX in expression contexts
  }

  private isValidJSXContinuation(): boolean {
    // Use lookahead to check for valid JSX continuation patterns
    const saved = this.current;
    
    try {
      // Skip < and identifier  
      this.advance(); // consume <
      this.advance(); // consume identifier
      
      // Handle generic type parameters for JSX components
      if (this.peek().value === "<") {
        this.advance(); // consume <
        let depth = 1;
        while (!this.isAtEnd() && depth > 0) {
          const token = this.peek();
          if (token.value === "<") {
            depth++;
          } else if (token.value === ">") {
            depth--;
          }
          this.advance();
        }
        // After consuming generics, continue checking
      }
      
      while (!this.isAtEnd()) {
        const token = this.peek();
        
        // JSX continuation patterns
        if (token.value === ">" || token.value === "/") {
          return true; // <Tag> or <Tag/>
        }
        
        if (token.type === TokenType.Identifier || token.type === TokenType.Keyword || token.value === "{") {
          return true; // <Tag attr= or <Tag {...props}
        }
        
        if (token.value === ".") {
          // Qualified name <Form.Input
          this.advance();
          if (this.peek().type === TokenType.Identifier) {
            this.advance();
            continue;
          }
          return false;
        }
        
        // Space is ok - keep looking (whitespace may be StringLiteral in JSX)
        if (token.type === TokenType.Whitespace || 
            (token.type === TokenType.StringLiteral && /^\s+$/.test(token.value))) {
          this.advance();
          continue;
        }
        
        // Anything else is not JSX
        return false;
      }
      
      return false;
    } finally {
      this.current = saved;
    }
  }

  private isHTMLTag(name: string): boolean {
    // Common HTML tags
    const htmlTags = new Set([
      'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
      'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
      'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
      'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
      'em', 'embed',
      'fieldset', 'figcaption', 'figure', 'footer', 'form',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hgroup', 'hr', 'html',
      'i', 'iframe', 'img', 'input', 'ins',
      'kbd', 'label', 'legend', 'li', 'link',
      'main', 'map', 'mark', 'menu', 'meta', 'meter',
      'nav', 'noscript',
      'object', 'ol', 'optgroup', 'option', 'output',
      'p', 'param', 'picture', 'pre', 'progress',
      'q', 'rp', 'rt', 'ruby',
      's', 'samp', 'script', 'section', 'select', 'slot', 'small', 'source', 'span', 
      'strong', 'style', 'sub', 'summary', 'sup', 'svg',
      'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 
      'title', 'tr', 'track',
      'u', 'ul',
      'var', 'video',
      'wbr'
    ]);
    
    return htmlTags.has(name.toLowerCase());
  }

  private parseJSXElement(): AST.JSXElement {
    const start = this.current;
    const openingElement = this.parseJSXOpeningElement();
    
    if (openingElement.selfClosing) {
      return {
        kind: "JSXElement",
        openingElement,
        closingElement: null,
        children: [],
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    const children = this.parseJSXChildren();
    const closingElement = this.parseJSXClosingElement();
    
    // Verify matching tags
    const openName = this.getJSXElementNameString(openingElement.name);
    const closeName = this.getJSXElementNameString(closingElement.name);
    
    if (openName !== closeName) {
      throw this.error(this.previous()!, 
        `JSX closing tag </${closeName}> doesn't match opening tag <${openName}>`);
    }
    
    return {
      kind: "JSXElement",
      openingElement,
      closingElement,
      children,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseJSXFragment(): AST.JSXFragment {
    const start = this.current;
    
    // We're already at '<', so advance past it
    this.advance(); // consume '<'
    this.consume(">", "Expected '>'");
    
    const children = this.parseJSXChildren();
    
    // Consume </>
    this.consume("<", "Expected '</'");
    this.consume("/", "Expected '/'");
    this.consume(">", "Expected '>'");
    
    return {
      kind: "JSXFragment",
      children,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseJSXOpeningElement(): AST.JSXOpeningElement {
    const start = this.current;
    
    // We're already at '<', so advance past it
    this.advance(); // consume '<'
    const name = this.parseJSXElementName();
    
    // Check for generic type arguments (per spec: JSXGenericElement)
    // <ComponentName<TypeArg1, TypeArg2> ...>
    // NOTE: Check for generics BEFORE skipping whitespace, as generics come immediately after the name
    let typeArguments: AST.TypeNode[] | undefined;
    
    if (this.peek().value === "<") {
      // Save position in case this isn't actually generics
      const checkpoint = this.current;
      try {
        this.advance(); // consume '<'
        typeArguments = [];
        
        // Parse type arguments
        do {
          typeArguments.push(this.parseType());
        } while (this.match(","));
        
        // Handle >> and >>> tokens that might remain after generic parsing
        if (this.peek().value === ">") {
          this.advance();
        } else if (this.peek().value === ">>") {
          // Split >> into two > tokens
          const originalToken = this.tokens[this.current];
          this.tokens[this.current] = { ...originalToken, value: ">" };
          this.advance();
        } else if (this.peek().value === ">>>") {
          // Split >>> into three > tokens  
          const originalToken = this.tokens[this.current];
          this.tokens[this.current] = { ...originalToken, value: ">" };
          this.advance();
        } else {
          // Not valid generics, restore position
          this.current = checkpoint;
          typeArguments = undefined;
        }
      } catch {
        // Failed to parse as generics, restore position
        this.current = checkpoint;
        typeArguments = undefined;
      }
    }
    
    const attributes = this.parseJSXAttributes();
    
    // Skip whitespace tokens before checking for self-closing
    this.skipJSXWhitespace();
    
    const selfClosing = this.match("/");
    this.consume(">", "Expected '>'");
    
    const result: any = {
      kind: "JSXOpeningElement",
      name,
      attributes,
      selfClosing,
      span: this.createSpan(start, this.current - 1)
    };
    
    // Add typeArguments if present
    if (typeArguments) {
      result.typeArguments = typeArguments;
    }
    
    return result;
  }

  private parseJSXClosingElement(): AST.JSXClosingElement {
    const start = this.current;
    
    // We're already at '<', so advance past it
    this.advance(); // consume '<'
    this.consume("/", "Expected '/'");
    const name = this.parseJSXElementName();
    this.consume(">", "Expected '>'");
    
    return {
      kind: "JSXClosingElement",
      name,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseJSXElementName(): AST.JSXElementName {
    const start = this.current;
    
    if (!this.peek() || this.peek().type !== TokenType.Identifier) {
      throw this.error(this.peek(), "Expected JSX element name");
    }
    
    let name: AST.JSXElementName = {
      kind: "JSXIdentifier",
      name: this.advance().value,
      span: this.createSpan(start, this.current - 1)
    };
    
    // Handle member expressions like <Form.Input>
    while (this.match(".")) {
      const propStart = this.current;
      if (this.peek().type !== TokenType.Identifier) {
        throw this.error(this.peek(), "Expected identifier after '.'");
      }
      
      const property: AST.JSXIdentifier = {
        kind: "JSXIdentifier",
        name: this.advance().value,
        span: this.createSpan(propStart, this.current - 1)
      };
      
      name = {
        kind: "JSXMemberExpression",
        object: name,
        property,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // NOTE: Generic type parameters are now handled in parseJSXOpeningElement
    // so we don't consume them here
    
    return name;
  }

  private parseJSXAttributes(): AST.JSXAttribute[] {
    const attributes: AST.JSXAttribute[] = [];
    
    while (!this.isAtEnd() && !this.check(">") && !this.check("/")) {
      // Skip virtual semicolons
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      // Skip whitespace tokens
      this.skipJSXWhitespace();
      
      // Check again after skipping whitespace
      if (this.check(">") || this.check("/")) {
        break;
      }
      
      if (this.check("{")) {
        // Spread attribute
        attributes.push(this.parseJSXSpreadAttribute());
      } else if (this.peek().type === TokenType.Identifier || this.peek().type === TokenType.Keyword) {
        // Normal attribute (can be identifier or keyword)
        attributes.push(this.parseJSXAttribute());
      } else {
        break;
      }
    }
    
    return attributes;
  }

  private parseJSXAttribute(): AST.JSXNormalAttribute {
    const start = this.current;
    const name = this.parseJSXAttributeName();
    
    let value: AST.JSXAttributeValue | null = null;
    
    if (this.match("=")) {
      if (this.check("{")) {
        // Expression value
        value = this.parseJSXExpressionContainer();
      } else if (this.peek().type === TokenType.StringLiteral) {
        // String value
        value = this.parseStringLiteral();
      } else if (this.check("<")) {
        // JSX element as value
        value = this.parseJSXElement();
      }
    }
    
    return {
      kind: "JSXAttribute",
      name,
      value,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseJSXAttributeName(): AST.JSXIdentifier | AST.JSXNamespacedName {
    const start = this.current;
    
    // JSX attribute names can be identifiers or keywords
    const token = this.peek();
    if (token.type !== TokenType.Identifier && token.type !== TokenType.Keyword) {
      throw this.error(this.peek(), "Expected attribute name");
    }
    
    const namespace: AST.JSXIdentifier = {
      kind: "JSXIdentifier",
      name: this.advance().value,
      span: this.createSpan(start, this.current - 1)
    };
    
    // Check for namespaced attribute like xmlns:xlink
    if (this.match(":")) {
      const nameStart = this.current;
      if (this.peek().type !== TokenType.Identifier && this.peek().type !== TokenType.Keyword) {
        throw this.error(this.peek(), "Expected identifier after ':'");
      }
      
      const name: AST.JSXIdentifier = {
        kind: "JSXIdentifier",
        name: this.advance().value,
        span: this.createSpan(nameStart, this.current - 1)
      };
      
      return {
        kind: "JSXNamespacedName",
        namespace,
        name,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    // Check for hyphenated attributes like data-testid
    if (this.match("-")) {
      // Concatenate hyphenated name
      let fullName = namespace.name + "-";
      while (this.peek().type === TokenType.Identifier) {
        fullName += this.advance().value;
        if (!this.match("-")) break;
        fullName += "-";
      }
      
      return {
        kind: "JSXIdentifier",
        name: fullName,
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    return namespace;
  }

  private parseJSXSpreadAttribute(): AST.JSXSpreadAttribute {
    const start = this.current;
    
    this.consume("{", "Expected '{'");
    this.consume("...", "Expected '...'");
    const argument = this.parseExpression();
    this.consume("}", "Expected '}'");
    
    return {
      kind: "JSXSpreadAttribute",
      argument,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseJSXChildren(): AST.JSXChild[] {
    const children: AST.JSXChild[] = [];
    
    while (!this.isAtEnd()) {
      // Check for closing tag
      if (this.check("<") && this.peekNext()?.value === "/") {
        break;
      }
      
      // Skip virtual semicolons
      while (this.peek().virtualSemi) {
        this.advance();
      }
      
      if (this.check("{")) {
        // Check if it's a spread child
        if (this.peekNext()?.value === "...") {
          // Spread child
          const start = this.current;
          this.advance(); // consume {
          this.advance(); // consume ...
          const expression = this.parseExpression();
          this.consume("}", "Expected '}'");
          
          children.push({
            kind: "JSXSpreadChild",
            expression,
            span: this.createSpan(start, this.current - 1)
          });
        } else {
          // Regular expression container (including empty {})
          children.push(this.parseJSXExpressionContainer());
        }
      } else if (this.check("<")) {
        // Nested element or fragment
        if (this.peekNext()?.value === ">") {
          children.push(this.parseJSXFragment());
        } else {
          children.push(this.parseJSXElement());
        }
      } else {
        // Text content
        const text = this.parseJSXText();
        if (text) {
          children.push(text);
        }
      }
    }
    
    return children;
  }

  private parseJSXText(): AST.JSXText | null {
    const start = this.current;
    let text = "";
    let raw = "";
    let lastTokenEnd = -1;
    
    while (!this.isAtEnd()) {
      const token = this.peek();
      
      // Stop at JSX boundaries
      if (token.value === "<" || token.value === "{") {
        break;
      }
      
      // Skip virtual semicolons but preserve the whitespace
      if (token.virtualSemi) {
        this.advance();
        continue;
      }
      
      // Check if we need to add space between tokens
      if (lastTokenEnd >= 0 && token.start > lastTokenEnd) {
        // There was whitespace between tokens
        text += " ";
        raw += " ";
      }
      
      // Accumulate text
      if (token.type === TokenType.Identifier || 
          token.type === TokenType.Keyword ||
          token.type === TokenType.NumericLiteral ||
          token.type === TokenType.StringLiteral) {
        text += token.value;
        raw += token.value;
        lastTokenEnd = token.end;
        this.advance();
      } else if (token.value === ">" || token.value === "}") {
        // These shouldn't appear in text
        break;
      } else {
        // Other tokens become part of text
        text += token.value;
        raw += token.value;
        lastTokenEnd = token.end;
        this.advance();
      }
    }
    
    // Return null for empty text, but preserve meaningful whitespace
    if (text === "") {
      return null;
    }
    
    return {
      kind: "JSXText",
      value: text,
      raw,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseJSXExpressionContainer(): AST.JSXExpressionContainer {
    const start = this.current;
    
    this.consume("{", "Expected '{'");
    
    // Skip whitespace inside JSX expression
    this.skipJSXWhitespace();
    
    if (this.check("}")) {
      // Empty expression
      this.advance();
      return {
        kind: "JSXExpressionContainer",
        expression: {
          kind: "JSXEmptyExpression",
          span: this.createSpan(start + 1, this.current - 1)
        },
        span: this.createSpan(start, this.current - 1)
      };
    }
    
    const expression = this.parseExpression();
    
    // Skip whitespace before closing brace
    this.skipJSXWhitespace();
    this.consume("}", "Expected '}'");
    
    return {
      kind: "JSXExpressionContainer",
      expression,
      span: this.createSpan(start, this.current - 1)
    };
  }

  private parseJSXExpression(): AST.Expr {
    // Parse expression while filtering out JSX whitespace tokens
    // Create a temporary filtered token array that excludes JSX whitespace
    const originalTokens = this.tokens;
    const originalCurrent = this.current;
    
    // Filter tokens to remove JSX whitespace StringLiterals  
    const filteredTokens: Token[] = [];
    const indexMap: number[] = []; // Maps filtered index to original index
    
    for (let i = originalCurrent; i < originalTokens.length; i++) {
      const token = originalTokens[i];
      
      // Stop at the closing brace
      if (token.value === "}" && token.type === TokenType.Operator) {
        filteredTokens.push(token);
        indexMap.push(i);
        break;
      }
      
      // Skip JSX whitespace StringLiterals  
      if (token.type === TokenType.StringLiteral && /^\s+$/.test(token.value)) {
        continue;
      }
      
      filteredTokens.push(token);
      indexMap.push(i);
    }
    
    // Temporarily replace tokens and reset position
    this.tokens = [...originalTokens.slice(0, originalCurrent), ...filteredTokens];
    this.current = originalCurrent;
    
    try {
      const expr = this.parseExpression();
      
      // Calculate how far we moved in filtered tokens
      const movedInFiltered = this.current - originalCurrent;
      
      // Restore original tokens and adjust position
      this.tokens = originalTokens;
      this.current = indexMap[movedInFiltered - 1] + 1;
      
      return expr;
    } catch (error) {
      // Restore original state on error
      this.tokens = originalTokens;
      this.current = originalCurrent;
      throw error;
    }
  }

  private getJSXElementNameString(name: AST.JSXElementName): string {
    switch (name.kind) {
      case "JSXIdentifier":
        return name.name;
      case "JSXMemberExpression":
        return this.getJSXElementNameString(name.object) + "." + name.property.name;
      case "JSXNamespacedName":
        return name.namespace.name + ":" + name.name.name;
    }
  }

  private skipJSXWhitespace(): void {
    // Skip StringLiteral tokens that contain only whitespace
    while (this.peek().type === TokenType.StringLiteral && /^\s*$/.test(this.peek().value)) {
      this.advance();
    }
  }
}