import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const svgPath = path.join(root, 'public', 'apple-touch-icon.svg')
const svg = fs.readFileSync(svgPath)

for (const size of [192, 512]) {
  await sharp(svg)
    .resize(size, size)
    .png()
    .toFile(path.join(root, 'public', `pwa-${size}.png`))
}

console.log('Generated public/pwa-192.png and public/pwa-512.png')
