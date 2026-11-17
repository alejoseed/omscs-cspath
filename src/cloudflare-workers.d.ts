// Minimal typing for the Workers runtime module. Bindings are narrowed where
// they are read (see src/lib/d1.server.ts), so no generated types are needed.
declare module "cloudflare:workers" {
  export const env: Record<string, unknown>;
}
