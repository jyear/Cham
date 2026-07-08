import * as webp from './formats/webp';

export type FormatOptionType = 'number' | 'boolean' | 'select';

export interface SelectOption {
  value: string;
  label: string;
}

export interface FormatOptionDef {
  key: string;
  labelKey: string;
  descKey: string;
  type: FormatOptionType;
  default: number | boolean | string;
  min?: number;
  max?: number;
  options?: SelectOption[];
}

export interface FormatConfig {
  format: string;
  options: FormatOptionDef[];
}

const FORMAT_CONFIGS: Record<string, FormatConfig> = {
  [webp.format]: { format: webp.format, options: webp.options },
};

export function getFormatConfig(format: string): FormatConfig | undefined {
  return FORMAT_CONFIGS[format];
}

export function getFormatOptions(format: string): FormatOptionDef[] {
  return FORMAT_CONFIGS[format]?.options ?? [];
}

export function getDefaultOptions(format: string): Record<string, number | boolean | string> {
  const opts: Record<string, number | boolean | string> = {};
  for (const opt of getFormatOptions(format)) {
    opts[opt.key] = opt.default;
  }
  return opts;
}
