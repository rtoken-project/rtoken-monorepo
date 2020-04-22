const path = require('path');

module.exports = {
  mode: 'development',
  entry: './src/rtoken-analytics.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'rtoken-analytics.js',
    library: 'rtoken-analytics',
    libraryTarget: 'umd',
    umdNamedDefine: true,
    globalObject: 'this',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env'],
            },
          },
        ],
      },
    ],
  },
};
