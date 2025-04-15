import { StabilityProvider } from './StabilityProvider.js';
import { MockProvider } from './MockProvider.js';

export class ProviderFactory {
    static getProvider(settings) {
        switch (settings.provider) {
            case 'stability':
                return new StabilityProvider(settings);
            case 'mock':
                return new MockProvider(settings);
            default:
                throw new Error(`Unknown provider: ${settings.provider}`);
        }
    }
} 