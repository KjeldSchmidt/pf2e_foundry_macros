function getTokensInTemplateArea() {
    // Get the currently active measurement template
    const template = canvas.templates.controlled[0] || canvas.templates.placeables[canvas.templates.placeables.length - 1];
    if (!template) {
        ui.notifications.warn("No measurement template selected!");
        return;
    }

    // Get all tokens in the scene
    const tokens = canvas.tokens.placeables;

    // Get the template's grid positions
    const gridPositions = template._getGridHighlightPositions();
    if (!gridPositions.length) {
        ui.notifications.warn("Template has no grid positions!");
        return;
    }

    const gridSize = canvas.grid.size;

    // Filter tokens that are within the template's area
    const tokensInArea = tokens.filter(token => {
        if (!token.actor) return false; // We don't care about tokens that don't have an actor
        if (!token.actor.system?.attributes?.hp) return false; // Nor those that don't have hit points
        const tokenCenter = token.center;
        // Round token position to grid
        const gridX = Math.floor(tokenCenter.x / gridSize) * gridSize;
        const gridY = Math.floor(tokenCenter.y / gridSize) * gridSize;
        const isInArea = gridPositions.some(pos => 
            pos.x === gridX && 
            pos.y === gridY && 
            !pos.collision // Only include if not blocked by walls
        );
        return isInArea;
    });

    return tokensInArea;
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

async function determineSaveResult(bonus, dc) {
    const roll = await new Roll('1d20').roll();
    game.dice3d?.showForRoll(roll, game.user, true);
    const rollValue = roll._total;
    const checkValue = rollValue + bonus;
    
    let successIndicator = 0;
    if (checkValue >= dc + 10) { successIndicator = 2; }
    else if (checkValue >= dc) { successIndicator = 1; }
    else if (checkValue >= dc - 9) { successIndicator = 0; }
    else if (checkValue <= dc - 10) { successIndicator = -1; }

    if (rollValue === 20) { successIndicator = Math.min(2, successIndicator + 1) }
    if (rollValue === 1) { successIndicator = Math.max(-1, successIndicator - 1) }

    const successDegree = successIndicator === 2 ? successDegrees.critSuccess :
                          successIndicator === 1 ? successDegrees.success :
                          successIndicator === 0 ? successDegrees.failure :
                          successDegrees.critFailure;
    return { rollValue, checkValue, successDegree };
}

function getDamageSummaryHtml(results, damageType, damageAmount, saveDC, saveType, hideGameMasterInfo) {
    const critFailureCount = results.filter(r => r.successDegree === successDegrees.critFailure).length;
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
            ${!hideGameMasterInfo && critFailureCount > 0 ? `
                <div style="margin-top: 0.5rem;">
                    <button class="target-crit-failures" data-tokens='${JSON.stringify(results.filter(r => r.successDegree === successDegrees.critFailure).map(r => r.token.id))}'>
                        Target ${critFailureCount} Critical Failure${critFailureCount > 1 ? 's' : ''}
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

async function rollSaveAndApplyDamages(tokens, damageType, damageAmount, saveDC, saveType) {
    const results = [];
    for (const token of tokens) {
        const saveResult = await determineSaveResult(token.actor.system.saves[saveType].value, saveDC);
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

async function handleDamageRoll(html, tokensInArea) {
    const damageType = html.find('[name="damageType"]').val();
    const damageAmount = parseInt(html.find('[name="damageAmount"]').val());
    const saveDC = parseInt(html.find('[name="saveDC"]').val());
    const saveType = html.find('[name="saveType"]').val();
    
    const results = await rollSaveAndApplyDamages(tokensInArea, damageType, damageAmount, saveDC, saveType);
    
    // Add handler to target tokens with crit failures
    Hooks.once('renderChatMessage', (_, html) => {
        html.find('.target-crit-failures').click(event => {
            const tokenIds = JSON.parse(event.currentTarget.dataset.tokens);
            const tokens = tokenIds.map(id => canvas.tokens.get(id));
            tokens[0].setTarget(true, {user: game.user, releaseOthers: true});
            tokens.forEach(token => token.setTarget(true, {user: game.user, releaseOthers: false, groupSelection: true}));
        });
    });

    // Create GM message with full details
    ChatMessage.create({
        content: getDamageSummaryHtml(results, damageType, damageAmount, saveDC, saveType, false),
        whisper: [game.user.id],
    });

    // Create player message with limited details
    for (const user of game.users) {
        if (user.isGM) continue;
        ChatMessage.create({
            content: getDamageSummaryHtml(results, damageType, damageAmount, saveDC, saveType, true),
            user: user.id,
            whisper: [user.id]
        });
    }
}

function openDamageRollWindow(tokensInArea) {
    if (tokensInArea.length > 0) {
        const damageTypes = CONFIG.PF2E.damageTypes;
        new Dialog({
            title: "Deal Damage",
            content: `
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
                    <label>
                        <input type="checkbox" name="includePlayers" checked>
                        Include Players?
                    </label>
                </div>
            `,
            buttons: {
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                },
                deal: {
                    icon: '<i class="fas fa-check"></i>',
                    label: "Deal Damage",
                    callback: (html) => {
                        const includePlayers = html.find('[name="includePlayers"]').is(':checked');
                        const filteredTokens = includePlayers ? tokensInArea : tokensInArea.filter(token => token.actor.type !== "character");
                        if (filteredTokens.length === 0) {
                            ui.notifications.warn("No valid tokens found!");
                            return;
                        }
                        handleDamageRoll(html, filteredTokens);
                    }
                }
            },
            default: "deal"
        }).render(true);
    }
}

const tokensInArea = getTokensInTemplateArea();
if (tokensInArea.length > 0) {
    openDamageRollWindow(tokensInArea);
} else {
    ui.notifications.warn("No tokens found in the template area!");
}
