# Project Rules

## Process

- Any architectural change must be documented in the relevant Obsidian notes before implementation begins. Present the design, wait for acceptance, update the notes, then implement.

## Code Style

- Always be explicit with types. Every function and method definition must show the type of every argument and must always include return types.
- Use idiomatic Go patterns for backend services. When asked for the "idiomatic Go approach", reference conventions from Kubernetes, Docker, etcd, and the Go standard library as authoritative examples.
- Avoid comments unless absolutely necessary. Code should be self-explanatory through clear naming. Do not add doc comments, section dividers, or inline explanations of what the code does.

## TypeScript (WebApp)

- Always use explicit type annotations for function parameters and return types. Never rely on inference for function signatures.
- Export interfaces/types for all data structures, store shapes, and prop contracts.
- Prefer `type` over `interface` for union types, mapped types, and utility types. Use `interface` for object shapes that may be extended.
- Import types with `import type { ... }` syntax for isolated type imports.
- Add explicit return type annotations to all exported functions and React components.
- Use `satisfies` operator instead of type assertions (`as`) where possible.
- Every TypeScript statement must end with a semicolon (`;`).

## Styling (WebApp)

- Never use inline `style={{ }}` props. All styling must use CSS classes.
- Prefer Tailwind utility classes for all styling. When custom CSS is needed, create a `.css` file co-located with the component (e.g. `WorkspaceInfoDrawer.css` next to `WorkspaceInfoDrawer.tsx`) and import it.
- Do not embed raw CSS strings or style objects in TypeScript files.
