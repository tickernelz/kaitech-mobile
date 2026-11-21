package io.kaitech.call

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject

object MessageStore {
  private const val NAME = "kaitech_messages"
  private const val THREAD = "t."
  private const val MUTE = "m."
  private const val LIMIT = 8

  @Volatile
  var openKeys: Set<String> = emptySet()

  @Volatile
  var bubbleKey: String? = null

  data class Line(
    val id: Int,
    val sender: String,
    val senderId: Int,
    val agent: Boolean,
    val text: String,
    val ts: Long,
    val mine: Boolean = false,
    val sendKey: String = "",
    val failed: Boolean = false,
  )

  data class Thread(val title: String, val type: String, val lines: List<Line>) {
    val lastMessageId: Int get() = lines.filter { !it.mine }.maxOfOrNull { it.id } ?: 0
    val failedLine: Line? get() = lines.lastOrNull { it.mine && it.failed }
  }

  private fun prefs(context: Context): SharedPreferences = context.getSharedPreferences(NAME, Context.MODE_PRIVATE)

  fun hidden(context: Context) = prefs(context).getBoolean("hidden", false)

  fun setHidden(context: Context, value: Boolean) {
    prefs(context).edit().putBoolean("hidden", value).apply()
  }

  fun language(context: Context): String? = prefs(context).getString("language", null)

  fun setLanguage(context: Context, value: String) {
    prefs(context).edit().putString("language", value).apply()
  }

  fun mutedUntil(context: Context, key: String): Long = prefs(context).getLong(MUTE + key, 0L)

  fun setMuted(context: Context, account: String, until: Map<Int, Long>) {
    val store = prefs(context)
    val editor = store.edit()
    store.all.keys.filter { it.startsWith("$MUTE$account:") }.forEach { editor.remove(it) }
    until.forEach { (channelId, at) -> editor.putLong("$MUTE$account:$channelId", at) }
    editor.apply()
  }

  fun keys(context: Context): List<String> = prefs(context).all.keys.filter { it.startsWith(THREAD) }.map { it.removePrefix(THREAD) }

  fun thread(context: Context, key: String): Thread? {
    val raw = prefs(context).getString(THREAD + key, null) ?: return null
    return try {
      decode(JSONObject(raw))
    } catch (error: org.json.JSONException) {
      null
    }
  }

  @Synchronized
  fun append(context: Context, key: String, title: String, type: String, line: Line): Thread? {
    val current = thread(context, key)
    if (!line.mine && line.id > 0 && current?.lines?.any { !it.mine && it.id == line.id } == true) return null
    val lines = ((current?.lines ?: emptyList()) + line).takeLast(LIMIT)
    val next = Thread(title.ifBlank { current?.title.orEmpty() }, type.ifBlank { current?.type ?: "channel" }, lines)
    save(context, key, next)
    return next
  }

  @Synchronized
  fun settle(context: Context, key: String, sendKey: String, failed: Boolean): Thread? {
    val current = thread(context, key) ?: return null
    if (current.lines.none { it.sendKey == sendKey }) return null
    val next = current.copy(lines = current.lines.map { if (it.sendKey == sendKey) it.copy(failed = failed) else it })
    save(context, key, next)
    return next
  }

  @Synchronized
  fun clear(context: Context, key: String) {
    prefs(context).edit().remove(THREAD + key).apply()
  }

  @Synchronized
  fun clearAccount(context: Context, account: String) {
    val store = prefs(context)
    val editor = store.edit()
    store.all.keys.filter { it.startsWith("$THREAD$account:") || it.startsWith("$MUTE$account:") }.forEach { editor.remove(it) }
    editor.apply()
  }

  private fun save(context: Context, key: String, thread: Thread) {
    prefs(context).edit().putString(THREAD + key, encode(thread).toString()).apply()
  }

  private fun encode(thread: Thread): JSONObject {
    val lines = JSONArray()
    thread.lines.forEach { line ->
      lines.put(
        JSONObject()
          .put("id", line.id)
          .put("sender", line.sender)
          .put("senderId", line.senderId)
          .put("agent", line.agent)
          .put("text", line.text)
          .put("ts", line.ts)
          .put("mine", line.mine)
          .put("sendKey", line.sendKey)
          .put("failed", line.failed),
      )
    }
    return JSONObject().put("title", thread.title).put("type", thread.type).put("lines", lines)
  }

  private fun decode(value: JSONObject): Thread {
    val raw = value.optJSONArray("lines") ?: JSONArray()
    val lines = (0 until raw.length()).map { index ->
      val line = raw.getJSONObject(index)
      Line(
        id = line.optInt("id"),
        sender = line.optString("sender"),
        senderId = line.optInt("senderId"),
        agent = line.optBoolean("agent"),
        text = line.optString("text"),
        ts = line.optLong("ts"),
        mine = line.optBoolean("mine"),
        sendKey = line.optString("sendKey"),
        failed = line.optBoolean("failed"),
      )
    }
    return Thread(value.optString("title"), value.optString("type"), lines)
  }
}
