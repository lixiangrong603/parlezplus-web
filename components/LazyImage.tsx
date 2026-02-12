import React, { ImgHTMLAttributes, useEffect, useRef, useState } from 'react';

const DEFAULT_ROOT_MARGIN = '120px';

export const DEFAULT_AVATAR_FALLBACK = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%23cbd5e1'/%3E%3Cstop offset='1' stop-color='%2394a3b8'/%3E%3C/linearGradient%3E%3C/defs%3E%3Ccircle cx='32' cy='32' r='32' fill='url(%23g)'/%3E%3Ccircle cx='32' cy='24' r='11' fill='%23e2e8f0'/%3E%3Cpath d='M12 54c2.5-10 10.5-15 20-15s17.5 5 20 15' fill='%23e2e8f0'/%3E%3C/svg%3E";

interface LazyImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src?: string;
  fallbackSrc?: string;
  containerClassName?: string;
  skeletonClassName?: string;
  rootMargin?: string;
  threshold?: number;
}

const LazyImage: React.FC<LazyImageProps> = ({
  src,
  fallbackSrc,
  alt = '',
  className = '',
  containerClassName = '',
  skeletonClassName = '',
  rootMargin = DEFAULT_ROOT_MARGIN,
  threshold = 0.01,
  onLoad,
  onError,
  ...rest
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src || fallbackSrc);
  const [fallbackTried, setFallbackTried] = useState(false);
  const [isFailed, setIsFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src || fallbackSrc);
    setIsLoaded(false);
    setFallbackTried(false);
    setIsFailed(false);
  }, [src, fallbackSrc]);

  useEffect(() => {
    if (shouldLoad) return;

    if (!containerRef.current || typeof window === 'undefined') {
      setShouldLoad(true);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        });
      },
      { root: null, rootMargin, threshold }
    );

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [shouldLoad, rootMargin, threshold]);

  const handleLoad: React.ReactEventHandler<HTMLImageElement> = (event) => {
    setIsLoaded(true);
    onLoad?.(event);
  };

  const handleError: React.ReactEventHandler<HTMLImageElement> = (event) => {
    if (!fallbackTried && fallbackSrc && currentSrc !== fallbackSrc) {
      setFallbackTried(true);
      setCurrentSrc(fallbackSrc);
      setIsLoaded(false);
      return;
    }

    setIsFailed(true);
    onError?.(event);
  };

  const showSkeleton = !isLoaded;

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${containerClassName}`}>
      {showSkeleton && (
        <div className={`absolute inset-0 bg-slate-200/70 dark:bg-slate-700/60 animate-pulse ${skeletonClassName}`}>
          <div className="lazy-image-shimmer absolute inset-0" />
        </div>
      )}

      {shouldLoad && currentSrc && !isFailed && (
        <img
          {...rest}
          src={currentSrc}
          alt={alt}
          onLoad={handleLoad}
          onError={handleError}
          className={`${className} transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
    </div>
  );
};

export default LazyImage;
