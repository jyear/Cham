require('./scripts/load-env')('.env.dev');

const path = require('path');
const webpack = require('webpack');

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    mode: isProd ? 'production' : 'development',
    devtool: isProd ? false : 'eval-source-map',
    entry: {
      index: './src/main/index.ts',
      preload: './src/main/preload/index.ts',
      worker: './src/main/plugins/builtin/conversion/worker.ts',
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
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist/main'),
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.CHAM_UPDATE_URL': JSON.stringify(
          process.env.CHAM_UPDATE_URL || 'https://cham-download.oss-cn-beijing.aliyuncs.com',
        ),
        'process.env.CHAM_STORE_URL': JSON.stringify(
          process.env.CHAM_STORE_URL || 'https://cham-download.oss-cn-beijing.aliyuncs.com/store',
        ),
        'process.env.FOR_DEVELOPMENT': JSON.stringify(
          process.env.FOR_DEVELOPMENT || 'false',
        ),
      }),
    ],
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
