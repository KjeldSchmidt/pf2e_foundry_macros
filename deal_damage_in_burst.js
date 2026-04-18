function getTokensInRegion() {
    const region = canvas.regions.controlled[0]
        || canvas.regions.hover
        || canvas.regions.placeables[canvas.regions.placeables.length - 1];
    if (!region) {
        ui.notifications.warn("No region selected!");
        return [];
    }

    const tokenDocs = Array.from(region.document.tokens ?? []);
    if (!tokenDocs.length) return [];

    return tokenDocs
        .map(td => td.object ?? canvas.tokens.get(td.id))
        .filter(token => token && token.actor && token.actor.system?.attributes?.hp);
}

class SuccessDegree {
    constructor(name, color) {
        this.name = name;
        this.color = color;
    }
}

const successDegrees = {
    critSuccess: new SuccessDegree("Critical Success", 'rgb(0, 128, 0)'),
    success: new SuccessDegree("Success", 'rgb(0, 0, 255)'),
    failure: new SuccessDegree("Failure", 'rgb(255, 69, 0)'),
    critFailure: new SuccessDegree("Critical Failure", 'rgb(255, 0, 0)'),
}

async function determineSaveResult(actor, saveType, dc) {
    const roll = await actor.saves[saveType].roll({
        dc: { value: dc },
        skipDialog: true,
        createMessage: false,
        extraRollOptions: ["damaging-effect"]
    });

    if (game.dice3d) {
        game.dice3d.showForRoll(roll, game.user, true);
    }

    const degreeIndex = roll?.degreeOfSuccess ?? roll?.options?.degreeOfSuccess ?? 0;
    const successDegree = [
        successDegrees.critFailure,
        successDegrees.failure,
        successDegrees.success,
        successDegrees.critSuccess
    ][degreeIndex];

    const d20 = roll?.dice?.find(d => d.faces === 20);
    const rollValue = d20?.total ?? d20?.results?.[0]?.result ?? null;
    const checkValue = roll?.total ?? null;
    return { rollValue, checkValue, successDegree };
}

function getDamageSummaryHtml(results, damageType, damageAmount, saveDC, saveType, hideGameMasterInfo) {
    const critFailures = results.filter(r => r.successDegree === successDegrees.critFailure);
    const failures = results.filter(r => r.successDegree === successDegrees.failure);
    const critFailureCount = critFailures.length;
    const failureCount = failures.length;
    return `
        <div class="damage-summary">
            <h4 class="action">
                <strong>Area Damage</strong>
                <span class="subtitle">(${damageAmount} ${damageType.charAt(0).toUpperCase() + damageType.slice(1)} damage, DC ${saveDC} ${saveType.charAt(0).toUpperCase() + saveType.slice(1)} save)</span>
            </h4>
            <div class="results">
                ${results.map(result => `
                    <div class="result" style="margin: 0.5rem 0;">
                        <div style="display: flex; justify-content: space-between;">
                            <span>${result.token.actor.name}</span>
                            <span style="color: ${result.successDegree.color}">${result.successDegree.name}</span>
                        </div>
                        <div style="font-size: 0.8em; color: #666;">
                            ${!hideGameMasterInfo || result.token.actor.type === "character" 
                                ? 
                                `Roll: ${result.rollValue} + ${result.checkValue - result.rollValue} = ${result.checkValue}
                                ${result.resistanceApplied > 0 ? `<br>Resistance: -${result.resistanceApplied}` : ''}
                                ${result.weaknessApplied > 0 ? `<br>Weakness: +${result.weaknessApplied}` : ''}
                                ${result.isImmune ? '<br>Immune' : ''}` 
                                : 
                                `Roll: 1d20 + ??? = ${result.checkValue}`
                            }
                            <br>Damage Taken: ${result.damageTaken}
                        </div>
                    </div>
                `).join('')}
            </div>
            ${!hideGameMasterInfo ? `
                <div style="margin-top: 0.5rem;">
                    ${failureCount > 0 ? `
                        <button class="target-failures" data-tokens='${JSON.stringify(failures.map(r => r.token.id))}'>
                            Target ${failureCount} Failure${failureCount > 1 ? 's' : ''}
                        </button>
                    ` : ''}
                    ${critFailureCount > 0 ? `
                        <button class="target-crit-failures" data-tokens='${JSON.stringify(critFailures.map(r => r.token.id))}'>
                            Target ${critFailureCount} Critical Failure${critFailureCount > 1 ? 's' : ''}
                        </button>
                    ` : ''}
                </div>
            ` : ''}
        </div>
    `;
}

