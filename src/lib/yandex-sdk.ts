// Yandex Games SDK Integration for Eteria: Shadow War
// Documentation: https://yandex.ru/dev/games/doc/en/

declare global {
  interface Window {
    YaGames: {
      init: () => Promise<YandexSDK>;
    };
  }
}

interface YandexSDK {
  environment: {
    i18n: {
      lang: string;
    };
    payload: string;
  };
  
  // Player data
  getPlayer: (options?: { signed: boolean }) => Promise<YandexPlayer>;
  
  // Leaderboard
  getLeaderboards: () => Promise<YandexLeaderboards>;
  
  // Ads
  adv: {
    showFullscreenAdv: (callbacks: {
      onOpen?: () => void;
      onClose?: (wasShown: boolean) => void;
      onError?: (error: Error) => void;
    }) => void;
    showRewardedVideo: (callbacks: {
      onOpen?: () => void;
      onRewarded?: () => void;
      onClose?: () => void;
      onError?: (error: Error) => void;
    }) => void;
  };
  
  // Analytics
  analytics: {
    hit: (url?: string) => void;
    goal: (name: string, params?: Record<string, unknown>) => void;
  };
  
  // Feedback
  feedback: {
    canReview: () => Promise<{ value: boolean; reason: string }>;
    requestReview: () => Promise<{ feedbackSent: boolean }>;
  };
  
  // Device info
  deviceInfo: {
    type: 'desktop' | 'mobile' | 'tablet';
    isDesktop: boolean;
    isMobile: boolean;
    isTablet: boolean;
  };
}

interface YandexPlayer {
  signature: string;
  signatureReason: string;
  name: string;
  photo: string;
  uniqueID: string;
  getMode: () => Promise<{ mode: string }>;
  setData: (data: Record<string, unknown>, flush?: boolean) => Promise<void>;
  getData: (keys?: string[]) => Promise<Record<string, unknown>>;
}

interface YandexLeaderboards {
  setLeaderboardScore: (name: string, score: number, extraData?: string) => Promise<void>;
  getLeaderboard: (name: string, options?: {
    includeUser?: boolean;
    quantityAround?: number;
    top?: number;
  }) => Promise<{
    leaderboard: {
      name: string;
      default: boolean;
      description?: {
        inverted: boolean;
      };
    };
    ranges: Array<{
      start: number;
      size: number;
    }>;
    playerRank?: {
      rank: number;
      score: number;
    };
    topPlayers: Array<{
      score: number;
      rank: number;
      player: {
        publicName: string;
        photo: string;
      };
    }>;
  }>;
}

// Singleton SDK instance
let sdkInstance: YandexSDK | null = null;
let isInitialized = false;

// Initialize Yandex Games SDK
export async function initYandexSDK(): Promise<YandexSDK | null> {
  if (isInitialized && sdkInstance) {
    return sdkInstance;
  }
  
  // Check if we're in Yandex Games environment
  const isYandexGames = typeof window !== 'undefined' && 'YaGames' in window;
  
  if (!isYandexGames) {
    console.log('Not running in Yandex Games environment');
    isInitialized = true;
    return null;
  }
  
  try {
    sdkInstance = await window.YaGames.init();
    isInitialized = true;
    console.log('Yandex Games SDK initialized successfully');
    return sdkInstance;
  } catch (error) {
    console.error('Failed to initialize Yandex Games SDK:', error);
    isInitialized = true;
    return null;
  }
}

// Get current SDK instance
export function getSDK(): YandexSDK | null {
  return sdkInstance;
}

