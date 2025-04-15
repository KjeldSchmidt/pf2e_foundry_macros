import { BaseProvider } from './BaseProvider.js';

export class OpenAIProvider extends BaseProvider {

    getPrompt(description) {
        return `
            A character illustration that fits the style of a tabletop RPGs. 
            The described character should be centered in the image and should fill the image entirely.
            Unless specified otherwise, the image should be a close-up of the character's face.
            There should only be one character in the image, unless specified otherwise.
            There should be no text, no frames, no borders - just the character, as if photographed in a scene.
            
            The character looks like this: ${description}
        `;
    }
    
    async generateImage(description) {
        const prompt = this.getPrompt(description);
        const apiKey = this.settings.openaiApiKey;
        if (!apiKey) {
            throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: prompt,
                n: 1,
                size: "1024x1024",
                quality: "standard",
                style: "vivid",
                response_format: "b64_json"
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error(`API error: ${errorData.error?.message || response.status}`);
        }

        const data = await response.json();
        const imageData = data.data[0].b64_json;
        
        const binary = atob(imageData);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        return new Blob([array], { type: 'image/png' });
    }
} 