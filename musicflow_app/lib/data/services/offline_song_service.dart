import 'dart:io';

import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../models/song_model.dart';
import 'song_api_service.dart';

class OfflineSongService {
  static final OfflineSongService _instance = OfflineSongService._internal();
  factory OfflineSongService() => _instance;
  OfflineSongService._internal();

  static const String _boxName = 'downloaded_songs';
  static const String _downloadFolderName = 'MusicFlowDownloaded';
  static const int _maxOfflineStorageBytes = 1024 * 1024 * 1024; // 1 GB
  static const int _maxOfflineSongCount = 500;

  static bool _hiveInitialized = false;
  Box<dynamic>? _box;

  Future<Box<dynamic>> get box async {
    if (_box != null && _box!.isOpen) return _box!;
    _box = await _openBox();
    return _box!;
  }

  Future<Box<dynamic>> _openBox() async {
    if (!_hiveInitialized) {
      await Hive.initFlutter();
      _hiveInitialized = true;
    }

    if (Hive.isBoxOpen(_boxName)) {
      return Hive.box<dynamic>(_boxName);
    }

    return Hive.openBox<dynamic>(_boxName);
  }

  Future<String> _getDownloadFolderPath() async {
    final docsDir = await getApplicationDocumentsDirectory();
    final folderPath = p.join(docsDir.path, _downloadFolderName);
    final folder = Directory(folderPath);

    if (!await folder.exists()) {
      await folder.create(recursive: true);
    }

    return folderPath;
  }

