// Safe KV-namespace resolver for EdgeOne Pages Functions.
//
// EdgeOne does not always expose KV bindings on the `env` argument the way
// Cloudflare Pages does — depending on the runtime/config the namespace may be
// injected as a GLOBAL variable instead. So we look it up through several
// layers and use whichever is present:
//   ① env[name]                         (Cloudflare-style binding object)
//   ② globalThis[name]                  (binding attached to the global object)
//   ③ direct global identifier          (typeof-guarded, never throws)
//
// Returns the KV namespace, or null if none of the layers has it.

// Direct (typeof-guarded) lookup of a known global binding. The bare identifier
// in the truthy branch is only evaluated when `typeof` proves it exists, so this
// can never throw a ReferenceError even when the binding is absent.
function directGlobal(name) {
  switch (name) {
    case 'PROCESS_KV':
      return typeof PROCESS_KV !== 'undefined' ? PROCESS_KV : undefined
    case 'ANNOTATIONS_KV':
      return typeof ANNOTATIONS_KV !== 'undefined' ? ANNOTATIONS_KV : undefined
    default:
      return undefined
  }
}

export function getKV(env, name) {
  // ① env binding object
  if (env && env[name]) return env[name]

  // ② global object
  try {
    if (typeof globalThis !== 'undefined' && globalThis[name]) return globalThis[name]
  } catch { /* ignore */ }

  // ③ direct global identifier (typeof-guarded)
  const g = directGlobal(name)
  if (g) return g

  return null
}
