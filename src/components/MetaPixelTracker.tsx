import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackMetaPageView } from '../utils/metaPixel';

/** Fires PageView on SPA navigations (initial load is handled by the base pixel in index.html). */
export function MetaPixelTracker() {
  const location = useLocation();
  const isFirstLoad = useRef(true);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    trackMetaPageView();
  }, [location.pathname, location.search]);

  return null;
}