// Save game progress
export async function saveGameProgress(data: {
  level?: number;
  score?: number;
  victories?: number;
  defeats?: number;
  totalGames?: number;
  playTime?: number;
  settings?: {
    musicVolume?: number;
    sfxVolume?: number;
    difficulty?: string;
  };
}): Promise<boolean> {
  const sdk = getSDK();
  
  if (!sdk) {
    // Fallback to localStorage
    try {
      localStorage.setItem('eteria_save', JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
  
  try {
    const player = await sdk.getPlayer({ signed: true });
    await player.setData(data, true);
    return true;
  } catch (error) {
    console.error('Failed to save game progress:', error);
    return false;
  }
}

// Load game progress
export async function loadGameProgress(): Promise<{
  level?: number;
  score?: number;
  victories?: number;
  defeats?: number;
  totalGames?: number;
  playTime?: number;
  settings?: {
    musicVolume?: number;
    sfxVolume?: number;
    difficulty?: string;
  };
} | null> {
  const sdk = getSDK();
  
  if (!sdk) {
    // Fallback to localStorage
    try {
      const data = localStorage.getItem('eteria_save');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
  
  try {
    const player = await sdk.getPlayer({ signed: true });
    const data = await player.getData();
    return data as ReturnType<typeof loadGameProgress>;
  } catch (error) {
    console.error('Failed to load game progress:', error);
    return null;
  }
}

// Submit high score
export async function submitHighScore(score: number): Promise<boolean> {
  const sdk = getSDK();
  
  if (!sdk) {
    console.log('SDK not available, skipping leaderboard submission');
    return false;
  }
  
  try {
    const leaderboards = await sdk.getLeaderboards();
    await leaderboards.setLeaderboardScore('highscore', score);
    return true;
  } catch (error) {
    console.error('Failed to submit high score:', error);
    return false;
  }
}

// Show fullscreen ad
export async function showFullscreenAd(): Promise<boolean> {
  const sdk = getSDK();
  
  if (!sdk) {
    return false;
  }
  
  return new Promise((resolve) => {
    sdk.adv.showFullscreenAdv({
      onOpen: () => {
        console.log('Ad opened');
      },
      onClose: (wasShown) => {
        console.log('Ad closed, was shown:', wasShown);
        resolve(wasShown);
      },
      onError: (error) => {
        console.error('Ad error:', error);
        resolve(false);
      }
    });
  });
}

// Show rewarded video ad
export async function showRewardedAd(): Promise<boolean> {
  const sdk = getSDK();
  
  if (!sdk) {
    return false;
  }
  
  return new Promise((resolve) => {
    sdk.adv.showRewardedVideo({
      onOpen: () => {
        console.log('Rewarded ad opened');
      },
      onRewarded: () => {
        console.log('Reward granted');
        resolve(true);
      },
      onClose: () => {
        console.log('Rewarded ad closed');
        resolve(false);
      },
      onError: (error) => {
        console.error('Rewarded ad error:', error);
        resolve(false);
      }
    });
  });
}

// Track game event
export function trackEvent(eventName: string, params?: Record<string, unknown>): void {
  const sdk = getSDK();
  
  if (sdk) {
    sdk.analytics.goal(eventName, params);
  }
  
  // Always log to console in development
  console.log('Event:', eventName, params);
}

// Request user review
export async function requestReview(): Promise<boolean> {
  const sdk = getSDK();
  
  if (!sdk) {
    return false;
  }
  
  try {
    const { value: canReview } = await sdk.feedback.canReview();
    
    if (canReview) {
      const { feedbackSent } = await sdk.feedback.requestReview();
      return feedbackSent;
    }
    
    return false;
  } catch (error) {
    console.error('Failed to request review:', error);
    return false;
  }
}

// Get device type
export function getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
  const sdk = getSDK();
  
  if (sdk) {
    return sdk.deviceInfo.type;
  }
  
  // Fallback detection
  if (typeof window === 'undefined') return 'desktop';
  
  const ua = navigator.userAgent;
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|iphone|ipod|android.*mobile/i.test(ua)) return 'mobile';
  return 'desktop';
}

// Check if running in Yandex Games
export function isYandexGamesEnvironment(): boolean {
  return typeof window !== 'undefined' && 'YaGames' in window;
}

const yandexSDK = {
  initYandexSDK,
  getSDK,
  saveGameProgress,
  loadGameProgress,
  submitHighScore,
  showFullscreenAd,
  showRewardedAd,
  trackEvent,
  requestReview,
  getDeviceType,
  isYandexGamesEnvironment
};

export default yandexSDK;
