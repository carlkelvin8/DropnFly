export const MAX_INCIDENT_PHOTO_LENGTH = 1_800_000;

const SUPPORTED_IMAGE_DATA_URL = /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i;

export function incidentPhotoError(photo: unknown): string | null {
  if (photo === undefined || photo === null || photo === "") return null;
  if (typeof photo !== "string" || photo.length > MAX_INCIDENT_PHOTO_LENGTH) {
    return "Photo is too large. Please attach a smaller photo.";
  }
  if (!SUPPORTED_IMAGE_DATA_URL.test(photo)) {
    return "Unsupported photo format. Please use a JPEG, PNG, or WebP photo.";
  }
  return null;
}
