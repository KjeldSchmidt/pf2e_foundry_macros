export class BaseProvider {
    constructor(settings) {
        this.settings = settings;
    }

    async generateImage(description) {
        throw new Error('generateImage must be implemented by provider');
    }
} 