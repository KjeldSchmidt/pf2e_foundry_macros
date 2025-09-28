import { generateImage } from './token_generation.js';
import { TokenPreviewForm } from './token-preview.js';
import { registerSettings } from './settings.js';

Hooks.once('init', async function() {
    console.log('Token Forge | Initializing');
    registerSettings();
});

Hooks.once('ready', async function() {
    console.log('Token Forge | Ready');
});

class TokenForgeForm extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "token-forge",
            title: "Token Forge",
            template: "modules/token-forge/templates/token-forge.html",
            width: 400,
            height: "auto",
            closeOnSubmit: true
        });
    }

    getData() {
        return {
            description: ""
        };
    }

    async _updateObject(event, formData) {
        try {
            const tokenImage = await generateImage(formData.description);
            const previewForm = new TokenPreviewForm(tokenImage, formData.description);
            previewForm.render(true);
        } catch (error) {
            console.error('Token Forge | Error creating token:', error);
            ui.notifications.error('Failed to create token. Check console for details.');
        }
    }
}

let tokenForgeForm = null;

Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return;

    console.log("Token", controls);
    
    controls.push({
        name: 'token-forge',
        title: 'Token Forge',
        icon: 'fas fa-hammer',
        visible: true,
        active: false,
        toggle: false,
        button: true,
        onClick: () => {
            if (tokenForgeForm?.rendered) {
                tokenForgeForm.close();
            } else {
                tokenForgeForm = new TokenForgeForm();
                tokenForgeForm.render(true);
            }
        }
    });
});
    