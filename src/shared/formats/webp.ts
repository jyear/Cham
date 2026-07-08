import type { FormatOptionDef } from '../formatConfig';

export const format = 'webp';

export const options: FormatOptionDef[] = [
  {
    key: 'lossless',
    labelKey: 'optLossless',
    descKey: 'optLosslessDesc',
    type: 'boolean',
    default: false,
  },
  {
    key: 'nearLossless',
    labelKey: 'optNearLossless',
    descKey: 'optNearLosslessDesc',
    type: 'boolean',
    default: false,
  },
  {
    key: 'alphaQuality',
    labelKey: 'optAlphaQuality',
    descKey: 'optAlphaQualityDesc',
    type: 'number',
    default: 100,
    min: 0,
    max: 100,
  },
  {
    key: 'effort',
    labelKey: 'optEffort',
    descKey: 'optEffortDesc',
    type: 'number',
    default: 4,
    min: 0,
    max: 6,
  },
  {
    key: 'preset',
    labelKey: 'optPreset',
    descKey: 'optPresetDesc',
    type: 'select',
    default: 'default',
    options: ['default', 'photo', 'picture', 'drawing', 'icon', 'text'].map((v) => ({
      value: v,
      label: v,
    })),
  },
  {
    key: 'smartSubsample',
    labelKey: 'optSmartSubsample',
    descKey: 'optSmartSubsampleDesc',
    type: 'boolean',
    default: false,
  },
  {
    key: 'smartDeblock',
    labelKey: 'optSmartDeblock',
    descKey: 'optSmartDeblockDesc',
    type: 'boolean',
    default: false,
  },
  {
    key: 'minSize',
    labelKey: 'optMinSize',
    descKey: 'optMinSizeDesc',
    type: 'boolean',
    default: false,
  },
  {
    key: 'loop',
    labelKey: 'optLoop',
    descKey: 'optLoopDesc',
    type: 'number',
    default: 0,
    min: 0,
    max: 999,
  },
  {
    key: 'mixed',
    labelKey: 'optMixed',
    descKey: 'optMixedDesc',
    type: 'boolean',
    default: false,
  },
  {
    key: 'exact',
    labelKey: 'optExact',
    descKey: 'optExactDesc',
    type: 'boolean',
    default: false,
  },
];
