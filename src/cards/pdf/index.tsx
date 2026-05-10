import { useState, useCallback } from 'react'

interface PdfFile {
  name: string
  path: string
}

export default function PdfCard() {
  const [files, setFiles] = useState<PdfFile[]>([])
  const [selected, setSelected] = useState<PdfFile | null>(null)
  const [dragging, setDragging] = useState(false)

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith('.pdf'))
    if (dropped.length === 0) return
    const newFiles = dropped.map(f => ({ name: f.name, path: URL.createObjectURL(f) }))
    setFiles(prev => {
      const next = [...prev, ...newFiles]
      if (!selected) setSelected(newFiles[0])
      return next
    })
  }, [selected])

  return (
    <div className="flex h-full gap-2">
      <div className="flex flex-col w-40 flex-shrink-0 gap-2">
        <div
          onDrop={onDrop}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          className={`flex-shrink-0 border-2 border-dashed rounded-lg p-2 text-center text-xs transition-colors ${
            dragging ? 'border-accent text-accent' : 'border-surface-border text-gray-500'
          }`}
        >
          PDF 드래그 앤 드롭
        </div>
        <div className="flex-1 overflow-y-auto space-y-1">
          {files.length === 0 && (
            <p className="text-xs text-gray-600 text-center mt-2">파일이 없습니다</p>
          )}
          {files.map((f, i) => (
            <button
              key={i}
              onClick={() => setSelected(f)}
              className={`w-full text-left text-xs px-2 py-1.5 rounded truncate transition-colors ${
                selected?.name === f.name
                  ? 'bg-accent/20 text-accent'
                  : 'text-gray-400 hover:bg-surface-hover hover:text-gray-200'
              }`}
            >
              📄 {f.name}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 bg-surface-hover rounded-lg overflow-hidden flex items-center justify-center">
        {selected ? (
          <iframe
            src={selected.path}
            className="w-full h-full border-0"
            title={selected.name}
          />
        ) : (
          <p className="text-gray-600 text-sm">PDF를 선택하거나 드래그하세요</p>
        )}
      </div>
    </div>
  )
}
