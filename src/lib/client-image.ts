export async function imageFileToDataUrl(file: File, maxDimension = 1600, quality = 0.82): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  const source = typeof createImageBitmap === "function"
    ? await createImageBitmap(file)
    : await new Promise<HTMLImageElement>((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => { URL.revokeObjectURL(url); resolve(image); };
        image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read photo")); };
        image.src = url;
      });
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
