const path = require('node:path')
const { FuseV1Options, FuseVersion } = require('@electron/fuses')
const { FusesPlugin } = require('@electron-forge/plugin-fuses')

module.exports = {
  packagerConfig: {
    asar: true,
    executableName: 'WordsOfYeshua',
    extraResource: [path.join(__dirname, 'native', 'build', 'Release', 'words_of_yeshua_native.node')],
    ignore: [
      /^\/data($|\/)/,
      /^\/native($|\/)/,
      /^\/src($|\/)/,
      /^\/public($|\/)/,
      /^\/\.git($|\/)/,
      /^\/out($|\/)/,
      /^\/coverage($|\/)/,
    ],
  },
  rebuildConfig: {},
  makers: [
    { name: '@electron-forge/maker-squirrel', config: { name: 'WordsOfYeshua' } },
    { name: '@electron-forge/maker-zip', platforms: ['win32'] },
  ],
  plugins: [
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    }),
  ],
}
