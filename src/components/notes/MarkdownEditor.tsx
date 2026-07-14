import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'

const theme = EditorView.theme({
  '&': { background: 'transparent', color: '#111827' },
  '.cm-editor': { background: 'transparent' },
  '.cm-scroller': { fontFamily: 'inherit', lineHeight: '1.7' },
  '.cm-content': { caretColor: '#111827', padding: '8px 0' },
  '.cm-line': { padding: '0 4px' },
  '.cm-cursor': { borderLeftColor: '#111827' },
  '.cm-activeLine': { background: 'rgba(0,0,0,0.03)' },
  '&.cm-focused': { outline: 'none' },
  '.cm-selectionBackground, ::selection': { background: 'rgba(0,0,0,0.08) !important' },
})

interface Props {
  value: string
  onChange: (value: string) => void
  pendingCursorRef: React.MutableRefObject<number | null>
}

export default function MarkdownEditor({ value, onChange, pendingCursorRef }: Props) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      onCreateEditor={view => {
        const pos = pendingCursorRef.current
        if (pos !== null) {
          const clamped = Math.max(0, Math.min(pos, view.state.doc.length))
          view.dispatch({ selection: EditorSelection.cursor(clamped), scrollIntoView: true })
          view.focus()
          pendingCursorRef.current = null
        }
      }}
      extensions={[markdown(), theme]}
      placeholder="Claude 채팅 내용 붙여넣기 또는 마크다운으로 작성하세요..."
      basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: true, searchKeymap: false, completionKeymap: false }}
      style={{ fontSize: '14px', minHeight: '100%' }}
    />
  )
}
