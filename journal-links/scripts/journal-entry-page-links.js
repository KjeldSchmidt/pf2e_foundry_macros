const observers = new Map();

Hooks.on("renderJournalSheet", (app, html, data) => {
    observers.forEach(obs => obs.disconnect());
    observers.clear();

    const pages = html.find(".journal-sidebar .pages-list .directory-item");
    const journalEntryId = data.document._id;

    pages.each((index, elem) => {
        const newObserver = new MutationObserver(foundry.utils.debounce((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const target = mutation.target;
                    const wasActive = mutation.oldValue?.includes('active');
                    const isActive = target.classList.contains('active');
                    
                    if (isActive && !wasActive) {
                        addCopyButtons(html, journalEntryId);
                    }
                }
            });
        }, 20));

        newObserver.observe(elem, { 
            attributes: true, 
            attributeFilter: ["class"],
            attributeOldValue: true 
        });
        observers.set(elem, newObserver);
    });
});

function addCopyButtons(sheetHtml, journalEntryId) {
    // Remove existing copy buttons - this is necessary when right-clicking the active page, and will add multiple buttons otherwise.
    sheetHtml.find('.journal-links-toc-copy-button').remove();
    
    const pages = sheetHtml.find(".journal-sidebar .pages-list .directory-item");

    pages.each((index, elem) => {
        const journalEntry = jQuery(elem);
        
        const journalEntryPageId = journalEntry.data("pageId");
        const pageName = journalEntry.find(".page-title").text();
        const uuidLink = `@UUID[JournalEntry.${journalEntryId}.JournalEntryPage.${journalEntryPageId}]{${pageName}}`;

        const copyButton = makeCopyButton(uuidLink)

        journalEntry.find('.page-heading').append(copyButton);
        // console.log(journalEntry.find('.'));

        journalEntry.find('.headings .heading').each((index, subHeadingHtml) => {
            const subHeading = jQuery(subHeadingHtml);
            const subHeadingAnchor = subHeading.data("anchor");
            const subHeadingName = subHeading.find(".heading-link").text();
            const subHeadingLink = `@UUID[JournalEntry.${journalEntryId}.JournalEntryPage.${journalEntryPageId}#${subHeadingAnchor}]{${subHeadingName}}`;
            const subHeadingCopyButton = makeCopyButton(subHeadingLink);
            subHeading.find('.heading-link').append(subHeadingCopyButton);
        });
    });
}

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
            ui.notifications.info('Copied Journal Link!');
            await navigator.clipboard.writeText(uuidLink);
        } catch (err) {
            console.error("Journal Links | Failed to copy jounral link to clipboard:", err);
        }
    });

    return copyButton;
}
