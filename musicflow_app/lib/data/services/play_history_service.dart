import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/song_model.dart';

/// Service quản lý lịch sử phát nhạc (lưu local)
class PlayHistoryService {
  static const String _historyKey = 'play_history';
  static const int _maxHistoryItems = 50; // Giới hạn số bài trong lịch sử

  /// Thêm bài hát vào lịch sử phát
  static Future<void> addToHistory(Song song) async {
    final prefs = await SharedPreferences.getInstance();
    final history = await getHistory();
    
    // Xóa bài hát nếu đã có trong lịch sử (để đưa lên đầu)
    history.removeWhere((s) => s.id == song.id);
    
    // Thêm vào đầu danh sách
    history.insert(0, song);
    
    // Giới hạn số lượng
    if (history.length > _maxHistoryItems) {
      history.removeRange(_maxHistoryItems, history.length);
    }
    
    // Lưu lại
    final jsonList = history.map((s) => s.toJson()).toList();
    await prefs.setString(_historyKey, jsonEncode(jsonList));
  }

  /// Lấy danh sách lịch sử phát
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
      print('Error parsing play history: $e');
      return [];
    }
  }

  /// Lấy lịch sử gần đây (giới hạn số lượng)
  static Future<List<Song>> getRecentHistory({int limit = 3}) async {
    final history = await getHistory();
    return history.take(limit).toList();
  }

  /// Xóa một bài khỏi lịch sử
  static Future<void> removeFromHistory(String songId) async {
    final prefs = await SharedPreferences.getInstance();
    final history = await getHistory();
    
    history.removeWhere((s) => s.id == songId);
    
    final jsonList = history.map((s) => s.toJson()).toList();
    await prefs.setString(_historyKey, jsonEncode(jsonList));
  }

  /// Xóa toàn bộ lịch sử
  static Future<void> clearHistory() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_historyKey);
  }
}