async function rollSaveAndApplyDamages(tokens, damageType, damageAmount, saveDC, saveType) {
    const results = [];
    for (const token of tokens) {
        const saveResult = await determineSaveResult(token.actor, saveType, saveDC);
        let finalDamage = 0;
        let resistanceApplied = 0;
        let weaknessApplied = 0;
        let isImmune = false;
        
        if (saveResult.successDegree === successDegrees.critSuccess) {
            finalDamage = 0;
        } else if (saveResult.successDegree === successDegrees.success) {
            finalDamage = Math.floor(damageAmount / 2);
        } else if (saveResult.successDegree === successDegrees.failure) {
            finalDamage = damageAmount;
        } else if (saveResult.successDegree === successDegrees.critFailure) {
            finalDamage = damageAmount * 2;
        }

        const resistance = token.actor.system.attributes.resistances.find(r => r.type === damageType);
        if (resistance) {
            resistanceApplied = resistance.value;
            finalDamage = Math.max(0, finalDamage - resistanceApplied);
        }

        const weakness = token.actor.system.attributes.weaknesses.find(w => w.type === damageType);
        if (weakness) {
            weaknessApplied = weakness.value;
            finalDamage += weaknessApplied;
        }

        const immunity = token.actor.system.attributes.immunities.find(i => i.type === damageType);
        if (immunity) {
            finalDamage = 0;
            isImmune = true;
        }
            
        if (finalDamage > 0) {
            await token.actor.applyDamage({
                damage: finalDamage,
                token: token,
                type: damageType
            });
        }

        results.push({
            token,
            successDegree: saveResult.successDegree,
            damageTaken: finalDamage,
            resistanceApplied,
            weaknessApplied,
            isImmune,
            rollValue: saveResult.rollValue,
            checkValue: saveResult.checkValue
        });
    }
    return results;
}

function handleTargetButtonClick(event) {
    const tokenIds = JSON.parse(event.currentTarget.dataset.tokens);
    const tokens = tokenIds.map(id => canvas.tokens.get(id)).filter(t => t);
    if (!tokens.length) return;
    tokens[0].setTarget(true, {user: game.user, releaseOthers: true});
    tokens.forEach(token => token.setTarget(true, {user: game.user, releaseOthers: false, groupSelection: true}));
}

if (!globalThis.__dealDamageInBurstHookRegistered) {
    Hooks.on('renderChatMessageHTML', (message, html) => {
        html.querySelectorAll('.target-failures, .target-crit-failures').forEach(btn => {
            if (btn.dataset.bound === "true") return;
            btn.dataset.bound = "true";
            btn.addEventListener('click', handleTargetButtonClick);
        });
    });
    globalThis.__dealDamageInBurstHookRegistered = true;
}

async function handleDamageRoll({ damageType, damageAmount, saveDC, saveType }, tokensInArea) {
    const results = await rollSaveAndApplyDamages(tokensInArea, damageType, damageAmount, saveDC, saveType);

    // Create player message with limited details
    players = game.users.filter(user => !user.isGM);    
    ChatMessage.create({
        content: getDamageSummaryHtml(results, damageType, damageAmount, saveDC, saveType, true),
        users: players,
        whisper: players.map(user => user.id)
    });

    // Create GM message with full details
    await ChatMessage.create({
        content: getDamageSummaryHtml(results, damageType, damageAmount, saveDC, saveType, false),
        whisper: [game.user.id],
    });
}

async function openDamageRollWindow(tokensInArea) {
    if (tokensInArea.length === 0) return;

    const damageTypes = CONFIG.PF2E.damageTypes;
    const content = `
        <div class="form-group">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <label style="width: 60px;">Damage</label>
                <input type="number" name="damageAmount" min="1" value="1" style="flex: 1;">
                <select name="damageType" style="flex: 1;">
                    ${Object.entries(damageTypes).map(([key, _]) =>
                        `<option value="${key}">${key.charAt(0).toUpperCase() + key.slice(1)}</option>`
                    ).join('')}
                </select>
            </div>
        </div>
        <div class="form-group">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
                <label style="width: 60px;">DC</label>
                <input type="number" name="saveDC" min="1" value="1" style="flex: 1;">
                <select name="saveType" style="flex: 1;">
                    ${Object.entries(CONFIG.PF2E.saves).map(([key, _]) =>
                        `<option value="${key}">${key.charAt(0).toUpperCase() + key.slice(1)}</option>`
                    ).join('')}
                </select>
            </div>
        </div>
        <div class="form-group">
            <div style="display: flex; justify-content: space-around; align-items: center; margin: 0.5rem 0;">
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" name="includePlayers" checked>
                    Include Players?
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" name="includeNPCs" checked>
                    Include NPCs?
                </label>
            </div>
        </div>
    `;

    const result = await foundry.applications.api.DialogV2.wait({
        window: { title: "Deal Damage" },
        content,
        buttons: [
            {
                action: "cancel",
                icon: "fas fa-times",
                label: "Cancel",
                callback: () => null
            },
            {
                action: "deal",
                icon: "fas fa-check",
                label: "Deal Damage",
                default: true,
                callback: (event, button, dialog) => {
                    const root = dialog.element;
                    return {
                        damageAmount: parseInt(root.querySelector('[name="damageAmount"]').value),
                        damageType: root.querySelector('[name="damageType"]').value,
                        saveDC: parseInt(root.querySelector('[name="saveDC"]').value),
                        saveType: root.querySelector('[name="saveType"]').value,
                        includePlayers: root.querySelector('[name="includePlayers"]').checked,
                        includeNPCs: root.querySelector('[name="includeNPCs"]').checked
                    };
                }
            }
        ],
        rejectClose: false
    });

    if (!result) return;

    const { includePlayers, includeNPCs } = result;
    const filteredTokens = tokensInArea.filter(token =>
        (includePlayers && token.actor.type === "character") ||
        (includeNPCs && token.actor.type !== "character")
    );
    if (filteredTokens.length === 0) {
        ui.notifications.warn("No valid tokens found!");
        return;
    }
    await handleDamageRoll(result, filteredTokens);
}

const tokensInArea = getTokensInRegion();
if (tokensInArea.length > 0) {
    openDamageRollWindow(tokensInArea);
} else {
    ui.notifications.warn("No tokens found in the region!");
}
