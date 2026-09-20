module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Asset/audio build scripts: plain Node, allowed to use bitwise math.
      files: ['tools/**/*.js'],
      env: {node: true},
      rules: {
        'no-bitwise': 'off',
      },
    },
  ],
};
