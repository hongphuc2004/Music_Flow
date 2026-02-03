import 'package:flutter/material.dart';
import 'package:musicflow_app/main.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/login/register_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;

  Future<void> _login() async {
    final email = emailController.text.trim();
    final password = passwordController.text;

    // Validate
    if (email.isEmpty || password.isEmpty) {
      _showSnackBar('Vui lòng nhập email và mật khẩu');
      return;
    }

    setState(() => _isLoading = true);

    final result = await AuthService.login(
      email: email,
      password: password,
    );

    setState(() => _isLoading = false);

    if (result.success) {
      _showSnackBar('Đăng nhập thành công!', isError: false);
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const MainScreen()),
        );
      }
    } else {
      _showSnackBar(result.message ?? 'Đăng nhập thất bại');
    }
  }

  void _showSnackBar(String message, {bool isError = true}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.red : Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Image.asset(
                  'assets/images/logo.png',
                  width: 120,   
                  height: 120,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 16),
                const Text(
                  'MusicFlow',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 40),

                // Email
                TextField(
                  controller: emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

                // Password
                TextField(
                  controller: passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Mật khẩu',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscurePassword ? Icons.visibility_off : Icons.visibility,
                      ),
                      onPressed: () {
                        setState(() => _obscurePassword = !_obscurePassword);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Login button
                ElevatedButton(
                  onPressed: _isLoading ? null : _login,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.greenAccent,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: _isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Text(
                          'Đăng nhập',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),

                const SizedBox(height: 12),

                TextButton(
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const RegisterScreen(),
                      ),
                    );
                  },
                  child: const Text('Chưa có tài khoản? Đăng ký ngay'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
