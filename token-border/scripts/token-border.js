import { addBorder, loadImageAsBlob } from './border-tools.js';

Hooks.once('init', async function() {
    console.log('Token Border | Initializing');
});

Hooks.once('ready', async function() {
    console.log('Token Border | Ready');
});

class TokenBorderForm extends FormApplication {
    constructor(token = null) {
        super();
        this.token = token;
        this.currentBorder = 'Smooth_Brass.png';
        this.originalImageBlob = null;
        this.selectedImagePath = token?.texture?.src || token?.document?.texture?.src || '';
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "token-border",
            title: "Token Border",
            template: "modules/token-border/templates/token-border.html",
            width: 600,
            height: 750,
            closeOnSubmit: true
        });
    }

    getData() {
        return {
            border: this.currentBorder,
            tokenName: this.token?.name || 'No token selected',
            hasToken: !!this.token,
            imagePath: this.selectedImagePath
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('button[name="cancel"]').click(() => this.close());
        html.find('select[name="border"]').change(async (event) => {
            this.currentBorder = event.target.value;
            await this.redrawCanvas();
        });
        
        // File picker for source image
        html.find('button[name="browse-image"]').click(async () => {
            const fp = new FilePicker({
                type: 'image',
                current: this.selectedImagePath,
                callback: async (path) => {
                    this.selectedImagePath = path;
                    this.element.find('input[name="imagePath"]').val(path);
                    this.originalImageBlob = await loadImageAsBlob(path);
                    await this.redrawCanvas();
                }
            });
            fp.browse();
        });
        
        // Manual path input
        html.find('input[name="imagePath"]').change(async (event) => {
            const path = event.target.value;
            if (path) {
                this.selectedImagePath = path;
                try {
                    this.originalImageBlob = await loadImageAsBlob(path);
                    await this.redrawCanvas();
                } catch (e) {
                    ui.notifications.error('Failed to load image from path');
                }
            }
        });
    }

    async redrawCanvas() {
        const canvas = this.element.find('#token-preview')[0];
        const display = this.element.find('#token-display')[0];
        const displayCtx = display.getContext('2d');
        const ctx = canvas.getContext('2d');
        
        if (!this.originalImageBlob) {
            // Clear the display if no image
            displayCtx.clearRect(0, 0, display.width, display.height);
            displayCtx.fillStyle = '#333';
            displayCtx.fillRect(0, 0, display.width, display.height);
            displayCtx.fillStyle = '#888';
            displayCtx.font = '16px sans-serif';
            displayCtx.textAlign = 'center';
            displayCtx.fillText('Select an image to preview', display.width / 2, display.height / 2);
            return;
        }
        
        // Add border to the image
        const borderedImage = await addBorder(this.originalImageBlob, `modules/token-border/assets/borders/${this.currentBorder}`);
        
        // Create image from blob
        const img = new Image();
        img.onload = () => {
            // Set canvas size to match the bordered image
            canvas.width = img.width;
            canvas.height = img.height;
            // Draw the image
            ctx.drawImage(img, 0, 0);

            // Scale and draw to display canvas
            displayCtx.clearRect(0, 0, display.width, display.height);
            const scale = Math.min(display.width / img.width, display.height / img.height);
            const x = (display.width - img.width * scale) / 2;
            const y = (display.height - img.height * scale) / 2;
            displayCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
        };
        img.src = URL.createObjectURL(borderedImage);
    }

    async _render(force, options) {
        await super._render(force, options);
        
        // Load initial image if we have a path
        if (this.selectedImagePath) {
            try {
                this.originalImageBlob = await loadImageAsBlob(this.selectedImagePath);
                await this.redrawCanvas();
            } catch (e) {
                console.warn('Token Border | Could not load initial image:', e);
                await this.redrawCanvas(); // Show placeholder
            }
        } else {
            await this.redrawCanvas(); // Show placeholder
        }
    }

    async _updateObject(event, formData) {
        if (!this.originalImageBlob) {
            ui.notifications.error('No image selected');
            return;
        }
        
        const previewCanvas = this.element.find('#token-preview')[0];
        const filename = `token-border-${foundry.utils.randomID()}.png`;
        
        // Convert canvas to blob
        const blob = await new Promise(resolve => previewCanvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], filename, { type: 'image/png' });

        // Ensure upload directory exists
        try {
            await FilePicker.createDirectory('data', 'token-border');
        } catch (error) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }

        // Upload the bordered image
        const uploadedImage = await FilePicker.upload('data', 'token-border', file, {});
        if (!uploadedImage) throw new Error('Failed to upload image');

        // If we have a token, update it; otherwise just notify about the saved file
        if (this.token) {
            await this.token.document.update({
                'texture.src': uploadedImage.path
            });
            ui.notifications.notify('Token border applied successfully!');
        } else {
            ui.notifications.notify(`Bordered image saved to: ${uploadedImage.path}`);
        }
    }
}

let tokenBorderForm = null;

// Add scene control button to open standalone form
// v13 API: controls is a Record<string, SceneControl>, not an array
Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return;
    
    // v13: controls is an object, add new control as a property
    controls['token-border'] = {
        name: 'token-border',
        title: 'Token Border',
        icon: 'fas fa-circle-notch',
        visible: true,
        layer: 'tokens',
        activeTool: 'open-border-form',
        tools: {
            'open-border-form': {
                name: 'open-border-form',
                title: 'Add Border to Image',
                icon: 'fas fa-circle-notch',
                visible: true,
                button: true,
                onClick: () => {
                    if (tokenBorderForm?.rendered) {
                        tokenBorderForm.close();
                    } else {
                        tokenBorderForm = new TokenBorderForm();
                        tokenBorderForm.render(true);
                    }
                }
            }
        }
    };
});

// Add to token HUD controls (v13+)
Hooks.on('getTokenActionButtons', (token, buttons) => {
    if (!game.user.isGM) return;
    
    buttons.push({
        name: 'token-border',
        title: 'Add Border',
        icon: 'fas fa-circle-notch',
        visible: true,
        onClick: () => {
            new TokenBorderForm(token).render(true);
        }
    });
});
