const path = require('path');

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? false : 'eval-source-map',
    entry: {
      index: './src/main/index.ts',
      preload: './src/main/preload/index.ts',
    },
    target: 'electron-main',
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
      ],
    },
    resolve: {
      extensions: ['.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src/main'),
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist/main'),
    },
    externals: {
      sharp: 'commonjs sharp',
      'better-sqlite3': 'commonjs better-sqlite3',
      chokidar: 'commonjs chokidar',
    },
    node: {
      __dirname: false,
      __filename: false,
    },
  };
};
