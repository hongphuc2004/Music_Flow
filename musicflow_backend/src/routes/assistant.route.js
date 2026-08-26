const express = require("express");
const router = express.Router();
const assistantController = require("../controllers/assistant.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.use(authMiddleware);

router.post("/messages", assistantController.sendMessage);
router.get("/quota", assistantController.getQuota);
router.get("/conversations", assistantController.getConversations);

router.get("/conversations/:id", assistantController.getConversationDetail);
router.delete("/conversations/:id", assistantController.deleteConversation);
router.post("/actions/:actionId/confirm", assistantController.confirmAction);

module.exports = router;
