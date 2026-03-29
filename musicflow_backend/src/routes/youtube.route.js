const express = require('express');
const axios = require('axios');
const router = express.Router();

// Helper: Parse YouTube videoId from URL
function extractVideoId(url) {
  if (!url) return null;
  // Standard: https://www.youtube.com/watch?v=VIDEOID
  const match = url.match(/[?&]v=([\w-]{11})/);
  if (match) return match[1];
  // Short: https://youtu.be/VIDEOID
  const short = url.match(/youtu\.be\/([\w-]{11})/);
  if (short) return short[1];
  // Embed: https://www.youtube.com/embed/VIDEOID
  const embed = url.match(/embed\/([\w-]{11})/);
  if (embed) return embed[1];
  return null;
}

// Helper: Convert ISO 8601 duration to seconds
function iso8601ToSeconds(iso) {
  if (!iso) return 0;
  const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
  const [, h, m, s] = iso.match(regex) || [];
  return (parseInt(h || 0) * 3600) + (parseInt(m || 0) * 60) + parseInt(s || 0);
}

// GET /api/youtube-duration?url=
router.get('/youtube-duration', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  const videoId = extractVideoId(url);
  if (!videoId) return res.status(400).json({ error: 'Invalid YouTube URL' });

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'YouTube API key not configured' });
    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=contentDetails&key=${apiKey}`;
    const ytRes = await axios.get(apiUrl);
    const items = ytRes.data.items;
    if (!items || !items.length) return res.status(404).json({ error: 'Video not found' });
    const isoDuration = items[0].contentDetails.duration;
    const duration = iso8601ToSeconds(isoDuration);
    return res.json({ duration });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch duration', details: err.message });
  }
});

module.exports = router;
