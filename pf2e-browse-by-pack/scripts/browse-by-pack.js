/**
 * PF2e Browse by Pack
 * Adds a pack filter to the PF2e Compendium Browser.
 *
 * PF2e v14 filters via Predicate over each index entry's `options` Set
 * (CompendiumBrowserTab.buildPredicate / results). This module:
 *  1. Tags each index entry with `pack:<collectionId>` after loadData
 *  2. Injects a native checkbox group into filterData.checkboxes.pack
 */

const MODULE_ID = "pf2e-browse-by-pack";

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Initializing`);
  patchCompendiumBrowserTabs();
});

/**
 * Patch all browser tabs so pack options and filter UI are available.
 */
function patchCompendiumBrowserTabs() {
  const browser = game.pf2e?.compendiumBrowser;
  if (!browser?.tabs) {
    console.warn(`${MODULE_ID} | PF2e Compendium Browser not found`);
    return;
  }

  for (const tab of Object.values(browser.tabs)) {
    if (!tab || tab._browseByPackPatched) continue;

    wrapTabLoadData(tab);
    tab._browseByPackPatched = true;

    // Tabs may already be initialized before this module's ready hook.
    if (tab.isInitialized) {
      ensurePackOptionsOnIndex(tab);
      ensurePackFilter(tab);
      // Nudge Svelte $state so a late-added checkbox key is picked up if the UI is open.
      tab.filterData = tab.filterData;
    }

    console.log(`${MODULE_ID} | Patched tab: ${tab.tabName}`);
  }
}

/**
 * Wrap loadData so pack tagging + filter injection happen before MiniSearch indexing
 * and before defaultFilterData is cloned in init().
 */
function wrapTabLoadData(tab) {
  const originalLoadData = tab.loadData.bind(tab);

  tab.loadData = async function loadDataWithPackFilter() {
    await originalLoadData();
    ensurePackOptionsOnIndex(this);
    ensurePackFilter(this);
  };
}

/**
 * Add `pack:<collectionId>` to every index entry's options Set.
 * MiniSearch stores options by reference, so later mutations stay visible to search hits.
 */
function ensurePackOptionsOnIndex(tab) {
  for (const entry of tab.indexData ?? []) {
    const packId = packIdFromUuid(entry.uuid);
    if (!packId) continue;

    if (!(entry.options instanceof Set)) {
      entry.options = new Set(entry.options ?? []);
    }
    entry.options.add(`pack:${packId}`);
  }
}

/**
 * Inject / refresh the native Pack checkbox group on this tab's filterData.
 * buildPredicate already turns checkbox selections into `{ or: ["pack:…"] }` statements.
 */
function ensurePackFilter(tab) {
  if (!tab.filterData || !("checkboxes" in tab.filterData)) return;

  const packIds = getPackIdsForTab(tab);
  const previous = tab.filterData.checkboxes.pack;
  const previousSelected = new Set(previous?.selected ?? []);

  const options = {};
  for (const packId of packIds) {
    const pack = game.packs.get(packId);
    options[packId] = {
      label: pack?.metadata?.label ?? packId,
      selected: previousSelected.has(packId),
    };
  }

  const packFilter = {
    isExpanded: previous?.isExpanded ?? false,
    label: "Pack",
    options,
    optionPrefix: "pack",
    selected: packIds.filter((id) => previousSelected.has(id)),
  };

  tab.filterData.checkboxes.pack = packFilter;

  // Keep Clear/Reset in sync when defaultFilterData already exists (late patch).
  // On first init, init() deep-clones filterData after loadData and picks this up.
  if (tab.defaultFilterData?.checkboxes) {
    tab.defaultFilterData.checkboxes.pack = foundry.utils.deepClone({
      isExpanded: false,
      label: "Pack",
      options: Object.fromEntries(
        Object.entries(options).map(([id, opt]) => [id, { label: opt.label, selected: false }]),
      ),
      optionPrefix: "pack",
      selected: [],
    });
  }
}

/**
 * Packs enabled for this browser tab in Compendium Browser settings.
 */
function getPackIdsForTab(tab) {
  const browser = game.pf2e?.compendiumBrowser;
  const fromSettings = browser?.loadedPacks?.(tab.tabName);
  if (Array.isArray(fromSettings) && fromSettings.length) {
    return sortPackIds(fromSettings);
  }

  const packs = new Set();
  for (const entry of tab.indexData ?? []) {
    const packId = packIdFromUuid(entry.uuid);
    if (packId) packs.add(packId);
  }
  return sortPackIds([...packs]);
}

function sortPackIds(packIds) {
  return packIds.slice().sort((a, b) => {
    const labelA = game.packs.get(a)?.metadata?.label ?? a;
    const labelB = game.packs.get(b)?.metadata?.label ?? b;
    return labelA.localeCompare(labelB, game.i18n.lang);
  });
}

/**
 * Extract compendium collection id from a document UUID.
 */
function packIdFromUuid(uuid) {
  if (!uuid || typeof uuid !== "string") return null;

  try {
    const parsed = foundry.utils.parseUuid(uuid);
    if (parsed?.collection?.collection) return parsed.collection.collection;
  } catch {
    // fall through to regex
  }

  // Compendium.<package>.<name>.<DocumentType>.<id>
  const match = uuid.match(/^Compendium\.([^.]+\.[^.]+)\./);
  return match?.[1] ?? null;
}
