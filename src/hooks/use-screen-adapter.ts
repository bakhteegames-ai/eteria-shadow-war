'use client';

import { useState, useEffect, useCallback } from 'react';

export interface ScreenInfo {
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'portrait' | 'landscape';
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isSmall: boolean;        // < 640px
  isMedium: boolean;       // 640-1024px
  isLarge: boolean;        // > 1024px
  isUltraWide: boolean;    // aspect ratio > 2
  isNotch: boolean;        // has notch/Dynamic Island
  safeAreaTop: number;
  safeAreaBottom: number;
  safeAreaLeft: number;
  safeAreaRight: number;
}

interface ScreenAdapterConfig {
  // Camera settings for different screen sizes
  camera: {
    orthoHeight: number;
    distance: number;
    fov: number;
  };
  // UI scale factor
  uiScale: number;
  // Minimap size
  minimapSize: number;
  // Button sizes
  buttonSize: number;
  // Font sizes
  fontSize: {
    small: number;
    medium: number;
    large: number;
  };
}

const DEFAULT_SCREEN_INFO: ScreenInfo = {
  width: 1920,
  height: 1080,
  aspectRatio: 16 / 9,
  orientation: 'landscape',
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isSmall: false,
  isMedium: false,
  isLarge: true,
  isUltraWide: false,
  isNotch: false,
  safeAreaTop: 0,
  safeAreaBottom: 0,
  safeAreaLeft: 0,
  safeAreaRight: 0,
};

// Get initial screen info (called once at module load)
function getInitialScreenInfo(): ScreenInfo {
  if (typeof window === 'undefined') return DEFAULT_SCREEN_INFO;
  
  const width = window.innerWidth;
  const height = window.innerHeight;
  const aspectRatio = width / height;
  const orientation = width > height ? 'landscape' : 'portrait';
  const isMobile = width < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const isTablet = width >= 768 && width < 1024 && /iPad|Android/i.test(navigator.userAgent);
  const isDesktop = width >= 1024 && !isMobile;
  const isSmall = width < 640;
  const isMedium = width >= 640 && width < 1024;
  const isLarge = width >= 1024;
  const isUltraWide = aspectRatio > 2;
  
  return {
    width,
    height,
    aspectRatio,
    orientation,
    isMobile,
    isTablet,
    isDesktop,
    isSmall,
    isMedium,
    isLarge,
    isUltraWide,
    isNotch: false,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    safeAreaLeft: 0,
    safeAreaRight: 0,
  };
}

