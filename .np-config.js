// https://github.com/sindresorhus/np/issues/398
module.exports = {
  // Avoids `np` trying to set 2FA again and again
  // after publishing to NPM
  exists: true,
}
