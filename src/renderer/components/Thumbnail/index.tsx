import React, { useState, useEffect } from 'react';
import s from './index.module.css';

interface Props {
  filePath: string;
}

export default function Thumbnail({ filePath }: Props) {
  const [src, setSrc] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.cham.readImage(filePath).then((result) => {
      if (!cancelled && result.success && result.dataUrl) {
        setSrc(result.dataUrl);
      } else if (!cancelled) {
        setError(true);
      }
    });
    return () => { cancelled = true; };
  }, [filePath]);

  if (error || !src) {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    return <span className={s.placeholder}>{ext}</span>;
  }
  return <img className={s.thumb} src={src} alt="" />;
}
