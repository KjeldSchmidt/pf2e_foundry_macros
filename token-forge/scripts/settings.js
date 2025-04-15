export function registerSettings() {
    game.settings.register('token-forge', 'provider', {
        name: 'Image Generation Provider',
        hint: 'Select which provider to use for image generation',
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'stability': 'Stability AI',
            'openai': 'OpenAI DALL-E',
            'mock': 'Mock Provider'
        },
        default: 'mock'
    });

    game.settings.register('token-forge', 'stabilityApiKey', {
        name: 'Stability AI API Key',
        hint: 'Your Stability AI API key',
        scope: 'world',
        config: true,
        type: String,
        default: ''
    });

    game.settings.register('token-forge', 'openaiApiKey', {
        name: 'OpenAI API Key',
        hint: 'Your OpenAI API key',
        scope: 'world',
        config: true,
        type: String,
        default: ''
    });
} 