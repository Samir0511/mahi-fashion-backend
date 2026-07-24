const normalizePhoto = (photo) => {
  if (typeof photo === 'string') {
    return {
      url: photo,
      key: ''
    };
  }

  return {
    url: photo?.url || '',
    key: photo?.key || ''
  };
};

export const serializeProduct = (product) => {
  const photos = Array.isArray(product?.photos)
    ? product.photos.map(normalizePhoto).filter((photo) => photo.url)
    : [];

  return {
    _id: product?._id,
    designNo: product?.designNo || '',
    productName: product?.productName || '',
    colour: product?.colour || '',
    price: Number(product?.price || 0),
    gender: product?.gender || 'Women',
    availableSizes: Array.isArray(product?.availableSizes) ? product.availableSizes : [],
    displayOrder: Number(product?.displayOrder || 0),
    thumbnail: photos[0]?.url || '',
    photos
  };
};
