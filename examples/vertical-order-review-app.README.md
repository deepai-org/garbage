# Vertical Order Review App

`vertical-order-review-app.poly` is the canonical public example for Poly:
one order-review workflow spanning Django, FastAPI, Pydantic, Express, Zod,
React server rendering, Java/Jackson futures, Ruby ActiveRecord/Fiber state,
and Go workers.

Compile it to an OmniVM manifest:

```sh
npm run polyc -- examples/vertical-order-review-app.poly -o /tmp/vertical-order-review-app.json
```

The app prints one summary line. The Ruby fiber id is process-local, and
FastAPI may include framework default routes, so those fields are shown as
stable expectations instead of hard-coded fixture values:

```text
Vertical order app order=ord-42 routes=<fastapi-route-count> django=200 react=71 java=priority ruby=<fiber-id> workers=2 adjustment=7
```

This example is intended to stay small enough to read end to end while showing
Poly’s core promise: framework objects remain in their native runtimes, typed
validation and rendering stay library-local, Java and Ruby service logic can be
called in the same workflow, and Go worker handles synchronize back into the
final Python response.
