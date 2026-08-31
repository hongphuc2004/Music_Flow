import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class AppSettingsService extends ChangeNotifier {
  static final AppSettingsService _instance = AppSettingsService._internal();
  factory AppSettingsService() => _instance;
  AppSettingsService._internal();

  static const String _floatingAiKey = "is_floating_ai_enabled";
  bool _isFloatingAiEnabled = true;

  bool get isFloatingAiEnabled => _isFloatingAiEnabled;

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _isFloatingAiEnabled = prefs.getBool(_floatingAiKey) ?? true;
    } catch (_) {
      _isFloatingAiEnabled = true;
    }
    notifyListeners();
  }

  Future<void> setFloatingAiEnabled(bool enabled) async {
    _isFloatingAiEnabled = enabled;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_floatingAiKey, enabled);
    } catch (_) {}
  }
}
