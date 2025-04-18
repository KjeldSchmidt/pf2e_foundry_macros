import { BaseProvider } from './BaseProvider.js';

export class MockProvider extends BaseProvider {
    async generateImage(description) {
        try {
            const response = await fetch('modules/token-forge/assets/placeholder.png');
            if (!response.ok) throw new Error('Failed to load placeholder image');
            return await response.blob();
        } catch (error) {
            console.error('Token Forge | Error loading mock image:', error);
            throw error;
        }
    }
} 