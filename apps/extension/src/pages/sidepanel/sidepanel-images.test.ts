import {
  CONVERSATION_MAX_IMAGE_BYTES,
  CONVERSATION_MAX_IMAGES,
  CONVERSATION_MAX_TOTAL_IMAGE_BYTES,
} from '@panerelay/protocol';
import { describe, expect, it } from 'vitest';
import { preparePastedImages, selectPastedImageFiles } from './sidepanel-images.js';
import type { PastedImage } from './sidepanel-state.js';

function file(name: string, type: string, size: number): File {
  return { name, type, size } as File;
}

function existingImage(size: number): PastedImage {
  return {
    id: `existing-${size}`,
    data: '',
    mimeType: 'image/png',
    size,
  };
}

const testOptions = {
  createId: () => 'id',
  now: () => 123,
  readImageData: async (value: File) => `data:${value.name}`,
};

describe('preparePastedImages', () => {
  it('prepares supported images with deterministic metadata', async () => {
    const selection = selectPastedImageFiles(
      [],
      [file('one.png', 'image/png', 100), file('two.webp', 'image/webp', 200)],
      'en',
    );
    const images = await preparePastedImages(selection.files, testOptions);

    expect(selection.imageError).toBe('');
    expect(images).toEqual([
      {
        id: 'pasted-image-123-0-id',
        data: 'data:one.png',
        mimeType: 'image/png',
        name: 'one.png',
        size: 100,
      },
      {
        id: 'pasted-image-123-1-id',
        data: 'data:two.webp',
        mimeType: 'image/webp',
        name: 'two.webp',
        size: 200,
      },
    ]);
  });

  it('skips invalid files while retaining valid files and the latest validation error', async () => {
    const result = selectPastedImageFiles(
      [],
      [
        file('text.txt', 'text/plain', 10),
        file('large.png', 'image/png', CONVERSATION_MAX_IMAGE_BYTES + 1),
        file('valid.png', 'image/png', 10),
      ],
      'en',
    );

    expect(result.files).toHaveLength(1);
    expect(result.files[0]?.name).toBe('valid.png');
    expect(result.imageError).toContain('MB');
  });

  it('enforces aggregate byte and image count limits against existing images', async () => {
    const aggregate = selectPastedImageFiles(
      [existingImage(CONVERSATION_MAX_TOTAL_IMAGE_BYTES - 5)],
      [file('overflow.png', 'image/png', 10)],
      'en',
    );
    expect(aggregate.files).toEqual([]);
    expect(aggregate.imageError).toContain('total');

    const count = selectPastedImageFiles(
      Array.from({ length: CONVERSATION_MAX_IMAGES }, (_, index) => existingImage(index)),
      [file('extra.png', 'image/png', 1)],
      'en',
    );
    expect(count.files).toEqual([]);
    expect(count.imageError).toContain(String(CONVERSATION_MAX_IMAGES));
  });
});
