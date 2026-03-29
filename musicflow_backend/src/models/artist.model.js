const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const artistSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
);

// Hash password trước khi save
artistSchema.pre("save", async function () {
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

module.exports = mongoose.model("Artist", artistSchema);
