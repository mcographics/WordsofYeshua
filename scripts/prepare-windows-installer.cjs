const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const vendorDirectory = path.join(
  __dirname,
  '..',
  'node_modules',
  'electron-winstaller',
  'vendor',
)
const architecture = os.arch()

for (const extension of ['exe', 'dll']) {
  const source = path.join(vendorDirectory, `7z-${architecture}.${extension}`)
  const destination = path.join(vendorDirectory, `7z.${extension}`)

  if (!fs.existsSync(source)) {
    throw new Error(`Missing Windows installer dependency: ${source}`)
  }

  fs.copyFileSync(source, destination)
}

console.log(`Prepared electron-winstaller 7-Zip helper for ${architecture}.`)
