import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    brandDetails: {
      type: Object,
      default: {}
    },
    sizeChart: {
      type: Array,
      default: []
    }
  },
  { timestamps: true }
);

settingsSchema.statics.getOrCreateSettings = async function getOrCreateSettings() {
  const settings = await this.findOne();
  if (settings) return settings;

  return this.create({
    brandDetails: {},
    sizeChart: []
  });
};

export const Settings = mongoose.model('Settings', settingsSchema);

export const getOrCreateSettings = () => Settings.getOrCreateSettings();
