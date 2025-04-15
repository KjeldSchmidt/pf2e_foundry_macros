import { BaseProvider } from './BaseProvider.js';

export class StabilityProvider extends BaseProvider {
    getPrompt(description) {
        return `
            A token image for a tabletop RPG. The image should be suitable for a token, by centering on the face of the character.
            The character looks like this: ${description}
        `;
    }

    async generateImage(description) {
        const prompt = this.getPrompt(description);
        const apiKey = this.settings.stabilityApiKey;
        if (!apiKey) {
            throw new Error('Stability AI API key not configured');
        }

        const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                text_prompts: [
                    {
                        text: prompt,
                        weight: 1
                    }
                ],
                cfg_scale: 7,
                height: 1024,
                width: 1024,
                steps: 30,
                samples: 1
            })
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        const imageData = data.artifacts[0].base64;
        
        const binary = atob(imageData);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: 'image/png' });
    }
} 