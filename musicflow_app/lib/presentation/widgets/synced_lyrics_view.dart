import 'package:flutter/material.dart';
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
  final Map<int, GlobalKey> _lineKeys = {};
  int _activeIndex = -1;

  GlobalKey _getKeyForIndex(int index) {
    return _lineKeys.putIfAbsent(index, () => GlobalKey());
  }

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
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _autoScrollToActiveLine();
      });
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
    if (!mounted || _activeIndex < 0) {
      return;
    }

    if (_activeIndex <= 0) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          0.0,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
        );
      }
      return;
    }

    final key = _lineKeys[_activeIndex];
    final ctx = key?.currentContext;
    if (ctx != null) {
      Scrollable.ensureVisible(
        ctx,
        alignment: 0.35,
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
    }
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

    return Stack(
      children: [
        ListView.builder(
          controller: _scrollController,
          physics: const BouncingScrollPhysics(),
          cacheExtent: 5000.0,
          padding: const EdgeInsets.only(
            left: 20,
            right: 20,
            top: 14,
            bottom: 120,
          ),
          itemCount: widget.lyrics.length,
          itemBuilder: (context, index) {
            final line = widget.lyrics[index];
            final isActive = index == _activeIndex;

            return InkWell(
              key: _getKeyForIndex(index),
              onTap: !widget.isSynced || widget.onLineTap == null
                  ? null
                  : () => widget.onLineTap!(line.timestamp),
              highlightColor: Colors.transparent,
              splashColor: Colors.transparent,
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 8,
                  vertical: 10,
                ),
                child: AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 250),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: widget.isSynced
                        ? (isActive
                            ? Colors.white
                            : Colors.white.withOpacity(0.36))
                        : Colors.white.withOpacity(0.70),
                    fontSize: widget.isSynced ? (isActive ? 20.0 : 15.5) : 16,
                    fontWeight: widget.isSynced
                        ? (isActive ? FontWeight.w800 : FontWeight.w600)
                        : FontWeight.w500,
                    letterSpacing: isActive ? -0.2 : 0.0,
                    height: 1.38,
                    shadows: isActive && widget.isSynced
                        ? [
                            Shadow(
                              color: Colors.black.withOpacity(0.85),
                              offset: const Offset(0, 2),
                              blurRadius: 10,
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    line.text.isEmpty ? '...' : line.text,
                    textAlign: TextAlign.center,
                    softWrap: true,
                  ),
                ),
              ),
            );
          },
        ),

        // Top edge subtle fade vignette
        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 32,
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withOpacity(0.45),
                    Colors.black.withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),
        ),

        // Bottom edge soft fade vignette
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 52,
          child: IgnorePointer(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [
                    Colors.black.withOpacity(0.75),
                    Colors.black.withOpacity(0.0),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}


