/**
 * Client Capability Detection Service
 *
 * Determines what media formats a client device can play natively.
 * Uses a combination of:
 * - User agent parsing
 * - Declared capabilities from client
 * - Device profile presets
 * - Historical playback success/failure
 *
 * @see docs/TRANSCODING_PIPELINE.md §5 for specification
 */

import type {
  ClientCapabilities,
  MaxResolution,
  VideoCodecSupport,
} from '@mediaserver/core';

/** Known device profiles */
export type DeviceProfile =
  | 'web_chrome'
  | 'web_firefox'
  | 'web_safari'
  | 'web_edge'
  | 'ios_safari'
  | 'ios_app'
  | 'android_chrome'
  | 'android_app'
  | 'roku'
  | 'fire_tv'
  | 'apple_tv'
  | 'chromecast'
  | 'lg_webos'
  | 'samsung_tizen'
  | 'ps4'
  | 'ps5'
  | 'xbox'
  | 'unknown';

/**
 * Preset device capabilities for known devices.
 */
const DEVICE_PROFILES: Record<DeviceProfile, ClientCapabilities> = {
  // Web browsers
  web_chrome: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: false }, // Chrome doesn't support HEVC by default
      vp9: { supported: true, profile: 2 },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: false,
      eac3: false,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 2, // Stereo for web
    hdr: {
      hdr10: false,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: false,
    },
    maxResolution: '4k',
    confidenceScore: 0.9,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  web_firefox: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: false },
      vp9: { supported: true, profile: 2 },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: false,
      eac3: false,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 2,
    hdr: {
      hdr10: false,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: false,
    },
    maxResolution: '4k',
    confidenceScore: 0.9,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  web_safari: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.2', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: false },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: false,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.95,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  web_edge: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' }, // Edge supports HEVC on Windows
      vp9: { supported: true, profile: 2 },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: false,
    },
    maxResolution: '4k',
    confidenceScore: 0.85,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  // iOS
  ios_safari: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.2', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: false },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: false,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.95,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  ios_app: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.2', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: false },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: false,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.98,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  // Android
  android_chrome: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: false }, // Most Android Chrome doesn't support HEVC
      vp9: { supported: true, profile: 2 },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: false,
      eac3: false,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 2,
    hdr: {
      hdr10: false,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: false,
    },
    maxResolution: '4k',
    confidenceScore: 0.8,
    rangeReliability: 'suspect', // Android range handling can be inconsistent
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  android_app: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.2', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: true, profile: 2 },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: true,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.9,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  // Streaming devices
  roku: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: true },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: false,
      flac: false,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: false,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.9,
    rangeReliability: 'untrusted', // Roku prefers HLS
    supportsPlaybackSpeed: false,
    supportsTrickplay: 'bif',
  },

  fire_tv: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: true },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: false,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.9,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'bif',
  },

  apple_tv: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.2', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: false },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: false,
      flac: true,
      truehd: true,
    },
    maxAudioChannels: 8,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: true,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.98,
    rangeReliability: 'trusted',
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  chromecast: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: true, profile: 2 },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: true,
      flac: true,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: false,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.9,
    rangeReliability: 'untrusted', // Chromecast prefers HLS
    supportsPlaybackSpeed: true,
    supportsTrickplay: 'webvtt',
  },

  // Smart TVs
  lg_webos: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: true },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: true,
      opus: false,
      flac: false,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: true,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.85,
    rangeReliability: 'suspect',
    supportsPlaybackSpeed: false,
    supportsTrickplay: 'none',
  },

  samsung_tizen: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: true },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: true,
      opus: false,
      flac: false,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.85,
    rangeReliability: 'suspect',
    supportsPlaybackSpeed: false,
    supportsTrickplay: 'none',
  },

  // Game consoles
  ps4: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.1', maxResolution: '1080p' },
      hevc: { supported: false },
      vp9: { supported: false },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: false,
      dts: false,
      opus: false,
      flac: false,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: false,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: false,
    },
    maxResolution: '1080p',
    confidenceScore: 0.95,
    rangeReliability: 'untrusted',
    supportsPlaybackSpeed: false,
    supportsTrickplay: 'none',
  },

  ps5: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.2', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: false },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: false,
      opus: false,
      flac: false,
      truehd: false,
    },
    maxAudioChannels: 6,
    hdr: {
      hdr10: true,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.95,
    rangeReliability: 'untrusted',
    supportsPlaybackSpeed: false,
    supportsTrickplay: 'none',
  },

  xbox: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '5.2', maxResolution: '4k' },
      hevc: { supported: true, maxLevel: '5.1', maxResolution: '4k' },
      vp9: { supported: true },
      av1: { supported: true },
    },
    audioCodecs: {
      aac: true,
      ac3: true,
      eac3: true,
      dts: true,
      opus: false,
      flac: true,
      truehd: true,
    },
    maxAudioChannels: 8,
    hdr: {
      hdr10: true,
      dolbyVision: true,
      dvProfile5: true,
      dvProfile7: false,
      dvProfile8: true,
      hlg: true,
    },
    maxResolution: '4k',
    confidenceScore: 0.95,
    rangeReliability: 'untrusted',
    supportsPlaybackSpeed: false,
    supportsTrickplay: 'none',
  },

  // Fallback
  unknown: {
    videoCodecs: {
      h264: { supported: true, maxLevel: '4.1', maxResolution: '1080p' },
      hevc: { supported: false },
      vp9: { supported: false },
      av1: { supported: false },
    },
    audioCodecs: {
      aac: true,
      ac3: false,
      eac3: false,
      dts: false,
      opus: false,
      flac: false,
      truehd: false,
    },
    maxAudioChannels: 2,
    hdr: {
      hdr10: false,
      dolbyVision: false,
      dvProfile5: false,
      dvProfile7: false,
      dvProfile8: false,
      hlg: false,
    },
    maxResolution: '1080p',
    confidenceScore: 0.5,
    rangeReliability: 'untrusted',
    supportsPlaybackSpeed: false,
    supportsTrickplay: 'none',
  },
};

