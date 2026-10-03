export async function imageFileToDataUrl(file: File, maxDimension = 1600, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  let source: ImageBitmap | HTMLImageElement | null = null;
  if (typeof createImageBitmap === "function") {
    try {
      source = await createImageBitmap(file);
    } catch {
      // Mobile Safari and some Android browsers expose camera formats that
      // createImageBitmap cannot decode. Fall through to the image element.
    }
  }
  if (!source) {
    try {
      source = await new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read photo")); };
        image.src = url;
      });
    } catch {
      // If the device can capture/display the original format but the canvas
      // decoder cannot, keep a small original file so the task can proceed.
      if (file.size <= 1_400_000) {
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read photo"));
          reader.readAsDataURL(file);
        });
      }
      throw new Error("This camera format could not be processed. Choose a JPEG/PNG photo under 2 MB.");
    }
  }
  const scale = Math.min(1, maxDimension / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable");
  context.drawImage(source, 0, 0, width, height);
  if ("close" in source && typeof source.close === "function") source.close();
  return canvas.toDataURL("image/jpeg", quality);
}
