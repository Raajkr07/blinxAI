import React, { useState, useEffect } from 'react';

const NetworkStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm font-medium animate-pulse">
      You are currently offline. Retrying...
    </div>
  );
};

export default NetworkStatus;
