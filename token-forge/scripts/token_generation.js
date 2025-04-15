import { ProviderFactory } from './providers/ProviderFactory.js';

export function generatePrompt(description) {
    return `A token image for a tabletop RPG, ${description}. The image should be circular and suitable for a token.`;
}

export async function generateImage(description) {
    try {
        ui.notifications.info('Generating image...');
        
        const settings = {
            provider: game.settings.get('token-forge', 'provider'),
            stabilityApiKey: game.settings.get('token-forge', 'stabilityApiKey')
        };
        
        const provider = ProviderFactory.getProvider(settings);
        const prompt = generatePrompt(description);
        const imageBlob = await provider.generateImage(prompt);
        
        return imageBlob;
    } catch (error) {
        console.error('Token Forge | Error generating image:', error);
        ui.notifications.error('Failed to generate image. Check console for details.');
        throw error;
    }
} 