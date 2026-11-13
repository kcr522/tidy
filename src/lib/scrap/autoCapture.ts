// 스크랩 사이트 화면 자동 캡처: Tidy 서버가 무료 캡처 서비스로 찍어 준다 (AI 가 아니라 서버가 찍는다)
import { fetchSiteShot } from './pageApi'

/** 이 링크의 사이트 화면 사진. 저장은 사용자가 보고 "그냥 올리기"나 "편집"을 고른 뒤에 한다. 실패하면 에러 */
export function autoCaptureShot(url: string): Promise<Blob> {
  return fetchSiteShot(url, AbortSignal.timeout(50000))
}
