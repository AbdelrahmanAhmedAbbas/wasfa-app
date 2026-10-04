import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { extractAacFromMp4 } from "./mp4-audio.ts";

const fixture = new Uint8Array(readFileSync(new URL("./fixtures/one-second-tone.m4a", import.meta.url)));

/** Walks an ADTS stream frame by frame and returns the frame count, or -1 when it is malformed. */
function countAdtsFrames(bytes) {
  let offset = 0;
  let frames = 0;
  while (offset < bytes.length) {
    if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xf6) !== 0xf0) return -1;
    const length = ((bytes[offset + 3] & 0x03) << 11) | (bytes[offset + 4] << 3) | (bytes[offset + 5] >> 5);
    if (length < 7) return -1;
    offset += length;
    frames++;
  }
  return offset === bytes.length ? frames : -1;
}

test("the audio track of an MP4 comes out as a well-formed AAC stream", () => {
  const audio = extractAacFromMp4(fixture);
  assert.ok(audio, "the fixture has an AAC track");

  // The fixture is one second of 32 kHz audio: about 31 frames of 1024 samples, plus
  // the encoder's padding frames.
  const frames = countAdtsFrames(audio);
  assert.ok(frames >= 31 && frames <= 37, `unexpected frame count ${frames}`);

  // AAC-LC, 32 kHz (index 5), stereo.
  assert.equal(audio[2] >> 6, 1);
  assert.equal((audio[2] >> 2) & 0x0f, 5);
  assert.equal(((audio[2] & 0x01) << 2) | (audio[3] >> 6), 2);
});

test("the extracted audio is smaller than the file it came from", () => {
  const audio = extractAacFromMp4(fixture);
  assert.ok(audio.byteLength < fixture.byteLength);
});

test("a file that is not an MP4, or is cut short, yields no audio instead of throwing", () => {
  assert.equal(extractAacFromMp4(new Uint8Array(0)), null);
  assert.equal(extractAacFromMp4(new TextEncoder().encode("<html>not a video</html>")), null);
  assert.equal(extractAacFromMp4(new Uint8Array(4096).fill(0xff)), null);

  // The sample tables survive but the audio they point at is gone.
  const moovAt = fixture.findIndex(
    (_, i) => fixture[i] === 0x6d && fixture[i + 1] === 0x6f && fixture[i + 2] === 0x6f && fixture[i + 3] === 0x76
  );
  const mdatAt = fixture.findIndex(
    (_, i) => fixture[i] === 0x6d && fixture[i + 1] === 0x64 && fixture[i + 2] === 0x61 && fixture[i + 3] === 0x74
  );
  assert.ok(moovAt > 0 && mdatAt > 0);
  if (mdatAt > moovAt) {
    assert.equal(extractAacFromMp4(fixture.slice(0, mdatAt + 200)), null);
  }
});
