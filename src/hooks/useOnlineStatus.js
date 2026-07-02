import { useEffect, useState } from 'react'

export function isAppOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export default function useOnlineStatus() {
  const [online, setOnline] = useState(() => !isAppOffline())

  useEffect(() => {
    function updateStatus() {
      setOnline(!isAppOffline())
    }

    window.addEventListener('online', updateStatus)
    window.addEventListener('offline', updateStatus)
    updateStatus()

    return () => {
      window.removeEventListener('online', updateStatus)
      window.removeEventListener('offline', updateStatus)
    }
  }, [])

  return online
}
