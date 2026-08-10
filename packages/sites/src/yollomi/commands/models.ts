import { defineCommand } from '@panerelay/site-kit';

const IMAGE = {
  'z-image-turbo': [1, 'Alibaba Qwen turbo'],
  'flux-schnell': [2, 'High-speed Flux generation'],
  'ideogram-v3-turbo': [3, 'Ideogram V3 Turbo'],
  'imagen-4-fast': [3, 'Google Imagen 4 Fast'],
  'seedream-4-5': [4, 'Seedream 4.5'],
  'seedream-5-lite': [4, 'Seedream 5 Lite'],
  flux: [4, 'Flux 1.1 Pro'],
  'nano-banana': [4, 'Google Nano Banana'],
  'flux-kontext-pro': [4, 'Flux Kontext Pro'],
  'imagen-4-ultra': [6, 'Google Imagen 4 Ultra'],
  'nano-banana-2': [7, 'Google Nano Banana 2'],
  'stable-diffusion-3-5-large': [7, 'Stable Diffusion 3.5 Large'],
  'nano-banana-pro': [15, 'Nano Banana Pro'],
  'flux-2-pro': [15, 'Flux 2 Pro'],
} as const;
const VIDEO = {
  'kling-v2-6-motion-control': [7, 'Kling v2.6 Motion Control'],
  'bytedance-seedance-1-pro-fast': [8, 'Seedance 1.0 Pro Fast'],
  'kling-2-1': [9, 'Kling 2.1'],
  'minimax-hailuo-2-3': [9, 'Hailuo 2.3'],
  'pixverse-5': [9, 'PixVerse 5'],
  'wan-2-5-t2v': [9, 'Wan 2.5 Text-to-Video'],
  'wan-2-5-i2v': [9, 'Wan 2.5 Image-to-Video'],
  'google-veo-3-fast': [9, 'Google Veo 3 Fast'],
  'google-veo-3-1-fast': [9, 'Google Veo 3.1 Fast'],
  'openai-sora-2': [10, 'Sora 2'],
  'google-veo-3': [10, 'Google Veo 3'],
  'google-veo-3-1': [10, 'Google Veo 3.1'],
  'wan-2-6-t2v': [29, 'Wan 2.6 T2V'],
  'wan-2-6-i2v': [29, 'Wan 2.6 I2V'],
} as const;
const TOOL = {
  'remove-bg': [0, 'Remove background'],
  'image-upscaler': [1, 'Enhance image resolution'],
  'object-remover': [3, 'Remove unwanted objects'],
  'face-swap': [3, 'Swap faces in photos'],
  'virtual-try-on': [3, 'Try clothes on photos'],
  'qwen-image-edit': [3, 'Edit image with text prompt'],
  'qwen-image-edit-plus': [3, 'Advanced image editing'],
  'photo-restoration': [4, 'Revive old photos'],
  'ai-background-generator': [5, 'Generate custom backgrounds'],
} as const;

export default defineCommand({
  name: 'models',
  description: 'List Yollomi image, video, and tool models.',
  access: 'read',
  args: [
    { name: 'type', description: 'all, image, video, or tool.', type: 'string', default: 'all' },
  ],
  output: ['type', 'model', 'credits', 'description'],
  examples: ['panerelay yollomi models --type image'],
  async run(_context, args) {
    const type = String(args.type || 'all');
    if (!['all', 'image', 'video', 'tool'].includes(type))
      throw new Error('yollomi type must be all, image, video, or tool');
    const rows: Record<string, unknown>[] = [];
    const append = (kind: string, values: Record<string, readonly [number, string]>) => {
      for (const [model, [credits, description]] of Object.entries(values))
        rows.push({ type: kind, model, credits, description });
    };
    if (type === 'all' || type === 'image') append('image', IMAGE);
    if (type === 'all' || type === 'video') append('video', VIDEO);
    if (type === 'all' || type === 'tool') append('tool', TOOL);
    return rows;
  },
});
