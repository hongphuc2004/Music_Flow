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
      required: true,
      minlength: 6,
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
  },
  {
    timestamps: true,
  }
);

// Hash password trước khi save
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method so sánh password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Loại bỏ password khi trả về JSON
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model("User", userSchema);