/**
 * Detect device profile from user agent string.
 */
export function detectDeviceProfile(userAgent: string): DeviceProfile {
  const ua = userAgent.toLowerCase();

  // iOS detection
  if (ua.includes('iphone') || ua.includes('ipad')) {
    if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('firefox')) {
      return 'ios_safari';
    }
    // Custom app
    return 'ios_app';
  }

  // Apple TV
  if (ua.includes('appletv')) {
    return 'apple_tv';
  }

  // Android detection
  if (ua.includes('android')) {
    if (ua.includes('chrome')) {
      return 'android_chrome';
    }
    // Fire TV
    if (ua.includes('silk') || ua.includes('aftm') || ua.includes('aftt')) {
      return 'fire_tv';
    }
    // Custom app
    return 'android_app';
  }

  // Roku
  if (ua.includes('roku')) {
    return 'roku';
  }

  // Chromecast
  if (ua.includes('crkey') || ua.includes('chromecast')) {
    return 'chromecast';
  }

  // Smart TVs
  if (ua.includes('webos') || ua.includes('netcast')) {
    return 'lg_webos';
  }
  if (ua.includes('tizen') || ua.includes('samsung')) {
    return 'samsung_tizen';
  }

  // Game consoles
  if (ua.includes('playstation 4')) {
    return 'ps4';
  }
  if (ua.includes('playstation 5')) {
    return 'ps5';
  }
  if (ua.includes('xbox')) {
    return 'xbox';
  }

  // Desktop browsers
  if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('firefox')) {
    return 'web_safari';
  }
  if (ua.includes('edg/')) {
    return 'web_edge';
  }
  if (ua.includes('firefox')) {
    return 'web_firefox';
  }
  if (ua.includes('chrome')) {
    return 'web_chrome';
  }

  return 'unknown';
}

/**
 * Get client capabilities from device profile.
 */
export function getClientCapabilities(profile: DeviceProfile): ClientCapabilities {
  return DEVICE_PROFILES[profile];
}

/**
 * Detect client capabilities from user agent string.
 */
export function detectClientCapabilities(userAgent: string): ClientCapabilities {
  const profile = detectDeviceProfile(userAgent);
  return getClientCapabilities(profile);
}

/**
 * Merge declared capabilities with profile defaults.
 *
 * Clients can declare additional capabilities they support,
 * which override the profile defaults.
 */
