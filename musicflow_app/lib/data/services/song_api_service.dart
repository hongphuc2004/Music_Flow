import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/song_model.dart';

class SongApiService {
  static const String baseUrl = "http://10.243.214.153:5000/api";

  static Future<List<Song>> fetchSongs() async {
    final response = await http.get(Uri.parse("$baseUrl/songs"));

    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((e) => Song.fromJson(e)).toList();
    } else {
      throw Exception("Failed to load songs");
    }
  }
}
