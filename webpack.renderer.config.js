require('./scripts/load-env')('.env.dev');

const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  /** @type {import('webpack').Configuration & { devServer?: import('webpack-dev-server').Configuration }} */
  return {
    mode: isProd ? 'production' : 'development',
    entry: './src/renderer/index.tsx',
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
        '@': path.resolve(__dirname, 'src/renderer'),
        '@shared': path.resolve(__dirname, 'src/shared'),
      },
    },
    output: {
      filename: 'renderer.js',
      path: path.resolve(__dirname, 'dist/renderer'),
      clean: true,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/renderer/index.html',
      }),
      new webpack.DefinePlugin({
        'process.env.CHAM_STORE_URL': JSON.stringify(
          process.env.CHAM_STORE_URL || 'https://cham-download.oss-cn-beijing.aliyuncs.com/store',
        ),
      }),
    ],
    devServer: isProd
      ? undefined
      : {
          port: 9000,
          hot: true,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
        },
    ignoreWarnings: [
      /Critical dependency: the request of a dependency is an expression/,
    ],
  };
};
