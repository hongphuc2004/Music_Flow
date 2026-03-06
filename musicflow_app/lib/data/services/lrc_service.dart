import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// Model cho synced lyrics
class SyncedLyrics {
  final String? syncedLyrics; // LRC format với timestamp
  final String? plainLyrics;  // Lyrics không có timestamp
  final String? trackName;
  final String? artistName;
  final String? albumName;
  final int? duration;
  final String? source; // Nguồn lyrics (lrclib, netease)

  SyncedLyrics({
    this.syncedLyrics,
    this.plainLyrics,
    this.trackName,
    this.artistName,
    this.albumName,
    this.duration,
    this.source,
  });

  factory SyncedLyrics.fromJson(Map<String, dynamic> json) {
    return SyncedLyrics(
      syncedLyrics: json['syncedLyrics'],
      plainLyrics: json['plainLyrics'],
      trackName: json['trackName'],
      artistName: json['artistName'],
      albumName: json['albumName'],
      duration: json['duration'],
      source: json['source'],
    );
  }
  
  Map<String, dynamic> toJson() => {
    'syncedLyrics': syncedLyrics,
    'plainLyrics': plainLyrics,
    'trackName': trackName,
    'artistName': artistName,
    'albumName': albumName,
    'duration': duration,
    'source': source,
  };

  /// Kiểm tra có synced lyrics không
  bool get hasSyncedLyrics => syncedLyrics != null && syncedLyrics!.isNotEmpty;
  
  /// Kiểm tra có plain lyrics không
  bool get hasPlainLyrics => plainLyrics != null && plainLyrics!.isNotEmpty;
}

/// Service để fetch lyrics từ nhiều nguồn (LRCLIB + Netease)
class LrcService {
  static const String _lrclibUrl = 'https://lrclib.net/api';
  static const String _neteaseUrl = 'https://music.163.com/api';
  static const String _qqMusicSearchUrl = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
  static const String _qqMusicLyricUrl = 'https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg';
  static const String _cachePrefix = 'lrc_cache_';
  static const Duration _cacheDuration = Duration(days: 30);

  /// Fetch synced lyrics - thử LRCLIB trước, sau đó Netease
  static Future<SyncedLyrics?> fetchLyrics({
    required String trackName,
    required String artistName,
    int? duration,
  }) async {
    // Kiểm tra cache trước
    final cached = await _getCachedLyrics(trackName, artistName);
    if (cached != null) {
      return cached;
    }

    // 1. Thử LRCLIB trước
    var result = await _fetchFromLrclib(trackName, artistName, duration);
    if (result != null && result.hasSyncedLyrics) {
      await _cacheLyrics(trackName, artistName, result.toJson());
      return result;
    }

    // 2. Fallback sang Netease
    result = await _fetchFromNetease(trackName, artistName);
    if (result != null && result.hasSyncedLyrics) {
      await _cacheLyrics(trackName, artistName, result.toJson());
      return result;
    }

    // 3. Fallback sang QQ Music
    result = await _fetchFromQQMusic(trackName, artistName);
    if (result != null && result.hasSyncedLyrics) {
      await _cacheLyrics(trackName, artistName, result.toJson());
      return result;
    }

    return result; // Trả về kết quả cuối cùng (có thể chỉ có plain lyrics)
  }

