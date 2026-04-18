/**
 * PF2e Browse by Pack
 * Adds a pack filter to the PF2e Compendium Browser 
 */

const MODULE_ID = "pf2e-browse-by-pack";
const INJECTION_DELAY = 100;

// Selected packs per tab (Set of pack collection IDs, e.g. "pf2e.spells-srd")
const selectedPacksByTab = new Map();

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Initializing`);
  patchCompendiumBrowserTabs();
});

/**
 * Extract the compendium pack ID ("scope.pack") from a UUID like
 * "Compendium.pf2e.spells-srd.Item.xyz"
 */
function packFromUuid(uuid) {
  if (!uuid) return "";
  const m = uuid.match(/^Compendium\.([^.]+\.[^.]+)\./);
  return m ? m[1] : "";
}

/**
 * Patch each tab's loadData so we keep a pristine backup of the full
 * indexData + searchEngine. We apply pack filtering by swapping these
 * to filtered copies and asking the browser to redraw.
 */
function patchCompendiumBrowserTabs() {
  const browser = game.pf2e?.compendiumBrowser;
  if (!browser) {
    console.log(`${MODULE_ID} | PF2e Compendium Browser not found`);
    return;
  }

  for (const [tabName, tab] of Object.entries(browser.tabs)) {
    if (!tab || tab._browseByPackPatched) continue;
    if (typeof tab.loadData !== "function") continue;

    const originalLoadData = tab.loadData.bind(tab);
    tab.loadData = async function (...args) {
      const result = await originalLoadData(...args);
      // Snapshot full dataset so we can restore / refilter freely
      tab._fullIndexData = tab.indexData ? [...tab.indexData] : [];
      tab._fullSearchEngine = tab.searchEngine ?? null;
      // Reapply any active pack selection from a previous open
      applyPackFilterToTab(tab);
      return result;
    };

    tab._browseByPackPatched = true;
    console.log(`${MODULE_ID} | Instrumented tab: ${tabName}`);
  }
}

/**
 * Apply the current pack selection to a tab by swapping its indexData
 * (and searchEngine) to a filtered subset.
 */
function applyPackFilterToTab(tab) {
  if (!tab?._fullIndexData) return;

  const tabName = tab.tabName;
  const selected = selectedPacksByTab.get(tabName);
  const full = tab._fullIndexData;
  const fullEngine = tab._fullSearchEngine;

  if (!selected || selected.size === 0) {
    // No filter active: restore originals
    tab.indexData = full;
    if (fullEngine) tab.searchEngine = fullEngine;
    return;
  }

  const filtered = full.filter((entry) => selected.has(packFromUuid(entry.uuid)));
  tab.indexData = filtered;

  // Rebuild the MiniSearch engine from the filtered set, reusing the
  // same configuration as the original engine so search still works.
  if (fullEngine && typeof fullEngine.constructor === "function") {
    try {
      const MiniSearch = fullEngine.constructor;
      const options = fullEngine._options ?? {
        idField: "uuid",
        fields: tab.searchFields ?? [],
        storeFields: tab.storeFields ?? [],
      };
      const engine = new MiniSearch(options);
      engine.addAll(filtered);
      tab.searchEngine = engine;
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not rebuild searchEngine, leaving original in place`, err);
    }
  }
}

/**
 * Force the browser's Svelte UI to re-read indexData and redraw.
 * resetListElement is what PF2e calls internally after loadData.
 */
function refreshBrowserList() {
  const browser = game.pf2e?.compendiumBrowser;
  if (!browser) return;

  if (typeof browser.resetListElement === "function") {
    try {
      browser.resetListElement();
      return;
    } catch (err) {
      console.warn(`${MODULE_ID} | resetListElement failed, falling back`, err);
    }
  }
  // Fallback: nudge the search input to force Svelte to recompute results
  const el = browser.element ?? document.getElementById("compendium-browser");
  const searchInput = el?.querySelector("input[type='search']");
  if (searchInput) {
    const v = searchInput.value;
    searchInput.value = v + "#";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    setTimeout(() => {
      searchInput.value = v;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }, 200);
  }
}

