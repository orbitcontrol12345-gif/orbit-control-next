import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateAttachmentContents,
  validateRequestBodyHeaders,
} from './public-form-security';

test('public request bodies require an expected media type', () => {
  const request = new Request('https://orbit-surplus.com/api/contact', {
    method: 'POST',
    body: 'not json',
    headers: {
      'content-type': 'text/plain',
    },
  });

  assert.deepEqual(
    validateRequestBodyHeaders(request, {
      allowedMediaTypes: ['application/json'],
      maxBytes: 1024,
    }),
    {
      error: 'Unsupported request content type.',
      status: 415,
    },
  );
});

test('public request bodies reject declared oversized payloads', () => {
  const request = new Request('https://orbit-surplus.com/api/contact', {
    method: 'POST',
    body: '{}',
    headers: {
      'content-length': '2048',
      'content-type': 'application/json; charset=utf-8',
    },
  });

  assert.equal(
    validateRequestBodyHeaders(request, {
      allowedMediaTypes: ['application/json'],
      maxBytes: 1024,
    })?.status,
    413,
  );
});

test('attachment signatures must match their declared extension', async () => {
  const pdf = new File(
    [new TextEncoder().encode('%PDF-1.7\n')],
    'specification.pdf',
    { type: 'application/pdf' },
  );
  const disguisedExecutable = new File(
    [new Uint8Array([0x4d, 0x5a, 0x90, 0x00])],
    'invoice.pdf',
    { type: 'application/pdf' },
  );

  assert.equal(await validateAttachmentContents([pdf]), null);
  assert.match(
    (await validateAttachmentContents([disguisedExecutable])) || '',
    /does not match/i,
  );
});
