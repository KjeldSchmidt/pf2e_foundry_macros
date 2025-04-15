import { ProviderFactory } from './providers/ProviderFactory.js';

export async function generateImage(description) {
    try {
        ui.notifications.info('Generating image...');
        
        const settings = {
            provider: game.settings.get('token-forge', 'provider'),
            stabilityApiKey: game.settings.get('token-forge', 'stabilityApiKey'),
            openaiApiKey: game.settings.get('token-forge', 'openaiApiKey')
        };
        
        const provider = ProviderFactory.getProvider(settings);
        const imageBlob = await provider.generateImage(description);
        
        return imageBlob;
    } catch (error) {
        console.error('Token Forge | Error generating image:', error);
        ui.notifications.error('Failed to generate image. Check console for details.');
        throw error;
    }
} 