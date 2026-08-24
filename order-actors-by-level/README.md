# Order Actors by Level

Adds a third Actors-directory sort mode (by level/CR) to Foundry’s existing alphabetical ↔ manual toggle.

Built-in resolvers: **pf2e**, **dnd5e**. Other systems fall back to name order unless a resolver is registered.

## Extending to another system

Make this module a dependency of the extending module, then on `setup` (or later):

```js
Hooks.once("setup", () => {
  const api = game.modules.get("order-actors-by-level")?.api;
  if (!api) return;

  api.registerLevelResolver("mysystem", (doc) => {
    const n = doc.system?.rank; // system-specific path
    return Number.isFinite(n) ? n : null;
  });
});
```

`api` also exposes `getActorLevel(doc)` and `getLevelResolver(systemId?)`.
