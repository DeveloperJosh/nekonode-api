import { VideoExtractor } from '../utils/VideoExtractor.js';

class StreamSB extends VideoExtractor {
  serverName = 'streamsb';
  sources = [];

  host = 'https://streamsss.net/sources50';
  host2 = 'https://watchsb.com/sources50';

   PAYLOAD = (hex) =>
    `566d337678566f743674494a7c7c${hex}7c7c346b6767586d6934774855537c7c73747265616d7362/6565417268755339773461447c7c346133383438333436313335376136323337373433383634376337633465366534393338373136643732373736343735373237613763376334363733353737303533366236333463353333363534366137633763373337343732363536313664373336327c7c6b586c3163614468645a47617c7c73747265616d7362`;

  async extract(videoUrl, isAlt = false){ 
    let headers = {
      watchsb: 'sbstream',
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/",
      Referer: videoUrl.href,
    };
    let id = videoUrl.href.split('/e/').pop();
    if (id?.includes('html')) id = id.split('.html')[0];
    const bytes = new TextEncoder().encode(id);

    const res = await this.client
      .get(`${isAlt ? this.host2 : this.host}/${this.PAYLOAD(Buffer.from(bytes).toString('hex'))}`, {
        headers,
      })
      .catch(() => null);

    if (!res?.data?.stream_data) throw new Error('No source found. Try a different server.');

    headers = {
      'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/",
      Referer: videoUrl.href.split('e/')[0],
    };
    const m3u8Urls = await this.client.get(res.data.stream_data.file, {
      headers,
    });

    const videoList = m3u8Urls.data.split('#EXT-X-STREAM-INF:');

    for (const video of videoList ?? []) {
      if (!video.includes('m3u8')) continue;

      const url = video.split('\n')[1];
      const quality = video.split('RESOLUTION=')[1].split(',')[0].split('x')[1];

      this.sources.push({
        url: url,
        quality: `${quality}p`,
        isM3U8: true,
      });
    }

    this.sources.push({
      quality: 'auto',
      url: res.data.stream_data.file,
      isM3U8: res.data.stream_data.file.includes('.m3u8'),
    });

    return this.sources;
  }

 addSources(source) {
    this.sources.push({
      url: source.file,
      isM3U8: source.file.includes('.m3u8'),
    });
  }
}

export default StreamSB;