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
console.log(gridPositions);

// Get grid size
const gridSize = canvas.grid.size;

// Filter tokens that are within the template's area
const tokensInArea = tokens.filter(token => {
    if (!token.actor) return false;
    if (!token.actor.system?.attributes?.hp) return false;
    const tokenCenter = token.center;
    // Snap token position to grid
    const snappedX = Math.floor(tokenCenter.x / gridSize) * gridSize;
    const snappedY = Math.floor(tokenCenter.y / gridSize) * gridSize;
    const isInArea = gridPositions.some(pos => 
        pos.x === snappedX && 
        pos.y === snappedY && 
        !pos.collision // Only include if not blocked by walls
    );
    return isInArea;
});

// Select the tokens
canvas.tokens.selectObjects(tokensInArea);

// Notify the user
ui.notifications.info(`Selected ${tokensInArea.length} tokens within the template.`);

class SuccessDegree {
    constructor(name, color) {
        this.name = name;
        this.color = color;
    }
}

const success_degrees = {
    CritSuccess: new SuccessDegree("Critical Success", 'rgb(0, 128, 0)'),
    Success: new SuccessDegree("Success", 'rgb(0, 0, 255)'),
    Failure: new SuccessDegree("Failure", 'rgb(255, 69, 0)'),
    CritFailure: new SuccessDegree("Critical Failure", 'rgb(255, 0, 0)'),
}

async function determine_save_result(bonus, dc) {
    const roll = await new Roll('1d20').roll();
    game.dice3d?.showForRoll(roll, game.user, true);
    const roll_value = roll._total;
    const check_value = roll_value + bonus;
    
    let success_indicator = 0;
    if (check_value >= dc + 10) { success_indicator = 2; }
    else if (check_value >= dc) { success_indicator = 1; }
    else if (check_value >= dc - 9) { success_indicator = 0; }
    else if (check_value <= dc - 10) { success_indicator = -1; }

    if (roll_value === 20) { success_indicator = Math.min(2, success_indicator + 1) }
    if (roll_value === 1) { success_indicator = Math.max(-1, success_indicator - 1) }

    const success_degree = success_indicator === 2 ? success_degrees.CritSuccess :
                          success_indicator === 1 ? success_degrees.Success :
                          success_indicator === 0 ? success_degrees.Failure :
                          success_degrees.CritFailure;
    return { roll_value, check_value, success_degree };
}

function get_damage_summary_html(results, damageType, damageAmount, saveDC, saveType) {
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
                            Roll: ${result.rollValue} + ${result.checkValue - result.rollValue} = ${result.checkValue}
                            ${result.resistanceApplied > 0 ? `<br>Resistance: -${result.resistanceApplied}` : ''}
                            ${result.weaknessApplied > 0 ? `<br>Weakness: +${result.weaknessApplied}` : ''}
                            ${result.isImmune ? '<br>Immune' : ''}
                            <br>Damage Taken: ${result.damageTaken}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

async function rollSaveAndApplyDamages(tokens, damageType, damageAmount, saveDC, saveType) {
    const results = [];
    for (const token of tokens) {
        const saveResult = await determine_save_result(token.actor.system.saves[saveType].value, saveDC);
        let finalDamage = 0;
        let resistanceApplied = 0;
        let weaknessApplied = 0;
        let isImmune = false;
        
        if (saveResult.success_degree === success_degrees.CritSuccess) {
            finalDamage = 0;
        } else if (saveResult.success_degree === success_degrees.Success) {
            finalDamage = Math.floor(damageAmount / 2);
        } else if (saveResult.success_degree === success_degrees.Failure) {
            finalDamage = damageAmount;
        } else if (saveResult.success_degree === success_degrees.CritFailure) {
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
            successDegree: saveResult.success_degree,
            damageTaken: finalDamage,
            resistanceApplied,
            weaknessApplied,
            isImmune,
            rollValue: saveResult.roll_value,
            checkValue: saveResult.check_value
        });
    }
    return results;
}

// Open damage roll window
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
        `,
        buttons: {
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: "Cancel"
            },
            deal: {
                icon: '<i class="fas fa-check"></i>',
                label: "Deal Damage",
                callback: async (html) => {
                    const damageType = html.find('[name="damageType"]').val();
                    const damageAmount = parseInt(html.find('[name="damageAmount"]').val());
                    const saveDC = parseInt(html.find('[name="saveDC"]').val());
                    const saveType = html.find('[name="saveType"]').val();
                    const results = await rollSaveAndApplyDamages(tokensInArea, damageType, damageAmount, saveDC, saveType);
                    
                    ChatMessage.create({
                        content: get_damage_summary_html(results, damageType, damageAmount, saveDC, saveType),
                        user: game.user.id
                    });
                }
            }
        },
        default: "deal"
    }).render(true);
}
