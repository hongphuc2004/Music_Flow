const mongoose = require("mongoose");
const path = require("path");
const dotenv = require("dotenv");

const MoodConversation = require("../models/mood-conversation.model");
const MoodMessage = require("../models/mood-message.model");
const MoodPlaylist = require("../models/mood-playlist.model");

const AssistantConversation = require("../models/assistant-conversation.model");
const AssistantMessage = require("../models/assistant-message.model");
const User = require("../models/user.model");

dotenv.config({ path: path.resolve(__dirname, "../..", ".env.dev") });

async function run() {
  if (!process.env.MONGO_URI) {
    throw new Error("Missing MONGO_URI in environment config.");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  const legacyConversations = await MoodConversation.find({});
  console.log(`Found ${legacyConversations.length} legacy mood conversations.`);

  let migratedConvs = 0;
  let migratedMsgs = 0;
  let updatedPlaylists = 0;

  for (const legacyConv of legacyConversations) {
    let newConv = await AssistantConversation.findOne({
      legacyConversationId: legacyConv._id.toString(),
    });

    const user = await User.findById(legacyConv.userId);
    if (!user) {
      console.warn(`User ${legacyConv.userId} not found for conversation ${legacyConv._id}. Skipping.`);
      continue;
    }

    if (!newConv) {
      newConv = await AssistantConversation.create({
        actorId: legacyConv.userId,
        actorType: "User",
        actorRole: user.role || "user",
        scope: "mood",
        title: legacyConv.title || "Mood Music",
        lastMessage: legacyConv.lastMessage || "",
        contextSummary: `migrated_from_mood_conversation:${legacyConv._id}`,
        legacyConversationId: legacyConv._id.toString(),
        createdAt: legacyConv.createdAt,
        updatedAt: legacyConv.updatedAt,
      });
      migratedConvs++;
    }

    const legacyMessages = await MoodMessage.find({ conversationId: legacyConv._id });
    for (const legacyMsg of legacyMessages) {
      const exists = await AssistantMessage.findOne({
        conversationId: newConv._id,
        content: legacyMsg.content,
        role: legacyMsg.role === "assistant" ? "model" : "user",
        createdAt: legacyMsg.createdAt,
      });

      if (!exists) {
        await AssistantMessage.create({
          conversationId: newConv._id,
          role: legacyMsg.role === "assistant" ? "model" : "user",
          content: legacyMsg.content,
          metadata: legacyMsg.metadata || {},
          createdAt: legacyMsg.createdAt,
          updatedAt: legacyMsg.updatedAt,
        });
        migratedMsgs++;
      }
    }

    const playlistsResult = await MoodPlaylist.updateMany(
      { conversationId: legacyConv._id },
      { $set: { conversationId: newConv._id } }
    );
    updatedPlaylists += playlistsResult.modifiedCount;
  }

  console.log(`Migration completed successfully!`);
  console.log(`- Migrated Conversations: ${migratedConvs}`);
  console.log(`- Migrated Messages: ${migratedMsgs}`);
  console.log(`- Updated Playlists: ${updatedPlaylists}`);

  await mongoose.disconnect();
}

run().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
