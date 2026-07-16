require('./scripts/load-env')('.env.dev');

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  /** @type {import('webpack').Configuration & { devServer?: import('webpack-dev-server').Configuration }} */
  return {
    mode: isProd ? 'production' : 'development',
    entry: './src/web/index.tsx',
    target: 'web',
    devtool: isProd ? false : 'eval-source-map',
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader'],
        },
        {
          test: /\.(png|jpe?g|gif|svg|webp)$/i,
          type: 'asset/resource',
        },
      ],
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@': path.resolve(__dirname, 'src/web'),
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    output: {
      filename: 'assets/bundle.[contenthash:8].js',
      path: path.resolve(__dirname, 'web'),
      clean: true,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/web/index.html',
        favicon: './assets/icons/icon-32x32.png',
      }),
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
    devServer: isProd
      ? undefined
      : {
          port: 8001,
          hot: true,
        },
  };
};
