import { useState, useEffect } from 'react';
import { Dimensions, ScaledSize } from 'react-native';

export function useOrientation() {
  const [dims, setDims] = useState(Dimensions.get('window'));

  useEffect(() => {
    const sub = Dimensions.addEventListener('change', ({ window }: { window: ScaledSize }) => {
      setDims(window);
    });
    return () => sub.remove();
  }, []);

  return {
    isLandscape: dims.width > dims.height,
    width: dims.width,
    height: dims.height,
  };
}
