export async function generateToken(description) {
    const apiKey = game.settings.get('token-forge', 'stabilityApiKey');
    if (!apiKey) {
        ui.notifications.error('Please set your Stability AI API key in the module settings');
        return;
    }

    try {
        ui.notifications.info('Generating token...');
        
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
                        text: `A token image for a tabletop RPG, ${description}. The image should be circular and suitable for a token.`,
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
        
        // Convert base64 to File
        const binary = atob(imageData);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([array], { type: 'image/png' });
        const filename = `token-${foundry.utils.randomID()}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        // Ensure directory exists
        try {
            await FilePicker.createDirectory('data', 'token-forge');
        } catch (error) {
            // Directory might already exist, which is fine
            if (!error.message.includes('already exists')) {
                throw error;
            }
        }

        // Upload the image to Foundry
        const uploadedImage = await FilePicker.upload('data', 'token-forge', file, {});
        if (!uploadedImage) throw new Error('Failed to upload image');

        // Create a new token
        const tokenData = {
            name: description,
            texture: {
                src: uploadedImage.path
            },
            width: 1,
            height: 1,
            x: canvas.stage.pivot.x,
            y: canvas.stage.pivot.y
        };

        // Create the token on the current scene
        await canvas.scene.createEmbeddedDocuments('Token', [tokenData]);
        
        ui.notifications.notify('Token created successfully!');
        
    } catch (error) {
        console.error('Token Forge | Error generating token:', error);
        ui.notifications.error('Failed to generate token. Check console for details.');
    }
} 