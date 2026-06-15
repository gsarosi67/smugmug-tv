const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = (env, argv) => {
  const isProd = argv.mode === 'production';

  return {
    // Webpack needs an entry point, but smugdata.js and smugvue.js use
    // global variables and CDN-loaded Vue — they can't be bundled as
    // ES modules. Instead, CopyWebpackPlugin copies them unchanged and
    // HtmlWebpackPlugin preserves the original <script> tags.
    entry: path.resolve(__dirname, 'src/entry.js'),

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '_entry.js',  // unused by the app; inject:false keeps it out of HTML
      clean: true,
    },

    devServer: {
      static: path.resolve(__dirname, 'dist'),
      port: 8080,
      open: true,
      hot: false,       // HMR doesn't apply to plain script files
      liveReload: true,
      watchFiles: ['*.js', '*.css', '*.html', 'assets/**'],
    },

    plugins: [
      new HtmlWebpackPlugin({
        template: './index.html',
        filename: 'index.html',
        inject: false,          // keep the existing <script> tags as-is
        minify: isProd ? {
          collapseWhitespace: true,
          removeComments: true,
        } : false,
      }),

      new CopyWebpackPlugin({
        patterns: [
          { from: 'smugdata.js',  to: 'smugdata.js' },
          { from: 'smugvue.js',   to: 'smugvue.js' },
          { from: 'smugvue.css',  to: 'smugvue.css' },
          { from: 'assets',       to: 'assets' },
        ],
      }),
    ],
  };
};
