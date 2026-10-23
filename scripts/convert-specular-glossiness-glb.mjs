import { readFile, writeFile } from 'node:fs/promises';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: node scripts/convert-specular-glossiness-glb.mjs input.glb output.glb');

const source = await readFile(input);
if (source.readUInt32LE(0) !== 0x46546c67) throw new Error('Input is not a binary glTF file.');

const chunks = [];
for (let offset = 12; offset < source.length;) {
  const length = source.readUInt32LE(offset);
  const type = source.readUInt32LE(offset + 4);
  chunks.push({ type, data: source.subarray(offset + 8, offset + 8 + length) });
  offset += 8 + length;
}

const jsonChunk = chunks.find((chunk) => chunk.type === 0x4e4f534a);
if (!jsonChunk) throw new Error('GLB has no JSON chunk.');
const document = JSON.parse(jsonChunk.data.toString().trim());
let converted = 0;
for (const material of document.materials ?? []) {
  const legacy = material.extensions?.KHR_materials_pbrSpecularGlossiness;
  if (!legacy) continue;
  material.pbrMetallicRoughness = {
    baseColorFactor: legacy.diffuseFactor ?? [1, 1, 1, 1],
    baseColorTexture: legacy.diffuseTexture,
    metallicFactor: 0,
    roughnessFactor: Math.max(.22, Math.min(1, 1 - (legacy.glossinessFactor ?? 0))),
  };
  delete material.extensions.KHR_materials_pbrSpecularGlossiness;
  if (!Object.keys(material.extensions).length) delete material.extensions;
  converted++;
}
for (const key of ['extensionsUsed', 'extensionsRequired']) {
  if (!document[key]) continue;
  document[key] = document[key].filter((extension) => extension !== 'KHR_materials_pbrSpecularGlossiness');
  if (!document[key].length) delete document[key];
}

let json = Buffer.from(JSON.stringify(document));
while (json.length % 4) json = Buffer.concat([json, Buffer.from(' ')]);
chunks[chunks.indexOf(jsonChunk)] = { type: jsonChunk.type, data: json };
const totalLength = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.length, 0);
const outputBuffer = Buffer.alloc(totalLength);
outputBuffer.writeUInt32LE(0x46546c67, 0);
outputBuffer.writeUInt32LE(2, 4);
outputBuffer.writeUInt32LE(totalLength, 8);
let offset = 12;
for (const chunk of chunks) {
  outputBuffer.writeUInt32LE(chunk.data.length, offset);
  outputBuffer.writeUInt32LE(chunk.type, offset + 4);
  chunk.data.copy(outputBuffer, offset + 8);
  offset += 8 + chunk.data.length;
}

await writeFile(output, outputBuffer);
console.log(`Converted ${converted} legacy material definitions to core glTF PBR.`);
