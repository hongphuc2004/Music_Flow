import 'dart:math';

import 'package:flutter/material.dart';
import 'package:musicflow_app/core/audio/global_audio_state.dart';
import 'package:musicflow_app/data/models/artist_profile_model.dart';
import 'package:musicflow_app/data/models/song_model.dart';
import 'package:musicflow_app/data/services/artist_api_service.dart';
import 'package:musicflow_app/data/services/auth_service.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_about_section.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_header_section.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_popular_section.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_release_section.dart';
import 'package:musicflow_app/presentation/screens/artist/artist_shared.dart';

class ArtistScreen extends StatefulWidget {
  final String artistName;
  final void Function(Song song)? onSongTap;
  final void Function(List<Song> songs, {int startIndex})? onPlayAll;

  const ArtistScreen({
    super.key,
    required this.artistName,
    this.onSongTap,
    this.onPlayAll,
  });

  @override
  State<ArtistScreen> createState() => _ArtistScreenState();
}

class _ArtistScreenState extends State<ArtistScreen> {
  final GlobalAudioState _audioState = GlobalAudioState();
  ArtistProfile? _artist;
  bool _isLoading = true;
  bool _isFollowLoading = false;
  bool _isFollowing = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadArtist();
  }

  Future<void> _loadArtist() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final result = await ArtistApiService.fetchArtistProfileByName(widget.artistName);
    if (!mounted) return;

    setState(() {
      _isLoading = false;
      _artist = result.artist;
      _errorMessage = result.success ? null : result.message;
    });

    if (result.success && result.artist != null) {
      await _loadFollowStatus(result.artist!.id);
    }
  }

  Future<void> _loadFollowStatus(String artistId) async {
    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn || !mounted) {
      setState(() {
        _isFollowing = false;
      });
      return;
    }

    final followStatus = await ArtistApiService.getFollowStatus(artistId);
    if (!mounted) return;

    setState(() {
      _isFollowing = followStatus.isFollowing;
    });
  }

  void _handleSongTap(Song song, int index) {
    final songs = _artist?.songs ?? const <Song>[];
    if (songs.isEmpty) return;

    if (widget.onPlayAll != null) {
      widget.onPlayAll!(songs, startIndex: index);
    } else {
      _audioState.playPlaylist(songs, startIndex: index);
      widget.onSongTap?.call(song);
    }
  }

  void _handlePlayAll() {
    final songs = _artist?.songs ?? const <Song>[];
    if (songs.isEmpty) return;

    if (widget.onPlayAll != null) {
      widget.onPlayAll!(songs, startIndex: 0);
    } else {
      _audioState.playPlaylist(songs, startIndex: 0);
    }
  }

  void _handleShuffle() {
    final songs = List<Song>.from(_artist?.songs ?? const <Song>[]);
    if (songs.isEmpty) return;

    songs.shuffle(Random());
    if (widget.onPlayAll != null) {
      widget.onPlayAll!(songs, startIndex: 0);
    } else {
      _audioState.playPlaylist(songs, startIndex: 0);
    }
  }

  Future<void> _toggleFollow() async {
    final artist = _artist;
    if (artist == null || _isFollowLoading) return;

    final isLoggedIn = await AuthService.isLoggedIn();
    if (!isLoggedIn) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Vui long dang nhap de theo doi artist'),
          duration: Duration(seconds: 2),
        ),
      );
      return;
    }

    setState(() {
      _isFollowLoading = true;
    });

    final result = await ArtistApiService.toggleFollowArtist(artist.id);
    if (!mounted) return;

    setState(() {
      _isFollowLoading = false;
      if (result.success) {
        _isFollowing = result.isFollowing ?? _isFollowing;
        _artist = _artist?.copyWith(
          followers: result.followers ?? _artist!.followers,
        );
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          result.message ??
              (result.success ? 'Cap nhat theo doi thanh cong' : 'Khong the cap nhat theo doi'),
        ),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          const ArtistBackdrop(),
          SafeArea(
            bottom: false,
            child: _buildBody(),
          ),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            CircularProgressIndicator(color: ArtistPalette.accent),
            SizedBox(height: 14),
            Text(
              'Dang tai khong gian artist...',
              style: TextStyle(color: Colors.white70),
            ),
          ],
        ),
      );
    }

    if (_errorMessage != null || _artist == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: ArtistPalette.surface,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: Colors.white.withOpacity(0.06)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.person_search_rounded, size: 58, color: Colors.white54),
                const SizedBox(height: 14),
                const Text(
                  'Khong tim thay artist',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  _errorMessage ?? 'Artist nay hien chua co du lieu de hien thi.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
                const SizedBox(height: 18),
                ElevatedButton.icon(
                  onPressed: _loadArtist,
                  icon: const Icon(Icons.refresh_rounded),
                  label: const Text('Thu lai'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ArtistPalette.accent,
                    foregroundColor: Colors.black,
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return RefreshIndicator(
      onRefresh: _loadArtist,
      color: ArtistPalette.accent,
      backgroundColor: ArtistPalette.surface,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 110),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ArtistHeaderSection(
                    artist: _artist!,
                    isFollowing: _isFollowing,
                    isFollowLoading: _isFollowLoading,
                    onBack: () => Navigator.of(context).maybePop(),
                    onPlayAll: _handlePlayAll,
                    onShuffle: _handleShuffle,
                    onFollow: _toggleFollow,
                  ),
                  const SizedBox(height: 6),
                  ArtistPopularSection(
                    songs: _artist!.songs,
                    onSongTap: _handleSongTap,
                  ),
                  const SizedBox(height: 28),
                  ArtistReleaseSection(
                    latestSong: _artist!.songs.isNotEmpty ? _artist!.songs.first : null,
                  ),
                  const SizedBox(height: 28),
                  ArtistAboutSection(artist: _artist!),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

