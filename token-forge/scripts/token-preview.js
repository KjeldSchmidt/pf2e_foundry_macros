import { createTokenInScene, addBorder } from './token_tools.js';

export class TokenPreviewForm extends FormApplication {
    constructor(imageBlob, description) {
        super();
        this.imageBlob = imageBlob;
        this.description = description;
        this.currentBorder = 'Smooth_Brass.png';
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: "token-preview",
            title: "Token Preview",
            template: "modules/token-forge/templates/token-preview.html",
            width: 600,
            height: 700,
            closeOnSubmit: true
        });
    }

    getData() {
        return {
            border: this.currentBorder
        };
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('button[name="cancel"]').click(() => this.close());
        html.find('select[name="border"]').change(async (event) => {
            this.currentBorder = event.target.value;
            await this.redrawCanvas();
        });
    }

    async redrawCanvas() {
        const canvas = this.element.find('#token-preview')[0];
        const display = this.element.find('#token-display')[0];
        const displayCtx = display.getContext('2d');
        const ctx = canvas.getContext('2d');
        
        // Add border to the image
        const borderedImage = await addBorder(this.imageBlob, `modules/token-forge/assets/borders/${this.currentBorder}`);
        
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
        await this.redrawCanvas();
    }

    async _updateObject(event, formData) {
        const canvas = this.element.find('#token-preview')[0];
        const filename = `token-${foundry.utils.randomID()}.png`;
        
        // Convert canvas to blob
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const file = new File([blob], filename, { type: 'image/png' });

        try {
            await FilePicker.createDirectory('data', 'token-forge');
        } catch (error) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }

        const uploadedImage = await FilePicker.upload('data', 'token-forge', file, {});
        if (!uploadedImage) throw new Error('Failed to upload image');

        await createTokenInScene(uploadedImage.path, this.description);
        ui.notifications.notify('Token created successfully!');
    }
} 