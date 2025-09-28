const MODULE_ID = "custom-compendium-banners";

const debouncedRender = foundry.utils.debounce(() => ui.sidebar?.render(false), 50);

function registerSetting(key, options) {
  game.settings.register(MODULE_ID, key, {
    scope: "world",
    config: true,
    restricted: true,
    requiresReload: false,
    ...options,
  });
}

function getCompendiumBanner(compendiumId) {
  const banners = game.settings.get(MODULE_ID, "compendiumBanners") || {};
  return banners[compendiumId] || "";
}

async function setCompendiumBanner(compendiumId, imagePath) {
  const banners = game.settings.get(MODULE_ID, "compendiumBanners") || {};
  banners[compendiumId] = imagePath;
  await game.settings.set(MODULE_ID, "compendiumBanners", banners);
}

function applyChanges() {
  const compendiumItems = document.querySelectorAll(
    ".compendium-sidebar .directory-item.compendium"
  );

  const bannerHeight = game.settings.get(MODULE_ID, "BannerHeight");

  compendiumItems.forEach((item) => {
    item.style.height = `${bannerHeight}px`;
    
    const compendiumId = item.dataset.pack;
    
    if (compendiumId) {
      const customBanner = getCompendiumBanner(compendiumId);
      
      const bannerElement = item.querySelector(".compendium-banner");
      if (bannerElement) {
        if (customBanner) {
          bannerElement.src = customBanner;
        }
      }
    }
  });
}

Hooks.once("init", () => {
  registerSetting("compendiumBanners", {
    name: "Compendium Banners",
    hint: "Internal storage for per-compendium banner images",
    type: Object,
    default: {},
    config: false, // Hide from settings UI
  });

  registerSetting("BannerHeight", {
    name: `Banners Height`,
    hint: `Height of compendium items. Use 55px for compact view. Default: 70px`,
    type: Number,
    range: {
      min: 20,
      max: 100,
      step: 5,
    },
    default: 70,
    onChange: debouncedRender,
  });
});

Hooks.on("getHeaderControlsCompendium", (app, controls) => {
  controls.push({
    icon: "fas fa-image",
    label: "Pick Banner Image",
    action: "pick-banner-image",
    onClick: () => {
      const compendiumId = app.collection?.metadata?.id || app.options?.id;
      
      if (!compendiumId) {
        ui.notifications.error("Could not determine compendium ID");
        return;
      }
      
      const currentBanner = getCompendiumBanner(compendiumId);
      
      new foundry.applications.apps.FilePicker.implementation({
        type: "image",
        current: currentBanner,
        callback: async (imagePath) => {
          if (imagePath) {
            await setCompendiumBanner(compendiumId, imagePath);
            applyChanges();
            
            const collection = game.packs.get(compendiumId);
            if (collection?.apps && collection.apps.length > 0) {
              collection.apps[0].render(false);
            }
            
            ui.notifications.info(`Updated banner for compendium: ${compendiumId}`);
          }
        }
      }).render(true);
    }
  });
});

Hooks.on("renderSidebarTab", (tab) => {
  if (tab instanceof foundry.applications.sidebar.tabs.CompendiumDirectory) applyChanges();
});

Hooks.on("changeSidebarTab", (tab) => {
  if (tab instanceof foundry.applications.sidebar.tabs.CompendiumDirectory) applyChanges();
});

Hooks.on("renderCompendium", (app, html, data) => {
  const compendiumId = app.collection?.metadata?.id;
  
  if (compendiumId) {
    const customBanner = getCompendiumBanner(compendiumId);
    if (customBanner) {
      const bannerElement = $(html).find(".header-banner img");
      if (bannerElement.length > 0) {
        bannerElement.attr("src", customBanner);
      }
    }
  }
});