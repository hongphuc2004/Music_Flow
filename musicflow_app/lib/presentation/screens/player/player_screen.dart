import 'package:flutter/material.dart';

class PlayerScreen extends StatefulWidget {
  final String songTitle;
  final String artist;
  final bool isPlaying;

  const PlayerScreen({
    super.key,
    required this.songTitle,
    required this.artist,
    required this.isPlaying,
  });

  @override
  State<PlayerScreen> createState() => _PlayerScreenState();
}

class _PlayerScreenState extends State<PlayerScreen> {
  double _progress = 0.3;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        leading: IconButton(
          icon: const Icon(Icons.keyboard_arrow_down),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text('Đang phát'),
        centerTitle: true,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            const SizedBox(height: 20),

            // 🎵 Album art
            Container(
              width: double.infinity,
              height: 300,
              decoration: BoxDecoration(
                color: Colors.grey.shade800,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Icon(
                Icons.music_note,
                size: 120,
                color: Colors.white,
              ),
            ),

            const SizedBox(height: 24),

            // 🎶 Song info
            Text(
              widget.songTitle,
              style: const TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              widget.artist,
              style: const TextStyle(color: Colors.grey),
            ),

            const SizedBox(height: 24),

            // ⏱ Progress
            Slider(
              value: _progress,
              activeColor: Colors.greenAccent,
              inactiveColor: Colors.grey,
              onChanged: (value) {
                setState(() {
                  _progress = value;
                });
              },
            ),

            const SizedBox(height: 12),

            // ⏯ Controls
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                IconButton(
                  icon: const Icon(Icons.skip_previous, size: 36),
                  onPressed: () {},
                ),
                Container(
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.greenAccent,
                  ),
                  child: IconButton(
                    icon: Icon(
                      widget.isPlaying
                          ? Icons.pause
                          : Icons.play_arrow,
                      size: 36,
                      color: Colors.black,
                    ),
                    onPressed: () {},
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.skip_next, size: 36),
                  onPressed: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
