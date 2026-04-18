/**
 * Load an image from a path and return it as a blob
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Blob>} - The image as a blob
 */
export async function loadImageAsBlob(imagePath) {
    const response = await fetch(imagePath);
    return response.blob();
}

/**
 * Add a decorative border to an image
 * @param {Blob} imageBlob - The source image as a blob
 * @param {string} borderPath - Path to the border image
 * @returns {Promise<Blob>} - The bordered image as a blob
 */
export async function addBorder(imageBlob, borderPath = 'modules/token-border/assets/borders/Smooth_Brass.png') {
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
            borderImg.src = borderPath;
        })
    ]);

    // Create a canvas with the border image size
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = borderImg.width;
    canvas.height = borderImg.height;

    // Scale and center the token image
    const targetSize = 500;
    const scale = targetSize / Math.max(img.width, img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;
    const x = (canvas.width - scaledWidth) / 2;
    const y = (canvas.height - scaledHeight) / 2;

    // Draw the image circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, targetSize/2 - 5, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
    ctx.restore();

    // Draw the border texture on top, taking up the entire canvas
    ctx.drawImage(borderImg, 0, 0, canvas.width, canvas.height);

    // Convert canvas to blob
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, 'image/png');
    });
}
