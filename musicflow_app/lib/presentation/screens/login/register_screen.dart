import 'package:flutter/material.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';

class RegisterScreen extends StatelessWidget {
  const RegisterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const LoginScreen(initialIsSignUp: true);
  }
}
