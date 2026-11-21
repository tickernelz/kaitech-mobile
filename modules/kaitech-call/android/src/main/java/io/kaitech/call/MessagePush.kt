package io.kaitech.call

data class MessagePush(
  val db: String,
  val uid: Int,
  val channelId: Int,
  val channelType: String,
  val channelName: String,
  val senderId: Int,
  val senderName: String,
  val agent: Boolean,
  val messageId: Int,
  val ts: Long,
  val kind: String,
  val duration: Int,
  val fileName: String,
  val body: String,
  val mention: Boolean,
  val muted: Boolean,
) {
  val key: String get() = MessageKey.of(db, uid, channelId)

  companion object {
    const val MESSAGE = "MESSAGE"
    const val READ = "READ"

    fun from(data: Map<String, String>): MessagePush? {
      val target = MessageKey.from(data) ?: return null
      return MessagePush(
        db = target.db,
        uid = target.uid,
        channelId = target.channelId,
        channelType = data["channel_type"].orEmpty().ifBlank { "channel" },
        channelName = data["channel_name"].orEmpty(),
        senderId = data["sender_id"]?.toIntOrNull() ?: 0,
        senderName = data["sender_name"].orEmpty(),
        agent = data["sender_agent"] == "1",
        messageId = data["message_id"]?.toIntOrNull() ?: 0,
        ts = data["ts"]?.toLongOrNull() ?: System.currentTimeMillis(),
        kind = data["msg_type"].orEmpty().ifBlank { "text" },
        duration = data["duration"]?.toIntOrNull() ?: 0,
        fileName = data["file_name"].orEmpty(),
        body = data["body"] ?: data["text"].orEmpty(),
        mention = data["mention"] == "1",
        muted = data["muted"] == "1",
      )
    }
  }
}

data class MessageKey(val db: String, val uid: Int, val channelId: Int) {
  val value: String get() = of(db, uid, channelId)
  val account: String get() = account(db, uid)

  companion object {
    fun of(db: String, uid: Int, channelId: Int) = "${account(db, uid)}:$channelId"

    fun account(db: String, uid: Int) = "$db:$uid"

    fun from(data: Map<String, String>): MessageKey? {
      if (data["model"] != "discuss.channel") return null
      val channelId = data["res_id"]?.toIntOrNull() ?: return null
      val uid = data["uid"]?.toIntOrNull() ?: return null
      val db = data["db"].orEmpty()
      if (channelId <= 0 || uid <= 0 || db.isEmpty()) return null
      return MessageKey(db, uid, channelId)
    }

    fun parse(value: String): MessageKey? {
      val channelAt = value.lastIndexOf(':')
      if (channelAt <= 0) return null
      val uidAt = value.lastIndexOf(':', channelAt - 1)
      if (uidAt <= 0) return null
      val uid = value.substring(uidAt + 1, channelAt).toIntOrNull() ?: return null
      val channelId = value.substring(channelAt + 1).toIntOrNull() ?: return null
      return MessageKey(value.substring(0, uidAt), uid, channelId)
    }
  }
}
