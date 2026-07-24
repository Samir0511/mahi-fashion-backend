import JSZip from 'jszip';

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MIME_BY_EXTENSION = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

export async function parseZipBuffer(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const photos = [];

  const fileEntries = Object.keys(zip.files).filter((filename) => {
    const entry = zip.files[filename];
    return !entry.dir && !filename.includes('__MACOSX') && !filename.startsWith('.');
  });

  for (const filename of fileEntries) {
    const entry = zip.files[filename];
    const basename = filename.split('/').pop() || filename;
    const dotIndex = basename.lastIndexOf('.');
    const ext = dotIndex !== -1 ? basename.substring(dotIndex).toLowerCase() : '';
    const isSupported = SUPPORTED_EXTENSIONS.includes(ext);

    let designNo = '';
    const match = basename.match(/^([a-zA-Z0-9-]+)/);
    if (match) designNo = match[1];

    let dataUrl = '';
    let isCorrupted = false;
    let buffer = null;
    let mimeType = MIME_BY_EXTENSION[ext] || 'image/jpeg';

    if (isSupported) {
      try {
        const base64 = await entry.async('base64');
        const nodeBuffer = await entry.async('nodebuffer');
        buffer = Buffer.from(nodeBuffer);
        dataUrl = `data:${mimeType};base64,${base64}`;
        if (!base64) isCorrupted = true;
      } catch {
        isCorrupted = true;
      }
    }

    const blobData = await entry.async('uint8array');
    photos.push({
      filename: basename,
      designNo,
      dataUrl,
      buffer,
      mimetype: mimeType,
      originalname: basename,
      format: ext.replace('.', '').toUpperCase(),
      isSupported,
      isCorrupted,
      sizeBytes: blobData.length
    });
  }

  return photos;
}

export function matchPhotosToProducts(products, photos) {
  const photoMap = new Map();
  photos.forEach((photo) => {
    if (photo.designNo && photo.isSupported && !photo.isCorrupted && photo.buffer) {
      if (!photoMap.has(photo.designNo)) photoMap.set(photo.designNo, []);
      photoMap.get(photo.designNo).push(photo);
    }
  });

  return products.map((p) => ({
    ...p,
    photos: photoMap.get(p.designNo) || []
  }));
}

export function filesToDataUrls(files) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}
