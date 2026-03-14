const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/auth.middleware");
const commentController = require("../controllers/comment.controller");

router.get("/song/:songId", commentController.getSongComments);

router.post("/", authMiddleware, commentController.createComment);
router.put("/:commentId", authMiddleware, commentController.updateComment);
router.delete("/:commentId", authMiddleware, commentController.deleteComment);

router.put("/:commentId/reactions", authMiddleware, commentController.reactToComment);
router.delete(
  "/:commentId/reactions",
  authMiddleware,
  commentController.removeReaction
);

module.exports = router;