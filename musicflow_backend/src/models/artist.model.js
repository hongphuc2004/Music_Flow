const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const artistSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      index: true,
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
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    provider: {
      type: String,
      enum: ["local", "google"],
      default: "local",
    },
    avatar: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["artist"],
      default: "artist",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isPro: {
      type: Boolean,
      default: false,
      index: true,
    },
    proPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },
    proExpiry: {
      type: Date,
      default: null,
    },
    followersCount: {
      type: Number,
      default: 0,
    },
    monthlyListeners: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Auto-slug & Hash password trước khi save
artistSchema.pre("save", async function () {
  if (!this.slug || this.isModified("name")) {
    const noAccents = String(this.name || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[đĐ]/g, (m) => (m === "Đ" ? "D" : "d"))
      .trim();
    const words = noAccents.split(/[\s._-]+/).filter(Boolean);
    if (words.length) {
      this.slug = words
        .map((w) => (w === w.toUpperCase() && w.length > 1 ? w : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
        .join("-")
        .replace(/[^a-zA-Z0-9-]/g, "");
    }
  }
  if (!this.password || !this.isModified("password")) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// So sánh password
artistSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Loại bỏ password khi trả về JSON
artistSchema.methods.toJSON = function () {
  const artist = this.toObject();
  delete artist.password;
  return artist;
};

artistSchema.index({ monthlyListeners: -1 });
artistSchema.index({ followersCount: -1 });

module.exports = mongoose.model("Artist", artistSchema);
