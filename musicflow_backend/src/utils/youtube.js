const axios = require('axios');

function extractVideoId(url) {
  if (!url) return null;
  const match = url.match(/[?&]v=([\w-]{11})/);
  if (match) return match[1];
  const short = url.match(/youtu\.be\/([\w-]{11})/);
  if (short) return short[1];
  const embed = url.match(/embed\/([\w-]{11})/);
  if (embed) return embed[1];
  return null;
}

function iso8601ToSeconds(iso) {
  if (!iso) return 0;
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const [, h, m, s] = iso.match(regex) || [];
  return (parseInt(h || 0) * 3600) + (parseInt(m || 0) * 60) + parseInt(s || 0);
}

async function getYoutubeDurationSeconds(url) {
  const videoId = extractVideoId(url);
  if (!videoId) return null;
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not set');
  const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${apiKey}`;
  const ytRes = await axios.get(apiUrl);
  const items = ytRes.data.items;
  if (!items || !items.length) return null;
  const isoDuration = items[0].contentDetails.duration;
  return iso8601ToSeconds(isoDuration);
}

module.exports = { extractVideoId, getYoutubeDurationSeconds };
