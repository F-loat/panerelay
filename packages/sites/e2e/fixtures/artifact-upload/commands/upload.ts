import {
  SiteError,
  createMultipartBody,
  defineCommand,
  fetchValidatedJson,
} from '@panerelay/site-kit';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export default defineCommand({
  name: 'upload',
  description: 'Upload one synthetic multipart fixture.',
  access: 'write',
  args: [
    {
      name: 'document',
      description: 'Synthetic text fixture.',
      type: 'file',
      required: true,
      positional: true,
    },
  ],
  output: ['accepted', 'filename', 'size'],
  examples: ['panerelay artifact-upload-fixture upload fixture.txt'],
  async run(context) {
    const artifact = context.artifact('document');
    const multipart = createMultipartBody('document', artifact, [
      { name: 'label', value: 'panerelay-daily-browser' },
    ]);
    const payload = await fetchValidatedJson<Record<string, unknown>>(context, {
      url: 'https://postman-echo.com/post',
      method: 'POST',
      headers: { 'content-type': multipart.contentType },
      body: multipart.body,
      withCookies: false,
    });
    const files = record(payload.files);
    const form = record(payload.form);
    const uploaded = String(files.document ?? Object.values(files)[0] ?? '');
    const encoded = /^data:[^;]*;base64,(.*)$/s.exec(uploaded)?.[1];
    const uploadedText = encoded ? Buffer.from(encoded, 'base64').toString('utf8') : uploaded;
    if (form.label !== 'panerelay-daily-browser' || !uploadedText.includes('fixture payload')) {
      throw new SiteError('shape-drift', 'Multipart echo did not contain the expected fields');
    }
    return [
      {
        accepted: true,
        filename: artifact.basename,
        size: artifact.size,
      },
    ];
  },
});
