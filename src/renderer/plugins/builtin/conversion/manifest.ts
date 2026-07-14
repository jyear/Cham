import type { PluginManifest } from '@shared/plugin/types';

const manifest: PluginManifest = {
  id: 'conversion',
  name: 'conversionTool',
  version: '1.0.0',
  description: 'conversionToolDesc',
  icon: 'image',
  color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  minWidth: 900,
  minHeight: 580,
  category: 'builtin',
  permissions: ['fs', 'convert', 'watch', 'settings'],
  entry: './index.tsx',
};

export default manifest;
