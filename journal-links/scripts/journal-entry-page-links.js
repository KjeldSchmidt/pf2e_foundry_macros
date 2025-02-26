console.log('SEARCH ANCHOR | JOURNAL-LINKS!');


Hooks.on("renderJournalSheet", (app, html, data) => {
    const pages = html.find(".journal-sidebar .pages-list .directory-item");
    const journalEntryId = data.document._id;

    pages.each((index, elem) => {
        const journalEntry = jQuery(elem);
        const journalEntryPageId = journalEntry.data("pageId");
        const pageName = journalEntry.find(".page-title").text();
        const uuidLink = `@UUID[JournalEntry.${journalEntryId}.JournalEntryPage.${journalEntryPageId}]{${pageName}}`;

        const copyButton = makeCopyButton(uuidLink)

        journalEntry.after(copyButton);
    });
});

function makeCopyButton(uuidLink) {
    const copyButton = $(`
        <div 
            class="fa-solid fa-passport journal-links-toc-copy-button"
            aria-label="Copy Page UUID as link"
            data-tooltip="Copy Page UUID as link"
            data-tooltip-direction="RIGHT"
        >
        </div>
    `);

    copyButton.on("click", async (event) => {
        event.stopPropagation(); // When the copy button is clicked, the journal should not change to the page of the copied link.
        try {
            await navigator.clipboard.writeText(uuidLink);
        } catch (err) {
            console.error("Journal Links | Failed to copy jounral link to clipboard:", err);
        }
    });

    return copyButton;
}