export interface GeometryPngEnvironment {
  createImage: () => HTMLImageElement;
  createCanvas: () => HTMLCanvasElement;
  createObjectUrl: (blob: Blob) => string;
  revokeObjectUrl: (url: string) => void;
}

const browserEnvironment = (): GeometryPngEnvironment => ({
  createImage: () => new Image(),
  createCanvas: () => document.createElement('canvas'),
  createObjectUrl: blob => URL.createObjectURL(blob),
  revokeObjectUrl: url => URL.revokeObjectURL(url),
});

export async function rasterizeGeometrySvg(
  svg: string,
  size = 1200,
  environment: GeometryPngEnvironment = browserEnvironment(),
): Promise<Blob> {
  if (!Number.isInteger(size) || size < 1) throw new Error('El tamaño de exportación PNG no es válido.');
  const sourceUrl = environment.createObjectUrl(new Blob([svg], { type: 'image/svg+xml' }));
  let image: HTMLImageElement | null = null;
  try {
    image = environment.createImage();
    const renderImage = image;
    await new Promise<void>((resolve, reject) => {
      renderImage.onload = () => resolve();
      renderImage.onerror = () => reject(new Error('El navegador no pudo decodificar la geometría SVG.'));
      renderImage.src = sourceUrl;
    });
    const canvas = environment.createCanvas();
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('El navegador no ofrece un lienzo compatible para exportar PNG.');
    context.drawImage(renderImage, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('El navegador no pudo crear el archivo PNG.')), 'image/png');
    });
  } catch (error) {
    throw error instanceof Error ? error : new Error('No se pudo exportar la geometría como PNG.');
  } finally {
    if (image) {
      image.onload = null;
      image.onerror = null;
    }
    environment.revokeObjectUrl(sourceUrl);
  }
}
