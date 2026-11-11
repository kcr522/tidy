import type { LockKind } from '../../lib/appLock'
import PasswordPad from './PasswordPad'
import PinPad from './PinPad'

interface SecretPadProps {
  kind: LockKind
  title: string
  subtitle?: string
  error?: string
  disabled?: boolean
  mode?: 'current' | 'new'
  onComplete: (secret: string) => void
}

/** 잠금 방식에 맞춰 숫자 4자리 패드 또는 비밀번호 칸을 보여 준다 */
export default function SecretPad({ kind, mode, ...props }: SecretPadProps) {
  return kind === 'password' ? <PasswordPad mode={mode} {...props} /> : <PinPad {...props} />
}
