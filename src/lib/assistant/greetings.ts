// AI 대화창을 열 때 첫인사: 시간대마다 여러 개 중 하나를 고른다

const MORNING = ['좋은 아침이에요! 오늘도 즐거운 하루 보내세요 ☀️', '안녕하세요! 상쾌한 아침이에요. 오늘 계획 같이 정리해 볼까요? 🌱', '굿모닝이에요! 오늘 하루도 응원할게요 💪']
const DAY = ['안녕하세요! 오늘도 즐거운 하루 보내세요 😊', '반가워요! 점심은 맛있게 드셨어요? 🍱', '안녕하세요! 오후도 힘내요. 제가 정리는 도와드릴게요 ✨']
const EVENING = ['안녕하세요! 오늘 하루 수고 많으셨어요 🌇', '좋은 저녁이에요! 오늘은 어떤 하루였어요? 🍵', '퇴근길인가요? 오늘 있었던 일, 편하게 말해 주세요 🚌']
const NIGHT = ['아직 안 주무셨네요! 오늘 하루도 고생 많으셨어요 🌙', '늦은 밤이에요. 오늘 일은 정리해 두고 푹 쉬어요 💤', '안녕하세요! 조용한 밤이네요. 오늘 하루를 같이 돌아볼까요? ⭐']

export function greeting(now: Date = new Date(), random: () => number = Math.random): string {
  const h = now.getHours()
  const list = h >= 5 && h < 11 ? MORNING : h < 17 && h >= 11 ? DAY : h >= 17 && h < 22 ? EVENING : NIGHT
  return list[Math.floor(random() * list.length) % list.length]
}

export const HELP = '포스터·공지 사진은 캘린더에, 결제 내역 캡처는 가계부에 넣어 드려요. 오늘 있었던 일을 말해 주시면 일기로 남겨 드릴게요.'
