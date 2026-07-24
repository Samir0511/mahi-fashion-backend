export const normalizeMimeType = (file) => {
  const mime = file?.mimetype || '';
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (!allowed.includes(mime)) {
    throw new Error('Unsupported file type');
  }

  return true;
};

export const formatSizes = (value) => {
  if (typeof value === 'string') {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  return [];
};
