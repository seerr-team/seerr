import { NProgress } from '@tanem/react-nprogress';
import { useRouter } from 'next/router';
import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';

interface BarProps {
  progress: number;
  isFinished: boolean;
}

const Bar = ({ progress, isFinished }: BarProps) => {
  return (
    <div
      className={`fixed top-0 left-0 z-50 w-full transition-opacity duration-400 ease-out ${
        isFinished ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div
        className="transition-width bg-indigo-400 duration-300"
        style={{
          height: '3px',
          width: `${progress * 100}%`,
        }}
      />
    </div>
  );
};

const NProgressBar = ({ loading }: { loading: boolean }) => (
  <NProgress isAnimating={loading}>
    {({ isFinished, progress }) => (
      <Bar progress={progress} isFinished={isFinished} />
    )}
  </NProgress>
);

const MemoizedNProgress = React.memo(NProgressBar);

const LoadingBar = (): React.ReactPortal | null => {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleLoading = () => {
      setLoading(true);
    };
    const handleFinishedLoading = () => {
      setLoading(false);
    };
    router.events.on('routeChangeStart', handleLoading);
    router.events.on('routeChangeComplete', handleFinishedLoading);
    router.events.on('routeChangeError', handleFinishedLoading);

    return () => {
      router.events.off('routeChangeStart', handleLoading);
      router.events.off('routeChangeComplete', handleFinishedLoading);
      router.events.off('routeChangeError', handleFinishedLoading);
    };
  }, [router]);

  return mounted
    ? ReactDOM.createPortal(
        <MemoizedNProgress loading={loading} />,
        document.body
      )
    : null;
};

export default LoadingBar;
