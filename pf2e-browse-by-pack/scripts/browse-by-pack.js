/**
 * PF2e Browse by Pack
 * Adds a pack filter to the PF2e Compendium Browser
 */

const MODULE_ID = "pf2e-browse-by-pack";
const INJECTION_DELAY = 100;

// Store selected packs per tab (Set of pack IDs)
const selectedPacksByTab = new Map();

Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Initializing`);
  patchCompendiumBrowserTabs();
});

/**
 * Patch all compendium browser tab types to add pack filtering
 */
function patchCompendiumBrowserTabs() {
  const browser = game.pf2e?.compendiumBrowser;
  if (!browser) {
    console.log(`${MODULE_ID} | PF2e Compendium Browser not found`);
    return;
  }
  
  // Patch each tab's filterIndexData method
  for (const [tabName, tab] of Object.entries(browser.tabs)) {
    if (tab && typeof tab.filterIndexData === "function" && !tab._browseByPackPatched) {
      const originalFilter = tab.filterIndexData.bind(tab);
      
      tab.filterIndexData = function(entry, filterData) {
        // First apply original filters
        const passesOriginal = originalFilter(entry, filterData);
        if (!passesOriginal) return false;
        
        // Then apply our pack filter
        const selectedPacks = selectedPacksByTab.get(tabName);
        
        // If no packs selected, show all
        if (!selectedPacks || selectedPacks.size === 0) return true;
        
        // Extract pack from UUID: "Compendium.world.invoker.Item.xxx" -> "world.invoker"
        const uuid = entry.uuid ?? "";
        const match = uuid.match(/^Compendium\.([^.]+\.[^.]+)\./);
        const itemPack = match ? match[1] : "";
        
        return selectedPacks.has(itemPack);
      };
      
      tab._browseByPackPatched = true;
      console.log(`${MODULE_ID} | Patched filterIndexData for tab: ${tabName}`);
    }
  }
}

/**
 * Hook into the compendium browser render to inject our pack filter UI
 */
Hooks.on("renderCompendiumBrowser", (app, html, data) => {
  console.log(`${MODULE_ID} | Compendium Browser rendered`);
  
  // Ensure tabs are patched (in case browser was created after ready)
  patchCompendiumBrowserTabs();
  
  // v13 Application V2 passes HTMLElement, not jQuery
  const element = html instanceof HTMLElement ? html : html[0];
  
  // Inject with delay to ensure sidebar is ready
  setTimeout(() => injectPackFilter(app, element), INJECTION_DELAY);
  
  // Add listeners to tab buttons for re-injection on tab switch
  addTabListeners(app, element);
});

/**
 * Add event listeners to tab buttons to re-inject filter on tab change
 */
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

/**
 * Inject the pack filter into the compendium browser
 */
function injectPackFilter(app, element) {
  // Remove any existing filter (tab may have changed)
  const existingFilter = element.querySelector(".browse-by-pack-filter");
  existingFilter?.remove();
  
  // Get the current tab
  const browser = game.pf2e?.compendiumBrowser;
  const activeTab = browser?.activeTab;
  const tabName = activeTab?.tabName;
  
  if (!activeTab || !tabName) {
    console.log(`${MODULE_ID} | No active tab found`);
    return;
  }
  
  // Get available packs for this tab type
  const packs = getAvailablePacksForTab(activeTab);
  if (!packs.length) return;
  
  // Find the control-area which contains all fieldsets
  const controlArea = element.querySelector(".control-area");
  if (!controlArea) {
    console.log(`${MODULE_ID} | Could not find .control-area`);
    return;
  }
  
  // Find all fieldsets and get the last one
  const fieldsets = controlArea.querySelectorAll("fieldset");
  if (!fieldsets.length) {
    console.log(`${MODULE_ID} | Could not find any fieldsets`);
    return;
  }
  const lastFieldset = fieldsets[fieldsets.length - 1];
  
  // Get currently selected packs for this tab (or create empty Set)
  if (!selectedPacksByTab.has(tabName)) {
    selectedPacksByTab.set(tabName, new Set());
  }
  const currentSelection = selectedPacksByTab.get(tabName);
  
  // Build pack filter element
  const packFilterEl = buildPackFilterElement(packs, currentSelection, tabName, activeTab, element);
  
  // Inject after the last fieldset
  lastFieldset.after(packFilterEl);
  
  console.log(`${MODULE_ID} | Pack filter injected for tab: ${tabName}`);
}

/**
 * Get available packs for a tab based on document type
 */
function getAvailablePacksForTab(tab) {
  const packs = [];
  
  // Determine what document type this tab uses
  // Most tabs use Item, but bestiary uses Actor
  const tabName = tab.tabName ?? "";
  const docType = tabName === "bestiary" ? "Actor" : "Item";
  
  for (const pack of game.packs) {
    if (pack.documentName === docType) {
      packs.push(pack.collection);
    }
  }
  
  return packs.sort();
}

/**
 * Build the DOM element for the pack filter (checkbox list with collapsible header)
 */
function buildPackFilterElement(packs, currentSelection, tabName, activeTab, element) {
  const fieldset = document.createElement("fieldset");
  fieldset.className = "svelte-pv9137 browse-by-pack-filter";
  
  // Create collapsible legend with button
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
  
  // Create checkbox container
  const checkboxContainer = document.createElement("div");
  checkboxContainer.className = "checkbox-container svelte-obnnay";
  
  // Add checkbox for each pack
  for (const pack of packs) {
    const packObj = game.packs.get(pack);
    const label = packObj?.metadata?.label ?? pack;
    
    const labelEl = document.createElement("label");
    labelEl.className = "svelte-obnnay";
    
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = pack;
    checkbox.checked = currentSelection.has(pack);
    
    // Handle checkbox change
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) {
        currentSelection.add(pack);
      } else {
        currentSelection.delete(pack);
      }
      
      console.log(`${MODULE_ID} | Packs selected for "${tabName}":`, Array.from(currentSelection));
      
      // Reset log count for debugging
      if (activeTab) activeTab._browseByPackLogCount = 0;
      
      // Trigger filter re-application
      triggerFilterUpdate(element);
    });
    
    labelEl.appendChild(checkbox);
    labelEl.appendChild(document.createTextNode(" " + label));
    checkboxContainer.appendChild(labelEl);
  }
  
  fieldset.appendChild(checkboxContainer);
  
  // Handle expand/collapse
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

/**
 * Trigger filter re-application by poking the search box
 */
function triggerFilterUpdate(element) {
  const browserEl = document.getElementById("compendium-browser") ?? element;
  const searchInput = browserEl.querySelector("input[type='search']");
  
  if (searchInput) {
    const originalValue = searchInput.value;
    searchInput.value = originalValue + "#";
    searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    
    // Restore original value after debounce completes
    setTimeout(() => {
      searchInput.value = originalValue;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }, 250);
  }
}
