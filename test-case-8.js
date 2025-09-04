
const { Lexer } = require('./dist/lexer');
const { Parser } = require('./dist/parser');

const code = `
# Event system mixing multiple paradigms
type EventMap = {
  "user:login": {userId: string, timestamp: Date}
  "user:logout": {userId: string}
  "data:update": {id: string, changes: object}
}

class EventBus<T extends EventMap> {
  handlers := new Map()
  asyncHandlers := new Map()
  middleware := []
  
  # Type-safe event registration
  on<K extends keyof T>(event: K, handler: (data: T[K]) => void) {
    if !this.handlers.has(event) {
      this.handlers.set(event, new Set())
    }
    this.handlers.get(event).add(handler)
    
    # Return unsubscribe function
    return () => {
      this.handlers.get(event)?.delete(handler)
    }
  }
  
  # Async event handling with Go-style
  async onAsync<K extends keyof T>(event: K, handler: (data: T[K]) => Promise<void>) {
    key := \`async:\${event}\`
    
    if !this.asyncHandlers.has(key) {
      this.asyncHandlers.set(key, [])
    }
    
    this.asyncHandlers.get(key).push(handler)
  }
  
  # Emit with middleware pipeline
  async emit<K extends keyof T>(event: K, data: T[K]) {
    # Run middleware
    context := {event, data, cancelled: false}
    
    for middleware of this.middleware {
      await middleware(context)
      if context.cancelled {
        return
      }
    }
    
    # Sync handlers
    handlers := this.handlers.get(event) ?? []
    handlers.forEach(handler => {
      try:
        handler(data)
      except Exception as e:
        console.error(\`Handler error for \${event}:\`, e)
    })
    
    # Async handlers with Go routines
    asyncHandlers := this.asyncHandlers.get(\`async:\${event}\`) ?? []
    foreach handler in asyncHandlers do
      go async () => {
        try {
          await handler(data)
        } catch (e) {
          console.error(\`Async handler error for \${event}:\`, e)
        }
      }()
    done
  }
  
  # Pattern-based subscription
  def subscribe(pattern: RegExp | string, handler) {
    if typeof pattern == "string" {
      return this.on(pattern, handler)
    }
    
    # Register pattern handler
    this.middleware.push(async (ctx) => {
      if pattern.test(ctx.event) {
        await handler(ctx.data)
      }
    })
  }
  
  # Once with promise
  once<K extends keyof T>(event: K): Promise<T[K]> {
    return new Promise((resolve) => {
      unsub := this.on(event, (data) => {
        unsub()
        resolve(data)
      })
    })
  }
}

# Create typed event bus
bus := new EventBus<EventMap>()

# Register handlers
bus.on("user:login", ({userId, timestamp}) => {
  console.log(\`User \${userId} logged in at \${timestamp}\`)
})

bus.onAsync("data:update", async ({id, changes}) => {
  await saveToDatabase(id, changes)
})

# Pattern subscription
bus.subscribe(/^user:/, (data) => {
  audit.log("User event:", data)
})

# Emit events
await bus.emit("user:login", {
  userId: "123",
  timestamp: new Date()
})

# Wait for specific event
logout := await bus.once("user:logout")
console.log("User logged out:", logout.userId)
`;

console.log('Testing: parses event-driven architecture with mixed patterns');
console.log('Code length:', code.length);

const timeout = setTimeout(() => {
  console.log('TIMEOUT - Parser stuck!');
  process.exit(1);
}, 2000);

try {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  const ast = parser.parse();
  clearTimeout(timeout);
  
  console.log(`Success! AST body length: ${ast.body.length}`);
} catch (e) {
  clearTimeout(timeout);
  console.log('Parse error:', e.message);
}
