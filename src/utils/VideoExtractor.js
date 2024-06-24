import axios from 'axios';

class VideoExtractor {
  constructor() {
    this.client = axios.create(); // No proxy setup, just a basic axios instance
  }

  // Abstract method placeholders
  async extract(videoUrl) {
    throw new Error('Method "extract" should be implemented in subclasses');
  }
}

export default VideoExtractor;
