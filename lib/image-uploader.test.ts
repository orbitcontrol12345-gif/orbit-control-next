import assert from 'node:assert/strict';
import test from 'node:test';

import { parseTrustedImageUrl } from './image-uploader';

test('trusted product image origins are accepted', () => {
  assert.equal(
    parseTrustedImageUrl(
      'https://i.ebayimg.com/images/g/example/s-l1600.jpg',
    ).hostname,
    'i.ebayimg.com',
  );
  assert.equal(
    parseTrustedImageUrl(
      'https://pub-e11286a0a91241bfbfe0d74a29552eed.r2.dev/orbit-control/products/1/main.jpg',
    ).protocol,
    'https:',
  );
});

test('untrusted, deceptive, and non-HTTPS image URLs are rejected', () => {
  for (const value of [
    'http://i.ebayimg.com/image.jpg',
    'https://i.ebayimg.com.evil.example/image.jpg',
    'https://127.0.0.1/image.jpg',
    'https://user:password@i.ebayimg.com/image.jpg',
    'https://i.ebayimg.com:444/image.jpg',
    'not-a-url',
  ]) {
    assert.throws(() => parseTrustedImageUrl(value));
  }
});
