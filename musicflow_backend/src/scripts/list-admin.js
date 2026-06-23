const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../..", ".env.dev") });

const userSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
});
const User = mongoose.model("User", userSchema);

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");
  const users = await User.find({ role: "admin" });
  console.log("Admins:");
  console.log(users);
  await mongoose.disconnect();
}
run();
