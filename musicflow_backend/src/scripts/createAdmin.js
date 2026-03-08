/**
 * Script tạo admin account
 * Chạy: node src/scripts/createAdmin.js
 */
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const readline = require("readline");

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// User Schema (copy từ model để script có thể chạy độc lập)
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, minlength: 6 },
    googleId: { type: String, unique: true, sparse: true },
    provider: { type: String, enum: ["local", "google"], default: "local" },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    avatar: { type: String, default: "" },
    favoriteSongs: [{ type: mongoose.Schema.Types.ObjectId, ref: "Song" }],
    playlists: [{ type: mongoose.Schema.Types.ObjectId, ref: "Playlist" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (!this.password || !this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model("User", userSchema);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve));

const main = async () => {
  await connectDB();

  console.log("\n====== CREATE ADMIN ACCOUNT ======\n");
  console.log("Options:");
  console.log("1. Create new admin account");
  console.log("2. Upgrade existing user to admin");
  console.log("3. List all admins");
  console.log("4. Exit\n");

  const choice = await question("Select option (1-4): ");

  switch (choice) {
    case "1":
      await createNewAdmin();
      break;
    case "2":
      await upgradeToAdmin();
      break;
    case "3":
      await listAdmins();
      break;
    case "4":
      console.log("Goodbye!");
      break;
    default:
      console.log("Invalid option");
  }

  rl.close();
  await mongoose.connection.close();
  process.exit(0);
};

const createNewAdmin = async () => {
  const name = await question("Admin name: ");
  const email = await question("Admin email: ");
  const password = await question("Admin password (min 6 chars): ");

  if (password.length < 6) {
    console.log("Password must be at least 6 characters!");
    return;
  }

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log("Email already exists!");
      return;
    }

    const admin = new User({
      name,
      email,
      password,
      role: "admin",
      provider: "local",
    });

    await admin.save();
    console.log(`\n✅ Admin created successfully!`);
    console.log(`Email: ${email}`);
    console.log(`Role: admin`);
  } catch (error) {
    console.error("Error creating admin:", error.message);
  }
};

const upgradeToAdmin = async () => {
  const email = await question("Enter user email to upgrade: ");

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("User not found!");
      return;
    }

    if (user.role === "admin") {
      console.log("User is already an admin!");
      return;
    }

    user.role = "admin";
    await user.save();
    console.log(`\n✅ User "${user.name}" upgraded to admin!`);
  } catch (error) {
    console.error("Error upgrading user:", error.message);
  }
};

const listAdmins = async () => {
  try {
    const admins = await User.find({ role: "admin" }).select("name email createdAt");
    
    if (admins.length === 0) {
      console.log("\nNo admin accounts found.");
      return;
    }

    console.log("\n=== Admin Accounts ===");
    admins.forEach((admin, index) => {
      console.log(`${index + 1}. ${admin.name} (${admin.email})`);
    });
  } catch (error) {
    console.error("Error listing admins:", error.message);
  }
};

main();
