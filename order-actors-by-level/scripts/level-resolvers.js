/**
 * System-specific actor "level" resolvers for directory sorting.
 * Register more with {@link registerLevelResolver}.
 *
 * @typedef {(doc: object) => number|null|undefined} LevelResolver
 */

/** @type {Map<string, LevelResolver>} */
const resolvers = new Map();

/**
 * @param {string} systemId
 * @param {LevelResolver} resolver
 */
export function registerLevelResolver(systemId, resolver) {
    resolvers.set(systemId, resolver);
}

/**
 * @param {string} [systemId]
 * @returns {LevelResolver|undefined}
 */
export function getLevelResolver(systemId = game.system.id) {
    return resolvers.get(systemId);
}

/**
 * Numeric sort key for an actor (or folder/other tree node).
 * @param {object} doc
 * @returns {number|null}
 */
export function getActorLevel(doc) {
    const resolver = getLevelResolver();
    if (!resolver) return null;
    const level = resolver(doc);
    return Number.isFinite(level) ? level : null;
}

/* -------------------------------------------- */
/*  Built-in resolvers                          */
/* -------------------------------------------- */

registerLevelResolver("pf2e", (doc) => {
    const value = doc.system?.details?.level?.value;
    return Number.isFinite(value) ? value : null;
});

registerLevelResolver("dnd5e", (doc) => {
    const details = doc.system?.details;
    if (!details) return null;

    // NPCs: CR is the meaningful rank (details.level may exist for spellcasting).
    if (doc.type === "npc" && Number.isFinite(details.cr)) return details.cr;

    if (Number.isFinite(details.level)) return details.level;
    if (Number.isFinite(details.cr)) return details.cr;
    return null;
});
