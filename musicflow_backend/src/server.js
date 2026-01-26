const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const uploadRoute = require("./routes/upload.route");
const songRoute = require("./routes/song.route");

const app = express();

app.use(cors());
app.use(express.json());

// routes
app.use("/api/upload", uploadRoute);
app.use("/api/songs", songRoute);

// connect DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error(err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
