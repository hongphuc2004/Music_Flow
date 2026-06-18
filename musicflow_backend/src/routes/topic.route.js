const express = require("express");
const router = express.Router();
const Topic = require("../models/topic.model");
const Song = require("../models/song.model");

const TOPIC_SONG_SELECT =
  "title artists topicIds uploadedBy isPublic audioUrl duration imageUrl source allowDownload playCount likeCount createdAt";

const parsePagination = (query) => {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 50);
  return { page, limit, skip: (page - 1) * limit };
};

// =================================================
// 📌 GET ALL TOPICS
router.get("/", async (req, res) => {
  try {
    const topics = await Topic.find().sort({ name: 1 });
    res.json(topics);
  } catch (error) {
    console.error("Get topics error:", error);
    res.status(500).json({ message: "Get topics failed", error: error.message });
  }
});

// =================================================
// 📌 GET SONGS BY TOPIC ID
router.get("/:topicId/songs", async (req, res) => {
  try {
    const { topicId } = req.params;
    const { page, limit, skip } = parsePagination(req.query);
    const filter = {
      topicIds: topicId,
      isPublic: true,
    };
    const [songs, total] = await Promise.all([
      Song.find(filter)
        .select(TOPIC_SONG_SELECT)
        .populate("artists", "name avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Song.countDocuments(filter),
    ]);

    res.set({
      "X-Total-Count": String(total),
      "X-Page": String(page),
      "X-Limit": String(limit),
      "X-Total-Pages": String(Math.ceil(total / limit)),
    });
    res.json(songs);
  } catch (error) {
    console.error("Get songs by topic error:", error);
    res.status(500).json({ message: "Get songs failed", error: error.message });
  }
});

// =================================================
// 📌 CREATE TOPIC
router.post("/", async (req, res) => {
  try {
    const { name, description, avatar } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Topic name is required" });
    }

    const topic = await Topic.create({
      name,
      description,
      avatar,
    });

    res.status(201).json({
      message: "Topic created successfully",
      topic,
    });
  } catch (error) {
    console.error("Create topic error:", error);
    res.status(500).json({ message: "Create topic failed", error: error.message });
  }
});

// =================================================
// 📌 UPDATE TOPIC
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, avatar } = req.body;

    const topic = await Topic.findByIdAndUpdate(
      id,
      { name, description, avatar },
      { new: true }
    );

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json({
      message: "Topic updated successfully",
      topic,
    });
  } catch (error) {
    console.error("Update topic error:", error);
    res.status(500).json({ message: "Update topic failed", error: error.message });
  }
});

// =================================================
// 📌 DELETE TOPIC
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await Topic.findByIdAndDelete(id);

    if (!topic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json({ message: "Topic deleted successfully" });
  } catch (error) {
    console.error("Delete topic error:", error);
    res.status(500).json({ message: "Delete topic failed", error: error.message });
  }
});

module.exports = router;
