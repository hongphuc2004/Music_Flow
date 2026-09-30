const express = require("express");
const router = express.Router();
const aiController = require("../controllers/ai.controller");
const ttsController = require("../controllers/tts.controller");
const authMiddleware = require("../middleware/auth.middleware");

// Public TTS endpoint for streaming Vietnamese audio responses
router.get("/tts", ttsController.synthesizeSpeech);
router.post("/tts", ttsController.synthesizeSpeech);

router.post("/playlist", authMiddleware, aiController.aiPlaylist);
router.get("/mood/history", authMiddleware, aiController.getMoodHistory);
router.get("/mood/conversations/:conversationId", authMiddleware, aiController.getMoodConversation);
router.delete("/mood/conversations/:conversationId", authMiddleware, aiController.deleteMoodConversation);

module.exports = router;
