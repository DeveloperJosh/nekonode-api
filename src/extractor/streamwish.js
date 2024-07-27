import { load } from 'cheerio';
import axios from 'axios';

const baseUrl = "https://gogoanime3.co";

// random user agent to avoid 403
const userAgent = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Safari/605.1.15",
  "Mozilla/5.0 (iPad; CPU OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (Linux; Android 10; SM-G975F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.149 Mobile Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36",
  "Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) like Gecko",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:68.0) Gecko/20100101 Firefox/68.0",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:55.0) Gecko/20100101 Firefox/55.0",
  "Opera/9.80 (Windows NT 6.0) Presto/2.12.388 Version/12.14",
  "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)"
];

function randomUserAgent() {
  console.log(userAgent[Math.floor(Math.random() * userAgent.length)]);
  return userAgent[Math.floor(Math.random() * userAgent.length)];
}
class StreamWish {
  constructor() {
    this.client = axios.create();
    this.serverName = 'streamwish';
  }

  async extract(videoUrl) {
    try {
      const options = {
        headers: {
          "Referer": videoUrl,
          'User-Agent': randomUserAgent(),
        },
      };
      const { data } = await this.client.get(videoUrl, options);

      const linksMatch = data.match(/file:\s*"([^"]+)"/g);
      if (!linksMatch) {
        throw new Error('No video links found');
      }

      // Extract and clean up links
      const links = linksMatch.map(link => link.replace(/file:\s*"|"$/g, ''));

      const sources = [];
      let lastLink = null;
      for (const link of links) {
        if (link.includes('.jpg') || link.includes('.png')) {
          continue;
        }

        sources.push({
          quality: lastLink ? 'backup' : 'default',
          url: link,
          isM3U8: link.includes('.m3u8'),
        });
        lastLink = link;
      }

      if (sources.some(source => source.isM3U8)) {
        const m3u8Link = sources.find(source => source.isM3U8).url;
        const m3u8Content = await this.client.get(m3u8Link, {
          headers: {
            Referer: videoUrl,
          },
        });

        if (m3u8Content.data.includes('EXTM3U')) {
          const videoList = m3u8Content.data.split('#EXT-X-STREAM-INF:');
          for (const video of videoList) {
            if (video.includes('m3u8')) {
              const url = m3u8Link.split('master.m3u8')[0] + video.split('\n')[1];
              const resolution = video.match(/RESOLUTION=\d+x(\d+)/);
              const quality = resolution ? resolution[1] : 'unknown';

              sources.push({
                url: url,
                quality: `${quality}`,
                isM3U8: url.includes('.m3u8'),
              });
            }
          }
        }
      }

      return sources;
    } catch (err) {
      console.error('Error extracting video:', err.message);
      throw err;
    }
  }

  async getEpisodeSources(episodeID) {
    try {
      const response = await axios.get(`${baseUrl}/${episodeID}`);
      const $ = load(response.data);
      const extractPromises = [];

      $('ul li a[rel="13"]').each((_, element) => {
        const videoUrl = $(element).attr('data-video');
        if (videoUrl) {
          extractPromises.push(this.extract(videoUrl));
        }
      });

      const sourcesArray = await Promise.all(extractPromises);
      const sources = sourcesArray.flat();

      return sources;
    } catch (error) {
      console.error('Error getting episode sources:', error.message);
      throw error;
    }
  }
}

export default StreamWish;
