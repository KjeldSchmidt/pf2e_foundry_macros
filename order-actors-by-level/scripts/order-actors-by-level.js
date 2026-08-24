const MODULE_ID = "order-actors-by-level";

const MODES = Object.freeze({ ALPHA: "a", MANUAL: "m", LEVEL: "l" });
const CYCLE = Object.freeze([MODES.ALPHA, MODES.MANUAL, MODES.LEVEL]);

function _log(message) {
    console.log(`Order Actors By Level | ${message}`);
}

function getMode() {
    return game.settings.get(MODULE_ID, "sortingMode");
}

function getCoreSortingKey() {
    return game.actors.collection ?? game.actors.name;
}

function setCoreSortingMode(mode) {
    const sortingModes = foundry.utils.duplicate(game.settings.get("core", "collectionSortingModes") ?? {});
    sortingModes[getCoreSortingKey()] = mode;
    game.settings.set("core", "collectionSortingModes", sortingModes);
}

async function setMode(mode) {
    await game.settings.set(MODULE_ID, "sortingMode", mode);
    if (mode === MODES.ALPHA || mode === MODES.MANUAL) setCoreSortingMode(mode);
}

function sortByLevel(a, b) {
    const levelA = a.system?.details?.level?.value;
    const levelB = b.system?.details?.level?.value;
    const hasLevelA = Number.isFinite(levelA);
    const hasLevelB = Number.isFinite(levelB);

    if (hasLevelA || hasLevelB) {
        const cmp = (hasLevelA ? levelA : Number.NEGATIVE_INFINITY) - (hasLevelB ? levelB : Number.NEGATIVE_INFINITY);
        if (cmp !== 0) return cmp;
    }

    return (a.name ?? "").localeCompare(b.name ?? "", game.i18n.lang);
}

function wrapActorSortComparators() {
    const Actors = CONFIG.Actor.collection;
    const originalAlphabetical = Actors._sortAlphabetical;
    const originalStandard = Actors._sortStandard;

    Actors._sortAlphabetical = function (a, b) {
        if (getMode() === MODES.LEVEL) return sortByLevel(a, b);
        return originalAlphabetical.call(this, a, b);
    };

    Actors._sortStandard = function (a, b) {
        if (getMode() === MODES.LEVEL) return sortByLevel(a, b);
        return originalStandard.call(this, a, b);
    };
}

function patchHeaderContext() {
    const DirectoryClass = CONFIG.ui.actors;
    const original = DirectoryClass.prototype._prepareHeaderContext;

    DirectoryClass.prototype._prepareHeaderContext = async function (context, options) {
        await original.call(this, context, options);
        if (getMode() === MODES.LEVEL) {
            context.sortMode = {
                icon: "fa-solid fa-arrow-down-1-9",
                label: "Sort by Level"
            };
        }
    };
}

async function cycleSortingMode() {
    const current = getMode();
    const index = CYCLE.indexOf(current);
    const next = CYCLE[(index < 0 ? 0 : index + 1) % CYCLE.length];
    await setMode(next);
    game.actors.initializeTree();
    _log(`Sort mode: ${next}`);
}

function installToggleSortAction() {
    ui.actors.options.actions.toggleSort = async function onToggleSort() {
        await cycleSortingMode();
        this.render();
    };
}

async function syncModeFromCoreIfNeeded() {
    const mode = getMode();
    if (mode === MODES.LEVEL) return;

    const coreMode = game.actors.sortingMode === MODES.MANUAL ? MODES.MANUAL : MODES.ALPHA;
    if (mode !== coreMode) await game.settings.set(MODULE_ID, "sortingMode", coreMode);
}

_log("Loading, registering hooks");

Hooks.once("init", () => {
    game.settings.register(MODULE_ID, "sortingMode", {
        scope: "client",
        config: false,
        type: String,
        default: MODES.ALPHA,
        choices: {
            [MODES.ALPHA]: "Alphabetical",
            [MODES.MANUAL]: "Manual",
            [MODES.LEVEL]: "Level"
        }
    });
});

Hooks.once("ready", async () => {
    wrapActorSortComparators();
    patchHeaderContext();
    await syncModeFromCoreIfNeeded();
    installToggleSortAction();

    if (getMode() === MODES.LEVEL) {
        game.actors.initializeTree();
        ui.actors.render();
    }

    _log("Ready");
});