  String _sanitizeFileName(String input) {
    return input
        .replaceAll(RegExp(r'[<>:"/\\|?*]'), '_')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  Future<List<DownloadedSong>> _getAllDownloadedSongs() async {
    final boxRef = await box;
    final items = <DownloadedSong>[];

    for (final key in boxRef.keys) {
      final raw = boxRef.get(key);
      if (raw is Map) {
        items.add(DownloadedSong.fromMap(Map<String, dynamic>.from(raw)));
      }
    }

    return items;
  }

  Future<List<DownloadedSong>> getAllDownloadedSongs() async {
    final items = await _getAllDownloadedSongs();
    items.sort((a, b) => b.downloadedAt.compareTo(a.downloadedAt));
    return items;
  }

  Future<int> getDownloadedSongsCount() async {
    final items = await getAllDownloadedSongs();
    return items.length;
  }

  Future<List<Song>> getDownloadedSongsAsSongs() async {
    final items = await getAllDownloadedSongs();
    return items
        .map(
          (item) => Song(
            id: item.songId,
            title: item.title,
            artist: item.artist,
            audioUrl: item.remoteAudioUrl,
            imageUrl: item.imageUrl ?? '',
            lyrics: '',
            isPublic: true,
            duration: item.duration,
          ),
        )
        .toList();
  }

  Future<void> _touchSongAccess(String songId) async {
    final boxRef = await box;
    final raw = boxRef.get(songId);
    if (raw is! Map) return;

    final map = Map<String, dynamic>.from(raw);
    map['last_accessed_at'] = DateTime.now().millisecondsSinceEpoch;
    await boxRef.put(songId, map);
  }

  Future<void> _ensureQuotaForNewDownload(int incomingBytes) async {
    if (incomingBytes > _maxOfflineStorageBytes) {
      throw Exception('Bai hat qua lon so voi gioi han luu tru offline');
    }

    final songs = await _getAllDownloadedSongs();
    int currentBytes = 0;

    for (final song in songs) {
      final file = File(song.localPath);
      if (await file.exists()) {
        currentBytes += await file.length();
      }
    }

    final sortedByLeastRecent = List<DownloadedSong>.from(songs)
      ..sort((a, b) => a.lastAccessedAt.compareTo(b.lastAccessedAt));

    while (currentBytes + incomingBytes > _maxOfflineStorageBytes ||
        sortedByLeastRecent.length >= _maxOfflineSongCount) {
      if (sortedByLeastRecent.isEmpty) break;

      final oldestSong = sortedByLeastRecent.removeAt(0);
      final oldFile = File(oldestSong.localPath);
      int removedBytes = 0;
      if (await oldFile.exists()) {
        removedBytes = await oldFile.length();
      }

      await removeDownloadedSong(oldestSong.songId);
      currentBytes = (currentBytes - removedBytes).clamp(0, 1 << 62);
    }

    if (currentBytes + incomingBytes > _maxOfflineStorageBytes) {
      throw Exception('Khong du bo nho de tai bai hat moi');
    }
  }

  Future<OfflineDownloadResult> downloadSong(Song song) async {
    try {
      final existing = await getDownloadedSong(song.id);
      if (existing != null && await File(existing.localPath).exists()) {
        await _touchSongAccess(song.id);
        return OfflineDownloadResult(
          success: true,
          message: 'Bai hat da duoc tai truoc do',
          localPath: existing.localPath,
          alreadyDownloaded: true,
        );
      }

      final apiResult = await SongApiService.requestDownloadSong(song.id);
      if (!apiResult.success || apiResult.audioUrl == null) {
        return OfflineDownloadResult(
          success: false,
          message: apiResult.message,
        );
      }

      final response = await http.get(Uri.parse(apiResult.audioUrl!));
      if (response.statusCode != 200) {
        return OfflineDownloadResult(
          success: false,
          message: 'Tai file that bai (HTTP ${response.statusCode})',
        );
      }

      await _ensureQuotaForNewDownload(response.bodyBytes.length);

      final folderPath = await _getDownloadFolderPath();
      final safeTitle = _sanitizeFileName(song.title);
      final safeArtist = _sanitizeFileName(song.artist);
      final fileName = '${song.id}_${safeTitle}_$safeArtist.mp3';
      final filePath = p.join(folderPath, fileName);

      final file = File(filePath);
      await file.writeAsBytes(response.bodyBytes, flush: true);

      final boxRef = await box;
      await boxRef.put(song.id, {
        'song_id': song.id,
        'title': song.title,
        'artist': song.artist,
        'image_url': song.imageUrl,
        'remote_audio_url': apiResult.audioUrl,
        'local_path': filePath,
        'duration': song.duration,
        'downloaded_at': DateTime.now().millisecondsSinceEpoch,
        'last_accessed_at': DateTime.now().millisecondsSinceEpoch,
      });

      return OfflineDownloadResult(
        success: true,
        message: 'Tai bai hat thanh cong',
        localPath: filePath,
      );
    } catch (e) {
      return OfflineDownloadResult(
        success: false,
        message: 'Khong the tai bai hat: $e',
      );
    }
  }

  Future<DownloadedSong?> getDownloadedSong(String songId) async {
    final boxRef = await box;
    final raw = boxRef.get(songId);
    if (raw is! Map) return null;

    return DownloadedSong.fromMap(Map<String, dynamic>.from(raw));
  }

  Future<String?> getLocalPathIfDownloaded(String songId) async {
    final downloadedSong = await getDownloadedSong(songId);
    if (downloadedSong == null) return null;

    final file = File(downloadedSong.localPath);
    if (await file.exists()) {
      await _touchSongAccess(songId);
      return downloadedSong.localPath;
    }

    // DB có record nhưng file đã bị xóa thủ công, dọn lại record.
    await removeDownloadedSong(songId);
    return null;
  }

  Future<void> removeDownloadedSong(String songId) async {
    final existing = await getDownloadedSong(songId);
    if (existing != null) {
      final file = File(existing.localPath);
      if (await file.exists()) {
        await file.delete();
      }
    }

    final boxRef = await box;
    await boxRef.delete(songId);
  }
}

class OfflineDownloadResult {
  final bool success;
  final String message;
  final String? localPath;
  final bool alreadyDownloaded;

  OfflineDownloadResult({
    required this.success,
    required this.message,
    this.localPath,
    this.alreadyDownloaded = false,
  });
}

class DownloadedSong {
  final String songId;
  final String title;
  final String artist;
  final String? imageUrl;
  final String remoteAudioUrl;
  final String localPath;
  final double? duration;
  final DateTime downloadedAt;
  final DateTime lastAccessedAt;

  DownloadedSong({
    required this.songId,
    required this.title,
    required this.artist,
    required this.imageUrl,
    required this.remoteAudioUrl,
    required this.localPath,
    required this.duration,
    required this.downloadedAt,
    required this.lastAccessedAt,
  });

  factory DownloadedSong.fromMap(Map<String, dynamic> map) {
    return DownloadedSong(
      songId: map['song_id'] as String,
      title: map['title'] as String,
      artist: map['artist'] as String,
      imageUrl: map['image_url'] as String?,
      remoteAudioUrl: map['remote_audio_url'] as String,
      localPath: map['local_path'] as String,
      duration: (map['duration'] as num?)?.toDouble(),
      downloadedAt: DateTime.fromMillisecondsSinceEpoch(map['downloaded_at'] as int),
      lastAccessedAt: DateTime.fromMillisecondsSinceEpoch(
        (map['last_accessed_at'] as int?) ?? (map['downloaded_at'] as int),
      ),
    );
  }
}
