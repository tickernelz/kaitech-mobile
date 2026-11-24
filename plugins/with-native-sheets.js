const { withPodfile } = require('expo/config-plugins');

const flag = "ENV['RNS_GAMMA_ENABLED'] = '1'";

module.exports = function withNativeSheets(config) {
  return withPodfile(config, (current) => {
    if (!current.modResults.contents.includes(flag)) current.modResults.contents = `${flag}\n${current.modResults.contents}`;
    return current;
  });
};