Hooks.on("renderCompendiumBrowser", (app, html) => {
  patchCompendiumBrowserTabs();
  const element = html instanceof HTMLElement ? html : html[0];
  setTimeout(() => injectPackFilter(app, element), INJECTION_DELAY);
  addTabListeners(app, element);
});

function addTabListeners(app, element) {
  const tabButtons = element.querySelectorAll("nav.tabs button, nav.tabs a, [data-tab], .item[data-tab]");
  tabButtons.forEach((btn) => {
    if (btn.dataset.browseByPackListener) return;
    btn.dataset.browseByPackListener = "true";
    btn.addEventListener("click", () => {
      setTimeout(() => injectPackFilter(app, element), INJECTION_DELAY);
    });
  });
}

function injectPackFilter(app, element) {
  element.querySelector(".browse-by-pack-filter")?.remove();

  const browser = game.pf2e?.compendiumBrowser;
  const activeTab = browser?.activeTab;
  const tabName = activeTab?.tabName;
  if (!activeTab || !tabName) return;

  const packs = getAvailablePacksForTab(activeTab);
  if (!packs.length) return;

  const controlArea = element.querySelector(".control-area");
  if (!controlArea) return;

  const fieldsets = controlArea.querySelectorAll("fieldset");
  if (!fieldsets.length) return;
  const lastFieldset = fieldsets[fieldsets.length - 1];

  if (!selectedPacksByTab.has(tabName)) {
    selectedPacksByTab.set(tabName, new Set());
  }
  const currentSelection = selectedPacksByTab.get(tabName);

  const packFilterEl = buildPackFilterElement(packs, currentSelection, tabName, activeTab);
  lastFieldset.after(packFilterEl);
}

function getAvailablePacksForTab(tab) {
  const tabName = tab.tabName ?? "";
  const docType = tabName === "bestiary" ? "Actor" : "Item";
  const packs = [];
  for (const pack of game.packs) {
    if (pack.documentName === docType) packs.push(pack.collection);
  }
  return packs.sort();
}

function buildPackFilterElement(packs, currentSelection, tabName, activeTab) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "svelte-pv9137 browse-by-pack-filter";

  const legend = document.createElement("legend");
  legend.className = "svelte-pv9137";

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "flat expand-section svelte-pv9137";
  expandBtn.setAttribute("aria-label", "expand");
  expandBtn.setAttribute("aria-expanded", "true");

  const icon = document.createElement("i");
  icon.className = "fa-solid fa-fw fa-chevron-down svelte-pv9137";
  expandBtn.appendChild(icon);

  const spanText = document.createElement("span");
  spanText.textContent = "Pack";
  expandBtn.appendChild(spanText);

  legend.appendChild(expandBtn);
  fieldset.appendChild(legend);

  const checkboxContainer = document.createElement("div");
  checkboxContainer.className = "checkbox-container svelte-obnnay";

  for (const pack of packs) {
    const packObj = game.packs.get(pack);
    const label = packObj?.metadata?.label ?? pack;

    const labelEl = document.createElement("label");
    labelEl.className = "svelte-obnnay";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = pack;
    checkbox.checked = currentSelection.has(pack);

    checkbox.addEventListener("change", () => {
      if (checkbox.checked) currentSelection.add(pack);
      else currentSelection.delete(pack);

      console.log(`${MODULE_ID} | Packs selected for "${tabName}":`, Array.from(currentSelection));

      applyPackFilterToTab(activeTab);
      refreshBrowserList();
    });

    labelEl.appendChild(checkbox);
    labelEl.appendChild(document.createTextNode(" " + label));
    checkboxContainer.appendChild(labelEl);
  }

  fieldset.appendChild(checkboxContainer);

  expandBtn.addEventListener("click", () => {
    const isExpanded = expandBtn.getAttribute("aria-expanded") === "true";
    expandBtn.setAttribute("aria-expanded", !isExpanded);
    icon.className = isExpanded
      ? "fa-solid fa-fw fa-chevron-up svelte-pv9137"
      : "fa-solid fa-fw fa-chevron-down svelte-pv9137";
    checkboxContainer.style.display = isExpanded ? "none" : "";
  });

  return fieldset;
}
