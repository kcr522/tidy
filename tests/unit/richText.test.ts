// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fromEditorHtml, htmlToText, isPlainHtml, sanitizeHtml, textToHtml, toEditorHtml } from '../../src/lib/richText'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('메모 꾸민 글', () => {
  it('허용한 꾸밈만 남기고 스크립트 · 이상한 속성은 버린다', () => {
    const html = sanitizeHtml(
      '<b>굵게</b><script>alert(1)</script><span style="background-color: rgb(255, 241, 118); position: fixed" onclick="x()">형광펜</span><a href="javascript:x">링크</a><u>밑줄</u><s>줄</s>',
    )
    expect(html).toBe('<b>굵게</b><span style="background-color:rgb(255, 241, 118)">형광펜</span>링크<u>밑줄</u><s>줄</s>')
  })

  it('글머리 기호 · 번호 · 줄바꿈을 글자로 바꾼다 (검색 · 미리보기용)', () => {
    expect(htmlToText('<div>장보기</div><ul><li>우유</li><li><b>빵</b></li></ul><ol><li>하나</li><li>둘</li></ol><div><br></div><div>끝</div>')).toBe('장보기\n• 우유\n• 빵\n1. 하나\n2. 둘\n\n끝')
  })

  it('옛 메모 글은 줄마다 나눠서 연다', () => {
    expect(textToHtml('첫 줄\n\n<셋째>')).toBe('<div>첫 줄</div><div><br></div><div>&lt;셋째&gt;</div>')
    expect(htmlToText(textToHtml('첫 줄\n\n셋째'))).toBe('첫 줄\n\n셋째')
  })

  it('사진은 html 밖(pics)으로 빼서 저장하고, 열 때 다시 채운다', () => {
    const editor = `<div>사진 <img data-pic="p1" src="${PNG}" style="width: 50%"></div><img data-pic="p2">`
    const { html, pics } = fromEditorHtml(editor)
    expect(html).toBe('<div>사진 <img data-pic="p1" alt="" style="width:50%"></div>')
    expect(pics).toEqual([{ id: 'p1', src: PNG }])
    expect(toEditorHtml(html, '', pics)).toContain(`src="${PNG}"`)
    // 사진이 없어졌으면 그 자리도 뺀다
    expect(toEditorHtml(html, '', [])).toBe('<div>사진 </div>')
  })

  it('사진 크기는 15~100% 로', () => {
    expect(fromEditorHtml(`<img data-pic="a" src="${PNG}" style="width:5%">`).html).toContain('width:15%')
    expect(fromEditorHtml(`<img data-pic="a" src="${PNG}" style="width:300px">`).html).not.toContain('width')
  })

  it('꾸밈이 없으면 그냥 글로 저장한다', () => {
    expect(isPlainHtml('<div>그냥 글</div><div><br></div>')).toBe(true)
    expect(isPlainHtml('<div><u>밑줄</u></div>')).toBe(false)
    expect(isPlainHtml('<ul><li>a</li></ul>')).toBe(false)
  })
})
