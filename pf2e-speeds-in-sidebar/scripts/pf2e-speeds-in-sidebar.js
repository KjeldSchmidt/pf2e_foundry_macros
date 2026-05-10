const MODULE_ID = "pf2e-speeds-in-sidebar";

const SPEED_META = {
    land:   { label: "Land",   icon: "fa-person-running" },
    fly:    { label: "Fly",    icon: "fa-feather-pointed" },
    swim:   { label: "Swim",   icon: "fa-person-swimming" },
    climb:  { label: "Climb",  icon: "fa-mountain" },
    burrow: { label: "Burrow", icon: "fa-water-ladder" },
};

function getSpeeds(actor) {
    const speeds = actor?.movement?.speeds;
    if (!speeds) return [];

    const out = [];
    for (const key of ["land", "fly", "swim", "climb", "burrow"]) {
        const stat = speeds[key];
        if (!stat) continue;
        const value = stat.value ?? stat.total;
        if (!value) continue;
        out.push({ key, value, ...SPEED_META[key] });
    }

    return out;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function buildSection(speeds) {
    const section = document.createElement("section");
    section.className = "pf2e-speeds-in-sidebar";

    const items = speeds.map(s => `
        <li data-tooltip="${escapeHtml(s.label)} Speed">
            <i class="fa-solid ${s.icon}" aria-hidden="true"></i>
            <span class="value">${escapeHtml(s.value)}</span>
            <span class="unit">ft</span>
        </li>`).join("");

    section.innerHTML = `
        <header><h2>Speeds</h2></header>
        <ul>${items}</ul>
    `;

    return section;
}

function injectSpeeds(actor, root) {
    if (!root) return;
    root.querySelectorAll(".pf2e-speeds-in-sidebar").forEach(el => el.remove());

    const speeds = getSpeeds(actor);
    console.log(`${MODULE_ID} | Speeds: ${speeds.length}`);
    if (!speeds.length) return;

    const sidebar = root.querySelector("aside.sidebar")
                 ?? root.querySelector(".sheet-body > aside")
                 ?? root.querySelector(".sidebar");
    console.log(`${MODULE_ID} | Sidebar: ${sidebar}`);
    if (!sidebar) {
        console.warn(`${MODULE_ID} | character sheet sidebar not found; skipping injection`);
        return;
    }
    console.log(`${MODULE_ID} | Appending speeds`);
    sidebar.appendChild(buildSection(speeds));
}

Hooks.once("init", () => {
    console.log(`${MODULE_ID} | Initializing`);
});

Hooks.on("renderCharacterSheetPF2e", (app, html) => {
    const root = html instanceof HTMLElement ? html : html?.[0];
    injectSpeeds(app.actor, root);
});
