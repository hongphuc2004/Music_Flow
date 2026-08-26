const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: 6,
      // Password không bắt buộc cho Google login
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true, // Cho phép nhiều null values
    },
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    avatar: {
      type: String,
      default: "",
    },
    favoriteSongs: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Song",
    }],
    playlists: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Playlist",
    }],
    followedArtists: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Artist",
    }],
    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },
    premiumExpiry: {
      type: Date,
      default: null,
    },
    premiumPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },
    aiMemory: {
      topMoods: { type: [String], default: [] },
      topThemes: { type: [String], default: [] },
      preferredEnergy: { type: String, enum: ["low", "medium", "high", "mixed"], default: "mixed" },
      timeSlotPreferences: {
        morning: { moods: { type: [String], default: [] }, energy: { type: String, default: "mixed" } },
        afternoon: { moods: { type: [String], default: [] }, energy: { type: String, default: "mixed" } },
        evening: { moods: { type: [String], default: [] }, energy: { type: String, default: "mixed" } },
        night: { moods: { type: [String], default: [] }, energy: { type: String, default: "mixed" } },
      },
      lastCalculatedAt: { type: Date, default: null },
    },
    customAiLimit: {
      type: Number,
      default: null,
    },
    bonusAiQuota: {
      type: Number,
      default: 0,
    },
  },


  {
    timestamps: true,
  }
);

// Hash password trước khi save
userSchema.pre("save", async function () {
  if (!this.password || !this.isModified("password")) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method so sánh password
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Loại bỏ password khi trả về JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model("User", userSchema);