export function mergeClientCapabilities(
  baseProfile: DeviceProfile,
  declared: Partial<ClientCapabilities>
): ClientCapabilities {
  const base = getClientCapabilities(baseProfile);

  return {
    ...base,
    ...declared,
    videoCodecs: {
      ...base.videoCodecs,
      ...(declared.videoCodecs ?? {}),
    },
    audioCodecs: {
      ...base.audioCodecs,
      ...(declared.audioCodecs ?? {}),
    },
    hdr: {
      ...base.hdr,
      ...(declared.hdr ?? {}),
    },
    // Lower confidence if client declares capabilities
    confidenceScore: declared.confidenceScore ?? base.confidenceScore * 0.9,
  };
}

/**
 * Check if client supports a specific video codec.
 */
export function clientSupportsVideoCodec(
  caps: ClientCapabilities,
  codec: string,
  level?: number,
  resolution?: { width: number; height: number }
): boolean {
  const codecLower = codec.toLowerCase();

  let codecSupport: VideoCodecSupport | undefined;

  if (codecLower === 'h264' || codecLower === 'avc') {
    codecSupport = caps.videoCodecs.h264;
  } else if (codecLower === 'hevc' || codecLower === 'h265') {
    codecSupport = caps.videoCodecs.hevc;
  } else if (codecLower === 'vp9') {
    codecSupport = caps.videoCodecs.vp9;
  } else if (codecLower === 'av1') {
    codecSupport = caps.videoCodecs.av1;
  }

  if (!codecSupport?.supported) {
    return false;
  }

  // Check level if specified
  if (level && codecSupport.maxLevel) {
    const maxLevel = parseFloat(codecSupport.maxLevel);
    if (level > maxLevel * 10) {
      // Levels are often specified as 5.1 = 51
      return false;
    }
  }

  // Check resolution if specified
  if (resolution && codecSupport.maxResolution) {
    const maxRes = codecSupport.maxResolution;
    const maxHeight =
      maxRes === '4k' ? 2160 : maxRes === '1080p' ? 1080 : maxRes === '720p' ? 720 : 480;

    if (resolution.height > maxHeight) {
      return false;
    }
  }

  return true;
}

/**
 * Check if client supports a specific audio codec.
 */
export function clientSupportsAudioCodec(
  caps: ClientCapabilities,
  codec: string,
  channels?: number
): boolean {
  const codecLower = codec.toLowerCase();

  let supported = false;

  if (codecLower === 'aac') {
    supported = caps.audioCodecs.aac;
  } else if (codecLower === 'ac3' || codecLower === 'ac-3') {
    supported = caps.audioCodecs.ac3;
  } else if (codecLower === 'eac3' || codecLower === 'e-ac-3') {
    supported = caps.audioCodecs.eac3;
  } else if (codecLower === 'dts' || codecLower.startsWith('dts')) {
    supported = caps.audioCodecs.dts;
  } else if (codecLower === 'opus') {
    supported = caps.audioCodecs.opus;
  } else if (codecLower === 'flac') {
    supported = caps.audioCodecs.flac;
  } else if (codecLower === 'truehd') {
    supported = caps.audioCodecs.truehd;
  }

  if (!supported) {
    return false;
  }

  // Check channel count
  if (channels && channels > caps.maxAudioChannels) {
    return false;
  }

  return true;
}

/**
 * Check if client supports HDR content.
 */
export function clientSupportsHDR(
  caps: ClientCapabilities,
  format: string
): boolean {
  const formatLower = format.toLowerCase();

  if (formatLower === 'hdr10') {
    return caps.hdr.hdr10;
  }
  if (formatLower === 'hlg') {
    return caps.hdr.hlg;
  }
  if (formatLower === 'dv_p5' || formatLower === 'dolby_vision_p5') {
    return caps.hdr.dvProfile5;
  }
  if (formatLower === 'dv_p7' || formatLower === 'dolby_vision_p7') {
    return caps.hdr.dvProfile7;
  }
  if (formatLower === 'dv_p8' || formatLower === 'dolby_vision_p8') {
    return caps.hdr.dvProfile8;
  }
  if (formatLower.includes('dolby') || formatLower.includes('dv')) {
    return caps.hdr.dolbyVision;
  }

  return false;
}

/**
 * Get the maximum resolution the client supports as dimensions.
 */
export function getMaxResolutionDimensions(
  maxRes: MaxResolution
): { width: number; height: number } {
  switch (maxRes) {
    case '4k':
      return { width: 3840, height: 2160 };
    case '1080p':
      return { width: 1920, height: 1080 };
    case '720p':
      return { width: 1280, height: 720 };
    case '480p':
      return { width: 854, height: 480 };
    default:
      return { width: 1920, height: 1080 };
  }
}
