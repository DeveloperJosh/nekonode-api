// Definition of the IVideo interface
/**
 * @typedef {Object} IVideo
 * @property {string} url - The **MAIN URL** of the video provider that should take you to the video
 * @property {string} [quality] - The quality of the video, should include the `p` suffix
 * @property {boolean} [isM3U8] - Set this to `true` if the video is HLS
 * @property {boolean} [isDASH] - Set this to `true` if the video is DASH
 * @property {number} [size] - Size of the video in **bytes**
 * @property {Object.<string, *>} [extraProperties] - Any other additional properties
 */
