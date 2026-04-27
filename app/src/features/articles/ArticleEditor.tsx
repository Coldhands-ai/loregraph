import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import Typography from '@tiptap/extension-typography'
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Link as LinkIcon,
  Minus,
} from 'lucide-react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import type { Json } from '@/lib/database.types'

interface ArticleEditorProps {
  content: Json | null
  onChange: (json: Json) => void
}

export function ArticleEditor({ content, onChange }: ArticleEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({
        placeholder: 'Начни писать… Что случилось в этом мире?',
      }),
      Typography,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
    ],
    content: isValidContent(content) ? content : '',
    onUpdate({ editor }) {
      onChange(editor.getJSON() as Json)
    },
    editorProps: {
      attributes: { class: 'tiptap prose-invert max-w-none' },
    },
  })

  // Externally-driven content updates (e.g. switching between articles)
  useEffect(() => {
    if (!editor) return
    const current = JSON.stringify(editor.getJSON())
    const incoming = JSON.stringify(content ?? '')
    if (current !== incoming && isValidContent(content)) {
      editor.commands.setContent(content, false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content])

  if (!editor) return null

  return (
    <div className="rounded-lg border border-border bg-bg-surface/40">
      <Toolbar editor={editor} />
      <div className="p-6 min-h-[480px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

function isValidContent(c: unknown): c is object | string {
  if (!c) return false
  if (typeof c === 'string') return true
  if (typeof c === 'object' && c !== null && 'type' in c) return true
  return false
}

interface ToolbarProps {
  editor: NonNullable<ReturnType<typeof useEditor>>
}

function Toolbar({ editor }: ToolbarProps) {
  const items: { icon: React.ReactNode; cmd: () => void; active?: boolean; label: string }[] = [
    {
      icon: <Heading1 className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      active: editor.isActive('heading', { level: 1 }),
      label: 'Заголовок 1',
    },
    {
      icon: <Heading2 className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      active: editor.isActive('heading', { level: 2 }),
      label: 'Заголовок 2',
    },
    {
      icon: <Heading3 className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      active: editor.isActive('heading', { level: 3 }),
      label: 'Заголовок 3',
    },
    {
      icon: <Bold className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleBold().run(),
      active: editor.isActive('bold'),
      label: 'Жирный',
    },
    {
      icon: <Italic className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleItalic().run(),
      active: editor.isActive('italic'),
      label: 'Курсив',
    },
    {
      icon: <Strikethrough className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleStrike().run(),
      active: editor.isActive('strike'),
      label: 'Зачёркнутый',
    },
    {
      icon: <Code className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleCode().run(),
      active: editor.isActive('code'),
      label: 'Код',
    },
    {
      icon: <List className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleBulletList().run(),
      active: editor.isActive('bulletList'),
      label: 'Маркированный список',
    },
    {
      icon: <ListOrdered className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleOrderedList().run(),
      active: editor.isActive('orderedList'),
      label: 'Нумерованный список',
    },
    {
      icon: <Quote className="h-4 w-4" />,
      cmd: () => editor.chain().focus().toggleBlockquote().run(),
      active: editor.isActive('blockquote'),
      label: 'Цитата',
    },
    {
      icon: <Minus className="h-4 w-4" />,
      cmd: () => editor.chain().focus().setHorizontalRule().run(),
      label: 'Разделитель',
    },
    {
      icon: <LinkIcon className="h-4 w-4" />,
      cmd: () => {
        const previous = editor.getAttributes('link').href as string | undefined
        const url = window.prompt('URL ссылки', previous ?? 'https://')
        if (url === null) return
        if (url === '') {
          editor.chain().focus().extendMarkRange('link').unsetLink().run()
          return
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
      },
      active: editor.isActive('link'),
      label: 'Ссылка',
    },
  ]

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border bg-bg-surface/60 sticky top-14 z-10 backdrop-blur">
      {items.map((it, i) => (
        <ToolbarButton key={i} {...it} />
      ))}
      <div className="mx-1 h-6 w-px bg-border" />
      <ToolbarButton
        icon={<Undo className="h-4 w-4" />}
        cmd={() => editor.chain().focus().undo().run()}
        label="Отменить"
      />
      <ToolbarButton
        icon={<Redo className="h-4 w-4" />}
        cmd={() => editor.chain().focus().redo().run()}
        label="Повторить"
      />
    </div>
  )
}

function ToolbarButton({
  icon,
  cmd,
  active,
  label,
}: {
  icon: React.ReactNode
  cmd: () => void
  active?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={cmd}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        'h-8 w-8 inline-flex items-center justify-center rounded-sm transition-colors focus-ring',
        active
          ? 'bg-brand-gradient text-white'
          : 'text-text-muted hover:bg-bg-surface2 hover:text-text',
      )}
    >
      {icon}
    </button>
  )
}
