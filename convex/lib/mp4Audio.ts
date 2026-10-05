// Pulls the AAC sound track out of an MP4 video so only the audio is sent for
// transcription. A reel's audio is a few percent of the file, which keeps long reels
// under the upload limit and makes the transcription request much faster.

type Box = { type: string; start: number; end: number };

const CONTAINER_HEADER_BYTES = 8;
const ADTS_HEADER_BYTES = 7;
const MAX_ADTS_FRAME_BYTES = 0x1fff;
const AAC_SAMPLE_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

function readUint32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
  );
}

function readUint64(bytes: Uint8Array, offset: number): number {
  return readUint32(bytes, offset) * 2 ** 32 + readUint32(bytes, offset + 4);
}

function readType(bytes: Uint8Array, offset: number): string {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

/** Lists the boxes directly inside [start, end). `start` and `end` of each box bound its content. */
function readBoxes(bytes: Uint8Array, start: number, end: number): Box[] {
  const boxes: Box[] = [];
  let offset = start;

  while (offset + CONTAINER_HEADER_BYTES <= end) {
    let size = readUint32(bytes, offset);
    const type = readType(bytes, offset + 4);
    let headerBytes = CONTAINER_HEADER_BYTES;

    if (size === 1) {
      if (offset + 16 > end) break;
      size = readUint64(bytes, offset + 8);
      headerBytes = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerBytes) break;

    boxes.push({ type, start: offset + headerBytes, end: Math.min(offset + size, end) });
    offset += size;
  }

  return boxes;
}

function findBox(bytes: Uint8Array, parent: Box, type: string): Box | undefined {
  return readBoxes(bytes, parent.start, parent.end).find((box) => box.type === type);
}

function findPath(bytes: Uint8Array, parent: Box, path: string[]): Box | undefined {
  let current: Box | undefined = parent;
  for (const type of path) {
    if (!current) return undefined;
    current = findBox(bytes, current, type);
  }
  return current;
}

/** A descriptor's length is stored in up to four bytes, seven bits each. */
function readDescriptorLength(bytes: Uint8Array, offset: number): { length: number; next: number } {
  let length = 0;
  let next = offset;
  for (let i = 0; i < 4; i++) {
    const byte = bytes[next++];
    length = (length << 7) | (byte & 0x7f);
    if ((byte & 0x80) === 0) break;
  }
  return { length, next };
}

type AacConfig = { profile: number; sampleRateIndex: number; channels: number };

/** Reads the AAC settings an ADTS header needs from the track's `esds` descriptor. */
function readAacConfig(bytes: Uint8Array, stsd: Box): AacConfig | null {
  // The sample entry's layout differs between QuickTime and ISO files, so the `esds`
  // box is located by its name rather than by a fixed offset.
  let esdsStart = -1;
  for (let offset = stsd.start; offset + 4 <= stsd.end; offset++) {
    if (readType(bytes, offset) === "esds") {
      esdsStart = offset + 4;
      break;
    }
  }
  if (esdsStart === -1) return null;

  let offset = esdsStart + 4; // version and flags
  if (bytes[offset++] !== 0x03) return null;
  offset = readDescriptorLength(bytes, offset).next;
  offset += 2; // ES id
  const flags = bytes[offset++];
  if (flags & 0x80) offset += 2;
  if (flags & 0x40) offset += 1 + bytes[offset];
  if (flags & 0x20) offset += 2;

  if (bytes[offset++] !== 0x04) return null;
  offset = readDescriptorLength(bytes, offset).next;
  const objectType = bytes[offset];
  // 0x40 is MPEG-4 audio; 0x66 to 0x68 are the MPEG-2 AAC profiles.
  if (objectType !== 0x40 && (objectType < 0x66 || objectType > 0x68)) return null;
  offset += 13; // object type, stream type, buffer size, max and average bitrate

  if (bytes[offset++] !== 0x05) return null;
  const specific = readDescriptorLength(bytes, offset);
  if (specific.length < 2 || specific.next + 2 > stsd.end) return null;

  const first = bytes[specific.next];
  const second = bytes[specific.next + 1];
  const audioObjectType = first >> 3;
  const sampleRateIndex = ((first & 0x07) << 1) | (second >> 7);
  const channels = (second >> 3) & 0x0f;

  if (sampleRateIndex >= AAC_SAMPLE_RATES.length || channels === 0 || channels > 7) return null;

  // HE-AAC (5, 29) carries an AAC-LC core, which is what the ADTS header describes.
  const coreObjectType = audioObjectType === 5 || audioObjectType === 29 ? 2 : audioObjectType;
  if (coreObjectType < 1 || coreObjectType > 4) return null;

  return { profile: coreObjectType - 1, sampleRateIndex, channels };
}

function writeAdtsHeader(target: Uint8Array, offset: number, config: AacConfig, frameBytes: number) {
  const length = frameBytes + ADTS_HEADER_BYTES;
  target[offset] = 0xff;
  target[offset + 1] = 0xf1;
  target[offset + 2] = (config.profile << 6) | (config.sampleRateIndex << 2) | (config.channels >> 2);
  target[offset + 3] = ((config.channels & 0x03) << 6) | (length >> 11);
  target[offset + 4] = (length >> 3) & 0xff;
  target[offset + 5] = ((length & 0x07) << 5) | 0x1f;
  target[offset + 6] = 0xfc;
}

function isAudioTrack(bytes: Uint8Array, mdia: Box): boolean {
  const hdlr = findBox(bytes, mdia, "hdlr");
  // version and flags (4), pre_defined (4), then the handler type.
  return !!hdlr && hdlr.start + 12 <= hdlr.end && readType(bytes, hdlr.start + 8) === "soun";
}

/**
 * Returns the video's audio as an ADTS AAC stream, or null when the file is not an MP4
 * with a plain AAC track (fragmented files, other codecs, a damaged file).
 */
export function extractAacFromMp4(bytes: Uint8Array): Uint8Array | null {
  try {
    const moov = readBoxes(bytes, 0, bytes.length).find((box) => box.type === "moov");
    if (!moov) return null;

    for (const trak of readBoxes(bytes, moov.start, moov.end)) {
      if (trak.type !== "trak") continue;
      const mdia = findBox(bytes, trak, "mdia");
      if (!mdia || !isAudioTrack(bytes, mdia)) continue;

      const stbl = findPath(bytes, mdia, ["minf", "stbl"]);
      if (!stbl) continue;
      const stsd = findBox(bytes, stbl, "stsd");
      const stsz = findBox(bytes, stbl, "stsz");
      const stsc = findBox(bytes, stbl, "stsc");
      const stco = findBox(bytes, stbl, "stco");
      const co64 = findBox(bytes, stbl, "co64");
      if (!stsd || !stsz || !stsc || (!stco && !co64)) continue;

      const config = readAacConfig(bytes, stsd);
      if (!config) continue;

      const fixedSampleSize = readUint32(bytes, stsz.start + 4);
      const sampleCount = readUint32(bytes, stsz.start + 8);
      if (sampleCount === 0) continue;
      const sampleSize = (index: number) =>
        fixedSampleSize !== 0 ? fixedSampleSize : readUint32(bytes, stsz.start + 12 + index * 4);

      const chunkTable = (stco ?? co64) as Box;
      const chunkCount = readUint32(bytes, chunkTable.start + 4);
      const chunkOffset = (index: number) =>
        stco ? readUint32(bytes, stco.start + 8 + index * 4) : readUint64(bytes, chunkTable.start + 8 + index * 8);

      const runCount = readUint32(bytes, stsc.start + 4);
      const runFirstChunk = (index: number) => readUint32(bytes, stsc.start + 8 + index * 12);
      const runSamplesPerChunk = (index: number) => readUint32(bytes, stsc.start + 12 + index * 12);

      let totalBytes = 0;
      for (let index = 0; index < sampleCount; index++) totalBytes += sampleSize(index) + ADTS_HEADER_BYTES;
      const output = new Uint8Array(totalBytes);

      let written = 0;
      let sampleIndex = 0;
      let run = 0;
      for (let chunk = 0; chunk < chunkCount && sampleIndex < sampleCount; chunk++) {
        while (run + 1 < runCount && chunk + 1 >= runFirstChunk(run + 1)) run++;
        let offset = chunkOffset(chunk);
        const samplesInChunk = runSamplesPerChunk(run);

        for (let i = 0; i < samplesInChunk && sampleIndex < sampleCount; i++, sampleIndex++) {
          const size = sampleSize(sampleIndex);
          if (size + ADTS_HEADER_BYTES > MAX_ADTS_FRAME_BYTES || offset + size > bytes.length) return null;
          writeAdtsHeader(output, written, config, size);
          output.set(bytes.subarray(offset, offset + size), written + ADTS_HEADER_BYTES);
          written += size + ADTS_HEADER_BYTES;
          offset += size;
        }
      }

      if (sampleIndex !== sampleCount) return null;
      return output;
    }

    return null;
  } catch {
    return null;
  }
}