export function useScreenAdapter(): ScreenInfo & { getConfig: () => ScreenAdapterConfig } {
  const [screenInfo, setScreenInfo] = useState<ScreenInfo>(getInitialScreenInfo);

  const updateScreenInfo = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    const aspectRatio = width / height;
    const orientation = width > height ? 'landscape' : 'portrait';
    
    // Device detection
    const isMobile = width < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isTablet = width >= 768 && width < 1024 && /iPad|Android/i.test(navigator.userAgent);
    const isDesktop = width >= 1024 && !isMobile;
    
    // Size categories
    const isSmall = width < 640;
    const isMedium = width >= 640 && width < 1024;
    const isLarge = width >= 1024;
    
    // Ultra-wide detection
    const isUltraWide = aspectRatio > 2;
    
    // Safe area detection (for notched devices)
    const computedStyle = getComputedStyle(document.documentElement);
    const safeAreaTop = parseInt(computedStyle.getPropertyValue('--sat') || computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0');
    const safeAreaBottom = parseInt(computedStyle.getPropertyValue('--sab') || computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0');
    const safeAreaLeft = parseInt(computedStyle.getPropertyValue('--sal') || computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0');
    const safeAreaRight = parseInt(computedStyle.getPropertyValue('--sar') || computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0');
    
    const isNotch = safeAreaTop > 20 || safeAreaBottom > 20;

    // Use requestAnimationFrame to defer setState
    requestAnimationFrame(() => {
      setScreenInfo({
        width,
        height,
        aspectRatio,
        orientation,
        isMobile,
        isTablet,
        isDesktop,
        isSmall,
        isMedium,
        isLarge,
        isUltraWide,
        isNotch,
        safeAreaTop,
        safeAreaBottom,
        safeAreaLeft,
        safeAreaRight,
      });
    });
  }, []);

  useEffect(() => {
    // Initial update is deferred
    const frameId = requestAnimationFrame(updateScreenInfo);

    // Listen for resize and orientation change
    window.addEventListener('resize', updateScreenInfo);
    window.addEventListener('orientationchange', updateScreenInfo);
    
    // Also update on visual viewport changes (keyboard open/close)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateScreenInfo);
    }

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateScreenInfo);
      window.removeEventListener('orientationchange', updateScreenInfo);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateScreenInfo);
      }
    };
  }, [updateScreenInfo]);

  // Get configuration based on screen info
  const getConfig = useCallback((): ScreenAdapterConfig => {
    const { width, height, aspectRatio, orientation, isMobile, isSmall } = screenInfo;
    
    // Camera settings - adjust for different aspect ratios
    let camera: ScreenAdapterConfig['camera'];
    
    if (aspectRatio > 2) {
      // Ultra-wide (21:9, 32:9) - show more horizontally
      camera = {
        orthoHeight: 25,
        distance: 35,
        fov: 50
      };
    } else if (aspectRatio > 1.7) {
      // Standard 16:9
      camera = {
        orthoHeight: 25,
        distance: 35,
        fov: 60
      };
    } else if (aspectRatio > 1.3) {
      // 4:3 or similar
      camera = {
        orthoHeight: 30,
        distance: 40,
        fov: 55
      };
    } else {
      // Portrait or square
      camera = {
        orthoHeight: orientation === 'portrait' ? 20 : 25,
        distance: orientation === 'portrait' ? 30 : 35,
        fov: 50
      };
    }
    
    // Scale adjustments for small screens
    if (isSmall) {
      camera.orthoHeight *= 0.8;
      camera.distance *= 0.9;
    }
    
    // UI scale
    const uiScale = isMobile ? (isSmall ? 0.85 : 1) : (width > 1920 ? 1.2 : 1);
    
    // Minimap size
    const minimapSize = isMobile 
      ? Math.min(120, width * 0.25)
      : Math.min(160, width * 0.12);
    
    // Button size (min 44px for touch)
    const buttonSize = isMobile ? 48 : (isSmall ? 44 : 56);
    
    // Font sizes
    const fontSize = isMobile
      ? { small: 10, medium: 12, large: 14 }
      : isSmall
        ? { small: 11, medium: 13, large: 15 }
        : { small: 12, medium: 14, large: 16 };

    return {
      camera,
      uiScale,
      minimapSize,
      buttonSize,
      fontSize
    };
  }, [screenInfo]);

  return { ...screenInfo, getConfig };
}

// CSS custom properties for safe areas
export function injectSafeAreaCSS() {
  if (typeof document === 'undefined') return;
  
  const style = document.createElement('style');
  style.textContent = `
    :root {
      --sat: env(safe-area-inset-top);
      --sab: env(safe-area-inset-bottom);
      --sal: env(safe-area-inset-left);
      --sar: env(safe-area-inset-right);
    }
    
    /* Ensure full height on mobile */
    html, body {
      height: 100%;
      overflow: hidden;
    }
    
    /* Safe area padding utilities */
    .safe-top { padding-top: env(safe-area-inset-top); }
    .safe-bottom { padding-bottom: env(safe-area-inset-bottom); }
    .safe-left { padding-left: env(safe-area-inset-left); }
    .safe-right { padding-right: env(safe-area-inset-right); }
    .safe-all {
      padding-top: env(safe-area-inset-top);
      padding-bottom: env(safe-area-inset-bottom);
      padding-left: env(safe-area-inset-left);
      padding-right: env(safe-area-inset-right);
    }
    
    /* Prevent overscroll on iOS */
    body {
      overscroll-behavior: none;
      -webkit-overflow-scrolling: touch;
    }
  `;
  document.head.appendChild(style);
}

export default useScreenAdapter;
