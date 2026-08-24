const Notification = require("../models/notification.model");
const User = require("../models/user.model");
const Artist = require("../models/artist.model");

class NotificationTriggerService {
  /**
   * Phase 1: Gửi thông báo mua mới / gia hạn gói tài khoản
   */
  async triggerSubscriptionNotification({ userId, action = "purchase", planName = "PREMIUM", subscriptionId = null }) {
    if (!userId) return null;

    const normalizedAction = action === "renewal" ? "renewal" : "purchase";
    const subIdStr = subscriptionId ? subscriptionId.toString() : Date.now().toString();
    const uniqueKey = `subscription_${normalizedAction}_${userId.toString()}_${subIdStr}`;
    const actionUrl = "/client/subscription";

    const title = normalizedAction === "purchase"
      ? "Xác nhận nâng cấp gói thành công"
      : "Thông báo gia hạn gói thành công";

    const content = normalizedAction === "purchase"
      ? `Chúc mừng bạn đã đăng ký thành công gói ${planName} trên MusicFlow!`
      : `Gói tài khoản ${planName} của bạn đã được gia hạn thành công.`;

    try {
      return await Notification.findOneAndUpdate(
        { uniqueKey },
        {
          $set: {
            user: userId,
            title,
            content,
            type: "subscription",
            isRead: false,
            metadata: {
              action: normalizedAction,
              planName,
              subscriptionId: subIdStr,
              actionUrl,
            },
          },
          $setOnInsert: { uniqueKey },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error("Failed to trigger subscription notification:", err.message);
      return null;
    }
  }

  /**
   * Phase 1: Gửi thông báo bài hát mới tới tất cả followers của Artist khi isPublic chuyển false -> true
   */
  async triggerArtistReleaseNotification({ artistId, song, wasPublicBefore = false }) {
    // Chỉ kích hoạt khi bài hát công khai và chuyển từ false -> true (hoặc bài mới isPublic: true)
    if (wasPublicBefore || !song || !song.isPublic || !artistId) {
      return { sentCount: 0 };
    }

    try {
      const followers = await User.find({ followedArtists: artistId }).select("_id").lean();
      if (!followers || followers.length === 0) {
        return { sentCount: 0 };
      }

      let artistName = "Nghệ sĩ";
      if (Array.isArray(song.artists) && song.artists.length > 0 && song.artists[0].name) {
        artistName = song.artists.map((a) => a.name).join(", ");
      } else {
        const artistDoc = await Artist.findById(artistId).select("name").lean();
        if (artistDoc?.name) artistName = artistDoc.name;
      }

      const songIdStr = song._id.toString();
      const actionUrl = `/client/song/${songIdStr}`;

      const bulkOps = followers.map((follower) => {
        const userIdStr = follower._id.toString();
        const uniqueKey = `artist_release_${userIdStr}_${songIdStr}`;

        return {
          updateOne: {
            filter: { uniqueKey },
            update: {
              $setOnInsert: {
                user: follower._id,
                title: `Bài hát mới từ ${artistName}`,
                content: `${artistName} vừa phát hành bài hát mới "${song.title}". Thưởng thức ngay!`,
                type: "artist_release",
                isRead: false,
                uniqueKey,
                metadata: {
                  songId: song._id,
                  artistId,
                  songTitle: song.title,
                  artistName,
                  actionUrl,
                },
              },
            },
            upsert: true,
          },
        };
      });

      const result = await Notification.bulkWrite(bulkOps, { ordered: false });
      return { sentCount: result.upsertedCount || followers.length };
    } catch (err) {
      console.error("Failed to trigger artist release notification:", err.message);
      return { sentCount: 0 };
    }
  }

  /**
   * Phase 1: Gửi thông báo tương tác Bình luận (Reply / Like / Unlike)
   * Tự động chặn self-action (người dùng tự like/reply comment của mình)
   */
  async triggerInteractionNotification({
    recipientUserId,
    actorId,
    commentId,
    songId,
    action = "reply",
    replyCommentId = null,
    actorName = "",
  }) {
    // Chặn tự tương tác (Self-action suppression)
    if (!recipientUserId || !actorId || recipientUserId.toString() === actorId.toString()) {
      return null;
    }

    const commentIdStr = commentId ? commentId.toString() : "";
    const recipientIdStr = recipientUserId.toString();
    const actorIdStr = actorId.toString();

    // Xử lý UNLIKE: Xóa thông báo like tương ứng
    if (action === "unlike") {
      const uniqueKey = `interaction_like_${recipientIdStr}_${actorIdStr}_${commentIdStr}`;
      try {
        await Notification.deleteOne({ uniqueKey });
        return { deleted: true };
      } catch (err) {
        console.error("Failed to remove notification on unlike:", err.message);
        return null;
      }
    }

    let displayActorName = actorName;
    if (!displayActorName) {
      const actorUser = await User.findById(actorId).select("name").lean();
      displayActorName = actorUser?.name || "Một người dùng";
    }

    const actionUrl = songId ? `/client/song/${songId.toString()}?comment=${commentIdStr}` : "/client";

    let uniqueKey = "";
    let title = "";
    let content = "";

    if (action === "like") {
      uniqueKey = `interaction_like_${recipientIdStr}_${actorIdStr}_${commentIdStr}`;
      title = "Tương tác bình luận";
      content = `${displayActorName} đã thích bình luận của bạn.`;
    } else {
      // reply
      const replyIdStr = replyCommentId ? replyCommentId.toString() : Date.now().toString();
      uniqueKey = `interaction_reply_${recipientIdStr}_${actorIdStr}_${commentIdStr}_${replyIdStr}`;
      title = "Phản hồi bình luận";
      content = `${displayActorName} đã trả lời bình luận của bạn.`;
    }

    try {
      return await Notification.findOneAndUpdate(
        { uniqueKey },
        {
          $set: {
            user: recipientUserId,
            title,
            content,
            type: "interaction",
            isRead: false,
            metadata: {
              action: action === "like" ? "like" : "reply",
              commentId,
              songId,
              actorId,
              actorName: displayActorName,
              actionUrl,
            },
          },
          $setOnInsert: { uniqueKey },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error("Failed to trigger interaction notification:", err.message);
      return null;
    }
  }

  /**
   * Phase 2 Helper: Gửi thông báo cột mốc lượt nghe cho Artist
   */
  async triggerMilestoneNotification({ artistId, songId, milestoneCount, songTitle = "" }) {
    if (!artistId || !songId || !milestoneCount) return null;

    const artistIdStr = artistId.toString();
    const songIdStr = songId.toString();
    const uniqueKey = `artist_milestone_${artistIdStr}_${songIdStr}_${milestoneCount}`;
    const actionUrl = `/artist/songs/${songIdStr}`;

    const title = "Cột mốc bài hát mới! 🎉";
    const content = `Chúc mừng! Bài hát "${songTitle || "của bạn"}" đã chính thức đạt mốc ${milestoneCount.toLocaleString()} lượt nghe!`;

    try {
      return await Notification.findOneAndUpdate(
        { uniqueKey },
        {
          $setOnInsert: {
            user: artistId,
            title,
            content,
            type: "artist_milestone",
            isRead: false,
            uniqueKey,
            metadata: {
              songId,
              artistId,
              milestoneCount,
              songTitle,
              actionUrl,
            },
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error("Failed to trigger milestone notification:", err.message);
      return null;
    }
  }

  /**
   * Phase 2 Helper: Nhận sự kiện QUOTA_RESTORED từ aiQuota.service.js và tạo thông báo
   */
  async triggerQuotaRestoredNotification({ userId, previousCount, currentCount, limit, oldestMessageExpiryTimestamp }) {
    if (!userId) return null;

    const expiryStr = oldestMessageExpiryTimestamp ? oldestMessageExpiryTimestamp.toString() : Date.now().toString();
    const uniqueKey = `ai_quota_restored_${userId.toString()}_${expiryStr}`;
    const actionUrl = "/client/ai-dj";

    const title = "🔄 Hạn mức AI DJ đã được làm mới";
    const content = `Hạn mức AI DJ của bạn đã khả dụng trở lại (${limit - currentCount}/${limit} lượt còn lại). Hãy bắt đầu trò chuyện ngay!`;

    try {
      return await Notification.findOneAndUpdate(
        { uniqueKey },
        {
          $setOnInsert: {
            user: userId,
            title,
            content,
            type: "ai_quota_reset",
            isRead: false,
            uniqueKey,
            metadata: {
              remaining: limit - currentCount,
              limit,
              oldestMessageExpiryTimestamp,
              actionUrl,
            },
          },
        },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error("Failed to trigger quota restored notification:", err.message);
      return null;
    }
  }
}

module.exports = new NotificationTriggerService();
