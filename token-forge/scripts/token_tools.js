export async function addBorder(imageBlob) {
    // Create a new image element for the token
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    // Create a new image element for the border
    const borderImg = new Image();
    borderImg.crossOrigin = 'anonymous';
    
    // Wait for both images to load
    await Promise.all([
        new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = URL.createObjectURL(imageBlob);
        }),
        new Promise((resolve, reject) => {
            borderImg.onload = resolve;
            borderImg.onerror = reject;
            borderImg.src = 'modules/token-forge/assets/borders/Smooth_Brass.png';
        })
    ]);

    // Create a canvas with the image size
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const size = Math.max(img.width, img.height);
    canvas.width = size;
    canvas.height = size;

    // Draw the image circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(size/2, size/2, size/2 - 5, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, 
        (size - img.width) / 2, 
        (size - img.height) / 2, 
        img.width, 
        img.height
    );
    ctx.restore();

    // Draw the border texture on top, scaled to canvas size
    ctx.drawImage(borderImg, 0, 0, borderImg.width, borderImg.height, 0, 0, size, size);

    // Convert canvas to blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
} 