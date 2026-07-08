const path = require('path');
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
    },
    output: {
      filename: 'assets/bundle.[contenthash:8].js',
      path: path.resolve(__dirname, 'web'),
      clean: true,
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/web/index.html',
        favicon: './assets/icon-32x32.png',
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
