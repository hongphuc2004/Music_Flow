const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const uploadRoute = require("./routes/upload.route");
const songRoute = require("./routes/song.route");
const authRoute = require("./routes/auth.route");
const topicRoute = require("./routes/topic.route");

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/upload", uploadRoute);
app.use("/api/songs", songRoute);
app.use("/api/auth", authRoute);
app.use("/api/topics", topicRoute);

// connect DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
