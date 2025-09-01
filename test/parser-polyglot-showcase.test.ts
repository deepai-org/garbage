import { describe, test, expect } from '@jest/globals';
import { Parser } from '../src/parser';
import { Lexer } from '../src/lexer';
import * as AST from '../src/ast';

function parseCode(code: string): AST.Program {
  const lexer = new Lexer(code);
  const tokens = lexer.tokenize();
  const parser = new Parser(tokens);
  return parser.parse();
}

describe('Polyglot Parser Showcase Tests', () => {
  test('parses real-world async data processor', () => {
    const code = `
# Real-world data processing pipeline mixing paradigms
async function processDataStream(source: DataSource) {
  results := []
  errors := []
  
  try {
    # Python-style with statement for resource management
    with source.connect() as conn:
      # Go-style defer for cleanup
      defer conn.close()
      
      # Bash-style loop with mixed syntax
      while [ $retries -lt 3 ]; do
        try:
          # Async iteration
          data := await conn.fetch()
          
          # Ruby-style block processing
          begin
            processed := data
              |> validate
              |> transform
              |> enrich
            
            # Pattern matching for result handling
            match processed {
              {status: "success", value} => results.push(value),
              {status: "error", reason} => errors.push(reason),
              _ => console.warn("Unknown result")
            }
          rescue ProcessingError => e
            errors.push(e.message)
            retry if retries < 3
          end
          
          retries := 0  # Reset on success
        except TimeoutError:
          retries++
          await sleep(1000)
        finally:
          log("Attempt completed")
      done
  } catch (e) {
    throw new Error(\`Pipeline failed: \${e.message}\`)
  } finally {
    return {results, errors}
  }
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
    const func = ast.body[0] as AST.FuncDecl;
    expect(func.kind).toBe('FuncDecl');
    expect(func.async).toBe(true);
  });

  test('parses multi-paradigm web server', () => {
    const code = `
# Web server mixing Express.js, Go, and Python patterns
class WebServer {
  constructor(port: number = 3000) {
    this.port := port
    this.routes := new Map()
    this.middleware := []
  }
  
  # Python-style method with Go defer
  def use(self, handler):
    defer self.log("Middleware added")
    self.middleware.push(handler)
    return self
  
  # TypeScript-style generic method
  async handle<T>(req: Request, res: Response): Promise<T> {
    # Go-style error handling
    result, err := await this.processRequest(req)
    if err != nil {
      res.status(500).json({error: err.message})
      return
    }
    
    # Bash-style conditional
    if [ "$result.cached" = "true" ]; then
      res.setHeader("X-Cache", "HIT")
    fi
    
    res.json(result)
  }
  
  # Ruby-style method with mixed blocks
  def start
    begin
      server := this.createServer()
      
      # Async IIFE
      (async () => {
        await server.listen(this.port)
        echo "Server running on port $this.port"
      })()
      
      # Signal handling with mixed syntax
      ["SIGINT", "SIGTERM"].forEach(signal => {
        process.on(signal, async () => {
          echo "Shutting down..."
          await server.close()
          process.exit(0)
        })
      })
    rescue => e
      console.error("Failed to start:", e)
      throw e
    end
  end
}

# Usage
server := new WebServer(8080)
server.use(cors())
server.use(bodyParser())
server.start()
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(2);
    const cls = ast.body[0] as AST.ClassDecl;
    expect(cls.kind).toBe('ClassDecl');
  });

  test('parses concurrent task orchestrator', () => {
    const code = `
# Task orchestrator with Go channels and JavaScript promises
fn orchestrate(tasks: []Task) {
  # Create channels for communication
  results := make(chan Result, len(tasks))
  errors := make(chan Error, len(tasks))
  done := make(chan bool)
  
  # Launch workers
  for i := 0; i < 10; i++ {
    go func(id) {
      for task := range tasks {
        try {
          result := await task.execute()
          results <- result
        } catch (e) {
          errors <- e
        }
      }
      done <- true
    }(i)
  }
  
  # Collect results with timeout
  collected := []
  errorList := []
  timeout := setTimeout(() => {
    throw new Error("Timeout")
  }, 30000)
  
  loop {
    select {
      case result := <-results:
        collected.push(result)
        if len(collected) == len(tasks) {
          clearTimeout(timeout)
          break
        }
      case err := <-errors:
        errorList.push(err)
      case <-done:
        workers--
        if workers == 0 {
          break
        }
    }
  }
  
  return {
    successful: collected,
    failed: errorList
  }
}
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(1);
  });

  test('parses configuration DSL with mixed syntax', () => {
    const code = `
# Configuration system mixing multiple paradigms
interface Config {
  database: {
    host: string
    port: number
    credentials?: Credentials
  }
  cache: CacheConfig
  features: Map<string, boolean>
}

# Builder pattern with method chaining
class ConfigBuilder {
  config := {
    database: {},
    cache: {},
    features: new Map()
  }
  
  def withDatabase(host, port = 5432):
    this.config.database = {host, port}
    return this
  
  fn withCache(type: "redis" | "memory") -> ConfigBuilder {
    match type {
      "redis" => this.config.cache = new RedisCache(),
      "memory" => this.config.cache = new MemoryCache(),
      _ => throw new Error("Invalid cache type")
    }
    return this
  }
  
  # Feature flags with Ruby-style blocks
  def features(&block)
    begin
      proxy := new Proxy({}, {
        set: (_, key, value) => {
          this.config.features.set(key, value)
          return true
        }
      })
      block(proxy)
    ensure
      return this
    end
  end
  
  async build(): Config {
    # Validate with bash-style checks
    if [ -z "$this.config.database.host" ]; then
      throw new Error("Database host required")
    fi
    
    # Apply environment overrides
    if process.env.DB_HOST {
      this.config.database.host = process.env.DB_HOST
    }
    
    # Async validation
    await this.validate()
    
    return this.config
  }
}

# Usage with fluent interface
config := await new ConfigBuilder()
  .withDatabase("localhost", 5432)
  .withCache("redis")
  .features(f => {
    f.darkMode = true
    f.betaFeatures = false
    f.analytics = true
  })
  .build()
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(3);
  });

  test('parses state machine with mixed paradigms', () => {
    const code = `
# State machine mixing TypeScript types and pattern matching
type State = "idle" | "loading" | "success" | "error"
type Event = {type: "FETCH"} | {type: "SUCCESS", data: any} | {type: "ERROR", error: Error}

class StateMachine<S, E> {
  state: S
  transitions: Map
  
  constructor(initial: S) {
    this.state = initial
    this.transitions = new Map()
  }
  
  # Define transitions with pattern matching
  def on(fromState: S, event: E["type"], toState: S, action?: Function) {
    key := \`\${fromState}:\${event}\`
    this.transitions.set(key, {toState, action})
    return this
  }
  
  # Process event with mixed error handling
  async send(event: E) {
    key := \`\${this.state}:\${event.type}\`
    transition := this.transitions.get(key)
    
    if transition == nil {
      echo "No transition for $key"
      return
    }
    
    try:
      if transition.action:
        await transition.action(event)
      
      oldState := this.state
      this.state = transition.toState
      
      # Emit state change event
      this.emit("stateChange", {
        from: oldState,
        to: this.state,
        event: event
      })
    except Exception as e:
      this.state = "error"
      raise e
    finally:
      this.logTransition()
  }
  
  # Guard conditions with mixed syntax
  fn canTransition(event: E) -> bool {
    key := \`\${this.state}:\${event.type}\`
    
    # Bash-style existence check
    if [ -n "\${this.transitions.get(key)}" ]; then
      return true
    fi
    
    return false
  }
}

# Create and configure state machine
machine := new StateMachine<State, Event>("idle")
  .on("idle", "FETCH", "loading", async () => {
    echo "Starting fetch..."
  })
  .on("loading", "SUCCESS", "success", (event) => {
    console.log("Data received:", event.data)
  })
  .on("loading", "ERROR", "error", (event) => {
    console.error("Error occurred:", event.error)
  })

# Use the state machine
go async () => {
  await machine.send({type: "FETCH"})
  
  try {
    data := await fetchData()
    await machine.send({type: "SUCCESS", data})
  } catch (error) {
    await machine.send({type: "ERROR", error})
  }
}()
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(3);
  });

  test('parses reactive stream processor', () => {
    const code = `
# Reactive stream processing with mixed paradigms
class StreamProcessor {
  operators := []
  subscribers := new Set()
  
  # Operator chaining with pipeline operator
  def pipe(...ops):
    this.operators = [...this.operators, ...ops]
    return this
  
  # Ruby-style enumerable methods
  def map(&transform)
    this.operators.push({
      type: "map",
      fn: transform
    })
    return this
  end
  
  def filter(&predicate)
    begin
      this.operators.push({
        type: "filter",
        fn: predicate
      })
    ensure
      return this
    end
  end
  
  # Async generator for processing
  async process(source) {
    for await (const item of source) {
      value := item
      skip := false
      
      # Apply operators
      foreach op in this.operators do
        match op.type {
          "map" => value = await op.fn(value),
          "filter" => {
            if !await op.fn(value) {
              skip = true
              break
            }
          },
          "tap" => await op.fn(value),
          _ => throw new Error(\`Unknown operator: \${op.type}\`)
        }
      done
      
      if !skip {
        # Notify subscribers
        this.subscribers.forEach(sub => {
          go sub(value)
        })
        
        yield value
      }
    }
  }
  
  # Subscribe with automatic cleanup
  subscribe(handler: Function) {
    this.subscribers.add(handler)
    
    # Return unsubscribe function
    return () => {
      this.subscribers.delete(handler)
    }
  }
}

# Usage example
processor := new StreamProcessor()
  |> _.map(x => x * 2)
  |> _.filter(x => x > 10)
  |> _.map(async x => {
    result := await transform(x)
    return result
  })

# Process stream
async function* dataStream() {
  for i := 0; i < 100; i++ {
    yield i
    await sleep(100)
  }
}

# Subscribe and process
unsubscribe := processor.subscribe(value => {
  console.log("Received:", value)
})

go async () => {
  for await (const result of processor.process(dataStream())) {
    if result > 50 {
      break
    }
  }
  unsubscribe()
}()
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(4);
  });

  test('parses dependency injection container', () => {
    const code = `
# DI container with mixed paradigms
interface ServiceProvider {
  get<T>(token: string | Symbol): T
  has(token: string | Symbol): boolean
}

class Container implements ServiceProvider {
  services := new Map()
  factories := new Map()
  singletons := new Map()
  
  # Register with Python-style decorators (simulated)
  def register(token, provider, options = {}):
    if options.singleton:
      this.singletons.set(token, null)
    
    this.factories.set(token, provider)
    return this
  
  # Resolve with pattern matching
  fn get<T>(token: string | Symbol): T {
    # Check if already instantiated singleton
    if this.singletons.has(token) && this.singletons.get(token) != nil {
      return this.singletons.get(token)
    }
    
    # Get factory
    factory := this.factories.get(token)
    if factory == nil {
      throw new Error(\`Service not found: \${token.toString()}\`)
    }
    
    # Resolve dependencies
    deps := []
    if factory.deps {
      foreach dep in factory.deps do
        deps.push(this.get(dep))
      done
    }
    
    # Create instance
    instance := match factory.type {
      "class" => new factory.provider(...deps),
      "factory" => factory.provider(...deps),
      "value" => factory.provider,
      _ => throw new Error("Invalid provider type")
    }
    
    # Store singleton if needed
    if this.singletons.has(token) {
      this.singletons.set(token, instance)
    }
    
    return instance
  }
  
  # Batch registration with Ruby block
  def configure(&block)
    begin
      proxy := {
        service: (token, provider) => {
          this.register(token, provider)
        },
        singleton: (token, provider) => {
          this.register(token, provider, {singleton: true})
        },
        factory: (token, fn) => {
          this.register(token, {type: "factory", provider: fn})
        }
      }
      
      block(proxy)
    rescue => e
      console.error("Configuration failed:", e)
      throw e
    ensure
      return this
    end
  end
  
  # Auto-wire with bash-style checks
  async autowire(target) {
    if [ -z "$target.constructor.inject" ]; then
      return target
    fi
    
    for key, token of target.constructor.inject {
      target[key] = await this.get(token)
    }
    
    return target
  }
}

# Configure container
container := new Container()
  .configure(c => {
    c.singleton("database", DatabaseConnection)
    c.singleton("cache", RedisCache)
    c.service("userRepo", UserRepository)
    c.factory("logger", () => new Logger({level: "debug"}))
  })

# Usage
userRepo := container.get("userRepo")
`;

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(3);
  });

  test('parses event-driven architecture with mixed patterns', () => {
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

    const ast = parseCode(code);
    expect(ast.body.length).toBeGreaterThanOrEqual(4);
  });
});