## 6
| 2026-11-27 | #? | 보안 | 보안 점검과 강화: AI 하루 횟수를 앱이 못 고치게(Firestore 규칙 aiUsage 읽기만 + 서버는 서비스 계정으로 셈, 못 세면 AI 안 부름), AI 허용 메일은 인증된 메일만, 스크랩 미리보기 서버가 DNS 로 찾은 실제 IP 까지 확인(SSRF), 웹 CSP · HSTS 2년, 배포 APK 디버그 모드 끄기(USB 로 기록 꺼내기 · chrome://inspect 막음), 규칙 확인 `npm run test:rules`, 점검 결과 docs/보안-점검.md | 검토 중 |

## 4-7
| 보안 강화 | AI 횟수 고치기 막기, SSRF 막기, 웹 CSP, APK 디버그 끄기, Firestore 규칙 에뮬레이터 확인 ([docs/보안-점검.md](보안-점검.md)) | 🧪 | #? |

## 5-2
| 보안 강화 (디버그 끈 APK · CSP) | #? | 새 APK 가 지우지 않고 덮어 깔리는지, 웹에서 구글 로그인 · 글꼴 바꾸기 · 인스타 퍼가기가 CSP 뒤에서도 되는지 |

## 5-3
| 보안: 직접 할 일 | Firebase 콘솔에 새 Firestore 규칙 게시, Authentication 에서 아무나 가입 끄기, USB · Mac 의 관리자 JSON 지우기 ([docs/보안-점검.md](보안-점검.md) 4번) |
