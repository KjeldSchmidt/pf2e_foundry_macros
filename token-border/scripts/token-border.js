import { addBorder, loadImageAsBlob } from './border-tools.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const FilePickerV2 = foundry.applications.apps.FilePicker.implementation;

Hooks.once('init', async function() {
    console.log('Token Border | Initializing');
});

Hooks.once('ready', async function() {
    console.log('Token Border | Ready');
});

class TokenBorderForm extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(options = {}) {
        super(options);
        this.token = options.token ?? null;
        this.currentBorder = 'Smooth_Brass.png';
        this.originalImageBlob = null;
        this.selectedImagePath = this.token?.texture?.src || this.token?.document?.texture?.src || '';
    }

    static DEFAULT_OPTIONS = {
        id: "token-border",
        tag: "form",
        window: {
            title: "Token Border",
            icon: "fas fa-circle-notch"
        },
        position: {
            width: "auto",
            height: "auto"
        },
        form: {
            handler: TokenBorderForm.#onSubmit,
            closeOnSubmit: true,
            submitOnChange: false
        },
        actions: {
            cancel: TokenBorderForm.#onCancel,
            "browse-image": TokenBorderForm.#onBrowseImage
        }
    };

    static PARTS = {
        form: {
            template: "modules/token-border/templates/token-border.html"
        }
    };

    async _prepareContext(options) {
        return {
            border: this.currentBorder,
            tokenName: this.token?.name || 'No token selected',
            hasToken: !!this.token,
            imagePath: this.selectedImagePath
        };
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const root = this.element;

        root.querySelector('select[name="border"]')?.addEventListener('change', async (event) => {
            this.currentBorder = event.target.value;
            await this.redrawCanvas();
        });

        root.querySelector('input[name="imagePath"]')?.addEventListener('click', () => {
            this.#openImagePicker();
        });

        if (this.selectedImagePath && !this.originalImageBlob) {
            loadImageAsBlob(this.selectedImagePath)
                .then((blob) => { this.originalImageBlob = blob; return this.redrawCanvas(); })
                .catch((e) => {
                    console.warn('Token Border | Could not load initial image:', e);
                    return this.redrawCanvas();
                });
        } else {
            this.redrawCanvas();
        }
    }

    async redrawCanvas() {
        const canvas = this.element.querySelector('#token-preview');
        const display = this.element.querySelector('#token-display');
        if (!canvas || !display) return;
        const displayCtx = display.getContext('2d');
        const ctx = canvas.getContext('2d');

        if (!this.originalImageBlob) {
            displayCtx.clearRect(0, 0, display.width, display.height);
            displayCtx.fillStyle = '#333';
            displayCtx.fillRect(0, 0, display.width, display.height);
            displayCtx.fillStyle = '#888';
            displayCtx.font = '16px sans-serif';
            displayCtx.textAlign = 'center';
            displayCtx.fillText('Select an image to preview', display.width / 2, display.height / 2);
            return;
        }

        const borderedImage = await addBorder(this.originalImageBlob, `modules/token-border/assets/borders/${this.currentBorder}`);

        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            displayCtx.clearRect(0, 0, display.width, display.height);
            const scale = Math.min(display.width / img.width, display.height / img.height);
            const x = (display.width - img.width * scale) / 2;
            const y = (display.height - img.height * scale) / 2;
            displayCtx.drawImage(img, x, y, img.width * scale, img.height * scale);
        };
        img.src = URL.createObjectURL(borderedImage);
    }

    #openImagePicker() {
        const fp = new FilePickerV2({
            type: 'image',
            current: this.selectedImagePath,
            callback: async (path) => {
                this.selectedImagePath = path;
                const input = this.element.querySelector('input[name="imagePath"]');
                if (input) input.value = path;
                this.originalImageBlob = await loadImageAsBlob(path);
                await this.redrawCanvas();
            }
        });
        fp.browse();
    }

    static async #onCancel(event, target) {
        this.close();
    }

    static async #onBrowseImage(event, target) {
        this.#openImagePicker();
    }

    static async #onSubmit(event, form, formData) {
        if (!this.originalImageBlob) {
            ui.notifications.error('No image selected');
            return;
        }

        const previewCanvas = this.element.querySelector('#token-preview');
        const filename = `token-border-${foundry.utils.randomID()}.png`;

        const blob = await new Promise(resolve => previewCanvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], filename, { type: 'image/png' });

        try {
            await FilePickerV2.createDirectory('data', 'token-border');
        } catch (error) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }

        const uploadedImage = await FilePickerV2.upload('data', 'token-border', file, {});
        if (!uploadedImage) throw new Error('Failed to upload image');

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

// v13 API: controls is a Record<string, SceneControl>, not an array
Hooks.on('getSceneControlButtons', (controls) => {
    if (!game.user.isGM) return;

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
                onChange: (event, active) => {
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

Hooks.on('renderTokenHUD', (hud, html, tokenData) => {
    if (!game.user.isGM) return;

    const root = html instanceof HTMLElement ? html : html[0];
    if (!root) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'control-icon';
    button.dataset.action = 'token-border';
    button.title = 'Add Border';
    button.innerHTML = '<i class="fas fa-circle-notch"></i>';
    button.addEventListener('click', () => {
        new TokenBorderForm({ token: hud.object }).render(true);
    });

    const col = root.querySelector('.col.left') ?? root.querySelector('.left') ?? root;
    col.appendChild(button);
});
