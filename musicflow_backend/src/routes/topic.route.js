const express = require("express");
const router = express.Router();
const Topic = require("../models/topic.model");
const Song = require("../models/song.model");

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
    const songs = await Song.find({ topicId }).sort({ createdAt: -1 });
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
    const { name, description, imageUrl, color } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Topic name is required" });
    }

    const topic = await Topic.create({
      name,
      description,
      imageUrl,
      color,
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
    const { name, description, imageUrl, color } = req.body;

    const topic = await Topic.findByIdAndUpdate(
      id,
      { name, description, imageUrl, color },
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
