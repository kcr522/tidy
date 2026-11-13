import { useEffect, useState } from 'react'

/** Blob(사진·영상)을 <img>/<video>에 넣을 주소로. 화면에서 사라지면 정리한다 */
export function useBlobUrl(blob: Blob | undefined | null): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) {
      setUrl(undefined)
      return
    }
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}
