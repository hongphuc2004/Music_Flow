import 'package:flutter/material.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/login/login_screen.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController nameController = TextEditingController();
  final TextEditingController emailController = TextEditingController();
  final TextEditingController passwordController = TextEditingController();
  final TextEditingController confirmPasswordController = TextEditingController();
  bool _isLoading = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  Future<void> _register() async {
    final name = nameController.text.trim();
    final email = emailController.text.trim();
    final password = passwordController.text;
    final confirmPassword = confirmPasswordController.text;

    // Validate
    if (name.isEmpty || email.isEmpty || password.isEmpty) {
      _showSnackBar('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    if (password.length < 6) {
      _showSnackBar('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }

    if (password != confirmPassword) {
      _showSnackBar('Mật khẩu xác nhận không khớp');
      return;
    }

    if (!_isValidEmail(email)) {
      _showSnackBar('Email không hợp lệ');
      return;
    }

    setState(() => _isLoading = true);

    final result = await AuthService.register(
      name: name,
      email: email,
      password: password,
    );

    setState(() => _isLoading = false);

    if (result.success) {
      _showSnackBar('Đăng ký thành công! Vui lòng đăng nhập.', isError: false);
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    } else {
      _showSnackBar(result.message ?? 'Đăng ký thất bại');
    }
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
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
      appBar: AppBar(
        title: const Text('Đăng ký'),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Center(
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Image.asset(
                  'assets/images/logo.png',
                  width: 100,   
                  height: 100,
                  fit: BoxFit.contain,
                ),
                const SizedBox(height: 16),
                const Text(
                  'Tạo tài khoản',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 32),

                // Name
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Họ và tên',
                    prefixIcon: Icon(Icons.person_outline),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),

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
                const SizedBox(height: 16),

                // Confirm Password
                TextField(
                  controller: confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  decoration: InputDecoration(
                    labelText: 'Xác nhận mật khẩu',
                    prefixIcon: const Icon(Icons.lock_outline),
                    border: const OutlineInputBorder(),
                    suffixIcon: IconButton(
                      icon: Icon(
                        _obscureConfirmPassword ? Icons.visibility_off : Icons.visibility,
                      ),
                      onPressed: () {
                        setState(() => _obscureConfirmPassword = !_obscureConfirmPassword);
                      },
                    ),
                  ),
                ),
                const SizedBox(height: 24),

                // Register button
                ElevatedButton(
                  onPressed: _isLoading ? null : _register,
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
                          'Đăng ký',
                          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                ),

                const SizedBox(height: 12),

                TextButton(
                  onPressed: () {
                    Navigator.pop(context);
                  },
                  child: const Text('Đã có tài khoản? Đăng nhập'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
