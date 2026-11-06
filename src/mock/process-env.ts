// server/*.ts reads a few settings from process.env; the browser has no `process`, so give it an empty one.
// Imported first by engine.ts, before the server modules evaluate.
const g = globalThis as { process?: { env: Record<string, string | undefined> } }
g.process ??= { env: {} }
