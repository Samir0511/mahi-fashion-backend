import mongoose from 'mongoose';

const photoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    designNo: { type: String, required: true, unique: true, trim: true },
    productName: { type: String, required: true, trim: true },
    colour: { type: String, default: '', trim: true },
    price: { type: Number, required: true, default: 0 },
    gender: { type: String, default: 'Women', trim: true },
    availableSizes: { type: [String], default: [] },
    displayOrder: { type: Number, default: 0 },
    photos: { type: [photoSchema], default: [] }
  },
  { timestamps: true }
);

productSchema.index({ displayOrder: 1 });
productSchema.index({ productName: 'text', colour: 'text', designNo: 'text' });

export const Product = mongoose.model('Product', productSchema);
