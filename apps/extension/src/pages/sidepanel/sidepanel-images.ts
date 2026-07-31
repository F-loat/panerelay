import {
  CONVERSATION_IMAGE_MIME_TYPES,
  CONVERSATION_MAX_IMAGE_BYTES,
  CONVERSATION_MAX_IMAGES,
  CONVERSATION_MAX_TOTAL_IMAGE_BYTES,
} from '@panerelay/protocol';
import { formatCopy, type Locale, translate } from './i18n.js';
import { sidepanelRandomId, type PastedImage } from './sidepanel-state.js';

const SUPPORTED_IMAGE_MIME_TYPES = new Set<string>(CONVERSATION_IMAGE_MIME_TYPES);

export interface PreparePastedImagesOptions {
  createId?: () => string;
  now?: () => number;
  readImageData?: (file: File) => Promise<string>;
}

export interface SelectedPastedImageFiles {
  files: File[];
  imageError: string;
}

function readImageData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const comma = result.indexOf(',');
      if (comma < 0) reject(new Error('Image data could not be read'));
      else resolve(result.slice(comma + 1));
    });
    reader.addEventListener('error', () => reject(reader.error || new Error('Image read failed')));
    reader.readAsDataURL(file);
  });
}

export function selectPastedImageFiles(
  current: PastedImage[],
  files: File[],
  locale: Locale,
): SelectedPastedImageFiles {
  let totalBytes = current.reduce((total, image) => total + image.size, 0);
  const accepted: File[] = [];
  let imageError = '';

  for (const file of files) {
    if (current.length + accepted.length >= CONVERSATION_MAX_IMAGES) {
      imageError = formatCopy(locale, 'tooManyImages', {
        count: String(CONVERSATION_MAX_IMAGES),
      });
      break;
    }
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(file.type)) {
      imageError = translate(locale, 'unsupportedImage');
      continue;
    }
    if (file.size > CONVERSATION_MAX_IMAGE_BYTES) {
      imageError = formatCopy(locale, 'imageTooLarge', {
        size: String(CONVERSATION_MAX_IMAGE_BYTES / 1024 / 1024),
      });
      continue;
    }
    if (totalBytes + file.size > CONVERSATION_MAX_TOTAL_IMAGE_BYTES) {
      imageError = formatCopy(locale, 'imagesTooLarge', {
        size: String(CONVERSATION_MAX_TOTAL_IMAGE_BYTES / 1024 / 1024),
      });
      continue;
    }
    accepted.push(file);
    totalBytes += file.size;
  }

  return { files: accepted, imageError };
}

export async function preparePastedImages(
  files: File[],
  options: PreparePastedImagesOptions = {},
): Promise<PastedImage[]> {
  const createId = options.createId ?? sidepanelRandomId;
  const now = options.now ?? Date.now;
  const readData = options.readImageData ?? readImageData;
  return Promise.all(
    files.map(async (file, index): Promise<PastedImage> => ({
      id: `pasted-image-${now()}-${index}-${createId()}`,
      data: await readData(file),
      mimeType: file.type,
      ...(file.name ? { name: file.name } : {}),
      size: file.size,
    })),
  );
}
