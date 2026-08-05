import 'package:flutter/material.dart';
import 'package:musicflow_app/core/theme/app_theme.dart';
import 'package:musicflow_app/data/models/lrc_line_model.dart';

class SyncedLyricsView extends StatefulWidget {
  final List<LrcLine> lyrics;
  final Duration currentPosition;
  final ValueChanged<Duration>? onLineTap;
  final bool isSynced;

  const SyncedLyricsView({
    super.key,
    required this.lyrics,
    required this.currentPosition,
    this.onLineTap,
    this.isSynced = true,
  });

  @override
  State<SyncedLyricsView> createState() => _SyncedLyricsViewState();
}

class _SyncedLyricsViewState extends State<SyncedLyricsView> {
  final ScrollController _scrollController = ScrollController();
  static const double _itemExtent = 56.0;

  int _activeIndex = -1;

  @override
  void initState() {
    super.initState();
    if (widget.isSynced) {
      _activeIndex = _findActiveIndex(widget.currentPosition, widget.lyrics);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _autoScrollToActiveLine();
      });
    }
  }

  @override
  void didUpdateWidget(covariant SyncedLyricsView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!widget.isSynced) {
      _activeIndex = -1;
      return;
    }

    final nextActive = _findActiveIndex(widget.currentPosition, widget.lyrics);

    if (nextActive != _activeIndex) {
      _activeIndex = nextActive;
      _autoScrollToActiveLine();
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  int _findActiveIndex(Duration position, List<LrcLine> lines) {
    if (lines.isEmpty) {
      return -1;
    }

    for (int i = lines.length - 1; i >= 0; i--) {
      if (position >= lines[i].timestamp) {
        return i;
      }
    }

    return -1;
  }

  void _autoScrollToActiveLine() {
    if (!_scrollController.hasClients || _activeIndex < 0) {
      return;
    }

    final viewportHeight = _scrollController.position.viewportDimension;
    final targetOffset =
        (_activeIndex * _itemExtent) - (viewportHeight / 2) + (_itemExtent / 2);

    final clampedOffset = targetOffset.clamp(
      _scrollController.position.minScrollExtent,
      _scrollController.position.maxScrollExtent,
    );

    _scrollController.animateTo(
      clampedOffset.toDouble(),
      duration: const Duration(milliseconds: 300),
      curve: Curves.fastOutSlowIn,
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.lyrics.isEmpty) {
      return const Center(
        child: Text(
          'Bài hát chưa có lời',
          style: TextStyle(color: Colors.white54, fontSize: 16),
        ),
      );
    }

    return ListView.builder(
      controller: _scrollController,
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 100),
      itemExtent: _itemExtent,
      itemCount: widget.lyrics.length,
      itemBuilder: (context, index) {
        final line = widget.lyrics[index];
        final isActive = index == _activeIndex;

        return InkWell(
          onTap: !widget.isSynced || widget.onLineTap == null
              ? null
              : () => widget.onLineTap!(line.timestamp),
          highlightColor: Colors.transparent,
          splashColor: Colors.transparent,
          child: Container(
            alignment: Alignment.center,
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 250),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: widget.isSynced
                    ? (isActive ? AppColors.secondary : Colors.white.withOpacity(0.35))
                    : Colors.white.withOpacity(0.65),
                fontSize: widget.isSynced ? (isActive ? 22 : 16) : 17,
                fontWeight: widget.isSynced
                    ? (isActive ? FontWeight.bold : FontWeight.w500)
                    : FontWeight.w500,
                shadows: isActive && widget.isSynced
                    ? [
                        Shadow(
                          color: AppColors.secondary.withOpacity(0.6),
                          blurRadius: 12,
                        ),
                      ]
                    : null,
                height: 1.3,
              ),
              child: Text(
                line.text.isEmpty ? '...' : line.text,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        );
      },
    );
  }
}
