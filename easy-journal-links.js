Hooks.once("renderJournalSheet", (app, html, data) => {
    const pages = html.find(".journal-sidebar .pages-list .directory-item");
    const journalEntryId = data.document._id;
    console.log(app, html, data);

    pages.each((index, elem) => {
        const jElem = jQuery(elem);
        const journalEntryPageId = jElem.data("pageId");
        const uuid = `JournalEntry.${journalEntryId}.JournalEntryPage.${journalEntryPageId}`;

        const copyButton = $('<div class="fa-solid fa-passport"></div>');

        copyButton.on("click", async (event) => {
            event.stopPropagation();
            try {
                await navigator.clipboard.writeText(uuid);
                console.log("Copied:", uuid);
            } catch (err) {
                console.error("Failed to copy:", err);
            }
        });

        console.log(jElem);

        jElem.find(".page-title").after(copyButton);
    });
});