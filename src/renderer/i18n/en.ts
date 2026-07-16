const en = {
  // TitleBar
  settings: 'Settings',
  back: 'Back',

  // SourcePanel
  source: 'Source',
  filesCount: (n: number) => `${n} files`,
  noFilesSelected: 'No files selected',
  addFolder: 'Add Folder',
  addFiles: 'Add Files...',
  clearAll: 'Clear All',
  copyBadge: 'copy',

  // ConfigPanel
  config: 'Config',
  quality: 'Quality',
  smallerFile: 'Smaller file',
  betterQuality: 'Better quality',
  format: 'Format',
  keepExtension: 'Keep original extension',
  keepExtensionHintWebp: 'Keep original extension instead of .webp',
  copyOtherTypes: 'Copy other file types',
  copyOtherTypesHint: 'Copy non-convertible files to output as-is',
  watchMode: 'Watch mode',
  watchModeHint: 'Auto-convert when files in the selected folder change',
  watchModeNoFolder: 'Select source folder and output folder first',
  watchModeLockOutput: 'Output folder is locked during watch mode',
  convert: 'Convert',
  convertAgain: 'Convert Again',
  converting: 'Converting...',
  convertingProgress: (done: number, total: number) => `Converting... ${done}/${total}`,
  selectOutputFolder: 'Select output folder',

  // OutputPanel
  output: 'Output',
  okCount: (ok: number, fail: number) => `${ok} ok${fail > 0 ? ` · ${fail} failed` : ''}`,
  readyToConvert: 'Ready to convert',
  allUpToDate: 'All files are already up to date',
  processing: 'Processing...',
  cached: 'Cached',
  copied: 'Copied',
  ok: 'OK',
  failed: 'Failed',

  // Footer
  footer: 'Powered by sharp · Based on cham-cli',
  keepInDock: 'Keep in Dock',
  removeFromDock: 'Remove from Dock',

  // Settings page
  settingsTitle: 'Settings',
  settingsDesc: 'Language / 语言',
  basicSettings: 'Basic',
  appearanceSettings: 'Appearance',
  theme: 'Theme',
  language: 'Language',
  currentVersion: (v: string) => `Current version: ${v}`,
  clearCache: 'Clear Cache',
  cacheCleared: 'Cache cleared successfully',
  checkUpdate: 'Check for Updates',
  checkingUpdate: 'Checking...',
  updateAvailableBanner: 'New version available',
  updateAvailable: (v: string) => `New version v ${v} available!`,
  updateUpToDate: (v: string) => `You are up to date (${v})`,
  updateChangelog: "What's New",
  updateDownloadNow: 'Download Now',
  updateDownloadingProgress: (p: number) => `Downloading... ${p}%`,
  updateInstallNow: 'Install Now',
  updateError: (e: string) => `Update error: ${e}`,

  // About page
  aboutTitle: 'About Cham',
  aboutDesc: 'A desktop image compression and WebP conversion tool built with Electron, React, and TypeScript.',
  aboutBullet1: 'Convert PNG / JPG / JPEG / GIF / TIFF / BMP to WebP',
  aboutBullet2: 'Powered by sharp for high-performance image processing',
  aboutBullet3: 'Based on the cham-cli CLI tool',

  // Format options
  formatOptions: 'Format Options',
  optLossless: 'Lossless',
  optLosslessDesc: 'Use lossless compression mode',
  optNearLossless: 'Near Lossless',
  optNearLosslessDesc: 'Use near-lossless compression mode',
  optAlphaQuality: 'Alpha Quality',
  optAlphaQualityDesc: 'Quality of the alpha layer, 0-100',
  optEffort: 'Effort',
  optEffortDesc: 'CPU effort, 0 (fastest) to 6 (slowest)',
  optPreset: 'Preset',
  optPresetDesc: 'Preprocessing / filter preset',
  optSmartSubsample: 'Smart Subsampling',
  optSmartSubsampleDesc: 'Use high-quality chroma subsampling',
  optSmartDeblock: 'Smart Deblock',
  optSmartDeblockDesc: 'Auto-adjust deblocking filter for low-contrast edges (slower)',
  optMinSize: 'Minimize Size',
  optMinSizeDesc: 'Disable animation key frames to reduce file size (slower)',
  optLoop: 'Loop',
  optLoopDesc: 'Animation loop count, 0 = infinite',
  optMixed: 'Mixed',
  optMixedDesc: 'Allow mixing lossy and lossless animation frames (slower)',
  optExact: 'Exact',
  optExactDesc: 'Preserve color data in transparent pixels',

  // Background image
  backgroundImage: 'Background Image',
  selectBackgroundImage: 'Select Image...',
  resetBackground: 'Reset',
  noBackground: 'No background image',

  // Home
  home: 'Home',
  welcome: 'Welcome',

  // Tools
  tools: 'Apps',
  toolsTitle: 'Apps',
  conversionTool: 'Image Conversion',
  conversionToolDesc: 'Convert images to WebP / AVIF format',

  // Store
  store: 'Store',
  storeInstalled: 'Installed',
  storeDiscover: 'Discover',
  storeInstall: 'Install',
  storeUninstall: 'Uninstall',
  storeUpdating: 'Updating...',
  storeInstalling: 'Installing...',
  storeInstallSuccess: 'Installed successfully',
  storeInstallFailed: 'Install failed',
  storeUninstallConfirm: 'Remove this plugin?',
  storeVersion: (v: string) => `v${v}`,
  storeAuthor: (a: string) => `By ${a}`,
  storeBuiltinBadge: 'Built-in',
  storeStoreBadge: 'Store',
  storeNoPlugins: 'No plugins installed yet',
  storeBrowseHint: 'Switch to the Discover tab to find plugins',
  storeNoStorePlugins: 'No plugins available',
  storeRefresh: 'Refresh',
  addLocalApp: 'Add Local App',

  // Misc
  minimize: 'Minimize',
  maximize: 'Maximize',
  restore: 'Restore',
  close: 'Close',
};

export default en;
