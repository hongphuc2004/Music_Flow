import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import '../../../data/models/song_model.dart';
import '../../../data/services/song_api_service.dart';
import '../../../data/services/topic_api_service.dart';
import '../../../data/models/topic_model.dart';
import '../../../presentation/widgets/mini_player_wrapper.dart';

class YourUploadsScreen extends StatefulWidget {
  final Function(Song)? onSongTap;
  final Function(List<Song>, {int startIndex})? onPlayAll;

  const YourUploadsScreen({
    super.key,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<YourUploadsScreen> createState() => _YourUploadsScreenState();
}

class _YourUploadsScreenState extends State<YourUploadsScreen> {
  List<Song> _uploadedSongs = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadUploadedSongs();
  }

  Future<void> _loadUploadedSongs() async {
    setState(() => _isLoading = true);
    
    final result = await SongApiService.getMyUploads();
    
    if (mounted) {
      setState(() {
        _isLoading = false;
        if (result.success) {
          _uploadedSongs = result.songs;
        }
      });
    }
  }

  Future<void> _togglePublic(Song song) async {
    final result = await SongApiService.togglePublic(song.id);
    
    if (result.success) {
      _showSnackBar(result.message);
      _loadUploadedSongs();
    } else {
      _showSnackBar(result.message, isError: true);
    }
  }

  Future<void> _deleteSong(Song song) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.grey[900],
        title: const Text('Xóa bài hát?', style: TextStyle(color: Colors.white)),
        content: Text(
          'Bạn có chắc muốn xóa "${song.title}"?\nHành động này không thể hoàn tác.',
          style: TextStyle(color: Colors.grey[400]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Xóa', style: TextStyle(color: Colors.redAccent)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final result = await SongApiService.deleteSong(song.id);
      _showSnackBar(result.message, isError: !result.success);
      if (result.success) {
        _loadUploadedSongs();
      }
    }
  }

  void _showEditDialog(Song song) {
    final titleController = TextEditingController(text: song.title);
    final artistController = TextEditingController(text: song.artist);
    final lyricsController = TextEditingController(text: song.lyrics);

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.grey[900],
        title: const Text('Sửa bài hát', style: TextStyle(color: Colors.white)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: titleController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Tên bài hát',
                  labelStyle: TextStyle(color: Colors.grey[400]),
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.grey[700]!),
                  ),
                  focusedBorder: const UnderlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFF1DB954)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: artistController,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  labelText: 'Ca sĩ',
                  labelStyle: TextStyle(color: Colors.grey[400]),
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.grey[700]!),
                  ),
                  focusedBorder: const UnderlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFF1DB954)),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: lyricsController,
                style: const TextStyle(color: Colors.white),
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Lời bài hát',
                  labelStyle: TextStyle(color: Colors.grey[400]),
                  enabledBorder: UnderlineInputBorder(
                    borderSide: BorderSide(color: Colors.grey[700]!),
                  ),
                  focusedBorder: const UnderlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFF1DB954)),
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Hủy', style: TextStyle(color: Colors.grey)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              final result = await SongApiService.updateSong(
                songId: song.id,
                title: titleController.text.trim(),
                artist: artistController.text.trim(),
                lyrics: lyricsController.text.trim(),
              );
              _showSnackBar(result.message, isError: !result.success);
              if (result.success) {
                _loadUploadedSongs();
              }
            },
            child: const Text('Lưu', style: TextStyle(color: Color(0xFF1DB954))),
          ),
        ],
      ),
    );
  }

  void _showSongOptions(Song song) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.grey[900],
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (context) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: Colors.grey[700],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            ListTile(
              leading: Icon(
                song.isPublic ? Icons.lock_outline : Icons.public,
                color: Colors.white70,
              ),
              title: Text(
                song.isPublic ? 'Chuyển sang riêng tư' : 'Công khai bài hát',
                style: const TextStyle(color: Colors.white),
              ),
              subtitle: Text(
                song.isPublic 
                    ? 'Chỉ bạn mới thấy bài hát này'
                    : 'Mọi người đều có thể thấy và nghe',
                style: TextStyle(color: Colors.grey[400], fontSize: 12),
              ),
              onTap: () {
                Navigator.pop(context);
                _togglePublic(song);
              },
            ),
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: Colors.white70),
              title: const Text('Sửa thông tin', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.pop(context);
                _showEditDialog(song);
              },
            ),
            ListTile(
              leading: const Icon(Icons.delete_outline, color: Colors.redAccent),
              title: const Text('Xóa bài hát', style: TextStyle(color: Colors.redAccent)),
              onTap: () {
                Navigator.pop(context);
                _deleteSong(song);
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  void _showSnackBar(String message, {bool isError = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError ? Colors.redAccent : const Color(0xFF1DB954),
      ),
    );
  }

  Future<void> _startUpload() async {
    // Show upload dialog
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => const _UploadBottomSheet(),
    );

    if (result == true) {
      _loadUploadedSongs();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        title: const Text(
          'Bài hát của bạn',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.upload_rounded),
            onPressed: _startUpload,
            tooltip: 'Upload bài hát mới',
          ),
        ],
      ),
      body: MiniPlayerWrapper(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Color(0xFF1DB954)),
              )
            : _uploadedSongs.isEmpty
                ? _buildEmptyState()
                : _buildSongList(),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              width: 120,
              height: 120,
              decoration: BoxDecoration(
                color: Colors.grey[900],
                shape: BoxShape.circle,
              ),
              child: Icon(
                Icons.cloud_upload_outlined,
                size: 60,
                color: Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Chưa có bài hát nào',
              style: TextStyle(
                color: Colors.white,
                fontSize: 20,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Upload bài hát từ thiết bị của bạn\nđể nghe mọi lúc mọi nơi',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: Colors.grey[400],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _startUpload,
              icon: const Icon(Icons.upload_rounded),
              label: const Text('Upload bài hát'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1DB954),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(25),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSongList() {
    return Column(
      children: [
        // Play all button
        if (_uploadedSongs.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      widget.onPlayAll?.call(_uploadedSongs, startIndex: 0);
                    },
                    icon: const Icon(Icons.play_arrow),
                    label: Text('Phát tất cả (${_uploadedSongs.length})'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1DB954),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(25),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

        // Song list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            itemCount: _uploadedSongs.length,
            itemBuilder: (context, index) {
              final song = _uploadedSongs[index];
              return _buildSongTile(song, index);
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSongTile(Song song, int index) {
    return ListTile(
      contentPadding: const EdgeInsets.symmetric(vertical: 4),
      leading: Stack(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Image.network(
              song.imageUrl,
              width: 50,
              height: 50,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 50,
                height: 50,
                color: Colors.grey[800],
                child: const Icon(Icons.music_note, color: Colors.grey),
              ),
            ),
          ),
          // Badge public/private
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              padding: const EdgeInsets.all(2),
              decoration: BoxDecoration(
                color: song.isPublic ? const Color(0xFF1DB954) : Colors.grey[700],
                borderRadius: BorderRadius.circular(4),
              ),
              child: Icon(
                song.isPublic ? Icons.public : Icons.lock,
                size: 12,
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      title: Text(
        song.title,
        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w500),
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
      ),
      subtitle: Row(
        children: [
          Expanded(
            child: Text(
              song.artist,
              style: TextStyle(color: Colors.grey[400], fontSize: 13),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: song.isPublic 
                  ? const Color(0xFF1DB954).withOpacity(0.2)
                  : Colors.grey[800],
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              song.isPublic ? 'Công khai' : 'Riêng tư',
              style: TextStyle(
                color: song.isPublic ? const Color(0xFF1DB954) : Colors.grey[400],
                fontSize: 10,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
      trailing: IconButton(
        icon: const Icon(Icons.more_vert, color: Colors.grey),
        onPressed: () => _showSongOptions(song),
      ),
      onTap: () => widget.onSongTap?.call(song),
    );
  }
}

// ==================== UPLOAD BOTTOM SHEET ====================
class _UploadBottomSheet extends StatefulWidget {
  const _UploadBottomSheet();

  @override
  State<_UploadBottomSheet> createState() => _UploadBottomSheetState();
}

class _UploadBottomSheetState extends State<_UploadBottomSheet> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _artistController = TextEditingController();
  final _lyricsController = TextEditingController();

  File? _audioFile;
  File? _imageFile;
  String? _audioFileName;

  List<Topic> _topics = [];
  Topic? _selectedTopic;
  bool _isLoadingTopics = true;
  bool _isUploading = false;
  bool _isPublic = false; // Mặc định riêng tư

  @override
  void initState() {
    super.initState();
    _loadTopics();
  }

  @override
  void dispose() {
    _titleController.dispose();
    _artistController.dispose();
    _lyricsController.dispose();
    super.dispose();
  }

  Future<void> _loadTopics() async {
    try {
      final topics = await TopicApiService.fetchTopics();
      if (mounted) {
        setState(() {
          _topics = topics;
          _isLoadingTopics = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingTopics = false);
      }
    }
  }

  Future<void> _pickAudioFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.audio,
        allowMultiple: false,
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        if (file.path != null) {
          setState(() {
            _audioFile = File(file.path!);
            _audioFileName = file.name;
          });
        }
      }
    } catch (e) {
      _showError('Không thể chọn file audio');
    }
  }

  Future<void> _pickImageFile() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.image,
        allowMultiple: false,
      );

      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        if (file.path != null) {
          setState(() {
            _imageFile = File(file.path!);
          });
        }
      }
    } catch (e) {
      _showError('Không thể chọn file ảnh');
    }
  }

  Future<void> _uploadSong() async {
    if (!_formKey.currentState!.validate()) return;

    if (_audioFile == null) {
      _showError('Vui lòng chọn file audio');
      return;
    }

    // Ảnh bìa là tùy chọn - không bắt buộc

    setState(() => _isUploading = true);

    final result = await SongApiService.uploadSong(
      audioFile: _audioFile!,
      imageFile: _imageFile,
      title: _titleController.text.trim(),
      artist: _artistController.text.trim(),
      topicId: _selectedTopic?.id,
      lyrics: _lyricsController.text.trim(),
      isPublic: _isPublic,
    );

    setState(() => _isUploading = false);

    if (result.success) {
      _showSuccess(result.message);
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } else {
      _showError(result.message);
    }
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.red),
    );
  }

  void _showSuccess(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message), backgroundColor: Colors.green),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: const BoxDecoration(
        color: Color(0xFF1A1A1A),
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        children: [
          // Handle bar
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[600],
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Huỷ', style: TextStyle(color: Colors.grey)),
                ),
                const Text(
                  'Upload bài hát',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(width: 60),
              ],
            ),
          ),

          // Form
          Expanded(
            child: _isUploading
                ? _buildUploadingView()
                : SingleChildScrollView(
                    padding: const EdgeInsets.all(16),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Audio + Image pickers in row
                          Row(
                            children: [
                              // Image preview
                              GestureDetector(
                                onTap: _pickImageFile,
                                child: Container(
                                  width: 100,
                                  height: 100,
                                  decoration: BoxDecoration(
                                    color: Colors.grey[900],
                                    borderRadius: BorderRadius.circular(8),
                                    image: _imageFile != null
                                        ? DecorationImage(
                                            image: FileImage(_imageFile!),
                                            fit: BoxFit.cover,
                                          )
                                        : null,
                                  ),
                                  child: _imageFile == null
                                      ? Column(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            Icon(Icons.add_photo_alternate,
                                                color: Colors.grey[600], size: 32),
                                            const SizedBox(height: 4),
                                            Text('Ảnh bìa',
                                                style: TextStyle(
                                                    color: Colors.grey[600], fontSize: 12)),
                                          ],
                                        )
                                      : null,
                                ),
                              ),
                              const SizedBox(width: 16),
                              // Audio picker
                              Expanded(
                                child: _buildFilePicker(
                                  icon: Icons.audio_file,
                                  label: _audioFileName ?? 'Chọn file audio',
                                  isSelected: _audioFile != null,
                                  onTap: _pickAudioFile,
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 20),

                          // Title
                          _buildTextField(
                            controller: _titleController,
                            label: 'Tên bài hát *',
                            hint: 'Nhập tên bài hát',
                            validator: (v) =>
                                v?.trim().isEmpty == true ? 'Bắt buộc' : null,
                          ),

                          const SizedBox(height: 16),

                          // Artist
                          _buildTextField(
                            controller: _artistController,
                            label: 'Nghệ sĩ *',
                            hint: 'Nhập tên nghệ sĩ',
                            validator: (v) =>
                                v?.trim().isEmpty == true ? 'Bắt buộc' : null,
                          ),

                          const SizedBox(height: 16),

                          // Topic
                          _buildLabel('Chủ đề (tuỳ chọn)'),
                          const SizedBox(height: 8),
                          _buildTopicDropdown(),

                          const SizedBox(height: 16),

                          // Lyrics
                          _buildTextField(
                            controller: _lyricsController,
                            label: 'Lời bài hát (tuỳ chọn)',
                            hint: 'Nhập lời bài hát...',
                            maxLines: 4,
                          ),

                          const SizedBox(height: 16),

                          // Public/Private toggle
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.05),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.1),
                              ),
                            ),
                            child: SwitchListTile(
                              title: const Text(
                                'Công khai bài hát',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 14,
                                ),
                              ),
                              subtitle: Text(
                                _isPublic
                                    ? 'Mọi người có thể nghe bài hát này'
                                    : 'Chỉ bạn mới có thể nghe bài hát này',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.6),
                                  fontSize: 12,
                                ),
                              ),
                              value: _isPublic,
                              onChanged: (value) {
                                setState(() => _isPublic = value);
                              },
                              activeColor: const Color(0xFF1DB954),
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 4,
                              ),
                            ),
                          ),

                          const SizedBox(height: 24),

                          // Upload button
                          SizedBox(
                            width: double.infinity,
                            height: 50,
                            child: ElevatedButton(
                              onPressed: _uploadSong,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: const Color(0xFF1DB954),
                                foregroundColor: Colors.white,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(25),
                                ),
                              ),
                              child: const Text(
                                'Upload',
                                style: TextStyle(
                                    fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),

                          const SizedBox(height: 32),
                        ],
                      ),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildUploadingView() {
    return const Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(color: Color(0xFF1DB954)),
          SizedBox(height: 24),
          Text(
            'Đang upload...',
            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          SizedBox(height: 8),
          Text(
            'Vui lòng chờ trong giây lát',
            style: TextStyle(color: Colors.grey, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildLabel(String text) {
    return Text(
      text,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 14,
        fontWeight: FontWeight.w600,
      ),
    );
  }

  Widget _buildFilePicker({
    required IconData icon,
    required String label,
    required bool isSelected,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.grey[900],
          borderRadius: BorderRadius.circular(8),
          border: Border.all(
            color: isSelected ? const Color(0xFF1DB954) : Colors.grey[700]!,
          ),
        ),
        child: Row(
          children: [
            Icon(icon, color: isSelected ? const Color(0xFF1DB954) : Colors.grey),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: isSelected ? Colors.white : Colors.grey,
                  fontSize: 14,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            Icon(
              isSelected ? Icons.check_circle : Icons.add_circle_outline,
              color: isSelected ? const Color(0xFF1DB954) : Colors.grey,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required String hint,
    String? Function(String?)? validator,
    int maxLines = 1,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildLabel(label),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          validator: validator,
          maxLines: maxLines,
          style: const TextStyle(color: Colors.white),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: Colors.grey[600]),
            filled: true,
            fillColor: Colors.grey[900],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey[700]!),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: BorderSide(color: Colors.grey[700]!),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: Color(0xFF1DB954)),
            ),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }

  Widget _buildTopicDropdown() {
    if (_isLoadingTopics) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        decoration: BoxDecoration(
          color: Colors.grey[900],
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Row(
          children: [
            SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            SizedBox(width: 12),
            Text('Đang tải...', style: TextStyle(color: Colors.grey)),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[700]!),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<Topic>(
          value: _selectedTopic,
          hint: Text('Chọn chủ đề', style: TextStyle(color: Colors.grey[600])),
          isExpanded: true,
          dropdownColor: Colors.grey[900],
          icon: const Icon(Icons.arrow_drop_down, color: Colors.grey),
          items: _topics.map((topic) {
            return DropdownMenuItem<Topic>(
              value: topic,
              child: Text(topic.name, style: const TextStyle(color: Colors.white)),
            );
          }).toList(),
          onChanged: (topic) => setState(() => _selectedTopic = topic),
        ),
      ),
    );
  }
}