  /// Fetch từ LRCLIB
  static Future<SyncedLyrics?> _fetchFromLrclib(String trackName, String artistName, int? duration) async {
    try {
      final uri = Uri.parse('$_lrclibUrl/get').replace(queryParameters: {
        'track_name': trackName,
        'artist_name': artistName,
        if (duration != null) 'duration': duration.toString(),
      });
      
      final response = await http.get(
        uri,
        headers: {'User-Agent': 'MusicFlow/1.0.0'},
      ).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final json = jsonDecode(response.body);
        json['source'] = 'lrclib';
        return SyncedLyrics.fromJson(json);
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Fetch từ Netease Music
  static Future<SyncedLyrics?> _fetchFromNetease(String trackName, String artistName) async {
    try {
      // Bước 1: Search bài hát
      final searchQuery = '$trackName $artistName';
      final searchUri = Uri.parse('$_neteaseUrl/search/get').replace(queryParameters: {
        's': searchQuery,
        'type': '1', // 1 = songs
        'limit': '5',
      });
      
      final searchResponse = await http.post(
        searchUri,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://music.163.com/',
        },
      ).timeout(const Duration(seconds: 8));

      if (searchResponse.statusCode != 200) return null;
      
      final searchJson = jsonDecode(searchResponse.body);
      final songs = searchJson['result']?['songs'] as List?;
      if (songs == null || songs.isEmpty) return null;

      // Lấy song ID đầu tiên
      final songId = songs[0]['id'];
      
      // Bước 2: Lấy lyrics
      final lyricUri = Uri.parse('$_neteaseUrl/song/lyric').replace(queryParameters: {
        'id': songId.toString(),
        'lv': '1', // Synced lyrics
        'tv': '1', // Translation (nếu có)
      });
      
      final lyricResponse = await http.get(
        lyricUri,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://music.163.com/',
        },
      ).timeout(const Duration(seconds: 8));

      if (lyricResponse.statusCode != 200) return null;
      
      final lyricJson = jsonDecode(lyricResponse.body);
      final lrc = lyricJson['lrc']?['lyric'] as String?;
      
      if (lrc == null || lrc.isEmpty) return null;

      // Lọc bỏ metadata tiếng Trung
      final cleanedLrc = _cleanNeteaseLyrics(lrc);

      return SyncedLyrics(
        syncedLyrics: cleanedLrc,
        plainLyrics: _stripTimestamps(cleanedLrc),
        trackName: songs[0]['name'],
        artistName: (songs[0]['artists'] as List?)?.map((a) => a['name']).join(', '),
        source: 'netease',
      );
    } catch (e) {
      return null;
    }
  }

  /// Fetch từ QQ Music (腾讯音乐)
  static Future<SyncedLyrics?> _fetchFromQQMusic(String trackName, String artistName) async {
    try {
      // Bước 1: Search bài hát
      final searchQuery = '$trackName $artistName';
      final searchUri = Uri.parse(_qqMusicSearchUrl).replace(queryParameters: {
        'w': searchQuery,
        'format': 'json',
        'p': '1',
        'n': '5',
      });
      
      final searchResponse = await http.get(
        searchUri,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://y.qq.com/',
        },
      ).timeout(const Duration(seconds: 8));

      if (searchResponse.statusCode != 200) return null;
      
      final searchJson = jsonDecode(searchResponse.body);
      final songs = searchJson['data']?['song']?['list'] as List?;
      if (songs == null || songs.isEmpty) return null;

      // Lấy songmid đầu tiên
      final songMid = songs[0]['songmid'] as String?;
      if (songMid == null) return null;
      
      // Bước 2: Lấy lyrics
      final lyricUri = Uri.parse(_qqMusicLyricUrl).replace(queryParameters: {
        'songmid': songMid,
        'format': 'json',
        'nobase64': '1',
      });
      
      final lyricResponse = await http.get(
        lyricUri,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://y.qq.com/',
        },
      ).timeout(const Duration(seconds: 8));

      if (lyricResponse.statusCode != 200) return null;
      
      final lyricJson = jsonDecode(lyricResponse.body);
      final lrc = lyricJson['lyric'] as String?;
      
      if (lrc == null || lrc.isEmpty) return null;

      // Lọc bỏ metadata
      final cleanedLrc = _cleanNeteaseLyrics(lrc);

