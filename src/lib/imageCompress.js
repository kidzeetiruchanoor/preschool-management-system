// Client-side image compression — runs entirely in the browser before upload.
// Resizes to a max width and re-encodes as JPEG at reduced quality.
// Non-image files (PDFs etc.) are passed through unchanged.

const MAX_WIDTH = 1600
const JPEG_QUALITY = 0.78

export function isCompressibleImage(file) {
  return file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp'
}

export async function compressImage(file) {
  if (!isCompressibleImage(file)) return file // PDFs and other types pass through as-is

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_WIDTH / bitmap.width)
  const targetW = Math.round(bitmap.width * scale)
  const targetH = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = targetW
  canvas.height = targetH
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, targetW, targetH)

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) return file // fallback to original if canvas encoding fails

  // Only use the compressed version if it's actually smaller
  if (blob.size >= file.size) return file

  const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg' })
}
