import JSZip from 'jszip'

export interface EpubChapter {
  id: string
  href: string
  title: string
  html: string
  text: string
}

export interface EpubBook {
  title: string
  chapters: EpubChapter[]
}

function resolveHref(base: string, href: string): string {
  if (!base) return href
  const baseParts = base.split('/')
  baseParts.pop()
  const stack = baseParts
  for (const part of href.split('/')) {
    if (part === '..') stack.pop()
    else if (part !== '.') stack.push(part)
  }
  return stack.join('/')
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script, style').forEach((n) => n.remove())
  return (doc.body?.textContent ?? '').replace(/\s+/g, ' ').trim()
}

function chapterTitle(html: string, fallback: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const h = doc.querySelector('h1, h2, h3, title')
  const t = h?.textContent?.trim()
  return t && t.length < 120 ? t : fallback
}

export async function loadEpub(url: string): Promise<EpubBook> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load EPUB: ${res.status}`)
  const zip = await JSZip.loadAsync(await res.arrayBuffer())

  const containerXml = await zip.file('META-INF/container.xml')?.async('text')
  if (!containerXml) throw new Error('Invalid EPUB: no container.xml')

  const rootHref =
    /full-path="([^"]+)"/.exec(containerXml)?.[1] ??
    (() => {
      throw new Error('Invalid EPUB: no rootfile')
    })()

  const opfText = await zip.file(rootHref)?.async('text')
  if (!opfText) throw new Error('Invalid EPUB: missing OPF')

  const opfDoc = new DOMParser().parseFromString(opfText, 'application/xml')
  const title =
    opfDoc.querySelector('title')?.textContent?.trim() ||
    opfDoc.getElementsByTagName('dc:title')[0]?.textContent?.trim() ||
    'Untitled'

  const manifest = new Map<string, { href: string; type: string }>()
  opfDoc.querySelectorAll('manifest > item').forEach((item) => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    const type = item.getAttribute('media-type') ?? ''
    if (id && href) manifest.set(id, { href, type })
  })

  const spineIds = [...opfDoc.querySelectorAll('spine > itemref')]
    .map((n) => n.getAttribute('idref'))
    .filter((id): id is string => Boolean(id))

  const chapters: EpubChapter[] = []
  let index = 0
  for (const id of spineIds) {
    const item = manifest.get(id)
    if (!item) continue
    if (!item.type.includes('html') && !item.href.endsWith('.xhtml') && !item.href.endsWith('.html')) {
      continue
    }
    const path = resolveHref(rootHref, item.href)
    const html = await zip.file(path)?.async('text')
    if (!html) continue
    const text = stripHtml(html)
    if (text.length < 40) continue
    index += 1
    chapters.push({
      id,
      href: path,
      title: chapterTitle(html, `Section ${index}`),
      html,
      text,
    })
  }

  if (!chapters.length) throw new Error('EPUB had no readable chapters')
  return { title, chapters }
}

/** Paginate plain text into page-sized chunks by character budget. */
export function paginateText(text: string, charsPerPage = 1400): string[] {
  const paragraphs = text.split(/(?<=\.)\s+/).filter(Boolean)
  const pages: string[] = []
  let buf = ''
  for (const p of paragraphs) {
    if ((buf + ' ' + p).length > charsPerPage && buf) {
      pages.push(buf.trim())
      buf = p
    } else {
      buf = buf ? `${buf} ${p}` : p
    }
  }
  if (buf.trim()) pages.push(buf.trim())
  return pages.length ? pages : [text]
}
