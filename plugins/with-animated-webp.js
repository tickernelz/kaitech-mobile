const { withGradleProperties } = require('expo/config-plugins');

const key = 'expo.webp.animated';

module.exports = function withAnimatedWebp(config) {
  return withGradleProperties(config, (current) => {
    current.modResults = current.modResults.filter((item) => item.type !== 'property' || item.key !== key);
    current.modResults.push({ type: 'property', key, value: 'true' });
    return current;
  });
};
