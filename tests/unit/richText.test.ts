// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fromEditorHtml, htmlToText, isPlainHtml, sanitizeHtml, sharedMemoBody, textToHtml, toEditorHtml } from '../../src/lib/richText'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
const MIN_PHOTO_WIDTH = '15%'

describe('메모 꾸민 글', () => {
  it('허용한 꾸밈만 남기고 스크립트 · 이벤트 속성 · 위험한 링크 · position 은 버린다', () => {
    const dirty = '<b>굵게</b><script>alert(1)</script><span style="background-color: rgb(255, 241, 118); position: fixed" onclick="x()">형광펜</span><a href="javascript:x">링크</a><u>밑줄</u><s>줄</s>'

    expect(sanitizeHtml(dirty)).toBe('<b>굵게</b><span style="background-color:rgb(255, 241, 118)">형광펜</span>링크<u>밑줄</u><s>줄</s>')
  })

  it('글머리 기호 · 번호 · 빈 줄을 글자로 바꾼다 (검색 · 미리보기용)', () => {
    const html = '<div>장보기</div><ul><li>우유</li><li><b>빵</b></li></ul><ol><li>하나</li><li>둘</li></ol><div><br></div><div>끝</div>'

    expect(htmlToText(html)).toBe('장보기\n• 우유\n• 빵\n1. 하나\n2. 둘\n\n끝')
  })

  it('옛 메모 글은 줄마다 div 로 나누고 < > 는 이스케이프해서 연다', () => {
    expect(textToHtml('첫 줄\n\n<셋째>')).toBe('<div>첫 줄</div><div><br></div><div>&lt;셋째&gt;</div>')
  })

  it('글 → html → 글로 돌리면 처음 글과 같다', () => {
    const text = '첫 줄\n\n셋째'

    expect(htmlToText(textToHtml(text))).toBe(text)
  })

  it('사진은 html 밖(pics)으로 빼서 저장하고, src 없는 사진 자리는 뺀다', () => {
    const editor = `<div>사진 <img data-pic="p1" src="${PNG}" style="width: 50%"></div><img data-pic="p2">`

    const { html, pics } = fromEditorHtml(editor)

    expect(html).toBe('<div>사진 <img data-pic="p1" alt="" style="width:50%"></div>')
    expect(pics).toEqual([{ id: 'p1', src: PNG }])
  })

  it('열 때 pics 의 사진을 다시 채우고, 사진이 없어졌으면 그 자리도 뺀다', () => {
    const html = '<div>사진 <img data-pic="p1" alt="" style="width:50%"></div>'

    expect(toEditorHtml(html, '', [{ id: 'p1', src: PNG }])).toContain(`src="${PNG}"`)
    expect(toEditorHtml(html, '', [])).toBe('<div>사진 </div>')
  })

  it('사진 너비가 15% 보다 작으면 15% 로 올린다', () => {
    expect(fromEditorHtml(`<img data-pic="a" src="${PNG}" style="width:5%">`).html).toContain(`width:${MIN_PHOTO_WIDTH}`)
  })

  it('사진 너비가 % 가 아니면(300px) 너비를 지운다', () => {
    expect(fromEditorHtml(`<img data-pic="a" src="${PNG}" style="width:300px">`).html).not.toContain('width')
  })

  it.each([
    ['줄과 빈 줄만', '<div>그냥 글</div><div><br></div>', true],
    ['밑줄', '<div><u>밑줄</u></div>', false],
    ['글머리 목록', '<ul><li>a</li></ul>', false],
  ])('%s 있는 html 은 꾸밈 없는 글인가: $2', (_case, html, isPlain) => {
    expect(isPlainHtml(html)).toBe(isPlain)
  })
})

describe('공유 → Tidy 메모', () => {
  it('글만 오면 \\r\\n 을 \\n 으로 바꾼 그냥 글 메모가 된다', () => {
    expect(sharedMemoBody('회의 메모\r\n- 예산', [])).toEqual({ text: '회의 메모\n- 예산', pics: [] })
  })

  it('사진이 오면 글 아래에 꽉 찬 너비로 사진을 넣고, 다시 열어도 사진이 그대로다', () => {
    let count = 0
    const nextId = () => `s${++count}`

    const body = sharedMemoBody('사진 두 장', [PNG, PNG], nextId)

    expect(body.pics.map((pic) => pic.id)).toEqual(['s1', 's2'])
    expect(body.html).toBe('<div>사진 두 장</div><div><img data-pic="s1" alt="" style="width:100%"></div><div><img data-pic="s2" alt="" style="width:100%"></div>')
    expect(fromEditorHtml(toEditorHtml(body.html, body.text, body.pics)).pics).toHaveLength(2)
  })
})
