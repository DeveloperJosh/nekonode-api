import crypto from "crypto";
import { VideoExtractor } from '../utils/VideoExtractor.js';

export const megacloud = {
  script: "https://megacloud.tv/js/player/a/prod/e1-player.min.js?v=",
  sources: "https://megacloud.tv/embed-2/ajax/e-1/getSources?id=",
};

/**
 * @typedef {Object} Track
 * @property {string} file - The file URL
 * @property {string} kind - The kind of track (e.g., "subtitles")
 * @property {string} [label] - The label of the track
 * @property {boolean} [default] - If the track is default
 */

/**
 * @typedef {Object} UnencryptSource
 * @property {string} file - The file URL
 * @property {string} type - The type of the source (e.g., "video/mp4")
 */

/**
 * @typedef {Object} IntroOutro
 * Define the properties of Intro and Outro here
 */

/**
 * @typedef {Object} ApiFormat
 * @property {string|UnencryptSource[]} sources - The sources of the video
 * @property {Track[]} tracks - The tracks of the video
 * @property {boolean} encrypted - If the video is encrypted
 * @property {IntroOutro} intro - The intro of the video
 * @property {IntroOutro} outro - The outro of the video
 * @property {number} server - The server number
 */

class MegaCloud extends VideoExtractor {

  serverName = 'MegaCloud';
  sources = [];

  async extract(videoUrl) {
    try {
      const result = {
        sources: [],
        subtitles: [],
        intro: {}, 
        outro: {} 
      };

      const videoId = videoUrl?.href?.split("/")?.pop()?.split("?")[0];
      const { data: srcsData } = this.client.get(
        megacloud.sources.concat(videoId || ""),
        {
          headers: {
            Accept: "*/*",
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            Referer: videoUrl.href,
          },
        }
      );
      if (!srcsData) {
        throw new Error("Url may have an invalid video id");
      }

      const encryptedString = srcsData.sources;
      if (!srcsData.encrypted && Array.isArray(encryptedString)) {
        result.intro = srcsData.intro;
        result.outro = srcsData.outro;
        result.subtitles = srcsData.tracks.map((s) => ({
          url: s.file,
          lang: s.label ? s.label : 'Thumbnails',
        }));
        result.sources = encryptedString.map((s) => ({
          url: s.file,
          type: s.type,
          isM3U8: s.file.includes('.m3u8'),
        }));
        return result;
      }

      const { data } = await this.client.get(
        megacloud.script.concat(Date.now().toString())
      );

      const text = data;
      if (!text)
        throw new Error("Couldn't fetch script to decrypt resource");

      const vars = this.extractVariables(text);
      const { secret, encryptedSource } = this.getSecret(
        encryptedString,
        vars
      );
      const decrypted = this.decrypt(encryptedSource, secret);
      try {
        const sources = JSON.parse(decrypted);
        result.intro = srcsData.intro;
        result.outro = srcsData.outro;
        result.subtitles = srcsData.tracks.map((s) => ({
          url: s.file,
          lang: s.label ? s.label : 'Thumbnails',
        }));
        result.sources = sources.map((s) => ({
          url: s.file,
          type: s.type,
          isM3U8: s.file.includes('.m3u8'),
        }));

        return result;
      } catch (error) {
        throw new Error("Failed to decrypt resource");
      }
    } catch (err) {
      throw err;
    }
  }

  extractVariables(text) {
    const regex =
      /case\s*0x[0-9a-f]+:(?![^;]*=partKey)\s*\w+\s*=\s*(\w+)\s*,\s*\w+\s*=\s*(\w+);/g;
    const matches = text.matchAll(regex);
    const vars = Array.from(matches, (match) => {
      const matchKey1 = this.matchingKey(match[1], text);
      const matchKey2 = this.matchingKey(match[2], text);
      try {
        return [parseInt(matchKey1, 16), parseInt(matchKey2, 16)];
      } catch (e) {
        return [];
      }
    }).filter((pair) => pair.length > 0);

    return vars;
  }

  getSecret(encryptedString, values) {
    let secret = "",
      encryptedSource = "",
      encryptedSourceArray = encryptedString.split(""),
      currentIndex = 0;

    for (const index of values) {
      const start = index[0] + currentIndex;
      const end = start + index[1];

      for (let i = start; i < end; i++) {
        secret += encryptedString[i];
        encryptedSourceArray[i] = "";
      }
      currentIndex += index[1];
    }

    encryptedSource = encryptedSourceArray.join("");

    return { secret, encryptedSource };
  }

  decrypt(encrypted, keyOrSecret, maybe_iv) {
    let key;
    let iv;
    let contents;
    if (maybe_iv) {
      key = keyOrSecret;
      iv = maybe_iv;
      contents = encrypted;
    } else {
      const cypher = Buffer.from(encrypted, "base64");
      const salt = cypher.subarray(8, 16);
      const password = Buffer.concat([
        Buffer.from(keyOrSecret, "binary"),
        salt,
      ]);
      const md5Hashes = [];
      let digest = password;
      for (let i = 0; i < 3; i++) {
        md5Hashes[i] = crypto.createHash("md5").update(digest).digest();
        digest = Buffer.concat([md5Hashes[i], password]);
      }
      key = Buffer.concat([md5Hashes[0], md5Hashes[1]]);
      iv = md5Hashes[2];
      contents = cypher.subarray(16);
    }

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    const decrypted =
      decipher.update(
        contents,
        typeof contents === "string" ? "base64" : undefined,
        "utf8"
      ) + decipher.final();

    return decrypted;
  }

  matchingKey(value, script) {
    const regex = new RegExp(`,${value}=((?:0x)?([0-9a-fA-F]+))`);
    const match = script.match(regex);
    if (match) {
      return match[1].replace(/^0x/, "");
    } else {
      throw new Error("Failed to match the key");
    }
  }
  
}

export default MegaCloud;