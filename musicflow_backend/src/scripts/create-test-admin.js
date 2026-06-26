const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");
const User = require("../models/user.model");

dotenv.config({ path: path.resolve(__dirname, "../..", ".env.dev") });

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Check if admin already exists
  const existing = await User.findOne({ email: "admin@musicflow.com" });
  if (existing) {
    existing.password = "admin123";
    existing.role = "admin";
    existing.provider = "local";
    await existing.save();
    console.log("Updated existing test admin.");
  } else {
    const admin = new User({
      name: "Test Admin",
      email: "admin@musicflow.com",
      password: "admin123",
      role: "admin",
      provider: "local",
    });
    await admin.save();
    console.log("Created new test admin user.");
  }

  await mongoose.disconnect();
}
run().catch(console.error);
