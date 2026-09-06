import imageCompression from 'browser-image-compression'

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
const maxOriginalBytes = 15 * 1024 * 1024

export function validateImage(file: File) {
  if (!acceptedTypes.includes(file.type.toLowerCase())) {
    throw new Error('Please choose a JPEG, PNG, WebP, or HEIC photograph.')
  }
  if (file.size > maxOriginalBytes) {
    throw new Error('That photo is over 15 MB. Please choose a smaller one.')
  }
}

export async function prepareImage(file: File) {
  validateImage(file)

  const [full, thumbnail] = await Promise.all([
    imageCompression(file, {
      maxSizeMB: 0.45,
      maxWidthOrHeight: 1800,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.84,
    }),
    imageCompression(file, {
      maxSizeMB: 0.08,
      maxWidthOrHeight: 480,
      useWebWorker: true,
      fileType: 'image/webp',
      initialQuality: 0.76,
    }),
  ])

  return {
    full: new File([full], 'memory.webp', { type: 'image/webp' }),
    thumbnail: new File([thumbnail], 'thumbnail.webp', {
      type: 'image/webp',
    }),
  }
}
