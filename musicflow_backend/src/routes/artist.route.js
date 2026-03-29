const express = require("express");
const router = express.Router();
const artistController = require("../controllers/artist.controller");

// Đăng ký artist
router.post("/register", artistController.register);
// Đăng nhập artist
router.post("/login", artistController.login);

module.exports = router;
