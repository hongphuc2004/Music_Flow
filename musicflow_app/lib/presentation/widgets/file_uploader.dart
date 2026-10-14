import 'dart:io';
import 'package:flutter/material.dart';

class FileUploader extends StatelessWidget {
  final File? file;
  final String? fileName;
  final int? fileSize;
  final String title;
  final String browseText;
  final String subtitle;
  final VoidCallback onTap;
  final VoidCallback? onRemove;
  final bool compact;
  final bool isAudio;
  final bool isImage;

  const FileUploader({
    super.key,
    required this.onTap,
    this.file,
    this.fileName,
    this.fileSize,
    this.title = 'Kéo thả hoặc',
    this.browseText = 'chọn file',
    this.subtitle = 'MP3, M4A · tối đa 50 MB',
    this.onRemove,
    this.compact = false,
    this.isAudio = true,
    this.isImage = false,
  });

  String _formatSize(int? bytes) {
    if (bytes == null || bytes <= 0) return '';
    if (bytes > 1048576) {
      return '${(bytes / 1048576).toStringAsFixed(1)} MB';
    }
    return '${(bytes / 1024).round()} KB';
  }

  Color _getExtensionColor(String ext) {
    switch (ext.toLowerCase()) {
      case 'mp3':
        return const Color(0xFF3D8BFF);
      case 'm4a':
      case 'wav':
        return const Color(0xFF8B6CFF);
      case 'flac':
        return const Color(0xFF1FB89A);
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'webp':
        return const Color(0xFF22A06B);
      case 'pdf':
        return const Color(0xFFE5484D);
      default:
        return const Color(0xFF6C63FF);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final effectiveName = fileName ?? file?.path.split(Platform.pathSeparator).last;
    final ext = effectiveName != null && effectiveName.contains('.')
        ? effectiveName.split('.').last.toUpperCase()
        : (isAudio ? 'MP3' : (isImage ? 'IMG' : 'FILE'));

    if (effectiveName != null) {
      // Prompt #032 Uploaded File Row Card
      return Container(
        height: compact ? 62 : 68,
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF13141C) : Colors.white,
          borderRadius: BorderRadius.circular(18),
          border: Border.all(
            color: isDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.08),
            width: 1,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.3 : 0.04),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: Row(
                children: [
                  // Extension badge
                  Container(
                    width: 38,
                    height: 42,
                    decoration: BoxDecoration(
                      color: _getExtensionColor(ext),
                      borderRadius: BorderRadius.circular(9),
                      boxShadow: [
                        BoxShadow(
                          color: _getExtensionColor(ext).withOpacity(0.4),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    alignment: Alignment.bottomCenter,
                    padding: const EdgeInsets.only(bottom: 5),
                    child: Text(
                      ext.length > 4 ? ext.substring(0, 4) : ext,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),

                  // File metadata
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          effectiveName,
                          style: TextStyle(
                            color: isDark ? const Color(0xFFF4F0E8) : const Color(0xFF16151B),
                            fontSize: 13.5,
                            fontWeight: FontWeight.w600,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 3),
                        Text(
                          fileSize != null
                              ? '${_formatSize(fileSize)} · Sẵn sàng'
                              : 'File đã chọn · Sẵn sàng tải lên',
                          style: TextStyle(
                            color: isDark ? Colors.white.withOpacity(0.45) : const Color(0xFF8E8A97),
                            fontSize: 11.5,
                            fontFeatures: const [FontFeature.tabularFigures()],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Success check badge
                  Container(
                    width: 28,
                    height: 28,
                    decoration: const BoxDecoration(
                      color: Color(0xFF119C72),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 17,
                    ),
                  ),

                  // Remove button if provided
                  if (onRemove != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 18),
                      color: isDark ? Colors.white54 : Colors.black45,
                      splashRadius: 18,
                      onPressed: onRemove,
                      tooltip: 'Xóa file',
                    ),
                  ],
                ],
              ),
            ),

            // Bottom accent progress line
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                height: 3,
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFF7B61FF), Color(0xFF3D8BFF), Color(0xFF1FB89A)],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }

    // Prompt #032 Drop Zone Empty State
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(22),
      child: CustomPaint(
        painter: _DashedBorderPainter(
          color: isDark ? Colors.white.withOpacity(0.18) : Colors.black.withOpacity(0.14),
          strokeWidth: 1.8,
          dashWidth: 7,
          dashSpace: 6,
          radius: 22,
        ),
        child: Container(
          width: double.infinity,
          height: compact ? 120 : 156,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF13141C).withOpacity(0.65) : const Color(0xFFFFFFFF),
            borderRadius: BorderRadius.circular(22),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Glowing squircle orb
              Container(
                width: compact ? 46 : 54,
                height: compact ? 46 : 54,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(compact ? 15 : 18),
                  gradient: const LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Color(0xFF5B8CFF), Color(0xFF8B6CFF)],
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x665B8CFF),
                      blurRadius: 18,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Center(
                  child: Icon(
                    isAudio
                        ? Icons.cloud_upload_rounded
                        : isImage
                            ? Icons.add_photo_alternate_rounded
                            : Icons.upload_file_rounded,
                    color: Colors.white,
                    size: compact ? 24 : 28,
                  ),
                ),
              ),
              SizedBox(height: compact ? 8 : 12),

              // Title with highlighted browseText
              RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: TextStyle(
                    fontFamily: 'Pretendard',
                    fontSize: compact ? 13 : 14.5,
                    fontWeight: FontWeight.w700,
                    color: isDark ? const Color(0xFFF4F0E8) : const Color(0xFF16151B),
                  ),
                  children: [
                    TextSpan(text: '$title '),
                    TextSpan(
                      text: browseText,
                      style: const TextStyle(
                        color: Color(0xFF6C63FF),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 4),

              // Subtitle
              Text(
                subtitle,
                style: TextStyle(
                  fontSize: compact ? 11 : 12,
                  color: isDark ? Colors.white.withOpacity(0.42) : const Color(0xFF8E8A97),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double dashWidth;
  final double dashSpace;
  final double radius;

  _DashedBorderPainter({
    required this.color,
    required this.strokeWidth,
    required this.dashWidth,
    required this.dashSpace,
    required this.radius,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final rrect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        strokeWidth / 2,
        strokeWidth / 2,
        size.width - strokeWidth,
        size.height - strokeWidth,
      ),
      Radius.circular(radius),
    );

    final path = Path()..addRRect(rrect);
    final metrics = path.computeMetrics();

    for (final metric in metrics) {
      double distance = 0;
      while (distance < metric.length) {
        final double length = distance + dashWidth > metric.length
            ? metric.length - distance
            : dashWidth;
        final extractPath = metric.extractPath(distance, distance + length);
        canvas.drawPath(extractPath, paint);
        distance += dashWidth + dashSpace;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.dashWidth != dashWidth ||
        oldDelegate.dashSpace != dashSpace ||
        oldDelegate.radius != radius;
  }
}
