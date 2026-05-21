import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/song_model.dart';

/// Service quan ly lich su phat nhac (luu local)
class PlayHistoryService {
  static const String _historyKey = 'play_history';
  static const int _maxHistoryItems = 50; // Gioi han so bai trong lich su

  /// Them bai hat vao lich su phat
  static Future<void> addToHistory(Song song) async {
    final prefs = await SharedPreferences.getInstance();
    final history = await getHistory();
    
    // Xoa bai hat neu da co trong lich su (de dua len dau)
    history.removeWhere((s) => s.id == song.id);
    
    // Them vao dau danh sach
    history.insert(0, song);
    
    // Gi?i h?n s? lu?ng
    if (history.length > _maxHistoryItems) {
      history.removeRange(_maxHistoryItems, history.length);
    }
    
    // Luu l?i
    final jsonList = history.map((s) => s.toJson()).toList();
    await prefs.setString(_historyKey, jsonEncode(jsonList));
  }

  /// Lay danh sach lich su phat
  static Future<List<Song>> getHistory() async {
    final prefs = await SharedPreferences.getInstance();
    final jsonString = prefs.getString(_historyKey);
    
    if (jsonString == null || jsonString.isEmpty) {
      return [];
    }
    
    try {
      final List<dynamic> jsonList = jsonDecode(jsonString);
      return jsonList.map((json) => Song.fromJson(json)).toList();
    } catch (e) {
      return [];
    }
  }

  /// Lay lich su gan day (gioi han so luong)
  static Future<List<Song>> getRecentHistory({int limit = 3}) async {
    final history = await getHistory();
    return history.take(limit).toList();
  }

  /// Xoa mot bai khoi lich su
  static Future<void> removeFromHistory(String songId) async {
    final prefs = await SharedPreferences.getInstance();
    final history = await getHistory();
    
    history.removeWhere((s) => s.id == songId);
    
    final jsonList = history.map((s) => s.toJson()).toList();
    await prefs.setString(_historyKey, jsonEncode(jsonList));
  }

  /// Xoa toan bo lich su
  static Future<void> clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_historyKey);
  }
}
