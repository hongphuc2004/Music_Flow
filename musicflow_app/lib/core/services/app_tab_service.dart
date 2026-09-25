import 'package:flutter/material.dart';

/// Service quản lý tab hiện tại của MainScreen
/// Giúp mọi màn hình con có thể truy cập, hiển thị và chuyển đổi tab trên FloatingNavBar
class AppTabService extends ChangeNotifier {
  static final AppTabService _instance = AppTabService._internal();
  factory AppTabService() => _instance;
  AppTabService._internal();

  int _currentTab = 0;
  int get currentTab => _currentTab;

  void switchTab(int index, {BuildContext? context}) {
    _currentTab = index;
    notifyListeners();
    if (context != null) {
      try {
        Navigator.of(context).popUntil((route) => route.isFirst);
      } catch (_) {}
    }
  }

  void setTab(int index) {
    if (_currentTab != index) {
      _currentTab = index;
      notifyListeners();
    }
  }
}
