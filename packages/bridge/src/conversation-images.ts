import {
  CONVERSATION_IMAGE_MIME_TYPES,
  CONVERSATION_MAX_IMAGE_BYTES,
  CONVERSATION_MAX_IMAGES,
  CONVERSATION_MAX_TOTAL_IMAGE_BYTES,
  type ConversationImageInput,
} from '@panerelay/protocol';

const SUPPORTED_MIME_TYPES = new Set<string>(CONVERSATION_IMAGE_MIME_TYPES);
const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

export function validateConversationImages(value: unknown): ConversationImageInput[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > CONVERSATION_MAX_IMAGES) {
    throw new Error(`images must contain at most ${CONVERSATION_MAX_IMAGES} items`);
  }

  let totalBytes = 0;
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`images[${index}] must be an image`);
    }
    const image = candidate as Record<string, unknown>;
    if (typeof image.mimeType !== 'string' || !SUPPORTED_MIME_TYPES.has(image.mimeType)) {
      throw new Error(`images[${index}] has an unsupported MIME type`);
    }
    if (
      typeof image.data !== 'string' ||
      image.data.length === 0 ||
      image.data.length % 4 !== 0 ||
      !BASE64_PATTERN.test(image.data)
    ) {
      throw new Error(`images[${index}] must contain valid base64 data`);
    }
    const bytes = Buffer.byteLength(image.data, 'base64');
    if (bytes > CONVERSATION_MAX_IMAGE_BYTES) {
      throw new Error(`images[${index}] exceeds the per-image size limit`);
    }
    totalBytes += bytes;
    if (totalBytes > CONVERSATION_MAX_TOTAL_IMAGE_BYTES) {
      throw new Error('images exceed the total size limit');
    }
    if (image.name !== undefined && (typeof image.name !== 'string' || image.name.length > 255)) {
      throw new Error(`images[${index}].name must be a string of at most 255 characters`);
    }
    return {
      data: image.data,
      mimeType: image.mimeType,
      ...(typeof image.name === 'string' && image.name ? { name: image.name } : {}),
    };
  });
}