      return SyncedLyrics(
        syncedLyrics: cleanedLrc,
        plainLyrics: _stripTimestamps(cleanedLrc),
        trackName: songs[0]['songname'],
        artistName: (songs[0]['singer'] as List?)?.map((a) => a['name']).join(', '),
        source: 'qqmusic',
      );
    } catch (e) {
      return null;
    }
  }

  /// Lọc bỏ các dòng metadata tiếng Trung từ Netease/QQ lyrics
  static String _cleanNeteaseLyrics(String lrc) {
    // Keywords metadata cần lọc
    final metadataKeywords = [
      '作曲', '作词', '编曲', '制作人', '混音', '母带', '录音', '和声',
      '吉他', '贝斯', '鼓', '键盘', '弦乐', '监制', '出品', '发行',
      '演唱', '原唱', '翻唱', '配唱', '制作', '统筹', '企划', '策划',
      'Composer', 'Lyricist', 'Arranger', 'Producer', 'Written by',
      'Composed by', 'Lyrics by', 'Music by', 'Arranged by',
    ];
    
    return lrc.split('\n').where((line) {
      // Lấy text sau timestamp
      final text = line.replaceAll(RegExp(r'^\[\d{2}:\d{2}[.:]\d{2,3}\]'), '').trim();
      
      // Giữ dòng trống để giữ timing
      if (text.isEmpty) return true;
      
      // Kiểm tra từng keyword
      for (final keyword in metadataKeywords) {
        // Bắt cả format "作词：xxx", "作词:xxx", "作词 : xxx", "作词 ：xxx"
        if (text.startsWith(keyword)) return false;
        if (text.contains('$keyword:')) return false;
        if (text.contains('$keyword：')) return false;
        if (text.contains('$keyword :')) return false;
        if (text.contains('$keyword ：')) return false;
      }
      
      // Bỏ dòng chỉ chứa credit format (tên người : vai trò)
      if (RegExp(r'^[^:：]+\s*[:：]\s*[^:：]+$').hasMatch(text) && 
          !text.contains(' ') || text.split(' ').length <= 3) {
        // Có thể là credit line, kiểm tra thêm
        if (text.contains('：') || (text.contains(':') && !text.contains("'"))) {
          // Nếu có ký tự Trung/Hàn/Nhật thì bỏ
          if (RegExp(r'[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]').hasMatch(text)) {
            return false;
          }
        }
      }
      
      // Bỏ các dòng credit khác
      if (text.startsWith('by:') || text.startsWith('By:')) return false;
      if (text.startsWith('by ') || text.startsWith('By ')) return false;
      
      return true;
    }).join('\n');
  }

  /// Xóa timestamps từ LRC để lấy plain lyrics
  static String _stripTimestamps(String lrc) {
    return lrc
        .split('\n')
        .map((line) => line.replaceAll(RegExp(r'^\[\d{2}:\d{2}[.:]\d{2,3}\]'), '').trim())
        .where((line) => line.isNotEmpty && !line.startsWith('['))
        .join('\n');
  }

  /// Lấy lyrics từ cache
  static Future<SyncedLyrics?> _getCachedLyrics(String trackName, String artistName) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getCacheKey(trackName, artistName);
      final cached = prefs.getString(key);
      
      if (cached != null) {
        final data = jsonDecode(cached);
        final timestamp = data['_timestamp'] as int?;
        
        if (timestamp != null) {
          final cachedTime = DateTime.fromMillisecondsSinceEpoch(timestamp);
          if (DateTime.now().difference(cachedTime) < _cacheDuration) {
            return SyncedLyrics.fromJson(data);
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Lưu lyrics vào cache
  static Future<void> _cacheLyrics(String trackName, String artistName, Map<String, dynamic> data) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getCacheKey(trackName, artistName);
      data['_timestamp'] = DateTime.now().millisecondsSinceEpoch;
      await prefs.setString(key, jsonEncode(data));
    } catch (e) {
      // Ignore cache errors
    }
  }

  /// Tạo cache key
  static String _getCacheKey(String trackName, String artistName) {
    final normalized = '${trackName.toLowerCase()}_${artistName.toLowerCase()}'
        .replaceAll(RegExp(r'[^a-z0-9]'), '_');
    return '$_cachePrefix$normalized';
  }

  /// Xóa cache cho một bài hát
  static Future<void> clearCache(String trackName, String artistName) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getCacheKey(trackName, artistName);
      await prefs.remove(key);
    } catch (e) {
      // Ignore
    }
  }
}
