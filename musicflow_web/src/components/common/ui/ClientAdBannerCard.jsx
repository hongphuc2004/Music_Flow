import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Chip } from '@mui/material';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import { useNavigate } from 'react-router-dom';
import { useClientPlayer } from '../../Layout/client/ClientPlayerProvider';
import { clientAdsApi } from '../../../services/client/client.service';

/**
 * Banner quảng cáo dịch vụ / chiến dịch động phong cách Zing MP3 / Spotify.
 * Lấy danh sách từ clientAdsApi.getBannerAds(), tích hợp tracking Impression & Click.
 * Tự động ẩn hoàn toàn đối với tài khoản PLUS / PREMIUM.
 */
function ClientAdBannerCard({ sx = {} }) {
  const [dismissed, setDismissed] = useState(false);
  const [currentBanner, setCurrentBanner] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const { userTier, isPremium } = useClientPlayer();
  const navigate = useNavigate();

  // Ref lưu lại các ID đã ghi nhận Impression để tránh spam tracking do re-render
  const recordedImpressionRef = useRef(new Set());

  // 1. Kiểm tra quyền lợi: Ẩn hoàn toàn với tài khoản PLUS hoặc PREMIUM
  const isAdFree = isPremium || userTier === 'plus' || userTier === 'premium';

  useEffect(() => {
    if (isAdFree || dismissed) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const fetchBanner = async () => {
      try {
        setIsLoading(true);
        const res = await clientAdsApi.getBannerAds();
        if (!isMounted) return;

        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          // Lấy banner có độ ưu tiên cao nhất
          const selectedBanner = res.data.data[0];
          setCurrentBanner(selectedBanner);

          // Ghi nhận Impression duy nhất 1 lần cho banner ID này
          const bannerId = selectedBanner._id || selectedBanner.id;
          if (bannerId && !recordedImpressionRef.current.has(bannerId)) {
            recordedImpressionRef.current.add(bannerId);
            clientAdsApi.recordImpression(bannerId).catch(() => {});
          }
        } else {
          // Nếu backend trả về rỗng, fallback về House Ad mặc định
          setCurrentBanner(null);
        }
      } catch (err) {
        console.warn('[ClientAdBannerCard] Failed to fetch banner ads, fallbacking:', err.message);
        if (isMounted) setCurrentBanner(null);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchBanner();

    return () => {
      isMounted = false;
    };
  }, [isAdFree, dismissed]);

  // Nếu là tài khoản trả phí hoặc người dùng đã bấm tắt banner
  if (isAdFree || dismissed) {
    return null;
  }

  // Khi đang tải và chưa có dữ liệu, không render để tránh giật giao diện
  if (isLoading && !currentBanner) {
    return null;
  }

  // Xử lý khi người dùng click vào banner
  const handleClickBanner = () => {
    if (currentBanner) {
      const bannerId = currentBanner._id || currentBanner.id;
      if (bannerId) {
        clientAdsApi.recordClick(bannerId).catch(() => {});
      }

      const target = currentBanner.targetUrl || '/client/premium';
      if (target.startsWith('http://') || target.startsWith('https://')) {
        window.open(target, '_blank', 'noopener,noreferrer');
      } else {
        navigate(target);
      }
    } else {
      // House Ad fallback
      navigate('/client/premium');
    }
  };

  // Dữ liệu hiển thị (từ Banner động hoặc Fallback House Ad)
  const displayTitle =
    currentBanner?.title || 'Nghe nhạc liền mạch không quảng cáo & Mở khóa âm thanh 320kbps';
  const displayDescription =
    currentBanner?.description ||
    'Trải nghiệm chất lượng âm thanh phòng thu Studio HQ và tận hưởng danh sách bài hát trọn vẹn.';
  const displayImage = currentBanner?.imageUrl || '';
  const isExternalUrl =
    currentBanner?.targetUrl?.startsWith('http://') ||
    currentBanner?.targetUrl?.startsWith('https://');

  return (
    <Box
      sx={{
        my: 3.5,
        p: { xs: 2.2, md: 2.8 },
        borderRadius: 4,
        background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.16) 0%, rgba(0, 188, 212, 0.12) 100%)',
        border: '1px solid rgba(108, 99, 255, 0.35)',
        position: 'relative',
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'space-between',
        gap: 2,
        boxShadow: '0 8px 32px rgba(108, 99, 255, 0.12)',
        ...sx,
      }}
    >
      {/* Decorative background glow */}
      <Box
        sx={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 140,
          height: 140,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0, 188, 212, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0, pr: { xs: 4, sm: 0 }, flexGrow: 1 }}>
        {/* Banner image or fallback icon */}
        {displayImage ? (
          <Box
            component="img"
            src={displayImage}
            alt={displayTitle}
            sx={{
              width: { xs: 48, sm: 56 },
              height: { xs: 48, sm: 56 },
              borderRadius: 3,
              objectFit: 'cover',
              flexShrink: 0,
              boxShadow: '0 6px 16px rgba(108, 99, 255, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}
          />
        ) : (
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: 3,
              background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow: '0 6px 16px rgba(108, 99, 255, 0.4)',
            }}
          >
            {currentBanner ? (
              <CampaignRoundedIcon sx={{ color: 'white', fontSize: 26 }} />
            ) : (
              <WorkspacePremiumRoundedIcon sx={{ color: 'white', fontSize: 28 }} />
            )}
          </Box>
        )}

        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.4 }}>
            <Chip
              label={currentBanner ? 'TÀI TRỢ' : 'GÓI PLUS'}
              size="small"
              sx={{
                bgcolor: currentBanner ? 'rgba(255, 179, 0, 0.18)' : 'rgba(0, 188, 212, 0.2)',
                color: currentBanner ? '#ffb300' : '#00bcd4',
                fontWeight: 800,
                fontSize: '0.7rem',
                border: currentBanner ? '1px solid rgba(255, 179, 0, 0.4)' : '1px solid rgba(0, 188, 212, 0.4)',
                height: 20,
              }}
            />
            {!currentBanner && (
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', fontWeight: 600 }}>
                Chỉ 20.000đ / tháng
              </Typography>
            )}
          </Box>

          <Typography
            variant="h6"
            sx={{
              fontWeight: 800,
              fontSize: { xs: '0.96rem', sm: '1.05rem' },
              color: 'white',
              lineHeight: 1.3,
            }}
          >
            {displayTitle}
          </Typography>

          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.65)',
              fontSize: '0.82rem',
              mt: 0.3,
              display: { xs: 'none', md: 'block' },
            }}
          >
            {displayDescription}
          </Typography>
        </Box>
      </Box>

      {/* Action CTA & Close Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, alignSelf: { xs: 'stretch', sm: 'auto' }, flexShrink: 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={isExternalUrl ? <OpenInNewRoundedIcon /> : <GraphicEqRoundedIcon />}
          onClick={handleClickBanner}
          sx={{
            background: 'linear-gradient(135deg, #6c63ff 0%, #00bcd4 100%)',
            color: 'white',
            fontWeight: 800,
            fontSize: '0.85rem',
            textTransform: 'none',
            borderRadius: 2.5,
            px: 2.8,
            py: 1,
            boxShadow: '0 6px 20px rgba(108, 99, 255, 0.35)',
            whiteSpace: 'nowrap',
            '&:hover': {
              background: 'linear-gradient(135deg, #5b52f2 0%, #00acc1 100%)',
            },
          }}
        >
          {currentBanner ? 'Khám phá ngay' : 'Nâng cấp ngay'}
        </Button>

        <IconButton
          size="small"
          onClick={() => setDismissed(true)}
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
            '&:hover': { color: 'white' },
          }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );
}

export default ClientAdBannerCard;
